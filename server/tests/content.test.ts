/* What a client may change.

   The allow cases are quick. The weight is on the refusals, and on one case in particular:
   an invented field nobody has thought about must be refused, because that is the property
   the whole design rests on. `skeleton()` blanks what is content and compares the rest, so a
   field added to a widget next year is structure until somebody says otherwise. A check
   written the other way round — listing what may differ — would have permitted it. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import { contentOnly } from '../src/content.ts';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore, type Role } from '../src/auth.ts';
import { adopt, renderSite } from '../src/render.ts';
import type { Doc, Node as PcNode } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

/** the first node of a type, anywhere in the document */
const find = (doc: Doc, type: string): PcNode => {
  let hit: PcNode | null = null;
  const walk = (ns: PcNode[]) => ns.forEach(n => {
    if (!hit && n.type === type) hit = n;
    walk(n.children || []);
  });
  doc.pages.forEach(p => walk(p.tree));
  walk(doc.header); walk(doc.footer);
  if (!hit) throw new Error(`the fixture has no ${type}`);
  return hit;
};

const change = (fn: (doc: Doc) => void) => {
  const before = demo();
  const after = structuredClone(before);
  fn(after);
  return contentOnly(before, after);
};

/* ------------------------------------------------------------------ allowed */

test('an unchanged document is content-only, trivially', () => {
  a.equal(change(() => { }).ok, true);
});

test('words are content — in a heading, a button, a paragraph, an alt text', () => {
  a.equal(change(d => { find(d, 'heading').props.text = 'New words'; }).ok, true);
  a.equal(change(d => { find(d, 'button').props.text = 'Press me'; }).ok, true);
  a.equal(change(d => { find(d, 'text').props.html = '<p>Rewritten.</p>'; }).ok, true);
  a.equal(change(d => { find(d, 'image').props.alt = 'A described picture'; }).ok, true);
});

test('rich text keeps toolbar formatting and refuses executable markup', () => {
  a.equal(change(d => { find(d, 'text').props.html = '<p><strong>Safe</strong> <a href="https://example.com">link</a></p>'; }).ok, true);
  for (const html of [
    '<img src=x onerror="alert(1)">',
    '<script>fetch("/api/sites")</script>',
    '<p style="background:url(https://evil.test)">Tracked</p>',
    '<a href="javascript:alert(1)">Bad link</a>'
  ]) {
    const result = change(d => { find(d, 'text').props.html = html; });
    a.equal(result.ok, false, html);
    a.match(result.where || '', /markup this account may not publish/);
  }
});

test('Embed HTML is owner-only even though its words remain searchable', () => {
  const before = demo();
  before.pages[0].tree[0].children.push(Core.N('embed', { html: '<p>Owner widget</p>' }, {}, []));
  const after = structuredClone(before);
  find(after, 'embed').props.html = '<script>alert(1)</script>';
  a.equal(contentOnly(before, after).ok, false);
  a.equal(Core.contentKeys('embed').size, 0, 'the limited editor must not offer the control');
});

test('a page’s own title and description are content', () => {
  a.equal(change(d => { d.pages[0].title = 'A better title'; }).ok, true);
  a.equal(change(d => { d.pages[0].desc = 'A better description'; }).ok, true);
});

test('a nested slot is content wherever it sits — an accordion row, a table body', () => {
  /* a document that has the widgets, so both sides share the same structure */
  const seeded = demo();
  seeded.pages[0].tree[0].children.push(Core.N('accordion', {}, {}, []), Core.N('table', {}, {}, []));

  const edited = structuredClone(seeded);
  const rows = find(edited, 'accordion').props.items!;
  rows[0].q = 'A different question';
  rows[0].a = 'A different answer';
  find(edited, 'table').props.body = 'Plan|Cost\nFree|0';
  find(edited, 'table').props.caption = 'A caption';

  a.equal(contentOnly(seeded, edited).ok, true);
});

test('adding words where there were none is content, not structure', () => {
  /* The first version blanked only the slots that had a value, so writing a caption for the
     first time looked like a new field appearing and was refused. */
  const seeded = demo();
  seeded.pages[0].tree[0].children.push(Core.N('table', {}, {}, []));
  const edited = structuredClone(seeded);
  a.equal(find(edited, 'table').props.caption, undefined, 'the fixture starts without one');
  find(edited, 'table').props.caption = 'Prices from April';
  a.equal(contentOnly(seeded, edited).ok, true);

  /* and taking them away again */
  const cleared = structuredClone(edited);
  delete cleared.pages[0].tree[0].children.slice(-1)[0].props.caption;
  a.equal(contentOnly(edited, cleared).ok, true);
});

