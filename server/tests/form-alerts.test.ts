import { expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import * as Core from '../../app/src/core/index.ts';
import { blankDoc } from '../src/render.ts';
import { FileSubmissionStore, type Submission } from '../src/submissions.ts';
import { submissionRoutes } from '../src/submissions-routes.ts';
import { FormAlerts, alertRecipients, entryMessage } from '../src/form-alerts.ts';
import { smtpNoticeSender } from '../src/mail.ts';
import { MemoryStore } from '../src/store.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';

const owner = { userId: 'u-owner', email: 'owner@example.test', name: 'Olive', role: 'owner' as const };
const editor = { userId: 'u-editor', email: 'editor@example.test', name: '', role: 'content' as const };
const entry = (values: Submission['values'], formName = 'Contact'): Submission => ({ id: '1', formId: 'f', formName, createdAt: '2026-11-25T00:00:00Z', status: 'success', values });

async function world(run: (w: any) => Promise<void>, options: { send?: any; perHour?: number } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-form-alerts-'));
  try {
    const sent: any[] = [];
    const send = 'send' in options ? options.send : async (...args: any[]) => { sent.push(args); };
    const store = new MemoryStore(), submissions = new FileSubmissionStore(join(root, 'entries'));
    const publications = new FileHostedPublicationStore(join(root, 'published'));
    const doc = blankDoc('QA');
    const form = Core.N('form'); form.id = 'contact'; form.props.aria = 'Contact us';
    form.props.fields = [{ name: 'email', label: 'Email', type: 'email', required: 1 }, { name: 'message', label: 'Message', type: 'textarea' }];
    doc.pages[0].tree = [form];
    const site = await store.create({ host: 'alerts.invalid', name: 'Corner Shop', doc });
    let members: any[] = [owner, editor];
    const alerts = new FormAlerts({ submissions, send, perHour: options.perHour, members: async () => members, inboxUrl: (id, f) => `https://editor.test/sites/${id}/submissions?form=${f}` });
    const pending: Promise<unknown>[] = [];
    const original = alerts.entry.bind(alerts);
    alerts.entry = (...args: Parameters<FormAlerts['entry']>) => { const p = original(...args); pending.push(p); return p; };
    const app = new Hono();
    submissionRoutes(app, { store, submissions, publications, alerts, editorOrigin: 'https://editor.test', requestSource: () => Math.random().toString(),
      allowed: async (c, id) => {
        const role = (c.req.header('cookie') || '').replace('role=', '') as any;
        return id === site.id && role ? { ok: true, user: { id: 'u-' + role, email: role + '@example.test', name: role } as any, role } : { ok: false, status: 403 };
      } });
    const pub = await publications.create({ siteId: site.id, slug: site.slug, host: site.host, sourceVersion: site.version, files: [{ path: 'index.html', mediaType: 'text/html', bytes: new TextEncoder().encode('x') }] } as any);
    await publications.promote(pub);
    const post = (values: Record<string, string>) => app.request(`https://editor.test/forms/${site.id}/contact`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'null' }, body: new URLSearchParams(values).toString() });
    const settings = (body: string, role = 'owner', origin = 'https://editor.test') => app.request(`https://editor.test/sites/${site.id}/submissions/alerts`, { method: 'POST', headers: { cookie: 'role=' + role, origin, 'content-type': 'application/x-www-form-urlencoded' }, body });
    const page = async (role = 'owner', query = '') => (await app.request(`https://editor.test/sites/${site.id}/submissions${query}`, { headers: { cookie: 'role=' + role } })).text();
    await run({ sent, site, submissions, alerts, post, settings, page, settle: () => Promise.all(pending), setMembers: (m: any) => { members = m; } });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('an accepted entry emails the owner once, with the answers and a link', () => world(async w => {
  const request = '12345678-1234-4123-8123-123456789abc';
  expect((await w.post({ email: 'visitor@example.test', message: 'Two lines\nhere', _pc_request: request })).status).toBe(303);
  expect((await w.post({ email: 'visitor@example.test', message: 'Two lines\nhere', _pc_request: request })).status).toBe(303);
  await w.settle();
  expect(w.sent).toHaveLength(1);
  const [to, subject, text, replyTo] = w.sent[0];
  expect([to, subject, replyTo]).toEqual(['owner@example.test', 'New entry: Contact us · Corner Shop', 'visitor@example.test']);
  expect(text).toContain('Email: visitor@example.test');
  expect(text).toContain('Message:\nTwo lines\nhere');
  expect(text).toContain(`https://editor.test/sites/${w.site.id}/submissions?form=contact`);
  expect(text).toContain('has not been verified');
}));

test('refused entries and spam are never emailed', () => world(async w => {
  expect((await w.post({ email: 'bad' })).status).toBe(422);
  expect((await w.post({ email: 'a@b.test', _pc_trap: 'bot' })).status).toBe(303);
  await w.settle();
  expect(w.sent).toEqual([]);
}));

test('a mail failure never reaches the visitor, keeps the entry, and is shown until mail works again', () => {
  let broken = true;
  const sent: any[] = [];
  return world(async w => {
    expect((await w.post({ email: 'a@b.test' })).status).toBe(303);
    await w.settle();
    expect(await w.submissions.list(w.site.id)).toHaveLength(1);
    expect(await w.page()).toContain('The last email could not be sent');
    broken = false;
    await w.post({ email: 'c@d.test' });
    await w.settle();
    expect(sent).toHaveLength(1);
    expect(await w.page()).not.toContain('The last email could not be sent');
  }, { send: async (...args: any[]) => { if (broken) throw new Error('smtp down'); sent.push(args); } });
});

test('a visitor is not kept waiting for the mail server', () => {
  let finish!: () => void;
  const mailServer = new Promise<void>(done => { finish = done; });
  return world(async w => {
    expect((await w.post({ email: 'a@b.test' })).status).toBe(303);
    finish();
    await w.settle();
  }, { send: () => mailServer });
});

test('owners choose recipients from the people on the site, and nobody else can be added', () => world(async w => {
  expect((await w.settings('person=u-editor&person=u-stranger&person=evil%40example.test')).headers.get('location')).toContain('alerts=saved');
  expect((await w.submissions.alerts(w.site.id)).recipients).toEqual(['u-editor']);
  await w.post({ email: 'a@b.test' }); await w.settle();
  expect(w.sent.map((s: any) => s[0])).toEqual(['editor@example.test']);
  w.setMembers([owner]);
  await w.post({ email: 'a@b.test' }); await w.settle();
  expect(w.sent).toHaveLength(1);
  await w.settings('');
  expect((await w.submissions.alerts(w.site.id)).recipients).toEqual([]);
}));

test('reviewers, who cannot open Submissions, are never emailed entries', () => world(async w => {
  const reviewer = { userId: 'u-reviewer', email: 'reviewer@example.test', name: 'Rae', role: 'reviewer' };
  w.setMembers([owner, editor, reviewer]);
  expect(await w.page()).not.toContain('reviewer@example.test');
  await w.settings('person=u-reviewer&person=u-editor');
  expect((await w.submissions.alerts(w.site.id)).recipients).toEqual(['u-editor']);
  w.setMembers([owner, { ...editor, role: 'reviewer' }]);
  await w.post({ email: 'a@b.test' }); await w.settle();
  expect(w.sent).toEqual([]);
}));

test('only owners see or change the setting, and only from this site', () => world(async w => {
  expect(await w.page()).toContain('id="form-emails"');
  expect(await w.page('content')).not.toContain('id="form-emails"');
  expect((await w.settings('person=u-owner', 'content')).status).toBe(403);
  expect((await w.settings('person=u-owner', '')).status).toBe(403);
  expect((await w.settings('person=u-owner', 'owner', 'https://evil.test')).status).toBe(403);
  expect(await w.submissions.alerts(w.site.id)).toEqual({});
  const html = await w.page('owner', '?form=contact&alerts=saved');
  expect(html).toContain('Form emails updated.');
  expect(html).toMatch(/value="u-owner" checked/);
  expect(html).not.toMatch(/value="u-editor" checked/);
  expect(await w.page('owner', '?alerts=%3Cscript%3E')).not.toContain('pc-alert-notice" role');
}));

test('a test email goes only to the owner asking, and is limited', () => world(async w => {
  for (const expected of ['sent', 'sent', 'sent', 'wait']) expect((await w.settings('action=test&person=u-editor')).headers.get('location')).toContain('alerts=test-' + expected);
  expect(w.sent.map((s: any) => s[0])).toEqual(Array(3).fill('owner@example.test'));
}));

test('many entries in an hour stop emailing, and the last email says so', () => world(async w => {
  for (let i = 0; i < 5; i++) { await w.post({ email: `v${i}@example.test` }); await w.settle(); }
  expect(w.sent).toHaveLength(3);
  expect(w.sent[1][2]).not.toContain('no more will be emailed');
  expect(w.sent[2][2]).toContain('no more will be emailed');
  expect(await w.submissions.list(w.site.id)).toHaveLength(5);
}, { perHour: 3 }));

test('without outgoing mail the page says so and nothing is attempted', () => world(async w => {
  await w.post({ email: 'a@b.test' }); await w.settle();
  expect(await w.page()).toContain('This server cannot send email yet');
  expect((await w.settings('action=test')).headers.get('location')).toContain('alerts=test-off');
}, { send: undefined }));

test('settings are removed with the site and are not counted as an entry', () => world(async w => {
  await w.settings('person=u-owner');
  expect(await w.submissions.list(w.site.id)).toEqual([]);
  expect(await w.submissions.overview(w.site.id)).toEqual([]);
  await w.submissions.removeSite(w.site.id);
  expect(await w.submissions.alerts(w.site.id)).toEqual({});
}));

test('visitor text cannot add headers or become a list of reply addresses', async () => {
  const message = entryMessage({ siteName: 'Shop\r\nBcc: x@evil.test', url: 'https://e.test', entry: entry([{ label: 'A\nB', value: 'a@b.test, c@d.test' }, { label: 'Email', value: 'ok@example.test' }], 'Form\r\nBcc: y@evil.test') });
  expect(message.subject).not.toMatch(/[\r\n]/);
  expect(message.text).toContain('A B: a@b.test, c@d.test');
  expect(message.replyTo).toBe('ok@example.test');
  expect(entryMessage({ siteName: 'S', url: 'u', entry: entry([{ label: 'Email', value: 'x@y.test\r\nBcc: z@evil.test' }]) }).replyTo).toBeUndefined();
  const mails: any[] = [];
  await smtpNoticeSender({ host: 'localhost', port: 1025, user: '', pass: '', from: 'P <p@example.test>' }, { sendMail: async (m: any) => { mails.push(m); } } as any)('o@example.test', message.subject, message.text, message.replyTo);
  expect(mails[0]).toEqual({ from: 'P <p@example.test>', to: 'o@example.test', subject: message.subject, text: message.text, replyTo: 'ok@example.test' });
});

test('nobody chosen means every owner', () => {
  const second = { ...owner, userId: 'u2', email: 'two@example.test' };
  expect(alertRecipients({}, [owner, editor, second]).map(m => m.userId)).toEqual(['u-owner', 'u2']);
  expect(alertRecipients({ recipients: [] }, [owner])).toEqual([]);
});
