import { afterEach, test } from 'vitest';
import a from 'node:assert/strict';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, hashToken, newToken } from '../src/auth.ts';
import { TemplateAuthorGrants } from '../src/template-authoring-grants.ts';
import { TemplateDraftStore } from '../src/template-draft-store.ts';
import sharp from 'sharp';
import { sha256 } from '../src/releases.ts';
import { validatePortablePackage } from '../src/portable-packages.ts';
import * as Core from '../../app/src/core/index.ts';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
async function rig() {
  const root = await mkdtemp(join(tmpdir(), 'pagecraft-template-workshop-')); roots.push(root);
  const auth = new MemoryAuthStore(), store = new MemoryStore();
  const owner = await auth.createUser('owner@example.test', 'Workshop Owner');
  const customer = await auth.createUser('member@example.test', 'Workshop Member');
  const drafts = new TemplateDraftStore({ root, environment: 'test' }); await drafts.init();
  const grants = new TemplateAuthorGrants(join(root, 'grants'), 'test', 'http://admin.test/mcp/template-authoring', [owner.id]);
  const app = createApp({ store, auth, templateAuthoring: { store: drafts, grants }, editorHost: 'admin.test',
    editorOrigin: 'http://admin.test', editorHtml: '<title>Pagecraft builder</title><script>window.ready=true</script>' });
  const cookie = async (id: string) => { const token = newToken(); await auth.putSession(hashToken(token), id, Date.now() + 60_000); return `pc_session=${token}`; };
  const ownerCookie = await cookie(owner.id), customerCookie = await cookie(customer.id);
  const call = (path: string, init: RequestInit = {}) => app.fetch(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', cookie: ownerCookie, origin: 'http://admin.test', ...Object.fromEntries(new Headers(init.headers)) },
  }));
  const { token, grant } = await grants.create(owner.id, 'Template workshop');
  const client = new Client({ name: 'template-workshop', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL('http://admin.test/mcp/template-authoring'), {
    authProvider: { token: async () => token },
    fetch: async (input, init) => app.fetch(new Request(input, { ...init, headers: { ...Object.fromEntries(new Headers(init?.headers)), host: 'admin.test' } })),
  }));
  const tool = async (name: string, input: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: input });
    const content = result.content as { type: string; text: string }[];
    return { error: !!result.isError, value: JSON.parse(content[0].text) };
  };
  return { root, owner, customerCookie, grants, drafts, app, client, call, token, grant, tool };
}

test('operator-only MCP creates, edits, previews and exports an immutable native draft', async () => {
  const r = await rig();
  try {
    const tools = await r.client.listTools();
    a.equal(tools.tools.length, 8);
    a.ok(!tools.tools.some(tool => /publish|promote|customer/.test(tool.name)));
    const schema = await r.tool('pagecraft_template_schema'); a.equal(schema.value.schemaVersion, Core.SCHEMA);
    a.ok(schema.value.widgets.heading.defaults.props); a.equal(schema.value.widgets.embed, undefined); a.equal(schema.value.widgets.code, undefined);
    const created = await r.tool('pagecraft_template_create', { id: 'linden-dental', version: '1.0.0', name: 'Linden Dental' });
    a.equal(created.error, false); a.equal(created.value.revision, 1);
    const doc = created.value.document;
    Core.restore(doc);
    const heading = Core.N('heading'); heading.props.text = 'Care for your whole family';
    doc.pages[0].tree = [heading];
    const saved = await r.tool('pagecraft_template_save', { id: 'linden-dental', version: '1.0.0', revision: 1, document: doc });
    a.equal(saved.error, false); a.equal(saved.value.revision, 2);
    const stale = await r.tool('pagecraft_template_save', { id: 'linden-dental', version: '1.0.0', revision: 1, document: doc });
    a.equal(stale.error, true); a.equal(stale.value.error, 'conflict');
    const preview = await r.call('/owner/template-drafts/linden-dental/1.0.0/preview/index.html?revision=2');
    a.equal(preview.status, 200); a.match(await preview.text(), /Care for your whole family/);
    a.match(preview.headers.get('content-security-policy')!, /form-action 'none'/);
    const editor = await r.call('/owner/template-drafts/linden-dental/1.0.0/edit');
    a.match(await editor.text(), /"templateDraft":true/);
    const exported = await r.tool('pagecraft_template_export', { id: 'linden-dental', version: '1.0.0', revision: 2 });
    a.equal(exported.error, false);
    const download = await r.app.fetch(new Request(exported.value.downloadUrl, { headers: { host: 'admin.test', authorization: `Bearer ${r.token}` } }));
    a.equal(download.status, 200);
    const bytes = new Uint8Array(await download.arrayBuffer());
    a.equal(sha256(bytes), exported.value.packageSha256);
    a.equal(validatePortablePackage(bytes).document.pages[0].tree[0].props.text, heading.props.text);
    const repeat = await r.tool('pagecraft_template_export', { id: 'linden-dental', version: '1.0.0', revision: 2 });
    a.equal(repeat.value.packageSha256, exported.value.packageSha256);
    a.equal((await r.drafts.read('linden-dental', '1.0.0')).revision, 2);
  } finally { await r.client.close(); }
});

