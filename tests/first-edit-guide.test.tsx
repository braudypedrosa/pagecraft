// @vitest-environment jsdom
import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { FirstEditGuide, createFirstEditGuide, guideFingerprint, guideNodes, guideTaskState } from '../app/src/ui/FirstEditGuide';
import { rig, type Rig } from './ui.setup';

type GuideDoc = Parameters<typeof createFirstEditGuide>[0];
type GuideNode = Parameters<typeof guideFingerprint>[0];
const node = (id: string, type: string, props = {}): GuideNode => ({ id, type, props });
const template = (): GuideDoc => ({ pages: [{ id: 'home', tree: [
  node('heading', 'heading', { text: 'Private initial headline' }),
  node('image', 'image', { src: 'https://example.com/private-photo.jpg' }),
  node('button', 'button', { text: 'Private initial action', link: '/private-destination' })
] }] });
let r: Rig;
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    clear: vi.fn(() => storage.clear())
  });
  history.replaceState(null, '', '?start=template');
  r = rig({ siteDraft: () => ({ siteId: 'guide-test-site', version: 1 }) });
  C.state.pages = [C.state.pages[0]];
  Object.assign(L, { guideSavedDocument: () => null, guidePreview: () => r.calls.push(['guidePreview']) });
});
afterEach(() => {
  act(() => r.draw(null)); r.host.remove();
  vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, '', '/');
});

test('guide targets nested content on the first page with a usable heading and stores fingerprints only', () => {
  const doc = template();
  doc.pages.unshift({ id: 'empty', tree: [] });
  doc.pages[1].tree = [{ id: 'section', type: 'section', children: doc.pages[1].tree }];
  const guide = createFirstEditGuide(doc);
  assert.deepEqual(guide.tasks.map(task => [task.type, task.pageId]), [['heading', 'home'], ['image', 'home'], ['button', 'home']]);
  const stored = JSON.stringify(guide);
  assert.ok(!stored.includes('Private'));
  assert.ok(!stored.includes('https://'));
  assert.ok(!stored.includes('private-destination'));
  assert.ok(guide.tasks.every(task => /^[a-f0-9]+$/.test(task.before)));
});

test('different template shapes get only supported targets or a safe empty fallback', () => {
  assert.deepEqual(createFirstEditGuide({ pages: [] }).tasks, []);
  assert.deepEqual(createFirstEditGuide({ pages: [{ id: 'blank', tree: [] }] }).tasks, []);
  const doc = { pages: [{ id: 'image-only', tree: [node('photo', 'image', { src: 'one.jpg' })] }] };
  assert.deepEqual(createFirstEditGuide(doc).tasks.map(task => task.type), ['image']);
});

test('hidden, bound, collection, component and conditional subtrees cannot become first-edit targets', () => {
  const child = node('nested-heading', 'heading', { text: 'Hidden or dynamic' });
  const excluded = [
    { id: 'hidden', type: 'section', hide: { t: true }, children: [child] },
    { id: 'bound', type: 'heading', bind: { text: { src: 'cms', path: 'title' } } },
    { id: 'list', type: 'list', children: [child] },
    { id: 'instance', type: 'heading', use: 'component-id', props: { text: 'Instance' } },
    { id: 'source', type: 'section', src: 'collection-id', children: [child] },
    { id: 'conditional', type: 'section', showIf: { path: 'visible' }, children: [child] }
  ];
  assert.deepEqual(guideNodes(excluded), []);
  const staticNode = { ...child, hide: { d: false, t: false }, bind: {} };
  assert.deepEqual(guideNodes([staticNode]), [staticNode]);
});

test('only relevant content changes complete tasks and reverting saved content reopens them', () => {
  const doc = template();
  const guide = createFirstEditGuide(doc);
  assert.deepEqual(guide.tasks.map(task => guideTaskState(task, doc)), ['pending', 'pending', 'pending']);
  doc.pages[0].tree[0].props!.unrelatedStyle = 'different';
  assert.equal(guideTaskState(guide.tasks[0], doc), 'pending');
  doc.pages[0].tree[0].props!.text = 'New headline';
  doc.pages[0].tree[1].props!.src = 'new.jpg';
  doc.pages[0].tree[2].props!.link = '/new-destination';
  assert.deepEqual(guide.tasks.map(task => guideTaskState(task, doc)), ['saved', 'saved', 'saved']);
  assert.equal(guideTaskState(guide.tasks[0], template()), 'pending');
});