test('CMS values and the draft flag are content', () => {
  const before = demo();
  Core.restore(before);
  const col = Core.collectionAdd('Journal');
  Core.fieldAdd(col.id, 'Title', 'text');
  const item = Core.itemAdd(col.id)!;
  Core.itemSet(col.id, item.id, col.fields[0].id, 'First post');
  const seeded = structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  }) as Doc;

  const edited = structuredClone(seeded);
  const c = edited.meta.collections![0];
  c.items[0].values[c.fields[0].id] = 'A retitled post';
  a.equal(contentOnly(seeded, edited).ok, true);

  const held = structuredClone(seeded);
  held.meta.collections![0].items[0].draft = 1;
  a.equal(contentOnly(seeded, held).ok, true, 'holding a post back is a content decision');
});

test('reading the CMS does not become a change to the site', () => {
  /* `collections()` in the core materialises `meta.collections` as a side effect of reading
     it, so opening the CMS panel turned a document without collections into one with an empty
     list — and a content account could then save nothing until it reloaded. Found by clicking
     the tab in a browser, which is the only place a lazy getter like that shows up. */
  const before = demo();
  /* set explicitly rather than assumed: `state.meta` outlives a `seed()` inside one process,
     so whether the key is there depends on which test ran first. In a fresh browser it is
     not there, which is the case that broke. */
  delete before.meta.collections;

  const after = structuredClone(before);
  Core.restore(after);
  Core.collections();                       // exactly what opening the panel does
  a.deepEqual(after.meta.collections, [], 'reading it created it');

  a.equal(contentOnly(before, after).ok, true, 'and that must not count as a change');
  a.equal(contentOnly(after, before).ok, true, 'in either direction');

  /* a collection that actually exists is still structure */
  const real = structuredClone(before);
  Core.restore(real);
  Core.collectionAdd('Journal');
  a.equal(contentOnly(before, real).ok, false, 'declaring one is not content');
});

/* --------------------------------------------------- images, the narrow way */

const withImage = (src: string) => {
  const doc = demo();
  find(doc, 'image').props.src = src;
  return doc;
};
const swap = (from: string, to: string, ids: string[]) => {
  const before = withImage(from);
  const after = structuredClone(before);
  find(after, 'image').props.src = to;
  return contentOnly(before, after, new Set(ids));
};

test('what matters is where the image now points, not what it used to be', () => {
  /* The first version compared the pair, and refused the case that matters most: the demo's
     image has no src, so a client setting one for the first time read as a change in kind.
     What a value used to be is not the question. */
  a.equal(swap('asset:a1', 'asset:a2', ['a1', 'a2']).ok, true, 'one upload for another');
  a.equal(swap('', 'asset:a1', ['a1']).ok, true, 'setting one for the first time');
  a.equal(swap('asset:a1', '', ['a1']).ok, true, 'and clearing it again');
  a.equal(swap('https://elsewhere.test/x.png', 'asset:a1', ['a1']).ok, true,
    'replacing somebody else’s image with their own upload');
});

test('an image may not be pointed at a URL, which is the whole reason the rule is narrow', () => {
  a.equal(swap('asset:a1', 'https://elsewhere.test/x.png', ['a1']).ok, false);
  a.equal(swap('', 'https://elsewhere.test/tracker.png', ['a1']).ok, false,
    'an empty field is not an invitation to point anywhere');
  a.equal(swap('https://a.test/x.png', 'https://b.test/y.png', ['a1']).ok, false,
    'a URL left in place by an owner stays, but a content account may not move it');
});

test('an image may not be pointed at somebody else’s asset', () => {
  a.equal(swap('asset:a1', 'asset:stolen', ['a1']).ok, false,
    'an id this site does not own is not this site’s content');
  a.equal(swap('asset:a1', 'asset:a2', ['a1']).ok, false, 'a2 is not in the set');
});

/** the demo has no gallery, so a test about one puts it there */
const withGallery = (tiles: { src: string; alt: string }[]) => {
  const doc = demo();
  doc.pages[0].tree[0].children.push(Core.N('gallery', { items: tiles }, {}, []));
  return doc;
};

