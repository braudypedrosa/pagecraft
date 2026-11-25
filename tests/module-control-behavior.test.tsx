// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector, advControls } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';
import type { Control, Doc, Node as PcNode } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); C.setCloudFormEndpoint(''); });
afterEach(() => { C.setCloudFormEndpoint(''); act(() => r.draw(null)); r.host.remove(); });

function reset() {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  C.state.meta.collections = [];
  C.hist.u.length = 0;
  C.hist.r.length = 0;
}

function place(type: string, parentType?: string): PcNode {
  reset();
  const node = C.N(type);
  if (parentType) {
    const parent = C.N(parentType);
    parent.children = [node];
    C.state.pages[0].tree = [parent];
  } else C.state.pages[0].tree = [node];
  C.state.ui.sel = node.id;
  return node;
}

function hasLabel(label: string) {
  return (r.host.textContent || '').includes(label);
}

function drawInspector(tab: 'content' | 'style' | 'advanced') {
  C.state.ui.stab = tab;
  C.state.ui.open = {};
  C.state.ui.open['form:Submission'] = true;
  r.draw(() => <Inspector />, 'right');
}

const conditionalSetup: Record<string, {
  off: (n: PcNode) => void;
  on: (n: PcNode) => void;
  offParent?: string;
  onParent?: string;
}> = {
  'list:Test': { off: n => { n.props.where = ''; }, on: n => { n.props.where = 'title'; } },
  'list:Value': { off: n => { n.props.where = 'title'; n.props.op = 'set'; }, on: n => { n.props.where = 'title'; n.props.op = 'is'; } },
  'list:Show at most': { off: n => { n.props.per = '10'; }, on: n => { n.props.per = ''; } },
  'list:Wrap': { off: n => { n.props.collectionLayout = 'slider'; }, on: n => { n.props.collectionLayout = 'grid'; } },
  'row:Order': { off: n => { C.applyCols(n, [100]); }, on: n => { C.applyCols(n, [50, 50]); } },
  'row:Stack on tablet': { off: n => { C.applyCols(n, [100]); }, on: n => { C.applyCols(n, [50, 50]); } },
  'column:Width (share)': { off: () => {}, on: () => {}, offParent: 'slider', onParent: 'row' },
  'column:Min basis': { off: () => {}, on: () => {}, offParent: 'slider', onParent: 'row' },
  'quote:Alignment': { off: n => { n.css.d.position = 'absolute'; }, on: n => { delete n.css.d.position; } },
  'image:Alignment': { off: n => { n.css.d.position = 'absolute'; }, on: n => { delete n.css.d.position; } },
  'button:Alignment': { off: n => { n.css.d.position = 'absolute'; }, on: n => { delete n.css.d.position; } },
  'icon:Alignment': { off: n => { n.css.d.position = 'absolute'; }, on: n => { delete n.css.d.position; } },
  'image:Focal point': { off: n => { n.css.d['object-fit'] = 'contain'; }, on: n => { n.css.d['object-fit'] = 'cover'; } },
  'box:Direction': { off: n => { n.props.layout = 'block'; }, on: n => { n.props.layout = 'flex'; } },
  'box:Gap': { off: n => { n.props.layout = 'block'; }, on: n => { n.props.layout = 'grid'; } },
  'box:Distribute': { off: n => { n.props.layout = 'block'; }, on: n => { n.props.layout = 'flex'; } },
  'box:Align': { off: n => { n.props.layout = 'block'; }, on: n => { n.props.layout = 'grid'; } },
  'box:Wrap': { off: n => { n.props.layout = 'grid'; }, on: n => { n.props.layout = 'flex'; } },
  'box:Columns': { off: n => { n.props.layout = 'flex'; }, on: n => { n.props.layout = 'grid'; } },
  'box:HTML tag': { off: n => { n.props.link = '#target'; }, on: n => { n.props.link = ''; } },
  'box:Filter tags': { off: () => {}, on: () => {}, offParent: 'section', onParent: 'filter' },
  'countdown:Seconds label': { off: n => { n.props.showSeconds = 0; }, on: n => { n.props.showSeconds = 1; } },
  'image:Link label': {
    off: n => { n.props.decorative = 0; n.props.link = ''; },
    on: n => { n.props.decorative = 1; n.props.link = 'https://example.com/details'; },
  },
  'video:Load player on click': {
    off: n => { n.props.src = 'https://cdn.example.com/clip.mp4'; n.props.autoplay = 0; },
    on: n => { n.props.src = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; n.props.autoplay = 0; },
  },
  'video:Muted': { off: n => { n.props.autoplay = 1; }, on: n => { n.props.autoplay = 0; } },
  'nav:Menu background': { off: n => { n.props.managedMobileLinks = 1; }, on: n => { delete n.props.managedMobileLinks; } },
  'button:Position': { off: () => {}, on: () => {}, onParent: 'column' },
  'form:Where submissions go': { off: n => { n.props.mode = 'wordpress'; }, on: n => { n.props.mode = 'external'; } },
  'form:Method': { off: n => { n.props.mode = 'wordpress'; }, on: n => { n.props.mode = 'external'; } },
  'dockbar:Where submissions go': { off: n => { n.props.mode = 'wordpress'; }, on: n => { n.props.mode = 'external'; } },
  'dockbar:Method': { off: n => { n.props.mode = 'wordpress'; }, on: n => { n.props.mode = 'external'; } },
  'slotpicker:Where submissions go': { off: n => { n.props.mode = 'wordpress'; }, on: n => { n.props.mode = 'external'; } },
  'slotpicker:Method': { off: n => { n.props.mode = 'wordpress'; }, on: n => { n.props.mode = 'external'; } },
  'slotpicker:Most guests': { off: n => { n.props.showGuests = 0; }, on: n => { n.props.showGuests = 1; } },
  'slotpicker:Available times': { off: n => { n.props.showTimes = 0; }, on: n => { n.props.showTimes = 1; } },
  'form:Grid columns': { off: n => { n.css.d['--f-layout'] = 'flex'; }, on: n => { n.css.d['--f-layout'] = 'grid'; } },
  'crumbs:Front page is called': { off: n => { n.props.mode = 'manual'; }, on: n => { n.props.mode = 'path'; } },
  'crumbs:Crumbs': { off: n => { n.props.mode = 'path'; }, on: n => { n.props.mode = 'manual'; } },
  'code:Comments': { off: n => { n.props.lang = 'text'; }, on: n => { n.props.lang = 'js'; } },
  'code:Strings': { off: n => { n.props.lang = 'text'; }, on: n => { n.props.lang = 'js'; } },
  'code:Keywords': { off: n => { n.props.lang = 'text'; }, on: n => { n.props.lang = 'js'; } },
  'code:Numbers': { off: n => { n.props.lang = 'text'; }, on: n => { n.props.lang = 'js'; } },
  'code:Names': { off: n => { n.props.lang = 'text'; }, on: n => { n.props.lang = 'js'; } },
  'table:Header background': {
    off: n => { n.props.head = 0; n.props.rowhead = 0; },
    on: n => { n.props.head = 1; n.props.rowhead = 0; },
  },
  'table:Heading colour': {
    off: n => { n.props.head = 0; n.props.rowhead = 0; },
    on: n => { n.props.head = 0; n.props.rowhead = 1; },
  },
  'table:Shading': { off: n => { n.props.zebra = 0; }, on: n => { n.props.zebra = 1; } },
  'table:Caption colour': { off: n => { n.props.caption = ''; }, on: n => { n.props.caption = 'Prices'; } },
  'shared:Size': { off: n => { n.css.d['background-image'] = ''; }, on: n => { n.css.d['background-image'] = 'url(qa.jpg)'; } },
  'shared:Position': { off: n => { n.css.d['background-image'] = ''; }, on: n => { n.css.d['background-image'] = 'url(qa.jpg)'; } },
  'shared:Repeat': { off: n => { n.css.d['background-image'] = ''; }, on: n => { n.css.d['background-image'] = 'url(qa.jpg)'; } },
};

