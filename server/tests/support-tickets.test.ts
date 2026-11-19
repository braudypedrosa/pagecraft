import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { test, vi } from 'vitest';
import { FileRecords, MemoryRecords } from '../src/record-files.ts';
import { registerSupportRoutes } from '../src/support-routes.ts';
import { SupportTicketStore, type SupportNotice } from '../src/support-tickets.ts';
import type { User } from '../src/auth.ts';

const sam = { id: 'member-1', name: 'Sam Carter', email: 'sam@example.test' };
const robin = { id: 'member-2', name: 'Robin Green', email: 'robin@example.test' };
const input = () => ({ requestId: randomUUID(), subject: 'Site settings', body: 'Where can I update the site name?' });

test('tickets stay with the account, and only the opaque reply address can append an email', async () => {
  const store = new SupportTicketStore(new MemoryRecords());
  const notify = vi.fn(async (_n: SupportNotice) => {});
  const initial = input();
  const one = await store.send(sam, undefined, initial, notify);
  const notice = notify.mock.calls[0][0];
  assert.equal(notice.accountEmail, sam.email);
  assert.equal(notice.ticketId, one.id);
  assert.equal(notice.messageId, one.messages[0].id);
  assert(!JSON.stringify(one).includes(notice.replyToken));
  assert.deepEqual(await store.list(robin.id), []);
  await assert.rejects(store.get(robin.id, one.id), /Ticket not found/);
  await assert.rejects(store.send(robin, one.id, input(), notify), /Ticket not found/);
  await assert.rejects(store.get(sam.id, '../other'), /Ticket not found/);
  assert.equal(await store.appendReply(one.id, 'reply-1', 'Open Site settings.'), false);
  await Promise.all(Array.from({ length: 4 }, () => store.appendReply(notice.replyToken, 'reply-1', 'Open Site settings.')));
  const next = await store.send({ ...sam, email: 'sam.carter@example.test' }, one.id, { requestId: randomUUID(), body: 'Thank you.' }, notify);
  assert.deepEqual(next.messages.map(row => row.body).sort(), ['Open Site settings.', 'Thank you.', initial.body].sort());
  assert.equal(next.messages.find(row => row.body === 'Open Site settings.')!.role, 'support');
  assert.equal(notify.mock.calls[1][0].accountEmail, 'sam.carter@example.test');
  assert.equal(notify.mock.calls[1][0].replyToken, notice.replyToken);
  assert.deepEqual(await store.list(sam.id), [{ id: one.id, subject: initial.subject, updatedAt: next.updatedAt, latestMessageRole: next.messages.at(-1)!.role }]);
});

test('existing tickets resolve the last author even with legacy timestamp-only activity or same-time replies', async () => {
  const records = new MemoryRecords();
  const store = new SupportTicketStore(records);
  const owner = createHash('sha256').update(sam.id).digest('hex');
  const id = randomUUID(), updatedAt = '2026-11-19T10:00:00.000Z';
  const summary = { id, subject: 'Publishing schedule', updatedAt };
  await records.write(`tickets/${id}.json`, { ...summary, owner });
  const message = async (key: string, role: 'support' | 'customer', oldIndex: boolean) => {
    await records.write(`threads/${id}/${key}.json`, { id: key, role, body: 'Schedule update.', createdAt: updatedAt });
    await records.write(`accounts/${owner}/activity/${id}-${key}.json`, oldIndex ? summary : { ...summary, latestMessageRole: role });
  };
  await message('first', 'customer', true);
  await message('second', 'support', true);
  assert.deepEqual(await store.list(sam.id), [{ ...summary, latestMessageRole: 'support' }]);
  await message('third', 'customer', false);
  assert.deepEqual(await store.list(sam.id), [{ ...summary, latestMessageRole: 'customer' }]);
});