test('a gallery tile and a page’s share image follow the same rule', () => {
  const before = withGallery([{ src: 'asset:a1', alt: 'one' }, { src: 'asset:a2', alt: 'two' }]);
  before.pages[0].ogImage = 'asset:a1';

  const ok = structuredClone(before);
  find(ok, 'gallery').props.items![0].src = 'asset:a2';
  ok.pages[0].ogImage = 'asset:a2';
  a.equal(contentOnly(before, ok, new Set(['a1', 'a2'])).ok, true);

  const no = structuredClone(before);
  find(no, 'gallery').props.items![0].src = 'https://elsewhere.test/x.png';
  a.equal(contentOnly(before, no, new Set(['a1', 'a2'])).ok, false);
});

test('with no assets known, no image may be set', () => {
  /* the default, and what a server with no asset store gives */
  a.equal(swap('asset:a1', 'asset:a2', []).ok, false);
  a.equal(swap('asset:a1', '', []).ok, true, 'though clearing one asks nothing of the store');
});

test('an image the owner left pointing at a URL does not block every content save', () => {
  /* The second mistake here: checking every image in the document rather than the ones this
     save moved. An owner may point an image wherever they like, and if that counts against
     the client then every content save on that site is refused for a value the client never
     touched. */
  const before = withImage('https://owner-put-this-here.test/x.png');
  const after = structuredClone(before);
  find(after, 'heading').props.text = 'Only the words changed';
  a.equal(contentOnly(before, after, new Set(['a1'])).ok, true);

  /* and moving it is still refused */
  const moved = structuredClone(before);
  find(moved, 'image').props.src = 'https://somewhere-else.test/y.png';
  a.equal(contentOnly(before, moved, new Set(['a1'])).ok, false);
});

test('a refusal says which image, because a document has many', () => {
  const res = swap('', 'https://elsewhere.test/x.png', ['a1']);
  a.equal(res.ok, false);
  a.match(res.where!, /image\.src points somewhere this account may not/);
});

test('adding or removing a gallery tile is still structure, however the images move', () => {
  const before = withGallery([{ src: 'asset:a1', alt: 'one' }]);
  const after = structuredClone(before);
  find(after, 'gallery').props.items!.push({ src: 'asset:a2', alt: 'two' });
  a.equal(contentOnly(before, after, new Set(['a1', 'a2'])).ok, false);
});

/* ------------------------------------------------------------------ refused */

test('styling is not content', () => {
  a.equal(change(d => { find(d, 'heading').css.d['color'] = 'red'; }).ok, false);
  a.equal(change(d => { find(d, 'heading').css.m['font-size'] = '99px'; }).ok, false);
  a.equal(change(d => { find(d, 'section').css.d['padding'] = '0'; }).ok, false);
  a.equal(change(d => { (find(d, 'heading') as PcNode & { st?: unknown }).st = { hover: { d: { color: 'red' }, t: {}, m: {} } }; }).ok, false);
  a.equal(change(d => { find(d, 'heading').cls = ['whatever']; }).ok, false);
  a.equal(change(d => { find(d, 'section').anim = { name: 'fade-up' }; }).ok, false);
});

test('structure is not content', () => {
  a.equal(change(d => { d.pages[0].tree[0].children.push(Core.N('heading', {}, {}, [])); }).ok, false, 'adding');
  a.equal(change(d => { d.pages[0].tree.pop(); }).ok, false, 'removing');
  a.equal(change(d => { d.pages[0].tree.reverse(); }).ok, false, 'reordering');
  a.equal(change(d => { find(d, 'heading').type = 'text'; }).ok, false, 'retyping');
  a.equal(change(d => { find(d, 'heading').id = 'renamed'; }).ok, false, 'renaming a node');
});

test('pages are structure, and their addresses are not content', () => {
  a.equal(change(d => { d.pages.push({ ...structuredClone(d.pages[0]), id: 'p9', slug: 'new', name: 'New' }); }).ok, false);
  a.equal(change(d => { d.pages.pop(); }).ok, false);
  a.equal(change(d => { d.pages[1].slug = 'moved'; }).ok, false, 'a slug is an address');
  a.equal(change(d => { d.pages[0].name = 'Renamed'; }).ok, false, 'the name is what the editor lists');
});