test('all 50 conditional declarations render only in their applicable state', () => {
  const declarations: Array<{ owner: string; tab: 'content' | 'style'; control: Control }> = [];
  for (const [owner, def] of Object.entries(C.DEF)) {
    for (const tab of ['content', 'style'] as const)
      for (const control of def.controls[tab]) if (control.when) declarations.push({ owner, tab, control });
  }
  for (const group of C.COMMON_STYLE)
    for (const control of group.items) if (control.when) declarations.push({ owner: 'shared', tab: 'style', control });

  expect(declarations).toHaveLength(50);
  expect(Object.keys(conditionalSetup).sort()).toEqual(
    declarations.map(({ owner, control }) => `${owner}:${control.label}`).sort(),
  );

  for (const { owner, tab, control } of declarations) {
    const key = `${owner}:${control.label}`;
    const setup = conditionalSetup[key];
    const type = owner === 'shared' ? 'section' : owner;

    const off = place(type, setup.offParent);
    setup.off(off);
    expect(control.when!(off), `${key} false fixture`).toBe(false);
    drawInspector(tab);
    expect(hasLabel(control.label || ''), `${key} should be absent`).toBe(false);

    const on = place(type, setup.onParent);
    setup.on(on);
    expect(control.when!(on), `${key} true fixture`).toBe(true);
    drawInspector(tab);
    expect(hasLabel(control.label || ''), `${key} should be visible`).toBe(true);
  }
});

