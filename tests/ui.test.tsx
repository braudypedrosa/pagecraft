// @vitest-environment jsdom
/* The components, in a DOM.

   These exist because every regression in the migration lived in this half of the app and
   none of it had a test. Each case below is one I had previously only checked by driving
   the real browser by hand, which caught them but caught them late.

   The seam does the heavy lifting: a panel reaches the old world only through `Legacy`, so
   a recording stub turns "did the button do the right thing?" into an assertion about an
   array. The core is the real one — it has its own suite and faking it here would prove
   nothing. */
import { test, beforeEach, afterEach } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { Layers } from '../app/src/ui/Layers';
import { Add } from '../app/src/ui/Add';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { Pages } from '../app/src/ui/Pages';
import { act } from 'preact/test-utils';
import { rig, type Rig } from './ui.setup';
import type { Control, NavItem } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { r.host.remove(); });

const heading = () => C.insert('heading', null, 0)!;

/* A repeater's rows, typed. `items` is a different shape per widget, so the test that
   built the node says which it has. */
const navRows = (n: any): NavItem[] => n.props.items as NavItem[];

/* ----------------------------------------------- scoped to a content account */

test('a content account is offered the Content tab and no other', () => {
  /* The server refuses CSS from a content account, so offering a tab full of colours is an
     invitation to be refused. One tab is no tab, so the row goes entirely. */
  const full = rig();
  const n = C.insert('heading', null, 0)!;
  C.state.ui.sel = n.id;
  full.draw(<Inspector />);
  a.deepEqual(full.$$('.tabs button').map(b => b.textContent), ['Content', 'Style', 'Advanced']);
  full.host.remove();

  const scoped = rig({ canStructure: false });
  const m = C.insert('heading', null, 0)!;
  C.state.ui.sel = m.id;
  scoped.draw(<Inspector />);
  a.deepEqual(scoped.$$('.tabs button').map(b => b.textContent), [], 'no tab row at all');
  a.ok(scoped.$('.group'), 'and the content controls are still there');
  scoped.host.remove();
});

test('a stale Style tab does not strand a content account on a pane it cannot leave', () => {
  /* `stab` persists across sessions, so the role has to force the tab rather than default
     it — otherwise the panel renders Style with no tab row to get back from. */
  const r2 = rig({ canStructure: false });
  C.state.ui.stab = 'style';
  const n = C.insert('heading', null, 0)!;
  C.state.ui.sel = n.id;
  r2.draw(<Inspector />);
  const labels = r2.$$('.gh').map(e => e.textContent!.trim());
  a.ok(labels.some(l => l.includes('Heading')), `expected the Content group, got ${JSON.stringify(labels)}`);
  a.equal(labels.some(l => l.includes('Background')), false, 'that is a Style group');
  r2.host.remove();
});

test('a content account’s Pages panel offers the two fields that are words', () => {
  const full = rig();
  full.draw(<Pages />);
  const all = full.$$('.gb label').map(e => e.textContent!.replace(/\s+/g, ' ').trim());
  a.ok(all.includes('Page name'));
  a.ok(all.includes('Slug'));
  a.ok(all.some(l => l.startsWith('Extra')));
  a.ok(full.$$('button').some(b => /New page/.test(b.textContent || '')));
  full.host.remove();

  const scoped = rig({ canStructure: false });
  scoped.draw(<Pages />);
  const some = scoped.$$('.gb label').map(e => e.textContent!.replace(/\s+/g, ' ').trim());
  a.deepEqual(some, ['Browser title', 'Meta description']);
  a.equal(scoped.$$('button').some(b => /New page/.test(b.textContent || '')), false,
    'adding a page is not a content edit');
  a.ok(scoped.$$('.pagerow').length >= 1, 'but the list stays — it is how you reach a page');
  scoped.host.remove();
});