test('a failed send can retry after restart using the same message id and ticket; concurrent sends cannot double-notify', async () => {
  const root = await mkdtemp(join(tmpdir(), 'support-tickets-'));
  try {
    const store = new SupportTicketStore(new FileRecords(root));
    const reloaded = new SupportTicketStore(new FileRecords(root));
    const initial = input();
    let initialNotice!: SupportNotice;
    await assert.rejects(store.send(sam, undefined, initial, async notice => {
      initialNotice = notice;
      throw new Error('delivery temporarily unavailable');
    }), /Email delivery could not be confirmed/);
    assert.deepEqual(await reloaded.list(sam.id), []);
    let release!: () => void;
    let started!: () => void;
    const sending = new Promise<void>(resolve => { started = resolve; });
    const delivered = new Promise<void>(resolve => { release = resolve; });
    const retry = reloaded.send(sam, undefined, initial, async notice => {
      assert.deepEqual(notice, initialNotice);
      started();
      await delivered;
    });
    await sending;
    const noSend = async () => { throw new Error('duplicate delivery'); };
    await assert.rejects(store.send(sam, undefined, initial, noSend), /still sending/);
    release();
    const ticket = await retry;
    assert.deepEqual(await store.send(sam, undefined, initial, noSend), ticket);
    await assert.rejects(store.send(sam, undefined, { ...initial, body: 'Different request.' }, noSend), /different message/);
    assert.equal(ticket.messages.length, 1);
    assert.equal((await reloaded.list(sam.id)).length, 1);
    await Promise.all([reloaded.send(sam, ticket.id, { requestId: randomUUID(), body: 'Second message.' }, async () => {}),
      store.send(sam, ticket.id, { requestId: randomUUID(), body: 'Third message.' }, async () => {})]);
    assert.equal((await store.get(sam.id, ticket.id)).messages.length, 3);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('customer routes require a signed-in session, keep cached responses private and validate writes', async () => {
  const store = new SupportTicketStore(new MemoryRecords());
  const notify = vi.fn(async (_n: SupportNotice) => {});
  const app = new Hono();
  let user: User | null = null;
  registerSupportRoutes(app, { store, notify, who: async () => user, page: u => 'Support for ' + u.name });
  const base = '/api/support/tickets';
  const send = (path: string, value: unknown, headers: Record<string,string> = {}) => app.request(path, {
    method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value),
  });
  const signedOut = await app.request('/account/support?ticket=one');
  assert.equal(signedOut.status, 302);
  assert.equal(signedOut.headers.get('location'), '/sign-in?next=%2Faccount%2Fsupport%3Fticket%3Done');
  assert.equal((await app.request('/support')).status, 404);
  assert.equal((await app.request(base)).status, 401);
  assert.equal((await send(base, input())).status, 401);
  user = sam;
  assert.match(await (await app.request('/account/support')).text(), /Support for Sam/);
  assert.equal((await send(base, input(), { authorization: 'Bearer invalid' })).status, 401);
  assert.equal((await send(base, input(), { origin: 'https://other.example.test' })).status, 403);
  assert.equal((await send(base, input(), { 'content-type': 'text/plain' })).status, 415);
  assert.equal((await send(base, { requestId: 'short', body: 'Hello' })).status, 400);
  assert.equal((await send(base, { ...input(), body: ' ' })).status, 400);
  assert.equal((await send(base, { ...input(), body: 'y'.repeat(8001) })).status, 400);
  assert.equal((await send(base, { ...input(), body: 'y'.repeat(60000) })).status, 413);
  const initial = input();
  const response = await send(base, initial);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('Cache-Control') || '', /no-store/);
  const { ticket } = await response.json();
  assert.deepEqual((await (await app.request(base + '/' + ticket.id)).json()).ticket, ticket);
  assert.equal((await (await app.request(base)).json()).tickets.length, 1);
  assert.equal((await send(base + '/' + ticket.id + '/messages', { requestId: randomUUID(), body: 'Another question.' })).status, 200);
  user = robin;
  assert.equal((await app.request(base + '/' + ticket.id)).status, 404);
});

test('the support API reports when outbound mail is unavailable', async () => {
  const app = new Hono();
  registerSupportRoutes(app, { store: new SupportTicketStore(new MemoryRecords()), who: async () => sam, page: () => '' });
  const response = await app.request('/api/support/tickets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input()) });
  assert.equal(response.status, 503);
});
