import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import { test, vi } from 'vitest';
import { FileRecords, MemoryRecords } from '../src/record-files.ts';
import { registerSupportRoutes } from '../src/support-routes.ts';
import { SupportTicketStore, type FounderReplyNotice, type SupportNotice } from '../src/support-tickets.ts';
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
  assert.deepEqual(await store.list(sam.id), [{ id: one.id, subject: initial.subject, updatedAt: next.updatedAt, latestMessageRole: next.messages.at(-1)!.role, unread: true }]);
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

test('only new incoming replies count; polling, listing and reading leave them untouched', async () => {
  const records = new MemoryRecords();
  const store = new SupportTicketStore(records);
  const notify = vi.fn(async (_n: SupportNotice) => {});
  const first = await store.send(sam, undefined, input(), notify);
  const second = await store.send(sam, undefined, input(), notify);
  const [a, b] = notify.mock.calls.map(([notice]) => notice.replyToken);
  const oldId = randomUUID(), oldDelivery = 'before-rollout';
  const key = createHash('sha256').update(oldDelivery).digest('hex');
  await records.create(`threads/${first.id}/reply-${key}.json`, { id: oldId, role: 'support', createdAt: new Date().toISOString(), body: 'Earlier answer.' });
  await store.appendReply(a, oldDelivery, 'Earlier answer.');
  assert.equal(await store.unreadCount(sam.id), 0);
  await store.appendReply(a, 'first-answer', 'Open Site settings.');
  const read = (await store.get(sam.id, first.id)).messages.find(m => m.unread)!;
  await Promise.all([store.appendReply(a, 'second-answer', 'Select Publishing.'), store.appendReply(b, 'other-ticket', 'Your file is ready.')]);
  assert.equal(await store.unreadCount(robin.id), 0);
  assert.deepEqual(new Set((await store.list(sam.id)).filter(t => t.unread).map(t => t.id)), new Set([first.id, second.id]));
  const thread = await store.get(sam.id, first.id);
  assert(!thread.messages.some(m => 'trackUnread' in m));
  assert.equal(thread.messages.filter(m => m.unread).length, 2);
  assert.equal(thread.messages.find(m => m.id === oldId)?.unread, undefined);
  assert.equal(await store.unreadCount(sam.id), 2);
  assert.equal(await store.markRead(sam.id, first.id, [read.id, read.id]), 2);
  await store.appendReply(a, 'first-answer', 'Open Site settings.');
  const remaining = (await store.get(sam.id, first.id)).messages.filter(m => m.unread);
  assert.equal(remaining.length, 1);
  assert.notEqual(remaining[0].id, read.id);
  assert.equal(await store.markRead(sam.id, second.id, [remaining[0].id]), 2);
  await assert.rejects(store.markRead(robin.id, first.id, [remaining[0].id]), /not found/);
  assert.equal(await store.markRead(sam.id, first.id, [remaining[0].id]), 1);
  assert.equal(await store.markRead(sam.id, first.id, [read.id]), 1);
  assert.equal((await store.list(sam.id)).find(t => t.id === first.id)?.unread, undefined);
  const listing = vi.spyOn(records, 'list');
  assert.equal(await store.unreadCount(sam.id), 1);
  assert(listing.mock.calls.every(([dir]) => dir.endsWith('/unread')));
});

test('an inbound retry interleaved with an acknowledgement cannot resurrect a read reply', async () => {
  const records = new MemoryRecords();
  const store = new SupportTicketStore(records), worker = new SupportTicketStore(records);
  const notify = vi.fn(async (_n: SupportNotice) => {});
  const ticket = await store.send(sam, undefined, input(), notify);
  const token = notify.mock.calls[0][0].replyToken;
  await worker.appendReply(token, 'incoming-a', 'Open Publishing.');
  const reply = (await store.get(sam.id, ticket.id)).messages.find(m => m.unread)!;
  const create = records.create.bind(records);
  let started!: () => void, resume!: () => void;
  const paused = new Promise<void>(resolve => { started = resolve; });
  const release = new Promise<void>(resolve => { resume = resolve; });
  vi.spyOn(records, 'create').mockImplementation(async (path, row) => {
    if (path.endsWith(`-${reply.id}.json`) && path.includes('/unread/')) { started(); await release; }
    return create(path, row);
  });
  const replay = worker.appendReply(token, 'incoming-a', 'Open Publishing.');
  await paused;
  assert.equal(await store.markRead(sam.id, ticket.id, [reply.id]), 0);
  await worker.appendReply(token, 'incoming-b', 'Then select the domain.');
  resume();
  await replay;
  assert.equal(await store.unreadCount(sam.id), 1);
  assert.deepEqual((await store.get(sam.id, ticket.id)).messages.filter(m => m.unread).map(m => m.body), ['Then select the domain.']);
});

