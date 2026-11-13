import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import { adoptHostDocument } from '../app/src/host/schema';
import { mediaReferences, replaceMediaReferences } from '../app/src/core/media-references';

const pages = () => C.state.pages;
const heading = (text: string) => C.N('heading', { text, level: 'h2' });
beforeEach(() => {
  C.blankProject('Workshop Regions');
  C.state.pages = ['Workshop Home', 'Workshop Visit'].map((name, i) => ({
    id: 'workshop-page-' + i, name, slug: i ? 'visit' : 'index', title: name, desc: 'Workshop test page',
    tree: [heading(name)]
  }));
  C.state.header = [heading('Workshop shared header')];
  C.state.footer = [heading('Workshop shared footer')];
  C.state.ui = C.initUi(); C.state.cur = 0;
  C.hist.u.length = 0; C.hist.r.length = 0;
});

test('shared inheritance, independent header/footer copies and hidden output resolve for the supplied page', () => {
  const [home, visit] = pages();
  expect(C.pageRegion(home, 'header')).toBe(C.state.header);
  const sharedId = C.state.header[0].id;
  C.state.header[0].adv.htmlId = 'workshop-header-anchor';
  C.pageRegionSet(visit, 'header', 'custom');
  const custom = visit.header!;
  expect(custom).not.toBe(C.state.header);
  expect(custom![0].id).not.toBe(sharedId);
  expect(custom![0].adv.htmlId).toBe('workshop-header-anchor');
  expect(C.anchorsOf(visit.slug)).toContain('workshop-header-anchor');
  expect(C.pageRegionMode(visit, 'header')).toBe('custom');
  custom![0].props.text = 'Workshop visit header';
  C.state.header[0].props.text = 'Workshop shared update';
  C.pageRegionSet(visit, 'footer', 'hidden');
  const homeHtml = C.buildPage(home), visitHtml = C.buildPage(visit);
  expect(homeHtml).toContain('Workshop shared update');
  expect(homeHtml).toContain('Workshop shared footer');
  expect(homeHtml).not.toContain('Workshop visit header');
  expect(visitHtml).toContain('Workshop visit header');
  expect(visitHtml).not.toContain('Workshop shared update');
  expect(visitHtml).not.toContain('Workshop shared footer');
  expect(visit.footer).toBeNull();
  C.pageRegionSet(visit, 'header', 'shared');
  expect(Object.hasOwn(visit, 'header')).toBe(false);
  expect(C.buildPage(visit)).toContain('Workshop shared update');
});

test('empty custom regions stay owned and editable; region changes are one reversible transaction', () => {
  C.state.header = [];
  const pg = pages()[0];
  const before = C.clone(C.doc());
  C.edit(() => C.pageRegionSet(pg, 'header', 'custom'), 'Customize page header');
  expect(pg.header).toEqual([]);
  expect(C.pageRegionMode(pg, 'header')).toBe('custom');
  C.state.ui.mode = 'header';
  expect(C.tree()).toBe(pg.header);
  C.tree().push(heading('Workshop first custom header'));
  expect(C.locateAny(C.tree()[0].id)).toMatchObject({ mode: 'header', page: 0 });
  const after = C.clone(C.doc());
  expect(C.hist.u).toHaveLength(1);
  C.undo(); expect(C.doc()).toEqual(before);
  C.redo(); expect(C.doc()).toEqual(after);
  expect(C.tree()).toBe(pages()[0].header);
});

test('save/adoption preserves null, empty and populated ownership and rejects malformed overrides', () => {
  pages()[0].header = [];
  pages()[0].footer = null;
  pages()[1].header = [heading('Workshop persisted header')];
  const source = C.clone(C.doc());
  const reopened = adoptHostDocument(JSON.parse(JSON.stringify(source)));
  expect(reopened).toEqual(source);
  expect(Object.hasOwn(reopened.pages[1], 'footer')).toBe(false);
  for (const invalid of [false, 'shared', {}, 3]) {
    const bad = C.clone(source) as any;
    bad.pages[0].header = invalid;
    expect(() => adoptHostDocument(bad)).toThrow(/invalid page header override/);
  }
});

