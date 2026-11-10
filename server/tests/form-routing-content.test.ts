import { expect, test } from 'vitest';
import * as Core from '../../app/src/core/index.ts';
import type { Doc, Node } from '../../app/src/core/types.ts';
import type { AccountAuth } from '../src/account-auth.ts';
import { createApp, type CloudMutationFastPath } from '../src/app.ts';
import { hashToken, MemoryAuthStore, newToken, roleAllows } from '../src/auth.ts';
import { contentOnly, formRoutingChanged } from '../src/content.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import { MemoryStore } from '../src/store.ts';

const cloud = 'https://workspace.example.test/forms/fixture';
const external = 'https://receiver.example.test/inquiries';
const alternate = 'https://alternate.example.test/inquiries';
const snapshot = (): Doc => structuredClone(Core.doc());

function fixture() {
  Core.restore(blankDoc('Northbank Workshop'));
  const form = Core.N('form', { fields: [{ type: 'text', label: 'Name', name: 'name' }], method: 'post', action: '' });
  const column = Core.N('column', {}, {}, [form]);
  const row = Core.N('row', {}, {}, [column]);
  const section = Core.N('section', {}, {}, [row]);
  Core.state.pages[0].tree = [section];
  return { form, column, section };
}

function componentProperty(component: string, key: string) {
  const definition = Core.findComponent(component)!;
  const control = Core.DEF.form.controls.content!.find(c => c.k === key)!;
  return Core.propFromControl(component, definition.node.id, control)!;
}

function cmsSource(scope: Node, value: string) {
  const collection = Core.collectionAdd('Workshops');
  const field = Core.fieldAdd(collection.id, 'Setting', 'text');
  const entry = Core.itemAdd(collection.id)!;
  Core.itemSet(collection.id, entry.id, 'title', 'Intro workshop');
  Core.itemSet(collection.id, entry.id, field.id, value);
  Core.srcSet(scope, collection.id);
  return { collection, field, entry };
}

test('an owner-exposed form property is a routing change, but ordinary copy stays content', () => {
  const { form } = fixture();
  const component = Core.componentFromNode(form.id, 'Inquiry')!;
  const destination = componentProperty(component, 'action');
  const label = componentProperty(component, 'submit');
  const before = snapshot();
  Core.instSet(form, destination, external);
  const after = snapshot();
  expect(renderSite(before, [], cloud).files.get('index.html')).toContain(`action="${cloud}/`);
  expect(renderSite(after, [], cloud).files.get('index.html')).toContain(`action="${external}"`);
  expect(contentOnly(before, after)).toEqual({ ok: false, where: 'form routing' });

  Core.restore(structuredClone(before));
  Core.instSet(Core.locate(form.id)!.node, label, 'Send inquiry');
  expect(contentOnly(before, snapshot())).toEqual({ ok: true });
});

test('a static CMS source can change copy, but cannot switch a form from Cloud to an external receiver', () => {
  const { form, section } = fixture();
  const { collection, field, entry } = cmsSource(section, '');
  Core.bindSet(form, 'action', Core.bindField(field.id));
  const before = snapshot();
  Core.itemSet(collection.id, entry.id, 'title', 'Weekend workshop');
  const updatedCopy = snapshot();
  Core.itemSet(collection.id, entry.id, field.id, external);
  const rerouted = snapshot();
  expect(contentOnly(before, updatedCopy)).toEqual({ ok: true });
  expect(contentOnly(before, rerouted)).toEqual({ ok: false, where: 'form routing' });
});

test('a nested component resolves a variant destination and a CMS-bound submission method', () => {
  const { form, column, section } = fixture();
  const { collection, field, entry } = cmsSource(section, 'post');
  const inner = Core.componentFromNode(form.id, 'Inquiry')!;
  const destination = componentProperty(inner, 'action');
  const method = componentProperty(inner, 'method');
  Core.findComponent(inner)!.variants = [{ id: 'remote', name: 'Remote', values: { [destination]: external } }];
  Core.variantSet(form, 'remote');
  Core.bindSet(form, Core.VAL + method, Core.bindField(field.id));
  Core.componentFromNode(column.id, 'Inquiry column');
  const before = snapshot();
  const html = (doc: Doc) => renderSite(doc, [], cloud).files.get('index.html');
  expect(html(before)).toContain(`action="${external}" method="post"`);
  Core.restore(structuredClone(before));
  Core.itemSet(collection.id, entry.id, field.id, 'get');
  const after = snapshot();
  expect(html(after)).toContain(`action="${external}" method="get"`);
  expect(contentOnly(before, after)).toEqual({ ok: false, where: 'form routing' });
});