test('the project is not content', () => {
  a.equal(change(d => { d.meta.name = 'Someone else'; }).ok, false);
  a.equal(change(d => { d.meta.baseUrl = 'https://elsewhere.test'; }).ok, false);
  a.equal(change(d => { d.meta.css = 'body{display:none}'; }).ok, false, 'custom CSS is a way to change anything');
  a.equal(change(d => { d.meta.headHtml = '<script src="//evil.test/x.js"></' + 'script>'; }).ok, false,
    'and the head block is a way to run anything');
  a.equal(change(d => { d.meta.tokens = null; }).ok, false);
});

test('a link is not content, for now, on purpose', () => {
  a.equal(change(d => { find(d, 'button').props.link = 'https://elsewhere.test'; }).ok, false);
});

test('a field nobody has thought of is refused, which is the whole design', () => {
  /* If this ever passes, the check has been rewritten as a list of what may change and the
     next widget prop will be silently writable by every client on the server. */
  a.equal(change(d => { (find(d, 'heading').props as Record<string, unknown>).somethingNew = 'x'; }).ok, false);
  a.equal(change(d => { (find(d, 'heading') as unknown as Record<string, unknown>).inventedKey = 1; }).ok, false);
  a.equal(change(d => { (d.meta as unknown as Record<string, unknown>).futureSetting = true; }).ok, false);
});

test('a refusal says where, for debugging rather than for logic', () => {
  const res = change(d => { find(d, 'heading').css.d['color'] = 'red'; });
  a.equal(res.ok, false);
  a.match(res.where!, /^at \d+: /);
});

/* ------------------------------------------------------- through the API */

test('a content client saves words and is refused the layout', async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const user = await auth.createUser('client@acme.test');
  await auth.grant(site.id, user.id, 'content' as Role);

  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init, headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'client@acme.test' }) });
  const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  const loaded = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc; version: number };

  /* the edit a client makes */
  const words = structuredClone(loaded.doc);
  find(words, 'heading').props.text = 'A client wrote this';
  const ok = await req(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: words, version: loaded.version })
  }, cookie);
  a.equal(ok.status, 200, 'a content client must be able to change words');

  const saved = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc };
  a.equal(find(saved.doc, 'heading').props.text, 'A client wrote this',
    'the content edit is present in the shared draft');
  const live = await app.request(new Request('http://acme.test/', { headers: { host: 'acme.test' } }));
  a.equal(/A client wrote this/.test(await live.text()), false,
    'a content autosave must not leak onto the published site');

  /* the edit a client does not get to make */
  const styled = structuredClone(words);
  find(styled, 'heading').css.d['color'] = 'red';
  const no = await req(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: styled, version: loaded.version + 1 })
  }, cookie);
  a.equal(no.status, 403);
  const body = await no.json() as { error: string; detail: string };
  a.equal(body.error, 'content only');
  a.match(body.detail, /text and CMS content/);
});

test('the check is against what is stored, not against what the client claims it loaded', async () => {
  /* Otherwise a client could send a structural change together with a skeleton that matches
     it, and the comparison would be against their own document rather than the real one. */
  const store = new MemoryStore();
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });

  const mine = structuredClone(site.doc);
  mine.pages[0].tree.pop();
  a.equal(contentOnly(site.doc, mine).ok, false);
  a.equal(contentOnly(mine, mine).ok, true, 'and it would pass if compared against itself');
});

test('a content client can still save against a row an older editor wrote', async () => {
  /* The case that made the save path adopt both documents rather than one. A row stored at v7
     is loaded, migrated by the editor on the way in, and sent back at v8 — so comparing what
     arrived against what is stored finds a difference in every migrated property and calls it
     structure. The client would be told they had changed the layout by opening the page. */
  const legacy = demo() as any;
  legacy.v = 7;
  legacy.schemaVersion = 7;
  find(legacy, 'button').css.d['--hover-bg'] = '#ff0000';

  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; }
  });
  /* straight into the store, which is what "a row that is already there" means */
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: structuredClone(legacy) });
  const user = await auth.createUser('client@acme.test');
  await auth.grant(site.id, user.id, 'content' as Role);

  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init, headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'client@acme.test' }) });
  const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  const loaded = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc; version: number };
  /* the editor migrates on load — this is that step */
  const edited = adopt(structuredClone(loaded.doc)) as Doc;
  find(edited, 'heading').props.text = 'A client wrote this';

  /* and this is why the route adopts the stored side too: the raw comparison refuses */
  a.equal(contentOnly(loaded.doc, edited).ok, false, 'the test bites — unadopted, this is structure');

  const res = await req(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: edited, version: loaded.version })
  }, cookie);
  a.equal(res.status, 200, 'a legacy row plus a content account is a save, not a refusal');

  const saved = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc };
  a.equal(find(saved.doc, 'heading').props.text, 'A client wrote this');
  const html = renderSite(adopt(saved.doc) as Doc).files.get('index.html') || '';
  a.match(html, /A client wrote this/);
  a.match(html, /:hover\{[^}]*background-color:#ff0000/, 'and the hover survived the draft round trip');
});

