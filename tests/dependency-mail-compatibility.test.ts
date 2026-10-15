import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createTransport } from 'nodemailer';
import { smtpSender, type MailConfig } from '../server/src/mail.ts';

test('Nodemailer 10 preserves the Pagecraft SMTP message contract', async () => {
  const transport = createTransport({ jsonTransport: true });
  let message: Record<string, unknown> | undefined;

  transport.use('compile', (mail, done) => {
    message = mail.data as Record<string, unknown>;
    done();
  });

  const config: MailConfig = {
    host: 'smtp.example.test',
    port: 587,
    user: 'pagecraft',
    pass: 'test-only',
    from: 'Pagecraft <hello@example.test>',
    product: 'Pagecraft'
  };

  await smtpSender(config, transport)(
    'customer@example.test',
    'https://build.example.test/auth/callback?token=test-only'
  );

  assert.deepEqual(message?.from, { name: 'Pagecraft', address: 'hello@example.test' });
  assert.deepEqual(message?.to, [{ name: '', address: 'customer@example.test' }]);
  assert.equal(message?.subject, 'Your Pagecraft sign-in link');
  assert.match(String(message?.text), /https:\/\/build\.example\.test\/auth\/callback\?token=test-only/);
});