test('page duplicate and reorder retain local regions without sharing node identities', () => {
  const pg = pages()[0];
  C.pageRegionSet(pg, 'header', 'custom');
  pg.footer = null;
  const duplicate = C.pageDup(0)!;
  expect(duplicate.header![0].props.text).toBe(pg.header![0].props.text);
  expect(duplicate.header![0].id).not.toBe(pg.header![0].id);
  expect(duplicate.footer).toBeNull();
  expect(C.pageMove(1, 1)).toBe(true);
  expect(C.page()).toBe(duplicate);
  const ids = C.state.pages.flatMap(C.pageTrees).flatMap(list => C.flatten(list)).map(n => n.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test('custom regions participate in class, component, search and media ownership walks', () => {
  const pg = pages()[1];
  const local = heading('Workshop custom label');
  const style = C.classAdd('Workshop Region');
  local.cls = [style];
  const image = C.N('image', { src: 'asset:workshop-photo', alt: 'Workshop forest' });
  pg.header = [local, image];
  const defNode = heading('Workshop badge');
  C.state.meta.components = [{ id: 'workshop-badge', name: 'Workshop Badge', node: defNode, props: [] }];
  const instance = heading(''); instance.use = 'workshop-badge';
  pg.footer = [instance];
  expect(C.classUsage(style)).toBe(1);
  expect(C.componentUsage('workshop-badge')).toBe(1);
  expect(C.searchAll('Workshop custom label')).toEqual([expect.objectContaining({ where: 'header', page: 1, nodeId: local.id })]);
  expect(C.replaceAll('custom label', 'updated label')).toBe(1);
  expect(local.props.text).toBe('Workshop updated label');
  expect(mediaReferences(C.doc())).toContainEqual(expect.objectContaining({ path: ['pages', 1, 'header', 1, 'props', 'src'], assetId: 'workshop-photo', ownerId: pg.id }));
  const replaced = replaceMediaReferences(C.doc(), 'workshop-photo', 'workshop-lake');
  expect(replaced.pages[1].header![1].props.src).toBe('asset:workshop-lake');
  expect(image.props.src).toBe('asset:workshop-photo');
});

test('page region styles and motion compile only for the owning page and WordPress page stylesheet', () => {
  const pg = pages()[1], node = heading('Workshop custom motion');
  node.css.d.color = '#123456'; node.anim = { name: 'fade-in', dur: '1s', once: 1 };
  pg.header = [node];
  const cssClass = C.nodeClass(node);
  const own = C.buildPage(pg), shared = C.buildPage(pages()[0]);
  expect(own).toContain('#123456');
  expect(own).toContain('bp-animate');
  expect(shared).not.toContain(cssClass);
  expect(shared).not.toContain('bp-animate');
  const wp = C.wordpressStyles(pg);
  expect(wp.page).toContain('#123456');
  expect(wp.global).not.toContain('#123456');
  expect(C.wordpressStyles(pages()[0]).page).not.toContain('#123456');
});

test('custom regions use detail-page CMS context and native form inspection does not skip them', () => {
  const col = C.collectionAdd('Workshop Cabins')!;
  const field = C.fieldAdd(col.id, 'Title', 'text');
  const item = C.itemAdd(col.id)!; item.values[field.id] = 'Workshop Pine'; delete item.draft;
  const pg = pages()[1]; pg.collection = col.id;
  const local = heading('Fallback'); local.bind = { text: { src: 'field', path: field.id } };
  const form = C.N('form');
  pg.header = [local, form]; pg.footer = null;
  expect(C.buildPage(pg, { col, item })).toContain('Workshop Pine');
  const found: string[] = [];
  C.inspectFormRouting(C.doc(), observation => found.push(...JSON.parse(observation.placement)));
  expect(found).toContain(form.id);
});

test('proposals can target page-owned regions without mutating shared content', () => {
  const pg = pages()[1], local = heading('Workshop before'); pg.header = [local];
  const prepared = C.proposalPrepare([{ type: 'text', nodeId: local.id, slot: 'text', value: 'Workshop after' }], { assets: new Set() });
  expect(prepared.problems).toEqual([]);
  expect(prepared.changes[0].region).toBe('page-header:' + pg.id);
  expect(C.proposalCheck(prepared.changes, '', { assets: new Set() })).toEqual(['ok']);
  C.proposalApply(prepared.changes, '', { assets: new Set() });
  expect(local.props.text).toBe('Workshop after');
  expect(C.state.header[0].props.text).toBe('Workshop shared header');
});


test('schema 14 migrates without inventing overrides and schema 16 stays behind the host version gate', () => {
  const legacy = C.clone(C.doc()); legacy.schemaVersion = 14;
  const reopened = adoptHostDocument(legacy);
  expect(reopened.schemaVersion).toBe(16);
  expect(reopened.pages.every(pg => !Object.hasOwn(pg, 'header') && !Object.hasOwn(pg, 'footer'))).toBe(true);
  expect(C.migrate({ ...legacy, schemaVersion: C.SCHEMA + 1 })).toBeNull();
});


test('customizing a shared region remaps native tab panel relations while preserving authored anchors', () => {
  const tabs = C.N('tabs'); C.enableTabPanels(tabs);
  const sourcePanels = C.tabPanelNodes(tabs);
  sourcePanels[0].adv.htmlId = 'workshop-panel-anchor';
  tabs.adv.htmlId = 'workshop-tabs-anchor';
  C.state.header = [tabs];
  const shared = C.clone(C.state.header);
  const pg = pages()[1];
  C.pageRegionSet(pg, 'header', 'custom');
  const copied = pg.header![0];
  expect(C.tabPanelProblem(copied)).toBeNull();
  expect(C.tabPanelNodes(copied).map(node => node.id)).toEqual(copied.children.map(node => node.id));
  expect(copied.children.every(node => !sourcePanels.some(original => original.id === node.id))).toBe(true);
  expect(copied.adv.htmlId).toBe('workshop-tabs-anchor');
  expect(copied.children[0].adv.htmlId).toBe('workshop-panel-anchor');
  expect(C.state.header).toEqual(shared);
  expect(() => adoptHostDocument(C.doc())).not.toThrow();
  expect(C.buildPage(pg)).toContain('role="tablist"');
  expect(C.buildPage(pg)).not.toContain('Tab panels must match');
});

test('schema 15 retains native tabs but refuses page-owned regions instead of silently adopting unsupported visible content', () => {
  const tabs = C.N('tabs'); C.enableTabPanels(tabs); pages()[0].tree = [tabs];
  const native15 = C.clone(C.doc()); native15.schemaVersion = 15;
  expect(adoptHostDocument(native15).pages[0].tree).toEqual(native15.pages[0].tree);
  for (const kind of ['header', 'footer'] as const) for (const region of [null, [], [heading('Workshop owned region')]]) {
    const incompatible = C.clone(native15); incompatible.pages[0][kind] = region;
    expect(() => adoptHostDocument(incompatible)).toThrow('Page ' + kind + ' overrides require document schema 16');
  }
});