test('unread routes protect account data and acknowledge explicit IDs without outbound mail', async () => {
  let current: User | null = sam;
  const app = new Hono(), store = new SupportTicketStore(new MemoryRecords());
  const notify = vi.fn(async (_n: SupportNotice) => {});
  const ticket = await store.send(sam, undefined, input(), notify);
  await store.appendReply(notify.mock.calls[0][0].replyToken, 'answer', 'Publishing is ready.');
  const reply = (await store.get(sam.id, ticket.id)).messages.find(m => m.unread)!;
  registerSupportRoutes(app, { store, who: async () => current, page: () => '', editorOrigin: 'https://studio.example.test' });
  const acknowledge = (data: unknown, patch: Record<string, string> = {}) => app.request('/api/support/tickets/' + ticket.id + '/read', {
    method: 'POST', headers: { origin: 'https://studio.example.test', 'content-type': 'application/json', ...patch }, body: JSON.stringify(data),
  });
  const body = { messageIds: [reply.id] };
  assert.equal((await acknowledge(body, { origin: 'https://wrong.example.test' })).status, 403);
  assert.equal((await acknowledge(body, { origin: '' })).status, 403);
  assert.equal((await acknowledge(body, { authorization: 'Bearer test' })).status, 401);
  assert.equal((await acknowledge(body, { 'content-type': 'text/plain' })).status, 415);
  for (const messageIds of [[], [null], ['../other'], Array(101).fill(reply.id)]) assert.equal((await acknowledge({ messageIds })).status, 400);
  current = robin;
  assert.deepEqual(await (await app.request('/api/support/unread')).json(), { count: 0 });
  assert.equal((await acknowledge(body)).status, 404);
  current = null;
  assert.equal((await app.request('/api/support/unread')).status, 401);
  assert.equal((await acknowledge(body)).status, 401);
  current = sam;
  const result = await app.request('/api/support/unread');
  assert.match(result.headers.get('Cache-Control') || '', /private.*no-store/);
  assert.deepEqual(await result.json(), { count: 1 });
  assert.deepEqual(await (await acknowledge(body)).json(), { count: 0 });
  assert.deepEqual(await (await acknowledge(body)).json(), { count: 0 });
  assert.equal(notify.mock.calls.length, 1);
});

test('founder lists submitted and legacy tickets across accounts without secrets or customer read receipts', async () => {
  const records = new MemoryRecords(), store = new SupportTicketStore(records);
  const notify = vi.fn(async (_n: SupportNotice) => {});
  const first = await store.send(sam, undefined, input(), notify);
  const second = await store.send(robin, undefined, input(), notify);
  const legacy = randomUUID(), owner = createHash('sha256').update('older-member').digest('hex');
  const legacyMessage = { id: randomUUID(), role: 'customer', body: 'Can I update this page?', createdAt: '2026-04-01T00:00:00Z' };
  await records.create(`tickets/${legacy}.json`, { id: legacy, owner, subject: 'Page update', replyToken: 'unused-test-token' });
  await records.create(`threads/${legacy}/${legacyMessage.id}.json`, legacyMessage);
  const pending = randomUUID();
  await records.create(`tickets/${pending}.json`, { id: pending, owner, subject: 'Unsent draft', replyToken: 'unused-test-token' });

  const notice = notify.mock.calls[0][0];
  await store.appendReply(notice.replyToken, 'first-answer', 'Open Publishing.');
  assert.equal(await store.unreadCount(sam.id), 1);
  const rows = await store.listForFounder();
  assert.deepEqual(new Set(rows.map(row => row.id)), new Set([first.id, second.id, legacy]));
  assert.equal(rows.find(row => row.id === first.id)?.accountEmail, sam.email);
  assert.equal(rows.find(row => row.id === second.id)?.accountEmail, robin.email);
  assert.deepEqual(rows.at(-1), { id: legacy, subject: 'Page update', updatedAt: legacyMessage.createdAt, latestMessageRole: 'customer' });
  for (const row of rows) assert(Object.keys(row).every(key => ['id','subject','updatedAt','latestMessageRole','accountEmail'].includes(key)));
  const detail = await store.getForFounder(first.id);
  assert.equal(detail.latestMessageRole, detail.messages.at(-1)?.role);
  assert.equal(rows.find(row => row.id === first.id)?.latestMessageRole, detail.latestMessageRole);
  assert.equal(detail.messages.length, 2);
  assert(!JSON.stringify(detail).includes(notice.replyToken));
  assert(!detail.messages.some(row => 'unread' in row || 'trackUnread' in row));
  assert.deepEqual((await store.getForFounder(legacy)).messages, [legacyMessage]);
  assert.equal(await store.unreadCount(sam.id), 1);
  await assert.rejects(store.getForFounder(pending), /not found/);
  await assert.rejects(store.replyAsFounder(pending, randomUUID(), 'Hello', { notify: async () => {} }), /not found/);
  await assert.rejects(store.getForFounder('../tickets'), /not found/);
  await assert.rejects(store.get(robin.id, first.id), /not found/);
  assert.deepEqual((await store.list(robin.id)).map(row => row.id), [second.id]);
});