test('all eight shared Advanced controls render and its five CSS controls compile every breakpoint', () => {
  let n = place('heading');
  drawInspector('advanced');
  const advanced = advControls(n);
  expect(advanced).toHaveLength(8);
  for (const control of advanced)
    expect(hasLabel(control.label || ''), `Advanced:${control.label} should be visible`).toBe(true);

  const responsive = advanced.filter(control => control.c && control.r);
  expect(responsive).toHaveLength(5);
  for (const control of responsive) {
    n = place('heading');
    for (const [device, bucket, value] of [
      ['desktop', 'd', control.c === 'overflow' ? 'hidden' : control.c === 'z-index' ? '11' : control.t === 'select' ? 'relative' : '11px'],
      ['tablet', 't', control.c === 'overflow' ? 'auto' : control.c === 'z-index' ? '12' : control.t === 'select' ? 'absolute' : '12px'],
      ['mobile', 'm', control.c === 'overflow' ? 'hidden' : control.c === 'z-index' ? '13' : control.t === 'select' ? 'sticky' : '13px'],
    ] as const) {
      C.state.ui.dev = device;
      C.edit(() => C.applyC(n, control, value));
      expect(n.css[bucket][control.c!], `${control.label}:${device}`).toBe(value);
    }
    C.undo();
    expect(C.locateAny(n.id)!.node.css.m[control.c!], `${control.label}:undo mobile`).toBeUndefined();
    C.redo();
    n = C.locateAny(n.id)!.node;
    expect(n.css.m[control.c!], `${control.label}:redo mobile`).toBe(control.c === 'overflow' ? 'hidden' : control.c === 'z-index' ? '13' : control.t === 'select' ? 'sticky' : '13px');
    const saved = C.clone(C.doc());
    const savedNode = findInDoc(saved, n.id)!;
    const css = { d: '', t: '', m: '' };
    C.nodeCss(savedNode, false, css);
    for (const bucket of ['d', 't', 'm'] as const)
      expect(css[bucket], `${control.label}:${bucket} compiled`).toContain(control.c!);
  }
});

