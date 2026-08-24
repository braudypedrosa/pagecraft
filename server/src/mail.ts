/* Getting the link to the person.

   Until now a login link was logged to the console, which is fine for the person running the
   server and useless for everybody else. This sends it.

   ## Why SMTP

   Every provider speaks it — Resend, Postmark, SES, Fastmail, a WordPress host's mail server,
   the box in the corner. An HTTP API would mean picking one of them and writing that choice
   into the code, and there is no reason to. Credentials in the environment, and whoever runs
   this decides whose server carries the mail.

   ## Why nodemailer rather than writing it

   An SMTP client is a hundred lines and about six ways to be subtly wrong: STARTTLS
   negotiation, which AUTH mechanism the server actually offers, header encoding for a name
   with an accent in it, line-ending rules, timeouts that hang a request forever. This is one
   email; it is not worth becoming a mail client to send it.

   ## What the message says

   Short, and specific about what it is for. A login link that reads like marketing is a login
   link people learn to ignore, and one that asks for anything is teaching a habit worth not
   teaching. It says who it is from, what the link does, how long it lasts, and what to do if
   it was not asked for — nothing else, and no tracking of any kind. */
import { createTransport, type Transporter } from 'nodemailer';
import { LINK_TTL_MS, type LinkSender } from './auth.ts';

export interface MailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** the From address. A display name is allowed: `Pagecraft <hello@example.com>`. */
  from: string;
  /** what the message calls the thing being signed into */
  product?: string;
}

/** Read from the environment, or nothing if it is not configured. */
export function mailConfig(env: Record<string, string | undefined>): MailConfig | null {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, MAIL_PRODUCT } = env;
  /* A local sink usually wants no credentials at all, so an empty password is allowed there
     and nowhere else — the alternative is inventing a fake user and password to talk to a
     process on the same machine. */
  const local = isLoopback(SMTP_HOST || '');
  if (!SMTP_HOST || !MAIL_FROM) return null;
  if (!local && (!SMTP_USER || !SMTP_PASS)) return null;
  return {
    host: SMTP_HOST,
    /* 587 is submission with STARTTLS, which is what almost every provider wants. 465 is
       implicit TLS and is chosen by naming it. */
    port: Number(SMTP_PORT || 587),
    user: SMTP_USER || '',
    pass: SMTP_PASS || '',
    from: MAIL_FROM,
    product: MAIL_PRODUCT || 'Pagecraft'
  };
}

const minutes = Math.round(LINK_TTL_MS / 60000);

/** Is this a mail server on this machine? Loopback only — a name that merely looks local is
    still a name that resolves somewhere. */
export const isLoopback = (host: string) =>
  ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host).trim().toLowerCase());

export function linkMessage(url: string, product: string) {
  const subject = `Your ${product} sign-in link`;
  const text = [
    `Here is your link to sign in to ${product}:`,
    '',
    url,
    '',
    `It works once and expires in ${minutes} minutes.`,
    '',
    'If you did not ask to sign in, nothing has happened — you can ignore this email and',
    'the link will expire on its own.'
  ].join('\n');
  return { subject, text };
}

/**
 * A sender backed by SMTP.
 *
 * `transport` is injectable so the tests can watch what would be sent without sending it.
 * Nothing in the test suite talks to a mail server, which is not only about speed: a suite
 * that can send email is a suite that can email somebody by accident.
 */
export function smtpSender(cfg: MailConfig, transport?: Transporter): LinkSender {
  const tx = transport || createTransport({
    host: cfg.host,
    port: cfg.port,
    /* Implicit TLS on 465, STARTTLS everywhere else. `requireTLS` is what turns STARTTLS from
       an offer into a condition: without it, a server that declines the upgrade gets the
       password in plain text and nothing says so.

       Loopback is the exception, and it is a rule rather than a flag. A local mail sink —
       Mailpit, MailHog, the thing you run to see what an email looks like — speaks plain SMTP
       on 1025, and there is no wire to listen to between a process and itself. An
       `SMTP_ALLOW_PLAINTEXT` variable would do the same job and could be set on a real box by
       somebody in a hurry; a hostname cannot be. */
    secure: cfg.port === 465,
    requireTLS: cfg.port !== 465 && !isLoopback(cfg.host),
    auth: cfg.pass ? { user: cfg.user, pass: cfg.pass } : undefined
  });

  return async (to: string, url: string) => {
    const { subject, text } = linkMessage(url, cfg.product || 'Pagecraft');
    await tx.sendMail({ from: cfg.from, to, subject, text });
  };
}

/**
 * At most `max` links per address per window.
 *
 * This was optional while the link went to a console and is not now: an endpoint that answers
 * 200 to any address and sends an email each time is a way to have this server mail-bomb
 * somebody. The limit is per address rather than per caller, because the address is what
 * suffers.
 *
 * In memory on purpose. A rate limit is not a record — losing it on restart costs one extra
 * window, and putting it in Postgres would mean a write on every login attempt, including all
 * the ones that are the attack.
 */
export function throttle(max = 5, windowMs = 15 * 60 * 1000) {
  const hits = new Map<string, number[]>();
  return {
    /** true when this address may be sent another link. Records the attempt when it may. */
    take(key: string, now = Date.now()) {
      const recent = (hits.get(key) || []).filter(t => now - t < windowMs);
      if (recent.length >= max) { hits.set(key, recent); return false; }
      recent.push(now);
      hits.set(key, recent);
      /* Swept here rather than on a timer: the only thing that grows this map is traffic, and
         traffic is also what cleans it. A timer would be a second thing to get wrong. */
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
      }
      return true;
    },
    size: () => hits.size
  };
}