test('founder replies are durable, idempotent and visible alongside simultaneous customer and email replies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'founder-support-'));
  try {
    const store = new SupportTicketStore(new FileRecords(root)), worker = new SupportTicketStore(new FileRecords(root));
    const notify = vi.fn(async (_n: SupportNotice) => {});
    const ticket = await store.send(sam, undefined, input(), notify);
    const requestId = randomUUID(), answer = 'Select Site settings.';
    let release!: () => void, sending!: () => void;
    const started = new Promise<void>(resolve => { sending = resolve; });
    const accepted = new Promise<void>(resolve => { release = resolve; });
    const delivery = { notify: vi.fn(async (_notice: FounderReplyNotice) => { sending(); await accepted; }) };
    const first = store.replyAsFounder(ticket.id, requestId, answer, delivery);
    await started;
    await assert.rejects(worker.replyAsFounder(ticket.id, requestId, answer, delivery), /still sending/);
    await Promise.all([
      worker.appendReply(notify.mock.calls[0][0].replyToken, 'email-followup', 'Then enter the domain.'),
      worker.send({ ...sam, email: 'sam.carter@example.test' }, ticket.id, { requestId: randomUUID(), body: 'I found it.' }, notify),
    ]);
    release();
    const reply = await first;
    const mail = delivery.notify.mock.calls[0][0];
    assert.equal(mail.accountEmail, sam.email);
    assert.equal(mail.messageId, reply.messages.find(m => m.body === answer)?.id);
    assert.deepEqual(Object.keys(mail).sort(), ['accountEmail','body','messageId','subject','ticketId']);
    assert(reply.messages.some(row => row.body === answer));
    const detail = await store.getForFounder(ticket.id);
    assert.equal(detail.accountEmail, 'sam.carter@example.test');
    assert.equal(detail.messages.length, 4);
    assert.equal(detail.messages.filter(row => row.body === answer && row.role === 'support').length, 1);
    assert.equal(notify.mock.calls.length, 2);
    await assert.rejects(store.replyAsFounder(ticket.id, requestId, 'Different content.', delivery), /different message/);
    for (const [id, body] of [['invalid','Hello'],[randomUUID(),' '],[randomUUID(),'x'.repeat(8001)]]) {
      await assert.rejects(store.replyAsFounder(ticket.id, id, body, delivery), /up to 8,000/);
    }
    const customerThread = await worker.get(sam.id, ticket.id);
    const unseen = customerThread.messages.filter(row => row.unread);
    assert.deepEqual(new Set(unseen.map(row => row.body)), new Set([answer,'Then enter the domain.']));
    await worker.markRead(sam.id, ticket.id, unseen.map(row => row.id));
    await store.replyAsFounder(ticket.id, requestId, answer, delivery);
    assert.equal(delivery.notify.mock.calls.length, 1);
    assert.equal(await store.unreadCount(sam.id), 0);
    assert.equal((await store.getForFounder(ticket.id)).messages.length, 4);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('customer notification resolves legacy owners securely and retries a failed delivery with its original recipient and message ID', async () => {
  const records = new MemoryRecords(), store = new SupportTicketStore(records);
  const ticket = await store.send(sam, undefined, input(), async () => {});
  const owner = createHash('sha256').update(sam.id).digest('hex');
  await records.remove(`accounts/${owner}/contact.json`);
  const requestId = randomUUID(), body = 'Your changes are saved.';
  const resolveContact = vi.fn(async (_hash: string) => 'sam+studio@example.test');
  const notify = vi.fn(async (_notice: FounderReplyNotice) => {}).mockRejectedValueOnce(new Error('mail temporarily unavailable'));
  await assert.rejects(store.replyAsFounder(ticket.id, requestId, body, { notify, resolveContact }), /Email delivery could not be confirmed/);
  assert.deepEqual(resolveContact.mock.calls, [[owner]]);
  assert.equal((await store.getForFounder(ticket.id)).accountEmail, 'sam+studio@example.test');
  assert.equal((await store.get(sam.id, ticket.id)).messages.length, 1);
  assert.equal(await store.unreadCount(sam.id), 0);
  const first = notify.mock.calls[0][0];
  assert.equal(first.accountEmail, 'sam+studio@example.test');
  await records.write(`accounts/${owner}/contact.json`, 'new@example.test');
  const reloaded = new SupportTicketStore(records);
  const delivered = await reloaded.replyAsFounder(ticket.id, requestId, body, { notify });
  assert.deepEqual(notify.mock.calls[1][0], first);
  assert.equal(delivered.messages.find(m => m.body === body)?.id, first.messageId);
  assert.equal(await reloaded.unreadCount(sam.id), 1);
  await reloaded.replyAsFounder(ticket.id, requestId, body, { notify });
  assert.equal(notify.mock.calls.length, 2);
});

test('a founder reply cannot send to missing or malformed account contacts', async () => {
  const records = new MemoryRecords(), store = new SupportTicketStore(records);
  const ticket = await store.send(sam, undefined, input(), async () => {});
  const owner = createHash('sha256').update(sam.id).digest('hex');
  const notify = vi.fn(async (_n: FounderReplyNotice) => {});
  for (const value of [null, 'Sam <sam@example.test>', 'a@example.test,b@example.test', 'team:sam@example.test;', 'a@-example.test', 'sam@example.test\r\n']) {
    if (value === null) await records.remove(`accounts/${owner}/contact.json`);
    else await records.write(`accounts/${owner}/contact.json`, value);
    await assert.rejects(store.replyAsFounder(ticket.id, randomUUID(), 'Review complete.', { notify }), /email address could not be verified/);
  }
  assert.equal(notify.mock.calls.length, 0);
  assert.equal((await store.get(sam.id, ticket.id)).messages.length, 1);
});

test('resolving an older ticket keeps the contact a customer confirmed during lookup', async () => {
  const records = new MemoryRecords(), store = new SupportTicketStore(records);
  const ticket = await store.send(sam, undefined, input(), async () => {});
  const owner = createHash('sha256').update(sam.id).digest('hex');
  await records.remove(`accounts/${owner}/contact.json`);
  const notify = vi.fn(async (_notice: FounderReplyNotice) => {});
  const currentEmail = 'sam.updated@example.test';
  const detail = await store.replyAsFounder(ticket.id, randomUUID(), 'Your update is ready.', {
    notify,
    resolveContact: async () => {
      await store.send({ ...sam, email: currentEmail }, ticket.id, input(), async () => {});
      return 'sam.previous@example.test';
    },
  });
  assert.equal(notify.mock.calls[0][0].accountEmail, currentEmail);
  assert.equal(detail.accountEmail, currentEmail);
});

test('a publication retry after the email receipt reuses one delivery and reconciles a previously stored founder reply', async () => {
  const records = new MemoryRecords(), store = new SupportTicketStore(records);
  const ticket = await store.send(sam, undefined, input(), async () => {});
  const requestId = randomUUID(), body = 'The preview is ready.';
  const visiblePath = `threads/${ticket.id}/founder-${requestId}.json`;
  const notify = vi.fn(async (_n: FounderReplyNotice) => {});
  const create = records.create.bind(records);
  let interrupt = true;
  vi.spyOn(records, 'create').mockImplementation(async (path, row) => {
    if (path === visiblePath && interrupt) { interrupt = false; throw new Error('disk interrupted'); }
    return create(path, row);
  });
  await assert.rejects(store.replyAsFounder(ticket.id, requestId, body, { notify }), /disk interrupted/);
  const before = await store.get(sam.id, ticket.id);
  assert.equal(before.messages.length, 1);
  const worker = new SupportTicketStore(records);
  const repaired = await worker.replyAsFounder(ticket.id, requestId, body, { notify });
  assert.equal(repaired.messages.filter(row => row.body === body).length, 1);
  assert.equal(notify.mock.calls.length, 1);

  const legacyRequest = randomUUID(), legacyMessage = { id: randomUUID(), role: 'support', body: 'Archived reply.', createdAt: '2026-10-10T10:00:00Z', trackUnread: true };
  await create(`threads/${ticket.id}/founder-${legacyRequest}.json`, legacyMessage);
  await assert.rejects(worker.replyAsFounder(ticket.id, legacyRequest, 'Other text.', { notify }), /different message/);
  const legacy = await worker.replyAsFounder(ticket.id, legacyRequest, legacyMessage.body, { notify });
  assert.equal(legacy.messages.filter(row => row.id === legacyMessage.id).length, 1);
  assert.equal(notify.mock.calls[1][0].messageId, legacyMessage.id);
  await store.replyAsFounder(ticket.id, legacyRequest, legacyMessage.body, { notify });
  assert.equal(notify.mock.calls.length, 2);
});
