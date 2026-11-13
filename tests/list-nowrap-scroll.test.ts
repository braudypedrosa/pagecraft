import { beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';

beforeEach(() => C.blankProject('No wrap cards'));
function fixture() {
  const col = C.collectionAdd('Workshop cards')!, title = C.titleField(col)!;
  for (let i = 1; i <= 18; i++) C.itemSet(col.id, C.itemAdd(col.id)!.id, title.id, `Workshop ${i}`);
  const list = C.insert('list', null, 0)!;
  C.srcSet(list, col.id);
  const heading = C.N('heading'); C.bindSet(heading, 'text', C.bindField(title.id));
  list.children[0].children.push(heading);
  return { list, card: list.children[0], col };
}
/* jsdom has no geometry or CSS-variable resolution. Select the actual compiled media
   rules, then inspect cascade winners and private variables separately. Native tests
   must prove card widths, page containment and keyboard/touch reachability. */
function output(list: PcNode, width = 414) {
  const css = C.treeCss([[list]], false);
  const parsed = new JSDOM(`<style>${css}</style>`);
  const active = (rules: CSSRuleList): string => [...rules].map(rule => {
    if (rule.type !== 4) return rule.cssText;
    const media = rule as CSSMediaRule;
    const max = /max-width:\s*(\d+)px/.exec(media.conditionText);
    const min = /min-width:\s*(\d+)px/.exec(media.conditionText);
    return (max && width > +max[1]) || (min && width < +min[1]) ? '' : active(media.cssRules);
  }).join('\n');
  const flat = active(parsed.window.document.styleSheets[0].cssRules as unknown as CSSRuleList);
  parsed.window.close();
  const dom = new JSDOM(`<style>${flat}</style>${C.renderNode(list, { edit: false })}`);
  const root = dom.window.document.querySelector('.pagecraft-list') as HTMLElement;
  const card = root.firstElementChild as HTMLElement;
  return { dom, root, card, css, style: (element = root) => dom.window.getComputedStyle(element), close: () => dom.window.close() };
}

test('factory Mobile nowrap preserves authored 100% basis and grow while disabling only fallback shrink', () => {
  const { list, card } = fixture(); list.css.m['flex-wrap'] = 'nowrap';
  const o = output(list);
  try {
    assert.equal(o.root.querySelectorAll('.pagecraft-heading').length, 18);
    assert.equal(o.root.getAttribute('role'), 'group');
    assert.equal(o.root.getAttribute('aria-label'), 'Workshop cards');
    assert.equal(o.root.getAttribute('tabindex'), '0');
    assert.equal(o.style().flexWrap, 'nowrap');
    assert.equal(o.style().getPropertyValue('--pc-list-overflow-x'), 'auto');
    assert.equal(o.style().getPropertyValue('--pc-list-item-shrink'), '0');
    assert.equal(o.style().getPropertyValue('--pc-list-padding'), '8px');
    assert.match(o.css, /:where\(\.pagecraft-list:not\(\.pagecraft-slider\)\)\{[^}]*padding:var\(--pc-list-padding,0\)/, 'compiled zero-specificity padding consumes the active fallback');
    assert.equal(o.style().overflowX, 'var(--pc-list-overflow-x,visible)');
    assert.equal(o.style().minWidth, 'var(--pc-list-min-width,auto)');
    assert.equal(o.style().maxWidth, 'var(--pc-list-max-width,none)');
    assert.equal(o.style(o.card).flexGrow, '100');
    assert.equal(o.style(o.card).flexBasis, '100%');
    assert.equal(o.style(o.card).flexShrink, 'var(--pc-list-item-shrink,1)');
    assert.equal(card.css.d['flex-basis'], '280px');
    assert.equal(card.css.m['flex-basis'], '100%');
  } finally { o.close(); }
});

test('Desktop nowrap inherits through Tablet and explicit Mobile wrap restores ordinary layout policy', () => {
  const { list } = fixture(); list.css.d['flex-wrap'] = 'nowrap'; list.css.m['flex-wrap'] = 'wrap';
  for (const [width, overflow, shrink] of [[1200, 'auto', '0'], [834, 'auto', '0'], [414, 'visible', '1']] as const) {
    const o = output(list, width);
    try { assert.equal(o.style().getPropertyValue('--pc-list-overflow-x'), overflow); assert.equal(o.style().getPropertyValue('--pc-list-item-shrink'), shrink); assert.equal(o.style().getPropertyValue('--pc-list-padding'), shrink === '0' ? '8px' : '0'); }
    finally { o.close(); }
  }
});

test('authored overflow and card flex sizing remain winners over nowrap fallbacks', () => {
  const { list, card } = fixture(); list.css.d['flex-wrap'] = 'nowrap';
  for (const overflow of ['visible', 'hidden', 'clip', 'auto']) {
    list.css.m['overflow-x'] = overflow;
    list.css.m['max-width'] = '75%'; list.css.m['min-width'] = '40px';
    card.css.m.flex = '0 1 42%';
    const o = output(list);
    try { assert.equal(o.style().overflowX, overflow); assert.equal(o.style().maxWidth, '75%'); assert.equal(o.style().minWidth, '40px'); assert.equal(o.style(o.card).flexShrink, '1'); assert.equal(o.style(o.card).flexBasis, '42%'); }
    finally { o.close(); }
  }
  delete list.css.m['overflow-x']; list.css.d.overflow = 'hidden';
  const o = output(list);
  try { assert.equal(o.style().overflow, 'hidden'); assert.equal(o.style().getPropertyValue('--pc-list-overflow-x'), 'auto'); }
  finally { o.close(); }
});

test('reusable class wrap policies follow breakpoints and authored class overflow/card shrink still win', () => {
  const { list, card } = fixture(); delete list.css.d['flex-wrap'];
  const cls = C.classAdd('Scrolling cards', { d: { 'flex-wrap': 'nowrap', 'overflow-x': 'hidden' }, t: { 'flex-wrap': 'wrap' }, m: { 'flex-wrap': 'nowrap' } });
  C.classApply(list, cls);
  const cardClass = C.classAdd('Authored card', { m: { 'flex-shrink': '1' } }); C.classApply(card, cardClass);
  for (const [width, shrink] of [[1200, '0'], [834, '1'], [414, '0']] as const) {
    const o = output(list, width);
    try { assert.equal(o.style().getPropertyValue('--pc-list-item-shrink'), shrink); assert.equal(o.style().overflowX, 'hidden'); if (width === 414) assert.equal(o.style(o.card).flexShrink, '1'); }
    finally { o.close(); }
  }
});

test('nested wrapped Lists reset outer scrolling policy without affecting nested generic Columns', () => {
  const { list, card } = fixture(); list.css.d['flex-wrap'] = 'nowrap';
  const inner = C.clone(list); inner.id = 'nested-list'; inner.css.d['flex-wrap'] = 'wrap';
  inner.children[0].id = 'nested-card'; card.children.push(inner);
  const o = output(list);
  try {
    const nested = o.root.querySelector('.' + C.nodeClass(inner)) as HTMLElement;
    assert.equal(o.style().getPropertyValue('--pc-list-item-shrink'), '0');
    assert.equal(o.style(nested).getPropertyValue('--pc-list-item-shrink'), '1');
    assert.equal(o.style(nested).getPropertyValue('--pc-list-overflow-x'), 'visible');
  } finally { o.close(); }
});

test('Slider remains its own named scrolling track and ordinary wrapping output gains no keyboard stop', () => {
  const { list } = fixture();
  let o = output(list);
  try { assert.equal(o.root.hasAttribute('tabindex'), false); }
  finally { o.close(); }
  list.css.m['flex-wrap'] = 'nowrap'; list.props.collectionLayout = 'slider';
  o = output(list);
  try {
    assert.equal(o.root.classList.contains('pagecraft-slider'), true);
    assert.equal(o.root.getAttribute('tabindex'), '0');
    assert.equal(o.style().overflowX, 'auto');
    assert.equal(o.style(o.card).flexShrink, '0');
    assert.equal(o.style(o.card).flexBasis, '100%', 'retain the existing factory Mobile card basis cascade');
  } finally { o.close(); }
});

test('save/restore retains only authored wrap and sizing, without private fallback migrations', () => {
  const { list } = fixture(); list.css.m['flex-wrap'] = 'nowrap';
  const snapshot = C.clone(C.doc()), before = JSON.stringify(snapshot);
  const publicHtml = C.buildPage(C.state.pages[0]);
  assert.match(publicHtml, /role="group" aria-label="Workshop cards" tabindex="0"/);
  C.blankProject('Reload'); C.restore(snapshot);
  const restored = C.locate(list.id)!.node;
  assert.equal(restored.css.m['flex-wrap'], 'nowrap');
  assert.equal(JSON.stringify(C.doc()), before);
  assert.equal(JSON.stringify(C.doc()).includes('--pc-list-'), false);
});


test('a wrapping class applied to a Box does not enable List policy outside Lists', () => {
  const box = C.N('box', { layout: 'flex' });
  const cls = C.classAdd('Single row', { d: { 'flex-wrap': 'nowrap' } }); C.classApply(box, cls);
  const css = C.treeCss([[box]], false);
  const dom = new JSDOM(`<style>${css}</style>${C.renderNode(box, { edit: false })}`);
  try {
    const el = dom.window.document.querySelector('.pagecraft-box');
    assert.equal(dom.window.getComputedStyle(el).getPropertyValue('--pc-list-item-shrink'), '');
    assert.equal(dom.window.getComputedStyle(el).overflowX, 'visible');
    assert.equal(el.hasAttribute('tabindex'), false);
  } finally { dom.window.close(); }
});

test('class focus Wrap policy reaches the named scrolling group without touching unrelated focus styling', () => {
  const { list } = fixture(); delete list.css.d['flex-wrap'];
  const cls = C.classAdd('Focused row');
  C.findClass(cls)!.st = { focus: { d: { 'flex-wrap': 'nowrap', 'overflow-y': 'hidden' }, t: {}, m: {} } };
  C.classApply(list, cls);
  const o = output(list);
  try {
    assert.equal(o.root.getAttribute('tabindex'), '0', 'state-only nowrap still needs keyboard access');
    o.root.focus();
    assert.equal(o.root.matches(':focus'), true);
    assert.equal(o.style().flexWrap, 'nowrap');
    assert.equal(o.style().getPropertyValue('--pc-list-item-shrink'), '0');
    assert.equal(o.style().getPropertyValue('--pc-list-overflow-x'), 'auto');
    assert.equal(o.style().overflowY, 'hidden', 'authored axis remains intact');
  } finally { o.close(); }
});

test('component List definition and placement retain nowrap metadata and shared card sizing', () => {
  const { list } = fixture(); list.css.m['flex-wrap'] = 'nowrap';
  const cid = C.componentFromNode(list.id, 'Workshop collection')!;
  assert.ok(cid);
  const placed = C.locate(list.id)!.node;
  assert.equal(placed.use, cid);
  const o = output(placed);
  try {
    assert.equal(o.root.getAttribute('role'), 'group');
    assert.equal(o.root.getAttribute('aria-label'), 'Workshop cards');
    assert.equal(o.root.getAttribute('tabindex'), '0');
    assert.equal(o.style().getPropertyValue('--pc-list-item-shrink'), '0');
    assert.equal(o.style(o.card).flexBasis, '100%');
    assert.equal(o.style(o.card).flexShrink, 'var(--pc-list-item-shrink,1)');
  } finally { o.close(); }
});


test('nowrap ink padding remains a fallback beneath authored shorthand, sides and class padding', () => {
  const { list } = fixture(); list.css.m['flex-wrap'] = 'nowrap';
  list.css.d.padding = '0';
  let o = output(list);
  try { assert.equal(o.style().padding, '0px', 'explicit zero opts out'); }
  finally { o.close(); }
  delete list.css.d.padding;
  list.css.m['padding-top'] = '11px';
  o = output(list);
  try {
    assert.equal(o.style().paddingTop, '11px', 'individual side remains authored');
    assert.equal(o.style().getPropertyValue('--pc-list-padding'), '8px');
  } finally { o.close(); }
  delete list.css.m['padding-top'];
  const cls = C.classAdd('Authored inset', { m: { padding: '9px 13px' } }); C.classApply(list, cls);
  o = output(list);
  try { assert.equal(o.style().padding, '9px 13px'); }
  finally { o.close(); }
});