test('a content account is offered the words, not the settings beside them', () => {
  /* The Content tab is not the line the server draws. A heading's tab holds its text — and
     also its HTML tag, its text style and its alignment. A tag is structure and the other two
     write CSS, so offering them is offering a refused save. */
  const full = rig();
  const n = C.insert('heading', null, 0)!;
  C.state.ui.sel = n.id;
  full.draw(<Inspector />);
  const before = full.$$('.gb > .f label').map(e => e.textContent!.replace(/\s+/g, ' ').trim());
  a.ok(before.includes('Heading text'));
  a.ok(before.includes('HTML tag'), 'the owner sees the settings');
  full.host.remove();

  const scoped = rig({ canStructure: false });
  const m = C.insert('heading', null, 0)!;
  C.state.ui.sel = m.id;
  scoped.draw(<Inspector />);
  const after = scoped.$$('.gb > .f label').map(e => e.textContent!.replace(/\s+/g, ' ').trim());
  a.deepEqual(after, ['Heading text']);
  scoped.host.remove();
});

test('a list of words survives the filter, because the list is where the words are', () => {
  /* An accordion's rows are a text slot named by its array: `['items', 'q', 'a']`. Filtering
     on the bare key would have dropped the one control that edits its content. */
  const r2 = rig({ canStructure: false });
  const n = C.insert('accordion', null, 0)!;
  C.state.ui.sel = n.id;
  r2.draw(<Inspector />);
  const labels = r2.$$('.gb > .f label').map(e => e.textContent!.replace(/\s+/g, ' ').trim());
  a.ok(labels.includes('Questions'), `expected the rows control, got ${JSON.stringify(labels)}`);
  a.equal(labels.includes('Open on load'), false, 'a setting, not content');
  r2.host.remove();
});

/* ------------------------------------------------------------ templates */

test('every template group is offered from the page, header and footer alike', () => {
  /* The first version filtered the list by the current region, which meant the Header and
     Footer groups did not exist until you had already switched to editing that region —
     so the templates were unfindable from the one view everybody starts in. */
  ['page', 'header', 'footer'].forEach(mode => {
    C.state.ui.mode = mode as 'page' | 'header' | 'footer';
    C.state.ui.atab = 'templates';
    r.draw(<Add />);
    const groups = r.$$('.plabel').map(e => e.textContent);
    a.ok(groups.includes('Header'), `Header offered in ${mode} mode`);
    a.ok(groups.includes('Footer'), `Footer offered in ${mode} mode`);
    a.ok(groups.includes('Hero'), `page sections offered in ${mode} mode`);
    a.equal(r.$$('.pvcard').length, C.PATTERNS.length, `all ${C.PATTERNS.length} cards in ${mode} mode`);
  });
});

test('the Header and Footer groups lead the list', () => {
  /* Two groups against twelve: in declaration order they sat at the bottom of a long
     scroll, which is close to where they were when they did not appear at all. */
  C.state.ui.mode = 'page';
  C.state.ui.atab = 'templates';
  r.draw(<Add />);
  const groups = r.$$('.plabel').map(e => e.textContent);
  a.deepEqual(groups.slice(0, 2), ['Header', 'Footer']);
  a.equal(groups[2], 'Hero', 'and the page sections keep their own order behind them');
  a.equal(new Set(groups).size, groups.length, 'no group listed twice');
});

test('clicking a header template switches to the header and builds it there', () => {
  C.state.ui.mode = 'page';
  C.state.ui.atab = 'templates';
  r.draw(<Add />);
  const card = r.$$('.pvcard').find(c => /Logo and links/.test(c.textContent!))!;
  r.click(card);

  a.deepEqual(r.arg('setMode'), ['header'], 'asks to switch region first — tree() reads the mode');
  a.equal(C.state.header.length, 1, 'the header now has it');
  a.equal(C.state.header[0].props.tag, 'header', 'as a landmark');
  a.equal(C.state.pages[0].tree.length, 0, 'and the page was left alone');
  /* the jump is announced, because a header replacing the view you had open otherwise
     reads as the template having gone wrong */
  a.match(String(r.arg('toast')![0]), /now editing the global header/);
});

