import { test, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SupportTicketStore } from '../src/support-tickets.ts';
import { FileRecords } from '../src/record-files.ts';

const script = fileURLToPath(new URL('../tools/support-inbound.py', import.meta.url));
const domain = 'help.example.test';

function deliver(root: string, source: string, node = process.execPath) {
  const result = spawnSync('python3', [script, '--store', root, '--domain', domain, '--node', node],
    { input: source, encoding: 'utf8', timeout: 10_000 });
  expect(result.error).toBeUndefined();
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
  return result.status;
}

test('mail pipe delivers one readable support reply per original message and suppresses unrelated mail', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-support-'));
  try {
    const store = new SupportTicketStore(new FileRecords(root));
    const account = { id: randomUUID(), email: 'sara@example.test' };
    let token = '';
    const ticket = await store.send(account, undefined, { requestId: randomUUID(), body: 'Can I update the site title?' },
      async notice => { token = notice.replyToken; });
    const base = [
      'From: Pagecraft Support <hello@braudyp.dev>',
      'To: support-replies+' + token + '@' + domain,
      'Subject: Re: Site title',
      'Message-ID: <inbound-1@example.test>',
      'Content-Type: text/plain; charset=utf-8', '',
      'Open site settings.', '', 'On Thursday,', ' Sara wrote:', '> Can I update the site title?'
    ].join('\r\n');
    expect(deliver(root, base)).toBe(0);
    expect(deliver(root, 'Received: from mx.example.test\r\n' + base)).toBe(0);
    const html = base.replace('inbound-1', 'inbound-2').replace('text/plain', 'text/html').split('\r\n\r\n')[0] +
      '\r\n\r\n<div>Use the <b>Site title</b> field.</div><div class="gmail_quote"><div>Your old message</div></div>';
    expect(deliver(root, html)).toBe(0);
    const rejected = base.replace('inbound-1', 'unrelated');
    for (const invalid of [
      rejected.replace('hello@braudyp.dev', 'sara@example.test'),
      rejected.replace('@' + domain, '@other.example.test'),
      rejected.replace(token, randomUUID().replaceAll('-', '')),
      'Auto-Submitted: auto-replied\r\n' + rejected,
      'Return-Path: <>\r\n' + rejected,
      rejected.replace('Re: Site title', 'Fwd: Site title'),
      rejected.replace('Open site settings.', ''),
      rejected.replace('Open site settings.', '📷'.repeat(4100)),
      rejected.replace('Open site settings.', 'Your original address was support-replies+' + token + '@' + domain)
    ]) expect(deliver(root, invalid)).toBe(0);

    const saved = await store.get(account.id, ticket.id);
    expect(saved.messages.filter(m => m.role === 'support').map(m => m.body)).toEqual([
      'Open site settings.', 'Use the Site title field.'
    ]);
    expect(deliver(root, base, '/unavailable/pagecraft-node')).toBe(75);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