test('a document from a newer editor is refused with something a person can read', async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; }
  });
  const site = await store.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const user = await auth.createUser('owner@acme.test');
  await auth.grant(site.id, user.id, 'owner' as Role);

  const req = (path: string, init: RequestInit = {}, cookie?: string) =>
    app.request(new Request(`http://admin.test${path}`, {
      ...init, headers: { host: 'admin.test', 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'owner@acme.test' }) });
  const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  const loaded = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc; version: number };
  const future = structuredClone(loaded.doc) as any;
  future.schemaVersion = Core.SCHEMA + 1;
  future.v = Core.SCHEMA + 1;
  find(future, 'heading').props.text = 'From the future';

  const res = await req(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: future, version: loaded.version })
  }, cookie);
  a.equal(res.status, 409);
  const body = await res.json() as { error: string; detail: string };
  a.equal(body.error, 'newer');
  a.match(body.detail, /newer version of the editor|deploy the server/);

  /* and it did not land — a refusal that still stored the document would be the worst of
     both, since the point is not to write a shape this build cannot read back */
  const after = await store.byId(site.id);
  a.notEqual(find(after!.doc, 'heading').props.text, 'From the future');
  a.equal(after!.version, loaded.version, 'and the version did not move');
});

/* ------------------------------------------------- component instances */

/** A component with one property of each interesting kind, and an instance on page 1. */
function withComponent() {
  const doc = demo();
  Core.restore(doc);
  const box = find(doc, 'column');
  const cid = Core.componentFromNode(box.id, 'Feature card')!;
  const def = Core.findComponent(cid)!;
  const words = Core.propAdd(cid, 'Title', 'text', 'Untitled')!;
  const pic = Core.propAdd(cid, 'Photo', 'img', '')!;
  const layout = Core.propAdd(cid, 'Layout', 'select', 'wide')!;
  /* the definition's own heading reads the words property */
  Core.bindSet(def.node.children[0], 'text', { src: 'prop', path: words });
  const out = structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  }) as Doc;
  return { doc: out, cid, words, pic, layout, instId: box.id };
}

/** the instance in a document, by id */
const instOf = (doc: Doc, id: string): PcNode => {
  let hit: PcNode | null = null;
  const walk = (ns: PcNode[]) => ns.forEach(n => { if (n.id === id) hit = n; walk(n.children || []); });
  doc.pages.forEach(p => walk(p.tree));
  if (!hit) throw new Error('no instance ' + id);
  return hit;
};

test('the words on an instance are content', () => {
  const { doc, words, instId } = withComponent();
  const after = structuredClone(doc);
  (instOf(after, instId) as unknown as { vals?: Record<string, string> }).vals = { [words]: 'A client wrote this' };
  a.equal(contentOnly(doc, after).ok, true);
});

test('filling in a property that had no value is content, not a change in kind', () => {
  /* The same trap the text slots had: comparing "absent" against "written" reads as
     structure, and a client typing into an empty field is told they changed the layout. */
  const { doc, words, instId } = withComponent();
  a.equal((instOf(doc, instId) as unknown as { vals?: unknown }).vals, undefined, 'the fixture starts empty');
  const after = structuredClone(doc);
  (instOf(after, instId) as unknown as { vals: Record<string, string> }).vals = { [words]: 'First words' };
  a.equal(contentOnly(doc, after).ok, true);

  /* and clearing it again is content too */
  a.equal(contentOnly(after, doc).ok, true);
});

test('switching what a component does is not content', () => {
  /* A select property changes the component's behaviour. That is the same kind of decision as
     a heading's HTML tag, which this account has never been able to make. */
  const { doc, layout, instId } = withComponent();
  const after = structuredClone(doc);
  (instOf(after, instId) as unknown as { vals: Record<string, string> }).vals = { [layout]: 'narrow' };
  a.equal(contentOnly(doc, after).ok, false);
});