test('a page template still goes to the page, and says nothing about regions', () => {
  C.state.ui.mode = 'page';
  C.state.ui.atab = 'templates';
  r.draw(<Add />);
  r.click(r.$$('.pvcard').find(c => /Split hero/.test(c.textContent!))!);

  a.equal(r.arg('setMode'), null, 'already in the right place, so no switch');
  a.equal(C.state.pages[0].tree.length, 1);
  a.equal(C.state.header.length, 0);
  a.equal(String(r.arg('toast')![0]), 'Split hero added');
});

test('a region template cannot be dragged, because a drop would land in the page', () => {
  /* A dropped pattern goes into whatever container the drop target names, which in page
     mode is page content — the one placement this must not allow. There is also nowhere
     meaningful to aim a global header. */
  C.state.ui.mode = 'page';
  C.state.ui.atab = 'templates';
  r.draw(<Add />);
  const down = (label: RegExp) => {
    const card = r.$$('.pvcard').find(c => label.test(c.textContent!))!;
    card.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
  };
  down(/Logo and links/);
  down(/Sitemap columns/);
  a.equal(r.arg('startDrag'), null, 'no drag offered for a header or a footer');
  down(/Split hero/);
  a.ok(r.arg('startDrag'), 'but a page section is still draggable');
});

/* --------------------------------------------------------------- colour */
/* The picker is the one control whose visible state lives in a hook rather than in the
   document, so opening it is a Preact state change and the DOM it produces does not exist
   until Preact flushes. `act` is that flush; without it these read the pre-click DOM and
   report the popover as never opening. */
const open = () => act(() => r.click(r.$('button.sw')));
const typed = (el: Element, v: string) => act(() => r.type(el, v));


test('the colour swatch is a button, not the operating system dialog', () => {
  /* It was `<input type="color">`, which meant the OS panel: no alpha, and on macOS a
     window bigger than the inspector it opened from. */
  const n = heading();
  C.selSet([n.id]);
  const c: Control = { t: 'color', c: 'color', label: 'Colour' };
  r.draw(<Ctl n={n} c={c} />);
  a.equal(r.$('input[type="color"]'), null, 'no native picker left');
  const sw = r.$('button.sw')!;
  a.ok(sw, 'the swatch opens it');
  a.equal(sw.getAttribute('aria-expanded'), 'false');
  a.equal(r.$('.cp'), null, 'and it starts closed');
});

test('the picker opens on the swatch, carries every part, and closes again', () => {
  const n = heading();
  n.css.d.color = '#3366cc';
  C.selSet([n.id]);
  const c: Control = { t: 'color', c: 'color', label: 'Colour' };
  r.draw(() => <Ctl n={n} c={c} />, 'right');
  open();

  a.ok(r.$('.cp'), 'open');
  a.equal(r.$('button.sw')!.getAttribute('aria-expanded'), 'true');
  /* the saturation square, the two strips, the preview chip and the value field */
  ['.cp-sv', '.cp-hue', '.cp-alpha', '.cp-chip', '.cp-val'].forEach(sel =>
    a.ok(r.$(sel), sel + ' is drawn'));
  a.equal((r.$('.cp-val') as HTMLInputElement).value, '#3366cc', 'seeded from the current value');
  /* the strips are sliders, so they announce themselves rather than being mystery boxes */
  a.equal(r.$('.cp-hue')!.getAttribute('role'), 'slider');
  a.equal(r.$('.cp-hue')!.getAttribute('aria-label'), 'Hue');
  a.equal(r.$('.cp-alpha')!.getAttribute('aria-label'), 'Opacity');

  open();
  a.equal(r.$('.cp'), null, 'the swatch toggles it shut');
});

test('typing an rgba into the picker writes it through, and half-typed text is not an error', () => {
  /* rgba already worked end to end — the css objects carry raw CSS and `parseColor` reads
     it back — so the gap this closes is picking one, not storing one. */
  const n = heading();
  C.selSet([n.id]);
  const c: Control = { t: 'color', c: 'color', label: 'Colour' };
  r.draw(() => <Ctl n={n} c={c} />, 'right');
  open();

  const f = r.$('.cp-val') as HTMLInputElement;
  typed(f, 'rgba(1, 2, 3, 0.4)');
  a.equal(n.css.d.color, 'rgba(1, 2, 3, 0.4)');

  /* a value on its way to being typed must not blank the colour */
  typed(f, 'rgba(1, 2');
  a.equal(n.css.d.color, 'rgba(1, 2, 3, 0.4)', 'still the last colour that parsed');
});