test('removed pages, replaced node types and newly hidden or dynamic targets remain unavailable, not completed', () => {
  const guide = createFirstEditGuide(template());
  assert.equal(guideTaskState(guide.tasks[0], { pages: [] }), 'missing');
  for (const replacement of [node('heading', 'text'), { ...node('heading', 'heading'), hide: { d: true } }, { ...node('heading', 'heading'), bind: { text: {} } }]) {
    assert.equal(guideTaskState(guide.tasks[0], { pages: [{ id: 'home', tree: [replacement] }] }), 'missing');
  }
});

function mountHeading() {
  const heading = C.insert('heading', null, 0)!;
  let acknowledged: unknown = structuredClone(C.doc());
  Object.assign(L, { guideSavedDocument: () => acknowledged });
  act(() => r.draw(<FirstEditGuide />));
  return { heading, acknowledge() { acknowledged = structuredClone(C.doc()); act(() => r.draw(<FirstEditGuide />)); } };
}

test('component progress advances only after acknowledgement and saved Undo reopens the step', () => {
  const { heading, acknowledge } = mountHeading();
  const original = String(heading.props.text);
  assert.match(r.host.textContent!, /0 of 1 changes saved/);
  C.edit(() => { heading.props.text = 'My changed headline'; });
  act(() => r.draw(<FirstEditGuide />));
  assert.match(r.host.textContent!, /0 of 1 changes saved/);
  acknowledge();
  assert.match(r.host.textContent!, /1 of 1 changes saved/);
  assert.match(r.host.textContent!, /Your first edits are saved/);
  C.undo();
  assert.equal(C.locate(heading.id)!.node.props.text, original);
  acknowledge();
  assert.match(r.host.textContent!, /0 of 1 changes saved/);
  assert.match(r.host.textContent!, /Edit heading/);
});

test('storage failures do not block guidance or dismissal and the guide respects permissions', () => {
  vi.spyOn(localStorage, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  mountHeading();
  assert.ok(r.$('.pc-first-edit'));
  act(() => r.click(r.$('[aria-label="Dismiss template guide"]')));
  assert.equal(r.$('.pc-first-edit'), null);
  act(() => r.draw(null));
  Object.assign(L, { canStructure: () => false });
  act(() => r.draw(<FirstEditGuide />));
  assert.equal(r.$('.pc-first-edit'), null);
});

test('existing sites do not start a guide without a stored template guide', () => {
  history.replaceState(null, '', '/');
  mountHeading();
  assert.equal(r.$('.pc-first-edit'), null);
});

test('corrupt or oversized stored guides are replaced safely without retaining raw content', () => {
  const storageKey = 'pagecraft:first-edit:v1:guide-test-site';
  for (const stored of [
    '{invalid-json',
    JSON.stringify({ version: 1, dismissed: false, tasks: [null] }),
    JSON.stringify({ version: 1, dismissed: false, tasks: Array.from({ length: 4 }, () => ({ id: 'x', pageId: 'home', type: 'heading', before: 'abc' })) }),
    JSON.stringify({ version: 1, dismissed: false, tasks: [{ id: 'x', pageId: 'home', type: 'heading', before: 'Private copy should never be stored' }] })
  ]) {
    act(() => r.draw(null));
    localStorage.setItem(storageKey, stored);
    act(() => r.draw(<FirstEditGuide />));
    assert.ok(r.$('.pc-first-edit'));
    const recovered = JSON.parse(localStorage.getItem(storageKey)!);
    assert.deepEqual(recovered.tasks, []);
    assert.equal(recovered.dismissed, false);
  }
});

test('dismissal persists across remounts and generic fallback previews without creating targets', () => {
  act(() => r.draw(<FirstEditGuide />));
  assert.match(r.host.textContent!, /Continue with your page/);
  act(() => r.click(r.$('.pc-first-edit > .btn')));
  assert.ok(r.names().includes('guidePreview'));
  act(() => r.click(r.$('[aria-label="Dismiss template guide"]')));
  act(() => r.draw(null));
  act(() => r.draw(<FirstEditGuide />));
  assert.equal(r.$('.pc-first-edit'), null);
});
