import { createTransport, type SendMailOptions, type Transporter } from 'nodemailer';
import { expect, test, vi } from 'vitest';
import { smtpFounderSupportSender } from '../src/mail.ts';

const config = {
  host: 'smtp.example.test', port: 465, user: 'support', pass: 'fixture-only',
  from: 'Pagecraft <support@example.test>',
};
const notice = {
  ticketId: '15727521-2c04-43ab-b529-43b0c045be8c',
  messageId: '89a9d34a-5d88-494e-a88e-5bcf1e5829d9',
  accountEmail: 'river+studio@example.test', subject: 'Page title',
  body: 'Open your site settings.\nChoose Save after updating the title.',
};

test('founder reply uses one envelope recipient, a private ticket link and a stable retry key', async () => {
  const local = createTransport({ streamTransport: true, buffer: true });
  const spy = vi.spyOn(local, 'sendMail');
  const production = smtpFounderSupportSender(config, 'https://build.example.test', local);
  await production(notice);
  await production(notice);
  const staging = smtpFounderSupportSender(config, 'https://staging.example.test', local);
  await staging(notice);

  const [first, repeat, stage] = spy.mock.calls.map(([input]) => input as SendMailOptions);
  expect(repeat).toEqual(first);
  expect(first).toEqual({
    from: config.from, to: { name: '', address: notice.accountEmail },
    subject: '[Pagecraft Support · 15727521] Page title',
    text: notice.body + '\n\nView or reply to your ticket in Pagecraft:\nhttps://build.example.test/account/support?ticket=' + notice.ticketId,
    messageId: '<support-reply.' + notice.messageId + '@build.example.test>',
    headers: { 'Resend-Idempotency-Key': 'support-reply/build.example.test/' + notice.messageId },
  });
  const rendered = await spy.mock.results[0].value;
  expect(rendered.envelope.to).toEqual([notice.accountEmail]);
  expect(rendered.message.toString()).toMatch(/\bResend-Idempotency-Key:\s+support-reply\/build\.example\.test\//i);
  expect(rendered.message.toString()).not.toMatch(/^(?:cc|bcc|reply-to):/im);
  expect(stage.text).toContain('https://staging.example.test/account/support?ticket=' + notice.ticketId);
  expect(stage.messageId).not.toBe(first.messageId);
  expect(stage.headers).not.toEqual(first.headers);
});

test('refuses invalid mailboxes and header injection before calling the transport', async () => {
  const sendMail = vi.fn();
  const sender = smtpFounderSupportSender(config, 'https://build.example.test', { sendMail } as unknown as Transporter);
  for (const address of ['', 'missing-domain', 'group:river@example.test;', 'river,lee@example.test', 'river@example.test\r\n', '<river@example.test>']) {
    await expect(sender({ ...notice, accountEmail: address })).rejects.toThrow('single customer email address');
  }
  await expect(sender({ ...notice, messageId: 'abc\r\nCc: Lee' })).rejects.toThrow('Invalid support message');
  expect(sendMail).not.toHaveBeenCalled();
});

test('reports transport failures to the ticket delivery workflow', async () => {
  const tx = { sendMail: vi.fn().mockRejectedValue(new Error('SMTP temporarily unavailable')) } as unknown as Transporter;
  await expect(smtpFounderSupportSender(config, 'https://build.example.test', tx)(notice)).rejects.toThrow('SMTP temporarily unavailable');
});