test('picking a literal breaks the token link, and a token swatch restores it', () => {
  const n = heading();
  n.css.d.color = C.cvar('ink');
  C.selSet([n.id]);
  const c: Control = { t: 'color', c: 'color', label: 'Colour' };
  r.draw(() => <Ctl n={n} c={c} />, 'right');
  /* linked, so the chip shows the token name instead of a hex field */
  a.ok(r.$('.tokchip'), 'shows as linked');

  open();
  const f = r.$('.cp-val') as HTMLInputElement;
  a.equal(f.value, C.findColor('ink')!.value, 'the picker opens on the token’s own colour');
  typed(f, '#ff0000');
  a.equal(n.css.d.color, '#ff0000', 'a literal replaces the reference');
  a.equal(C.isRef(n.css.d.color), false);

  act(() => r.click(r.$('.toks .tok')));
  a.ok(C.isRef(n.css.d.color), 'and a token swatch links it again');
});

/* ------------------------------------------------------------------ unit */

test('an empty unit control defaults to the first unit, so a bare number is valid CSS', () => {
  /* The bug this exists for: the string version relied on the browser picking the first
     option when none matched. Rendering `value={u}` instead left selectedIndex at -1, so
     typing 900 into Max width stored `max-width: 900` — a declaration browsers discard. */
  const n = heading();
  C.selSet([n.id]);
  const c: Control = { t: 'unit', c: 'max-width', label: 'Max width', r: 1, units: ['px', 'rem', '%', 'ch'] };
  r.draw(<Ctl n={n} c={c} />);

  const sel = r.$('select') as HTMLSelectElement;
  a.equal(sel.value, 'px', 'no stored unit, so the first offered one is selected');
  a.notEqual(sel.selectedIndex, -1, 'and something really is selected');

  r.type(r.$('input[type=number]')!, '900');
  a.equal(C.cssVal(C.tgtObj(n), 'max-width', true).v, '900px');
  a.match(C.cssVal(C.tgtObj(n), 'max-width', true).v, /^\d+(px|rem|%|ch)$/, 'a declaration a browser keeps');
});

test('a unit control whose only offered unit is empty stays unitless', () => {
  /* z-index takes a bare number, so the fallback must not invent `px` for it */
  const n = heading();
  C.selSet([n.id]);
  r.draw(<Ctl n={n} c={{ t: 'unit', c: 'z-index', label: 'Z-index', units: [''] }} />);
  r.type(r.$('input[type=number]')!, '5');
  a.equal(C.cssVal(C.tgtObj(n), 'z-index', false).v, '5');
});

test('changing the unit sends the pair, not just the unit', () => {
  const n = heading();
  C.selSet([n.id]);
  const c: Control = { t: 'unit', c: 'max-width', label: 'Max width', r: 1, units: ['px', 'rem'] };
  r.draw(<Ctl n={n} c={c} />);
  r.type(r.$('input[type=number]')!, '40');
  r.pick(r.$('select')!, 'rem');
  a.equal(C.cssVal(C.tgtObj(n), 'max-width', true).v, '40rem', 'the number came along');
});

/* --------------------------------------------------------- responsive badge */

test('the responsive badge means "set at this breakpoint", not "has a value"', () => {
  const n = heading();
  C.selSet([n.id]);
  n.css.d = { 'font-size': '48px' };
  const c: Control = { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: ['px'] };

  C.state.ui.dev = 'mobile';
  r.draw(<Ctl n={n} c={c} />);
  a.equal(r.$('.rsp')!.classList.contains('ovr'), false,
    'mobile inherits the desktop size — inheriting is not overriding');

  r.type(r.$('input[type=number]')!, '28');
  r.draw(<Ctl n={n} c={c} />);
  a.equal(r.$('.rsp')!.classList.contains('ovr'), true, 'now it owns one');
  a.equal(n.css.m['font-size'], '28px');
});

