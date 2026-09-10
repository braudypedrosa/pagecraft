import { test, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Hono } from 'hono';
import * as Core from '../../app/src/core/index.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import { FileSubmissionStore, siteForms, submissionValues } from '../src/submissions.ts';
import { submissionRoutes } from '../src/submissions-routes.ts';
import { MemoryStore } from '../src/store.ts';
import { FileHostedPublicationStore } from '../src/publications.ts';
import { siteSubmissionsPage } from '../src/account-pages.ts';

const source = () => {
  const doc = blankDoc('Submissions QA');
  const form = Core.N('form'); form.id = 'qa-form'; form.props.aria = 'Contact QA';
  form.props.fields = [{ name: 'email', label: 'Email', type: 'email', required: 1 }, { name: 'message', label: 'Message', type: 'textarea' }];
  doc.pages[0].tree = [form]; return doc;
};
test('Cloud rendering activates every form without mutating documents or leaking into portable/WordPress renders', () => {
  const doc = source(), before = JSON.stringify(doc);
  const cloud = renderSite(doc, [], 'https://editor.test/forms/site').files.get('index.html')!;
  expect(cloud).toContain('action="https://editor.test/forms/site/qa-form"');
  expect(cloud).toContain('_pc_trap'); expect(cloud).toContain('_pc_request');
  expect(cloud).not.toContain('data-disabled');
  expect(JSON.stringify(doc)).toBe(before);
  expect(Core.cloudFormsEnabled()).toBe(false);
  expect(renderSite(doc).files.get('index.html')).toContain('data-disabled');
  doc.pages[0].tree[0].props.mode = 'wordpress';
  expect(renderSite(doc).files.get('index.html')).toContain('PAGECRAFT_FORM_ENDPOINT:qa-form');
  expect(renderSite(doc, [], 'https://editor.test/forms/site').files.get('index.html')).not.toContain('PAGECRAFT_FORM_ENDPOINT');
});
test('discovery includes nested forms and used components, validation limits fields and rejects invalid values', () => {
  const doc = source(); doc.header = [structuredClone(doc.pages[0].tree[0])];
  const forms = siteForms(doc); expect(forms).toHaveLength(1); expect(forms[0].pages).toContain('Header');
  expect(() => submissionValues(forms[0], new URLSearchParams('email=bad'))).toThrow('valid email');
  expect(() => submissionValues(forms[0], new URLSearchParams())).toThrow('required');
  expect(submissionValues(forms[0], new URLSearchParams('email=qa@example.test&secret=ignored'))).toHaveLength(2);
  expect(() => submissionValues(forms[0], new URLSearchParams('email=a@b.test&email=c@d.test'))).toThrow();
});
test('published receiver, private inbox and statuses enforce site scope and preserve entries across store instances', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-submissions-'));
  try {
    const store = new MemoryStore(), submissions = new FileSubmissionStore(join(root, 'entries'));
    const publications = new FileHostedPublicationStore(join(root, 'published'));
    const site = await store.create({ host: 'submissions.invalid', name: 'QA', doc: source() });
    const app = new Hono();
    submissionRoutes(app, { store, submissions, publications, editorOrigin: 'https://editor.test', requestSource: () => 'qa', allowed: async (c, id) => id === site.id && c.req.header('cookie') === 'owner=1' ? { ok: true, user: { id: 'user', email: 'qa@example.test', name: 'QA' }, role: 'owner' } : { ok: false, status: 403 } });
    const post = (body: string, form = 'qa-form', origin = 'https://editor.test') => app.request('https://editor.test/forms/' + site.id + '/' + form, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin }, body });
    expect((await post('email=qa@example.test')).status).toBe(404);
    const pub = await publications.create({ siteId: site.id, slug: site.slug, host: site.host, sourceVersion: site.version, files: [{ path:'index.html', mediaType:'text/html', bytes: new TextEncoder().encode('<h1>QA</h1>') }] });
    await publications.promote(pub);
    expect((await post('email=bad')).status).toBe(422);
    expect((await post('email=qa@example.test', 'missing')).status).toBe(404);
    expect((await post('email=qa@example.test', 'qa-form', 'https://evil.test')).status).toBe(403);
    expect((await post('email=qa@example.test&_pc_trap=bot')).status).toBe(303);
    expect(await submissions.list(site.id)).toHaveLength(0);
    const request = '_pc_request=12345678-1234-4123-8123-123456789abc&email=qa@example.test&message=%3Cscript%3E';
    expect((await post(request, 'qa-form', 'null')).status).toBe(303); expect((await post(request)).status).toBe(303);
    const entries = await new FileSubmissionStore(join(root, 'entries')).list(site.id);
    expect(entries).toHaveLength(1); expect(entries[0].status).toBe('new');
    expect(await submissions.list('another-site')).toEqual([]);
    const base = 'https://editor.test/sites/' + site.id + '/submissions';
    expect((await app.request(base)).status).toBe(403);
    const inbox = await app.request(base + '?form=qa-form', { headers: { cookie: 'owner=1' } });
    const html = await inbox.text(); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<dd><script>');
    const embedded = await app.request(base + '?embedded=1&form=qa-form', { headers: { cookie: 'owner=1' } });
    expect(embedded.headers.get('content-security-policy')).toContain("frame-ancestors 'self'");
    const embeddedHtml = await embedded.text();
    expect(embeddedHtml).not.toContain('aria-label="Site management"');
    expect(embeddedHtml).toContain('pagecraft:close-submissions');
    expect(embeddedHtml).toContain('name="embedded" value="1"');
    const change = (origin: string) => app.request(base + '/' + entries[0].id + '/status', { method: 'POST', headers: { cookie:'owner=1', origin }, body:'status=read' });
    expect((await change('https://evil.test')).status).toBe(403); expect((await change('https://editor.test')).status).toBe(303);
    expect((await submissions.list(site.id))[0].status).toBe('read');
    const embeddedSave = await app.request(base + '/' + entries[0].id + '/status', { method: 'POST', headers: { cookie: 'owner=1', origin: 'https://editor.test' }, body: 'status=archived&embedded=1' });
    expect(embeddedSave.headers.get('location')).toBe('/sites/' + site.id + '/submissions?embedded=1');
    expect((await app.request(base, { headers: { cookie: 'owner=1', 'x-pagecraft-editor-session': 'wp' } })).status).toBe(403);
    await submissions.removeSite(site.id); expect(await submissions.list(site.id)).toHaveLength(0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test('inbox discovers empty forms and preserves removed form entries', () => {
  const html = siteSubmissionsPage({ id:'qa', email:'qa@example.test', name:'QA' }, { id:'site', name:'QA' }, 'owner', siteForms(source()), [], '', '', 1);
  expect(html).toContain('Contact QA'); expect(html).toContain('aria-label="Detected forms"'); expect(html).toContain('aria-expanded="false"'); expect(html).not.toContain('pc-form-list'); expect(html).toContain('Submissions');
});

test('form overview separates entries by form and keeps removed forms accessible', () => {
  const user = { id:'qa', email:'qa@example.test', name:'QA' }, site = { id:'site', name:'QA' };
  const entries = [{ id:'entry', formId:'removed', formName:'Old contact', status:'new' as const, createdAt:'2026-09-10T00:00:00Z', values:[{label:'Email', value:'private@example.test'}] }];
  const overview = siteSubmissionsPage(user, site, 'owner', siteForms(source()), entries, '', '', 1, true);
  expect(overview).toContain('Old contact (removed form)');
  expect(overview).toContain('aria-label="Old contact (removed form) submissions"');
  expect(overview).toContain('private@example.test');
  expect(overview).toContain('hidden class="pc-form-entries"');
  const detail = siteSubmissionsPage(user, site, 'owner', siteForms(source()), entries, 'removed', '', 1, true);
  expect(detail).toContain('private@example.test');
  expect(detail).toContain('name="form" value="removed"');
  expect(detail).toContain('All forms');
});