test('all 51 module renderers emit their representative authored value', () => {
  const contracts: Record<string, { expected: RegExp; configure?: (n: PcNode) => void }> = {
    section: { expected: /^<article\b/, configure: n => { n.props.tag = 'article'; } },
    row: { expected: /class="pagecraft-row / },
    slider: { expected: /data-slider/, configure: n => { n.children = [C.N('column')]; n.props.aria = 'QA slides'; } },
    list: { expected: /class="pagecraft-list /, configure: n => {
      const col = C.collectionAdd('QA journal');
      const item = C.itemAdd(col.id)!;
      C.itemSet(col.id, item.id, 'title', 'QA entry');
      n.src = col.id;
      const card = C.N('column'); card.children = [C.N('heading', { text: 'QA card' })]; n.children = [card];
    } },
    column: { expected: /class="pagecraft-column / },
    box: { expected: /^<aside\b/, configure: n => { n.props.tag = 'aside'; } },
    heading: { expected: /<h3[^>]*>QA heading<\/h3>/, configure: n => { n.props.level = 'h3'; n.props.text = 'QA heading'; } },
    text: { expected: /<p>QA rich text<\/p>/, configure: n => { n.props.html = '<p>QA rich text</p>'; } },
    quote: { expected: /QA quotation[\s\S]*QA author/, configure: n => { n.props.text = 'QA quotation'; n.props.by = 'QA author'; } },
    image: { expected: /alt="QA image"/, configure: n => { n.props.src = 'https://example.com/qa.jpg'; n.props.alt = 'QA image'; } },
    video: { expected: /src="https:\/\/example\.com\/qa\.mp4"/, configure: n => { n.props.src = 'https://example.com/qa.mp4'; } },
    button: { expected: />QA action<\//, configure: n => { n.props.text = 'QA action'; n.props.link = 'https://example.com/qa'; } },
    nav: { expected: /aria-label="QA navigation"/, configure: n => { n.props.aria = 'QA navigation'; } },
    form: { expected: /aria-label="QA contact"/, configure: n => { n.props.aria = 'QA contact'; } },
    spacer: { expected: /class="pagecraft-spacer / },
    divider: { expected: /^<hr\b/ },
    crumbs: { expected: /QA current/, configure: n => { n.props.mode = 'manual'; n.props.items = [{ label: 'QA current', href: '' }]; } },
    code: { expected: /QA source line/, configure: n => { n.props.body = 'QA source line'; } },
    table: { expected: /QA plan[\s\S]*QA price/, configure: n => { n.props.body = 'QA plan|QA price'; } },
    tabs: { expected: /QA tab[\s\S]*QA panel/, configure: n => { n.props.items = [{ label: 'QA tab', panel: 'QA panel' }]; } },
    accordion: { expected: /QA question[\s\S]*QA answer/, configure: n => { n.props.items = [{ q: 'QA question', a: 'QA answer' }]; } },
    embed: { expected: /title="QA map"/, configure: n => { n.props.html = '<iframe src="https://example.com/qa" title="QA map"></iframe>'; } },
    icon: { expected: /aria-label="QA icon"/, configure: n => { n.props.name = 'check'; n.props.label = 'QA icon'; } },
    gallery: { expected: /alt="QA gallery image"/, configure: n => { n.props.items = [{ src: 'https://example.com/gallery.jpg', alt: 'QA gallery image', caption: 'QA caption' }]; } },
    audio: { expected: /QA episode/, configure: n => { n.props.src = 'https://example.com/qa.mp3'; n.props.title = 'QA episode'; } },
    countdown: { expected: /data-countdown="2035-06-15T18:00:00Z"/, configure: n => { n.props.target = '2035-06-15T18:00:00Z'; } },
    marquee: { expected: /QA marquee item/, configure: n => { n.children = [C.N('heading', { text: 'QA marquee item' })]; } },
    filter: { expected: /data-filter-tag="QA tag"/, configure: n => { n.children = [C.N('box', { tags: 'QA tag' })]; } },
    compare: { expected: /data-compare/, configure: n => { n.props.beforeSrc = 'https://example.com/a.jpg'; n.props.afterSrc = 'https://example.com/b.jpg'; } },
    timeline: { expected: /QA milestone/, configure: n => { n.props.items = [{ tag: 'Step 1', title: 'QA milestone', detail: 'Details' }]; } },
    progress: { expected: /<progress[^>]+value="82"/, configure: n => { n.props.items = [{ label: 'QA progress', value: '82', unit: '%' }]; } },
    hotspot: { expected: /popovertarget="/, configure: n => { n.props.src = 'https://example.com/diagram.jpg'; n.props.items = [{ label: '01', title: 'QA pin', detail: 'Detail', x: '40', y: '60' }]; } },
    strips: { expected: /data-strips/, configure: n => { n.props.items = [{ src: 'https://example.com/a.jpg', alt: 'QA strip', title: 'QA strip', detail: 'Detail' }]; } },
    switcher: { expected: /data-switcher/, configure: n => { n.props.items = [{ label: 'QA stage', meta: '10 min', title: 'QA stage title', detail: 'Stage detail', src: 'https://example.com/s.jpg', alt: 'Stage photo' }]; } },
    exhibit: { expected: /data-exhibit/, configure: n => { n.props.items = [{ title: 'QA exhibit', location: 'Portland', scope: '2.4 ac', year: '2025', src: 'https://example.com/e.jpg', alt: 'Exhibit preview' }]; } },
    scrolly: { expected: /data-scrolly/, configure: n => { n.props.items = [{ title: 'QA step', detail: 'Step detail', fact: '82 mm/hr', src: 'https://example.com/sc.jpg', alt: 'Step visual' }]; } },
    clocks: { expected: /data-clocks/, configure: n => { n.props.items = [{ city: 'Munich', tz: 'Europe/Berlin', address: 'Maximilianstr. 35a', phone: '+49 89 555 010', href: 'https://example.com/map', linkLabel: 'Maps', src: 'https://example.com/ofc.jpg', alt: 'Munich chambers' }]; } },
    roster: { expected: /data-roster/, configure: n => { n.props.items = [{ name: 'Claire Mercer', role: 'Partner', seat: 'DC', credential: 'USPTO', quote: 'Trial first.', src: 'https://example.com/p.jpg', alt: 'Claire' }]; } },
    tiers: { expected: /data-tiers/, configure: n => { n.props.items = [{ tierName: 'Retainer', priceUsd: '$6,400', priceEur: '€5,800', priceGbp: '£4,950', period: '/mo', summary: 'Counsel', features: 'Partner access', ctaText: 'Engage', href: 'https://example.com/go', featured: 1 }]; } },
    qapills: { expected: /data-qapills/, configure: n => { n.props.items = [{ q: 'Question?', a: 'Answer.', note: 'Rule 1.7' }]; } },
    dockbar: { expected: /QA dock field/, configure: n => { n.props.fields = [{ type: 'text', label: 'QA dock field', name: 'qa' }]; } },
    arches: { expected: /data-arches/, configure: n => { n.props.items = [{ src: 'https://example.com/a1.jpg', alt: 'Arch 1' }]; } },
    chapters: { expected: /data-chapters/, configure: n => { n.props.chapters = [{ chapterTitle: 'Ch 1', chapterSub: 'Sub', overlayText: 'Note', src: 'https://example.com/c1.jpg', alt: 'Ch 1' }]; } },
    slotpicker: { expected: /data-slotpicker/, configure: n => { n.props.passes = [{ passName: 'Circuit', passMeta: '90m', unitPrice: '95' }]; } },
    typemask: { expected: /data-typemask.*QA-MASK/, configure: n => { n.props.wordmark = 'QA-MASK'; n.props.maskSrc = 'https://example.com/mask.jpg'; } },
    fullmenu: { expected: /data-fullmenu.*QA drawer link/, configure: n => { n.props.menuItems = [{ label: 'QA drawer link', href: 'https://example.com/p', src: 'https://example.com/p.jpg' }]; } },
    swatchshop: { expected: /data-swatchshop.*QA Jacket/, configure: n => { n.props.products = [{ prodName: 'QA Jacket', prodPrice: '$290', c1Name: 'Pine', c1Hex: '#145C3E', c1Src: 'https://example.com/j1.jpg' }]; } },
    snaprail: { expected: /data-snaprail.*QA Rail Card/, configure: n => { n.props.railCards = [{ title: 'QA Rail Card', detail: 'Detail', stat: '28k mm', bgHex: '#14261F', fgHex: '#F2F6F3' }]; } },
    scrollsteps: { expected: /data-scrollsteps.*QA Seam Step/, configure: n => { n.props.steps = [{ title: 'QA Seam Step', badge: '48h', detail: 'Detail', src: 'https://example.com/st.jpg' }]; } },
    dragstrip: { expected: /data-dragstrip.*QA Filmstrip Suite/, configure: n => { n.props.slides = [{ title: 'QA Filmstrip Suite', meta: 'Cliffside', src: 'https://example.com/ds.jpg' }]; } },
    stayfilter: { expected: /data-stayfilter.*QA Cliff Villa/, configure: n => { n.props.stays = [{ stayName: 'QA Cliff Villa', sleeps: '4', lowRate: '420', midRate: '560', highRate: '720', src: 'https://example.com/v1.jpg' }]; } },
  };
  expect(Object.keys(contracts).sort()).toEqual(Object.keys(C.DEF).sort());
  for (const [type, contract] of Object.entries(contracts)) {
    reset();
    const n = C.N(type);
    contract.configure?.(n);
    const html = C.renderNode(n, { edit: false, pg: C.state.pages[0] });
    expect(html, `${type} representative render`).toMatch(contract.expected);
  }
});

function makeApplicable(owner: string, n: PcNode, c: Control) {
  if (owner === 'list') {
    const col = C.collectionAdd('QA collection');
    C.fieldAdd(col.id, 'Rank', 'number');
    n.src = col.id;
    n.props.where = 'title'; n.props.op = 'is'; n.props.per = '';
  }
  if (owner === 'box') { n.props.layout = c.label === 'Columns' ? 'grid' : 'flex'; n.props.link = ''; }
  if (owner === 'form') n.props.mode = 'external';
  if (owner === 'crumbs') n.props.mode = c.label === 'Crumbs' ? 'manual' : 'path';
  if (owner === 'code') n.props.lang = 'js';
  if (owner === 'table') { n.props.zebra = 1; n.props.caption = 'Prices'; }
  if (owner === 'image' && c.label === 'Link label') {
    n.props.decorative = 1; n.props.link = 'https://example.com/details';
  }
  if (owner === 'shared') n.css.d['background-image'] = 'url(qa.jpg)';
}

function options(c: Control, n: PcNode): string[] {
  const direct = typeof c.opts === 'function' ? c.opts(n) : (c.opts || []);
  const grouped = c.og ? c.og().flatMap((group: any[]) => group[1] || []) : [];
  return [...grouped, ...direct].map((option: any[]) => String(option[0]));
}
function propertyValue(c: Control, n: PcNode, before: unknown) {
  const choices = options(c, n).filter(value => value !== String(before ?? ''));
  if (c.t === 'select' || c.t === 'pick') return choices.find(Boolean) ?? choices[0] ?? 'qa-choice';
  if (c.t === 'toggle') return String(before) === '1' ? '0' : '1';
  if (c.t === 'unit') return '17';
  if (c.t === 'link') return 'https://example.com/qa';
  if (c.t === 'rich') return '<p>QA rich value</p>';
  if (c.t === 'img') return 'https://example.com/qa.png';
  if (c.t === 'icon') return String(before) === 'check' ? 'arrow-right' : 'check';
  if (c.t === 'tstyle') return String(before) === 'body' ? 'title' : 'body';
  if (c.t === 'area') return 'QA line one\nQA line two';
  return 'QA value';
}
function findInDoc(d: Doc, id: string): PcNode | null {
  let hit: PcNode | null = null;
  for (const list of [d.header, d.footer, ...d.pages.map(page => page.tree)])
    C.eachNode(list, node => { if (node.id === id) hit = node; });
  return hit;
}

const primitivePropertyKinds = new Set(['pick', 'select', 'toggle', 'text', 'unit', 'link', 'area', 'tstyle', 'rich', 'img', 'icon']);

test('every primitive property declaration survives edit, Undo, Redo and document serialization', () => {
  const declarations: Array<{ owner: string; control: Control }> = [];
  for (const [owner, def] of Object.entries(C.DEF))
    for (const control of [...def.controls.content, ...def.controls.style])
      if (control.k && primitivePropertyKinds.has(control.t)) declarations.push({ owner, control });
  for (const control of advControls(C.N('heading')))
    if (control.k && primitivePropertyKinds.has(control.t)) declarations.push({ owner: 'heading', control });

  expect(declarations).toHaveLength(199);
  for (const { owner, control } of declarations) {
    const setup = conditionalSetup[`${owner}:${control.label}`];
    const n = place(owner, setup?.onParent);
    makeApplicable(owner, n, control);
    setup?.on(n);
    expect(!control.when || control.when(n), `${owner}:${control.label} fixture`).toBe(true);
    const before = C.propVal(n, control.k);
    const requested = propertyValue(control, n, before);

    C.edit(() => C.applyC(n, control, requested));
    const after = C.propVal(n, control.k);
    expect(String(after), `${owner}:${control.label} write`).not.toBe(String(before ?? ''));
    expect(C.hist.u, `${owner}:${control.label} history`).toHaveLength(1);

    C.undo();
    expect(String(C.propVal(C.locateAny(n.id)!.node, control.k) ?? ''), `${owner}:${control.label} undo`)
      .toBe(String(before ?? ''));
    C.redo();
    const redone = C.locateAny(n.id)!.node;
    expect(String(C.propVal(redone, control.k)), `${owner}:${control.label} redo`).toBe(String(after));

    const saved = C.clone(C.doc());
    expect(String(C.propVal(findInDoc(saved, n.id)!, control.k)), `${owner}:${control.label} serialized`)
      .toBe(String(after));
  }
});

function cssValue(c: Control, n: PcNode, before: unknown) {
  const choices = options(c, n).filter(value => value && value !== String(before ?? ''));
  if (c.t === 'select' || c.t === 'pick' || c.t === 'opt') return choices.at(-1) || 'initial';
  if (c.t === 'color') return '#123456';
  if (c.t === 'slider') return c.raw ? '0.37' : '37px';
  if (c.t === 'img') return 'url(https://example.com/qa.jpg)';
  if (c.t === 'text') return 'translateX(2px)';
  return 'initial';
}

test('all 197 CSS declarations compile and share the same Undo/save model', () => {
  const declarations: Array<{ owner: string; control: Control }> = [];
  for (const [owner, def] of Object.entries(C.DEF))
    for (const control of [...def.controls.content, ...def.controls.style])
      if (control.c) declarations.push({ owner, control });
  for (const group of C.COMMON_STYLE)
    for (const control of group.items) if (control.c) declarations.push({ owner: 'shared', control });
  for (const control of advControls(C.N('heading')))
    if (control.c) declarations.push({ owner: 'heading', control });

  expect(declarations).toHaveLength(316);
  for (const { owner, control } of declarations) {
    const type = owner === 'shared' ? 'section' : owner;
    const setup = conditionalSetup[`${owner}:${control.label}`];
    const n = place(type, setup?.onParent);
    makeApplicable(owner, n, control);
    setup?.on(n);
    expect(!control.when || control.when(n), `${owner}:${control.label} fixture`).toBe(true);
    const before = C.cssVal(C.tgtObj(n), control.c!, false).v;
    const requested = cssValue(control, n, before);

    C.edit(() => C.applyC(n, control, requested));
    const after = C.cssVal(C.tgtObj(n), control.c!, false).v;
    expect(String(after), `${owner}:${control.label} write`).not.toBe(String(before || ''));
    expect(C.hist.u, `${owner}:${control.label} history`).toHaveLength(1);

    C.undo();
    expect(String(C.cssVal(C.tgtObj(C.locateAny(n.id)!.node), control.c!, false).v || ''), `${owner}:${control.label} undo`)
      .toBe(String(before || ''));
    C.redo();
    const redone = C.locateAny(n.id)!.node;
    expect(String(C.cssVal(C.tgtObj(redone), control.c!, false).v), `${owner}:${control.label} redo`).toBe(String(after));

    const saved = C.clone(C.doc());
    const savedNode = findInDoc(saved, n.id)!;
    expect(String(C.cssVal(savedNode, control.c!, false).v), `${owner}:${control.label} serialized`).toBe(String(after));
    const css = { d: '', t: '', m: '' };
    C.nodeCss(savedNode, false, css);
    const renderedProperty = control.c === '--pc-column-v-align' ? 'justify-content' : control.c!;
    expect(css.d, `${owner}:${control.label} compiled`).toContain(renderedProperty);
  }
});