test('clicking the badge clears only this breakpoint', () => {
  const n = heading();
  C.selSet([n.id]);
  n.css.d = { 'font-size': '48px' };
  n.css.m = { 'font-size': '28px' };
  C.state.ui.dev = 'mobile';
  r.draw(<Ctl n={n} c={{ t: 'unit', c: 'font-size', label: 'Size', r: 1, units: ['px'] }} />);

  r.click(r.$('.rsp'));
  a.equal('font-size' in n.css.m, false, 'the override is gone');
  a.equal(n.css.d['font-size'], '48px', 'and the base is untouched');
});

test('a box control clears all four sides, not one', () => {
  /* three sides surviving as a phantom override is the failure this guards */
  const n = heading();
  C.selSet([n.id]);
  C.state.ui.dev = 'mobile';
  n.css.m = { 'padding-top': '4px', 'padding-right': '4px', 'padding-bottom': '4px', 'padding-left': '4px' };
  r.draw(<Ctl n={n} c={{ t: 'box', c: 'padding', label: 'Padding', r: 1 }} />);
  r.click(r.$('.rsp'));
  a.deepEqual(n.css.m, {}, 'every side went');
});

/* ------------------------------------------------------------------ binding */

test('a bound control goes inert and shows the item value, not the literal', () => {
  const n = heading();
  C.selSet([n.id]);
  const col = C.collectionAdd('Projects')!;
  const field = C.titleField(col)!;
  const item = C.itemAdd(col.id)!;
  C.itemSet(col.id, item.id, field.id, 'Acme rebrand');
  n.props.text = 'A literal that is standing in';

  /* the section above it declares the scope */
  C.srcSet(C.state.pages[0].tree[0], col.id);
  C.bindSet(n, 'text', field.id);

  r.draw(<Ctl n={n} c={{ t: 'text', k: 'text', label: 'Heading text' }} />);
  const input = r.$('input.ctl') as HTMLInputElement;
  a.equal(input.disabled, true, 'editing it would be editing nothing');
  a.equal(input.value, 'Acme rebrand', 'what the canvas will actually render');
  a.match(r.$('.note')!.textContent!, /From/, 'and it says where the value comes from');
  a.equal(r.$('.bnd')!.classList.contains('on'), true, 'the badge stays live so it can be unbound');
});

/* ------------------------------------------------------- advanced pseudo-props */

test('the HTML id control reads from adv and strips what an attribute cannot carry', () => {
  /* the string version rendered an empty input and overwrote el.value in a loop after
     binding; a component reads the right place, and this asserts both halves */
  const n = heading();
  C.selSet([n.id]);
  n.adv.htmlId = 'existing-anchor';
  const c: Control = { t: 'text', k: '_id', label: 'HTML id' };
  r.draw(<Ctl n={n} c={c} />);
  a.equal((r.$('input.ctl') as HTMLInputElement).value, 'existing-anchor', 'shown without a fixup pass');

  r.type(r.$('input.ctl')!, 'sign up #now');
  a.equal(n.adv.htmlId, 'signupnow');
});

/* ------------------------------------------------------------------ repeaters */

test('a repeater adds, reorders and removes rows', () => {
  const n = C.insert('nav', null, 0)!;
  C.selSet([n.id]);
  const c: Control = { t: 'items', k: 'items', label: 'Menu links' };
  const drawn = () => r.draw(<Ctl n={n} c={c} />);
  drawn();

  const before = navRows(n).length;
  r.click(r.$$('button').find(b => /Add link/.test(b.textContent || '')) || null);
  a.equal(navRows(n).length, before + 1);

  drawn();
  r.type(r.$$('.irow')[0].querySelector('input')!, 'Renamed');
  a.equal(navRows(n)[0].label, 'Renamed');

  drawn();
  const second = navRows(n)[1].label;
  r.click(r.$$('.irow')[1].querySelector('[title="Move up"]'));
  a.equal(navRows(n)[0].label, second, 'it swapped with the row above');

  drawn();
  const count = navRows(n).length;
  r.click(r.$$('.irow')[0].querySelector('[title="Remove"]'));
  a.equal(navRows(n).length, count - 1);
});

