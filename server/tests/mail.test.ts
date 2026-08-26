/* Sending the link, and not sending too many.

   Nothing here talks to a mail server. A test suite that can send email is a suite that can
   email somebody by accident, so the transport is injected and every case watches what would
   have been sent.

   The throttle is in this file rather than with auth because it only became necessary when
   sending became real: an endpoint that answers 200 to any address and emails it each time is
   a way to have this server mail-bomb a stranger. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { mailConfig, linkMessage, smtpSender, throttle, isLoopback } from '../src/mail.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { LINK_TTL_MS } from '../src/auth.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

/** A transport that records instead of connecting. */
const spy = () => {
  const sent: Record<string, unknown>[] = [];
  return {
    sent,
    tx: { sendMail: async (m: Record<string, unknown>) => { sent.push(m); return { messageId: 'x' }; } }
  };
};

/* ------------------------------------------------------------------ config */

test('mail is configured or it is not — there is no half', () => {
  const full = { SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'a@b.test' };
  a.ok(mailConfig(full));
  a.equal(mailConfig(full)!.port, 587, 'submission with STARTTLS, the usual case');
  a.equal(mailConfig({ ...full, SMTP_PORT: '465' })!.port, 465);
  a.equal(mailConfig({ ...full, MAIL_PRODUCT: 'Acme' })!.product, 'Acme');

  for (const missing of ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM']) {
    const partial = { ...full, [missing]: undefined };
    a.equal(mailConfig(partial), null, `${missing} missing should mean unconfigured`);
  }
  a.equal(mailConfig({}), null);
});