test('a paginated list accepts another entry using its approved route, but rejects a new destination', () => {
  const { form, column, section } = fixture();
  const list = Core.N('list', { per: '1' }, {}, [column]);
  section.children = [list];
  const { collection, field, entry } = cmsSource(list, external);
  Core.bindSet(form, 'action', Core.bindField(field.id));
  const before = snapshot();
  const newEntry = Core.itemAdd(collection.id)!;
  Core.itemSet(collection.id, newEntry.id, 'title', 'Weekend workshop');
  Core.itemSet(collection.id, newEntry.id, field.id, 'https://RECEIVER.example.test:443/inquiries#confirmation');
  const sameRoute = snapshot();

  Core.itemSet(collection.id, newEntry.id, field.id, alternate);
  const bothApprovedByOwner = snapshot();
  Core.itemSet(collection.id, newEntry.id, field.id, external);
  Core.itemSet(collection.id, entry.id, field.id, alternate);
  const swapped = snapshot();
  expect(contentOnly(before, sameRoute)).toEqual({ ok: true });
  expect(contentOnly(before, bothApprovedByOwner)).toEqual({ ok: false, where: 'form routing' });
  expect(contentOnly(bothApprovedByOwner, swapped)).toEqual({ ok: false, where: 'form routing' });
});

test('CMS detail routes can be added or held back while preserving an existing approved receiver', () => {
  const { form, section } = fixture();
  const { collection, field, entry } = cmsSource(section, external);
  const detail = Core.state.pages[0];
  detail.collection = collection.id;
  delete section.src;
  Core.bindSet(form, 'action', Core.bindField(field.id));
  const before = snapshot();
  const added = Core.itemAdd(collection.id)!;
  Core.itemSet(collection.id, added.id, 'title', 'Weekend workshop');
  Core.itemSet(collection.id, added.id, field.id, external);
  Core.itemDraft(collection.id, entry.id, true);
  const sameRoute = snapshot();

  Core.itemSet(collection.id, added.id, field.id, alternate);
  const rerouted = snapshot();
  expect(contentOnly(before, sameRoute)).toEqual({ ok: true });
  expect(contentOnly(before, rerouted)).toEqual({ ok: false, where: 'form routing' });
});

test('portable WordPress handling remains part of the route when Cloud already has an external action', () => {
  const { form } = fixture();
  form.props.action = external;
  form.props.mode = 'wordpress';
  const before = snapshot();
  form.props.mode = 'external';
  expect(formRoutingChanged(before, snapshot())).toBe(true);
});