test('customer sessions, wrong resources, revoked grants and cross-origin saves cannot author templates', async () => {
  const r = await rig();
  try {
    a.equal((await r.call('/owner/template-drafts', { headers: { cookie: r.customerCookie } })).status, 403);
    a.equal((await r.call('/api/template-drafts/sample/1.0.0', { method: 'PUT', headers: { origin: 'https://other.test' }, body: '{}' })).status, 403);
    a.equal((await r.call('/mcp/template-authoring', { method: 'POST', headers: { authorization: 'Bearer pca.invalid' }, body: '{}' })).status, 401);
    a.equal(await new TemplateAuthorGrants(join(r.root, 'grants'), 'production', 'http://admin.test/mcp/template-authoring', [r.owner.id]).withGrant(r.token, async () => true), null);
    a.equal(await new TemplateAuthorGrants(join(r.root, 'grants'), 'test', 'http://other.test/mcp/template-authoring', [r.owner.id]).withGrant(r.token, async () => true), null);
    const names = await readdir(join(r.root, 'grants'));
    const stored = await readFile(join(r.root, 'grants', names.find(name => name.endsWith('.json'))!), 'utf8');
    a.ok(!stored.includes(r.token));
    await r.grants.revoke(r.grant.id, r.owner.id);
    a.equal((await r.call('/mcp/template-authoring', { method: 'POST', headers: { authorization: `Bearer ${r.token}` }, body: '{}' })).status, 401);
  } finally { await r.client.close(); }
});

test('revocation waits for an in-flight authorised save and denies all later work', async () => {
  const r = await rig();
  try {
    let finish!: () => void, started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const pending = r.grants.withGrant(r.token, async () => { started(); await new Promise<void>(resolve => { finish = resolve; }); return 'saved'; });
    await entered;
    const revoked = r.grants.revoke(r.grant.id, r.owner.id);
    finish();
    a.equal(await pending, 'saved'); a.equal(await revoked, true);
    a.equal(await r.grants.withGrant(r.token, async () => 'unexpected'), null);
  } finally { await r.client.close(); }
});


test('malformed documents and invalid image bytes return client errors without changing the draft', async () => {
  const r = await rig();
  try {
    const created = await r.tool('pagecraft_template_create', { id: 'example', version: '1.0.0', name: 'Example' });
    const document = structuredClone(created.value.document);
    document.schemaVersion = Core.SCHEMA + 1;
    const save = await r.call('/api/template-drafts/example/1.0.0', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({doc:document,version:1}) });
    a.equal(save.status,422);
    a.equal((await r.call('/api/template-drafts/missing/1.0.0')).status,404);
    const form = new FormData(); form.set('revision','1'); form.set('file',new File([new Uint8Array([0xff,0xd8,0xff,0x00])],'broken.jpg',{type:'image/jpeg'}));
    const image = await r.call('/api/template-drafts/example/1.0.0/assets', {method:'POST',body:form});
    a.equal(image.status,422);
    a.equal((await r.drafts.read('example','1.0.0')).revision,1);
  } finally { await r.client.close(); }
});


test('immutable preview keeps its revision for relative pages and assets', async () => {
  const r = await rig();
  try {
    const created = await r.tool('pagecraft_template_create', { id:'sample', version:'1.0.0', name:'Sample' });
    const image = new Uint8Array(await sharp({create:{width:8,height:6,channels:3,background:'#447799'}}).png().toBuffer());
    const uploaded = await r.drafts.putAsset('sample','1.0.0',1,{name:'sample.png',type:'image/png',bytes:image},r.owner.id);
    const doc = structuredClone(created.value.document), first = Core.N('heading',{text:'First revision home'}), second = Core.N('heading',{text:'First revision contact'});
    const photo = Core.N('image',{src:`asset:${uploaded.assets[0].id}`,alt:'Sample'});
    doc.pages[0].tree=[first,photo];
    doc.header=[Core.N('nav',{items:[{label:'Contact',href:'contact.html'}]})];
    doc.pages.push({...structuredClone(doc.pages[0]), id:'contact-page', name:'Contact', title:'Contact', slug:'contact', tree:[second]});
    const original=await r.drafts.save('sample','1.0.0',2,doc,r.owner.id);
    const read=await r.tool('pagecraft_template_read',{id:'sample',version:'1.0.0',revision:original.revision});
    const url=new URL(read.value.previewUrl);
    a.match(url.pathname,/\/preview\/3\/index\.html$/);
    const changed=structuredClone(doc); changed.pages[0].tree[0].props.text='New home'; changed.pages[1].tree[0].props.text='New contact';
    await r.drafts.save('sample','1.0.0',3,changed,r.owner.id);
    const home=await r.call(url.pathname); a.equal(home.status,200); const homeHtml=await home.text(); a.match(homeHtml,/First revision home/); a.match(homeHtml,/href="contact\.html"/);
    const contactUrl=new URL('contact.html',url); const contact=await r.call(contactUrl.pathname);
    a.equal(contact.status,200); a.match(await contact.text(),/First revision contact/);
    const asset = await r.drafts.asset('sample','1.0.0',uploaded.assets[0].id,3);
    const assetPath=Core.assetFile(asset); a.ok(homeHtml.includes(assetPath));
    const assetUrl=new URL(assetPath,url);
    const assetResponse=await r.call(assetUrl.pathname); a.equal(assetResponse.status,200); a.equal(sha256(new Uint8Array(await assetResponse.arrayBuffer())),uploaded.assets[0].sha256);
  } finally { await r.client.close(); }
});