test('move up is disabled on the first row', () => {
  const n = C.insert('nav', null, 0)!;
  C.selSet([n.id]);
  r.draw(<Ctl n={n} c={{ t: 'items', k: 'items', label: 'Menu links' }} />);
  const first = r.$$('.irow')[0].querySelector('[title="Move up"]') as HTMLButtonElement;
  a.equal(first.disabled, true, 'there is nothing above it');
});

/* ------------------------------------------------------------------- toggle */

test('a toggle writes 1 and 0, and carries its label inside the row', () => {
  const n = C.insert('image', null, 0)!;
  C.selSet([n.id]);
  const c: Control = { t: 'toggle', k: 'decorative', label: 'Decorative' };
  r.draw(<Ctl n={n} c={c} />);
  a.equal(r.$('label'), null, 'no separate label — the row carries it');
  a.match(r.$('.tog-row span')!.textContent!, /Decorative/);

  r.click(r.$('.sw-tog'));
  a.equal(n.props.decorative, 1);
  r.draw(<Ctl n={n} c={c} />);
  r.click(r.$('.sw-tog'));
  a.equal(n.props.decorative, 0);
});

/* ------------------------------------------------------------ fan-out through the panel */

test('editing one control writes every selected element', () => {
  const one = heading();
  const col = C.locate(one.id)!.parent!;
  const two = C.insert('heading', col, 1)!;
  C.selSet([one.id, two.id]);
  r.draw(<Ctl n={one} c={{ t: 'text', k: 'text', label: 'Heading text' }} />);
  r.type(r.$('input.ctl')!, 'Both of them');
  a.deepEqual([one.props.text, two.props.text], ['Both of them', 'Both of them']);
});

/* ------------------------------------------------------------------ Navigator */

test('a Navigator row acts on itself, not on the selection', () => {
  /* the rule the old binder stated in a comment and nothing enforced */
  const one = heading();
  const col = C.locate(one.id)!.parent!;
  const two = C.insert('heading', col, 1)!;
  C.selSet([two.id]);
  r.draw(() => <Layers />, 'layers');

  const row = r.$(`.lrow[data-id="${one.id}"]`)!;
  r.click(row.querySelector('[title^="Hide"]'));
  a.deepEqual(r.arg('runAct'), ['hide', [one.id]], 'the row it belongs to, not the selection');
});

test('a Navigator row click selects, and a modifier adds', () => {
  const n = heading();
  C.selSet([]);
  r.draw(() => <Layers />, 'layers');
  const row = r.$(`.lrow[data-id="${n.id}"]`)!;
  row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  a.deepEqual(r.arg('select'), [n.id, { scroll: true, add: false, range: false }]);

  r.calls.length = 0;
  row.dispatchEvent(new window.MouseEvent('click', { bubbles: true, metaKey: true }));
  a.equal(r.arg('select')![1].add, true, 'a modifier extends the set');
});

test('Navigator rows carry data-id, which the drag reads back', () => {
  /* startLayerDrag finds its drop target with closest('.lrow[data-id]'), so this attribute
     is load-bearing — the port nearly shipped without it and drag-to-reorder became a
     silent no-op */
  const n = heading();
  r.draw(() => <Layers />, 'layers');
  a.ok(r.$(`.lrow[data-id="${n.id}"]`), 'the node row has one');
  a.equal(r.$$('.lrow.region').filter(x => x.dataset.id).length, 0,
    'and region rows deliberately do not, which is what excludes them as drop targets');
});

test('the twisty collapses a subtree without changing the selection', () => {
  const n = heading();
  C.selSet([n.id]);
  const sec = C.state.pages[0].tree[0];
  r.draw(() => <Layers />, 'layers');
  const before = r.$$('.lrow[data-id]').length;

  r.click(r.$(`.lrow[data-id="${sec.id}"]`)!.querySelector('.tw'));
  a.equal(C.state.ui.collapsed[sec.id], true);
  a.ok(r.$$('.lrow[data-id]').length < before, 'the subtree went');
  a.deepEqual(C.selIds(), [n.id], 'and the selection stayed put');
});