test('GET field labels cannot add or suppress fixed query pairs through an implicit input name', () => {
  const { form } = fixture();
  form.props.method = 'get';
  form.props.action = 'https://receiver.example.test/search?campaign=Harbor&campaign=River&lang=en';
  const field = { type: 'text', label: 'Search', name: '' };
  form.props.fields = [field];
  const before = snapshot();
  field.label = 'Campaign';
  const collision = snapshot();
  field.name = 'query';
  field.label = 'Search';
  const explicitName = snapshot();
  field.label = 'Campaign';
  const explicitNameEdited = snapshot();

  const fixedPairs = (doc: Doc) => [...renderSite(doc, [], cloud).files.get('index.html')!
    .matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map(([, name, value]) => [name, value]);
  expect(fixedPairs(before)).toEqual([['campaign', 'Harbor'], ['campaign', 'River'], ['lang', 'en']]);
  expect(fixedPairs(collision)).toEqual([['lang', 'en']]);
  expect(contentOnly(before, collision)).toEqual({ ok: false, where: 'form routing' });
  expect(contentOnly(collision, before)).toEqual({ ok: false, where: 'form routing' });
  expect(contentOnly(explicitName, explicitNameEdited)).toEqual({ ok: true });
});

test('a new native placement is permitted, but a newly introduced external form is privileged', () => {
  const before = blankDoc('Northbank Workshop');
  const { form } = fixture();
  expect(formRoutingChanged(before, snapshot())).toBe(false);
  form.props.action = external;
  expect(formRoutingChanged(before, snapshot())).toBe(true);
  const routed = snapshot();
  form.props.action = '';
  expect(formRoutingChanged(routed, snapshot())).toBe(true);
});

test.each(['standard', 'optimized Cloud'] as const)('%s save requires owner authority to reroute a CMS-bound form', async savePath => {
  const { form, section } = fixture();
  const { collection, field, entry } = cmsSource(section, '');
  Core.bindSet(form, 'action', Core.bindField(field.id));
  const before = snapshot();
  Core.itemSet(collection.id, entry.id, 'title', 'Weekend workshop');
  const copy = snapshot();
  Core.itemSet(collection.id, entry.id, field.id, external);
  const rerouted = snapshot();

  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let saved = await store.create({ host: 'northbank.invalid', name: before.meta.name, doc: before });
  const publishedVersion = saved.publishedVersion;
  const editor = await auth.ensureAuthUser('editor', 'editor@example.test', 'Editor');
  const owner = await auth.ensureAuthUser('owner', 'owner@example.test', 'Owner');
  await auth.grant(saved.id, editor.id, 'content');
  await auth.grant(saved.id, owner.id, 'owner');
  const requiredRoles: string[] = [];
  const cloudMutations: CloudMutationFastPath = {
    cachedSaveSource: () => ({ site: saved, assets: [] }),
    async saveAuthorized(input) {
      requiredRoles.push(input.requiredRole);
      const user = input.identity.authUserId === 'owner' ? owner : editor;
      const membership = await auth.membership(input.siteId, user.id);
      if (!membership || !roleAllows(membership.role, input.requiredRole)) return { status: 'forbidden' };
      const result = await store.save(input.siteId, input.doc, input.sourceVersion, user.id);
      if (!result.ok) return { status: 'conflict', currentVersion: result.conflict?.theirs || 0 };
      saved = result.site!;
      return { status: 'saved', site: saved };
    },
    cachedPublishSource: () => null,
    publishAuthorized: async () => { throw new Error('The fixture only saves drafts'); },
  };
  let identity = { authUserId: 'editor', email: editor.email, name: editor.name };
  const app = createApp({
    store, auth, editorHost: 'workspace.example.test', editorOrigin: 'https://workspace.example.test',
    ...(savePath === 'optimized Cloud' ? { accountAuth: { identity: async () => identity } as unknown as AccountAuth, cloudMutations } : {}),
  });
  const cookie = async (userId: string) => {
    const token = newToken();
    await auth.putSession(hashToken(token), userId, Date.now() + 60_000);
    return `pc_session=${token}`;
  };
  const editorCookie = await cookie(editor.id);
  const ownerCookie = await cookie(owner.id);
  const put = (doc: Doc, version: number, cookie: string) => app.request(`https://workspace.example.test/api/sites/${saved.id}`, {
    method: 'PUT', headers: { host: 'workspace.example.test', 'content-type': 'application/json', cookie, origin: 'https://workspace.example.test' },
    body: JSON.stringify({ doc, version }),
  });
  expect((await put(copy, 1, editorCookie)).status).toBe(200);
  expect((await put(rerouted, 2, editorCookie)).status).toBe(403);
  expect((await store.byId(saved.id))?.version).toBe(2);
  identity = { authUserId: 'owner', email: owner.email, name: owner.name };
  expect((await put(rerouted, 2, ownerCookie)).status).toBe(200);
  const result = await store.byId(saved.id);
  expect(result?.version).toBe(3);
  expect(result?.publishedVersion).toBe(publishedVersion);
  expect(renderSite(result!.doc, [], cloud).files.get('index.html')).toContain(`action="${external}"`);
  if (savePath === 'optimized Cloud') expect(requiredRoles).toEqual(['write', 'admin', 'admin']);
});