test('a mail server on this machine may speak plaintext; one anywhere else may not', () => {
  /* A rule rather than a flag. `SMTP_ALLOW_PLAINTEXT` would do the same job and could be set
     on a real box by somebody in a hurry — a hostname cannot be. */
  a.equal(isLoopback('localhost'), true);
  a.equal(isLoopback('127.0.0.1'), true);
  a.equal(isLoopback(' ::1 '), true, 'trimmed, because an environment variable often is not');
  a.equal(isLoopback('smtp.gmail.com'), false);
  a.equal(isLoopback('localhost.evil.test'), false, 'a name that looks local still resolves somewhere');
  a.equal(isLoopback('127.0.0.1.evil.test'), false);

  /* and a local sink needs no credentials, while a real server still does */
  a.ok(mailConfig({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', MAIL_FROM: 'a@b.test' }));
  a.equal(mailConfig({ SMTP_HOST: 'smtp.test', MAIL_FROM: 'a@b.test' }), null,
    'no password to a server across a network is not a configuration, it is a mistake');
});

/* ----------------------------------------------------------------- message */

test('the message says what it is, how long it lasts, and what to do if unasked', () => {
  const { subject, text } = linkMessage('https://admin.test/auth/callback?token=abc', 'Acme');
  a.match(subject, /^Your Acme sign-in link$/);
  a.match(text, /https:\/\/admin\.test\/auth\/callback\?token=abc/);
  a.match(text, /works once/);
  a.match(text, new RegExp(`${Math.round(LINK_TTL_MS / 60000)} minutes`), 'the real expiry, not a guess');
  a.match(text, /did not ask to sign in/);
});

test('the message asks for nothing and tracks nothing', () => {
  const { text } = linkMessage('https://admin.test/auth/callback?token=abc', 'Acme');
  a.equal(/password|verify your|confirm your|click here/i.test(text), false,
    'a login email that reads like a phishing email teaches a habit worth not teaching');
  const urls = text.match(/https?:\/\/\S+/g) || [];
  a.equal(urls.length, 1, 'one link, which is the one they asked for');
});

test('a link is sent to the address, from the configured sender', async () => {
  const { sent, tx } = spy();
  const cfg = mailConfig({ SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'Pagecraft <hi@b.test>' })!;
  await smtpSender(cfg, tx as never)('client@acme.test', 'https://admin.test/x?token=t');

  a.equal(sent.length, 1);
  a.equal(sent[0].to, 'client@acme.test');
  a.equal(sent[0].from, 'Pagecraft <hi@b.test>');
  a.match(String(sent[0].text), /https:\/\/admin\.test\/x\?token=t/);
});

test('a transport that throws is not swallowed', async () => {
  const cfg = mailConfig({ SMTP_HOST: 'smtp.test', SMTP_USER: 'u', SMTP_PASS: 'p', MAIL_FROM: 'a@b.test' })!;
  const tx = { sendMail: async () => { throw new Error('550 relay denied'); } };
  await a.rejects(() => Promise.resolve(smtpSender(cfg, tx as never)('c@acme.test', 'https://x/t')), /relay denied/);
});

/* ---------------------------------------------------------------- throttle */

test('an address may have a few links and then no more', () => {
  const t = throttle(3, 1000);
  a.equal(t.take('a@x.test'), true);
  a.equal(t.take('a@x.test'), true);
  a.equal(t.take('a@x.test'), true);
  a.equal(t.take('a@x.test'), false, 'the fourth in the window');
  a.equal(t.take('b@x.test'), true, 'and it is per address, because the address is what suffers');
});

test('the window moves, so a limit is not a ban', () => {
  const t = throttle(2, 1000);
  const t0 = 1_000_000;
  a.equal(t.take('a@x.test', t0), true);
  a.equal(t.take('a@x.test', t0 + 10), true);
  a.equal(t.take('a@x.test', t0 + 20), false);
  a.equal(t.take('a@x.test', t0 + 1100), true, 'the first two have aged out');
});

test('a refused attempt does not extend the block', () => {
  /* Otherwise hammering the endpoint keeps the address locked out forever, which turns a
     protection for that person into a denial of service against them. */
  const t = throttle(1, 1000);
  const t0 = 2_000_000;
  a.equal(t.take('a@x.test', t0), true);
  for (let i = 0; i < 50; i++) t.take('a@x.test', t0 + 10);
  a.equal(t.take('a@x.test', t0 + 1100), true, 'still free once the real attempt aged out');
});

test('the map does not grow without limit', () => {
  const t = throttle(1, 1);
  const t0 = 3_000_000;
  for (let i = 0; i < 6000; i++) t.take(`u${i}@x.test`, t0);
  /* swept when it gets large, using the traffic that grew it */
  a.ok(t.size() <= 6000, 'sanity');
  t.take('trigger@x.test', t0 + 10_000);
  a.ok(t.size() < 100, `expected a sweep, still holding ${t.size()}`);
});

test('active attacker-controlled keys are capped too', () => {
  const t = throttle(1, 60_000, 3);
  a.equal(t.take('one', 1), true);
  a.equal(t.take('two', 1), true);
  a.equal(t.take('three', 1), true);
  a.equal(t.take('four', 1), false);
  a.equal(t.size(), 3);
});

test('the public login body and address have hard limits', async () => {
  const app = createApp({ store: new MemoryStore(), auth: new MemoryAuthStore(), editorHost: 'admin.test' });
  const ask = (body: string) => app.request(new Request('http://admin.test/auth/login', {
    method: 'POST', headers: { host: 'admin.test', 'content-type': 'application/json' }, body
  }));
  a.equal((await ask('x'.repeat(9000))).status, 413);
  a.equal((await ask(JSON.stringify({ email: `${'a'.repeat(255)}@x.test` }))).status, 400);
});

/* ------------------------------------------------------------ through the API */

test('being over the limit looks exactly like being under it', async () => {
  /* The endpoint answers 200 to an unknown address so it cannot be used to ask who has an
     account. A different answer when throttled would give that back. */
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const sent: string[] = [];
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (to) => { sent.push(to); },
    loginLimit: throttle(2, 60_000)
  });
  await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  await auth.createUser('client@acme.test');

  const ask = () => app.request(new Request('http://admin.test/auth/login', {
    method: 'POST', headers: { host: 'admin.test', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'client@acme.test' })
  }));

  const results = [await ask(), await ask(), await ask(), await ask()];
  a.deepEqual(results.map(r => r.status), [200, 200, 200, 200], 'the same answer every time');
  a.equal(sent.length, 2, 'and only two emails');
});

test('a mail server that refuses says so rather than pretending the link was sent', async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: () => { throw new Error('connection refused'); }
  });
  await auth.createUser('client@acme.test');

  const res = await app.request(new Request('http://admin.test/auth/login', {
    method: 'POST', headers: { host: 'admin.test', 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'client@acme.test' })
  }));
  a.equal(res.status, 502, 'a person staring at "check your email" is owed the truth');
  a.match((await res.json() as { error: string }).error, /could not be sent/);
});