test('a value for a property nobody declared is refused', () => {
  /* It cannot come from the panel, so it came from a client writing JSON. Refused for the
     same reason an invented prop key is: the check permits what is declared, not what is
     plausible. */
  const { doc, instId } = withComponent();
  const after = structuredClone(doc);
  (instOf(after, instId) as unknown as { vals: Record<string, string> }).vals = { invented: 'x' };
  a.equal(contentOnly(doc, after).ok, false);
});

test('changing what a component is is not content, however small the change', () => {
  const { doc, cid } = withComponent();
  const words = structuredClone(doc);
  const def = (words.meta.components || []).find(c => c.id === cid)!;
  def.node.children[0].props.text = 'Rewritten in the definition';
  a.equal(contentOnly(doc, words).ok, false, 'a definition is the site, not one page’s words');

  const renamed = structuredClone(doc);
  (renamed.meta.components || []).find(c => c.id === cid)!.name = 'Renamed';
  a.equal(contentOnly(doc, renamed).ok, false);

  const declared = structuredClone(doc);
  (declared.meta.components || []).find(c => c.id === cid)!.props.push(
    { k: 'extra', label: 'Extra', t: 'text', def: '' });
  a.equal(contentOnly(doc, declared).ok, false, 'declaring a property is a change to the component');
});

test('an image property takes an upload of this site and nothing else', () => {
  const { doc, pic, instId } = withComponent();
  const mine = new Set(['abc123']);

  const upload = structuredClone(doc);
  (instOf(upload, instId) as unknown as { vals: Record<string, string> }).vals = { [pic]: 'asset:abc123' };
  a.equal(contentOnly(doc, upload, mine).ok, true, 'an upload of theirs is content');

  const url = structuredClone(doc);
  (instOf(url, instId) as unknown as { vals: Record<string, string> }).vals = { [pic]: 'https://example.com/x.jpg' };
  a.equal(contentOnly(doc, url, mine).ok, false, 'a URL is not');

  const theirs = structuredClone(doc);
  (instOf(theirs, instId) as unknown as { vals: Record<string, string> }).vals = { [pic]: 'asset:zzz999' };
  a.equal(contentOnly(doc, theirs, mine).ok, false, 'nor is somebody else’s asset id');
});

test('what a client puts in a slot is still structure', () => {
  /* A slot's content is the page's own nodes, so adding one is adding a node — which has never
     been a content edit and is not one because a component is involved. */
  const { doc, instId } = withComponent();
  const after = structuredClone(doc);
  instOf(after, instId).children.push(Core.N('heading', { text: 'Mine' }));
  a.equal(contentOnly(doc, after).ok, false);
});

test('which variant an instance is is not content', () => {
  /* A variant decides several properties at once, including the ones that switch what the
     component does. It is refused by falling out of the shape rather than by a rule: `variant`
     is a field on the node and nothing blanks it, so it has to match. */
  const { doc, instId } = withComponent();
  const cid = (doc.meta.components || [])[0].id;
  (doc.meta.components || [])[0].variants = [{ id: 'loud', name: 'Loud', values: {} }];
  void cid;
  const after = structuredClone(doc);
  (instOf(after, instId) as unknown as { variant?: string }).variant = 'loud';
  a.equal(contentOnly(doc, after).ok, false);
});

test('a condition is structure, not content', () => {
  /* Whether an element is on the page at all is not one page's words. Refused by the same
     property as everything else: `showIf` is a field on the node and nothing blanks it. */
  const { doc, instId } = withComponent();
  const after = structuredClone(doc);
  (instOf(after, instId) as unknown as { showIf?: unknown }).showIf =
    { bind: { src: 'prop', path: 'title' }, op: 'set' };
  a.equal(contentOnly(doc, after).ok, false);
});

/* ------------------------------------------- a client editing a real CMS site

   The whole point of the server, exercised on a document that has the things a real one has: a
   collection, a page listing it, a page templating one item, and a conditional element. */

