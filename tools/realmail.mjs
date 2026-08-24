/* The SMTP path against a real mail server, not a spy.

   `server/tests/mail.test.ts` injects a transport and watches what would be sent, which is
   what keeps the suite from being able to email a stranger by accident. This is the other
   half: it proves the transport itself — STARTTLS negotiation, auth, header encoding — which a
   spy cannot.

     docker run -d --rm --name pcmail -p 1026:1025 -p 8026:8025 axllent/mailpit
     node tools/realmail.mjs
     docker stop pcmail

   Mailpit because it speaks SMTP and has an API to read back what arrived, so the assertion is
   about the message a person would open rather than the object handed to a library. */
import { mailConfig, smtpSender } from '../server/src/mail.ts';
import assert from 'node:assert/strict';

const cfg = mailConfig({
  SMTP_HOST: '127.0.0.1', SMTP_PORT: '1026',
  MAIL_FROM: 'Pagecraft <hello@pagecraft.test>', MAIL_PRODUCT: 'Pagecraft'
});
assert.ok(cfg, 'a loopback sink needs no credentials');
console.log('config:', cfg.host + ':' + cfg.port, 'auth:', cfg.pass ? 'yes' : 'none');

await smtpSender(cfg)('client@acme.test', 'http://localhost:8787/auth/callback?token=REALTOKEN');

const res = await fetch('http://localhost:8026/api/v1/messages');
const { messages } = await res.json();
assert.equal(messages.length, 1, 'exactly one message arrived');
const m = messages[0];
console.log('subject:', m.Subject);
console.log('to:     ', m.To.map(t => t.Address).join(', '));
console.log('from:   ', m.From.Name + ' <' + m.From.Address + '>');

const full = await (await fetch('http://localhost:8026/api/v1/message/' + m.ID)).json();
assert.match(full.Text, /REALTOKEN/, 'the link survived the transport');
assert.match(full.Text, /works once/);
console.log('body:');
console.log(full.Text.split('\n').map(l => '  | ' + l).join('\n'));
console.log('\nreal smtp: the message arrived intact');