function notesSite(): Doc {
  Core.seed();
  Core.blankProject('Notes');
  Core.state.meta.collections = [];        // schemas are a library — see render.test.ts
  const col = Core.collectionAdd('Notes')!;
  const title = col.fields[0].id;
  const body = Core.fieldAdd(col.id, 'Body', 'rich')!.id;
  for (const [t, b] of [['First note', '<p>One.</p>'], ['Second note', '<p>Two.</p>']]) {
    const it = Core.itemAdd(col.id)!;
    Core.itemSet(col.id, it.id, title, t);
    Core.itemSet(col.id, it.id, body, b);
  }
  const h = Core.insert('heading', null, 0)!;
  h.props.text = 'Notes'; h.props.level = 'h1'; h.props.ts = 'display';
  const det = Core.pageFromTemplate('blank', 'Note')!;
  Core.state.pages.push(det);
  det.slug = 'note'; det.collection = col.id; det.title = 'A note'; det.desc = 'One note.';
  Core.state.cur = 1;
  const dh = Core.insert('heading', null, 0)!;
  dh.props.level = 'h1'; dh.props.ts = 'display';
  Core.bindSet(dh, 'text', Core.bindField(title));
  Core.state.cur = 0;
  return structuredClone({
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  }) as Doc;
}

test('a client rewrites an item and the detail page it generates changes with it', async () => {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  let sent = '';
  const app = createApp({
    store, auth, editorHost: 'admin.test', editorOrigin: 'http://admin.test',
    sendLink: (_t, url) => { sent = url; }
  });
  const site = await store.create({ host: 'notes.test', name: 'Notes', doc: notesSite() });
  const user = await auth.createUser('client@notes.test');
  await auth.grant(site.id, user.id, 'content' as Role);

  const req = (path: string, init: RequestInit = {}, cookie?: string, host = 'admin.test') =>
    app.request(new Request(`http://${host}${path}`, {
      ...init, headers: { host, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }
    }));
  await req('/auth/login', { method: 'POST', body: JSON.stringify({ email: 'client@notes.test' }) });
  const cb = await req(`/auth/callback?token=${new URL(sent).searchParams.get('token')}`);
  const cookie = (cb.headers.get('set-cookie') || '').split(';')[0];

  /* the detail page is served, before anything is edited */
  const before = await req('/notes/first-note', {}, undefined, 'notes.test');
  a.equal(before.status, 200, 'a per-item page is a page this server serves');
  a.match(await before.text(), /<h1[^>]*>First note</);

  /* the client rewrites it */
  const loaded = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc; version: number };
  const edited = structuredClone(loaded.doc);
  const col = (edited.meta.collections || [])[0];
  const titleField = col.fields[0].id;
  col.items[0].values[titleField] = 'The first note, renamed';
  const res = await req(`/api/sites/${site.id}`, {
    method: 'PUT', body: JSON.stringify({ doc: edited, version: loaded.version })
  }, cookie);
  a.equal(res.status, 200, 'words in a CMS item are content');

  /* The shared draft changes, while the active release at the stable URL remains unchanged. */
  const saved = await (await req(`/api/sites/${site.id}`, {}, cookie)).json() as { doc: Doc };
  const savedCol = (saved.doc.meta.collections || [])[0];
  a.equal(savedCol.items[0].values[titleField], 'The first note, renamed');
  const after = await req('/notes/first-note', {}, undefined, 'notes.test');
  a.equal(after.status, 200);
  const afterHtml = await after.text();
  a.match(afterHtml, /<h1[^>]*>First note</);
  a.equal(/The first note, renamed/.test(afterHtml), false, 'the draft value must not leak publicly');
});

test('a client cannot add an item, delete one, or change the schema', async () => {
  /* Words are content. How many things there are, and what fields they have, is the site. */
  const base = notesSite();
  const col = (d: Doc) => (d.meta.collections || [])[0];

  const added = structuredClone(base);
  col(added).items.push({ id: 'nnew', slug: 'third', values: {} });
  a.equal(contentOnly(base, added).ok, false, 'adding an item is structure');

  const removed = structuredClone(base);
  col(removed).items.pop();
  a.equal(contentOnly(base, removed).ok, false, 'and so is removing one');

  const schema = structuredClone(base);
  col(schema).fields.push({ id: 'extra', name: 'Extra', type: 'text', required: 0 });
  a.equal(contentOnly(base, schema).ok, false, 'and so is a new field');

  const held = structuredClone(base);
  col(held).items[0].draft = 1;
  a.equal(contentOnly(base, held).ok, true, 'holding one back is content — it is their words');
});
