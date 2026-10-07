// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;

beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function inspect(n: ReturnType<typeof C.N>, tab: 'content' | 'style' | 'advanced' = 'content',
  dev: 'desktop' | 'tablet' | 'mobile' = 'desktop') {
  C.state.pages[0].tree = [n];
  C.state.ui.stab = tab;
  C.state.ui.dev = dev;
  C.selSet([n.id]);
  r.draw(() => <Inspector />, 'right');
}

function help(kind: string) {
  return r.$(`details[data-context-help="${kind}"]`) as HTMLDetailsElement;
}

test('container help identifies Section, Row and each Box layout without replacing their controls', () => {
  const cases = [
    [C.N('section'), 'About this Section', 'page-wide region'],
    [C.N('row'), 'About this Row and its Columns', 'arranges Columns side by side'],
    [C.N('box', { layout: 'block' }), 'About this Box', 'stacks its direct children'],
    [C.N('box', { layout: 'flex' }), 'About this Flex container', 'one flexible axis'],
    [C.N('box', { layout: 'grid' }), 'About this Grid', 'occupies a grid cell']
  ] as const;

  for (const [node, summary, description] of cases) {
    inspect(node);
    assert.equal(help('layout').open, false, 'guidance stays optional');
    assert.equal(help('layout').querySelector('summary')!.textContent, summary);
    assert.match(help('layout').textContent!, new RegExp(description));
    assert.ok(r.$('.gh'), 'the original control group remains available');
  }
});

test('native help remains open across an inspector repaint', () => {
  const section = C.N('section');
  inspect(section);
  const details = help('layout');
  assert.equal(details.querySelector('summary')!.tagName, 'SUMMARY');
  details.open = true;
  r.draw(() => <Inspector />);
  assert.equal(help('layout'), details, 'repaint keeps the same native disclosure element');
  assert.equal(help('layout').open, true);
});

test('content-only accounts get content editing without structural layout guidance', () => {
  r.host.remove();
  r = rig({ canStructure: false });

  inspect(C.N('section'));
  assert.equal(help('layout'), null, 'a role that cannot change structure gets no structural prompt');
  assert.equal(r.$('.tabs'), null, 'the existing content-only inspector remains single-purpose');

  const heading = C.N('heading', { text: 'Editable copy' });
  inspect(heading);
  const editor = r.$('textarea') as HTMLTextAreaElement;
  assert.ok(editor, 'content editing remains available');
  assert.equal(editor.value, 'Editable copy');
  assert.equal(editor.disabled, false);
});

test('responsive help distinguishes the desktop base, inherited Tablet styles and Tablet overrides', () => {
  const heading = C.N('heading');
  heading.css.d['font-size'] = '48px';

  inspect(heading, 'style', 'desktop');
  assert.match(help('responsive').querySelector('summary')!.textContent!, /Desktop base/);
  assert.match(help('responsive').textContent!, /Tablet and Mobile inherit/);
  assert.ok(r.$('button.rst'), 'desktop reset controls remain available');

  heading.css.t.transform = 'translateY(-2px)';
  inspect(heading, 'style', 'tablet');
  assert.match(help('responsive').querySelector('summary')!.textContent!, /Tablet inherits Desktop/);
  assert.match(help('responsive').textContent!, /does not describe your browser window size/);
  assert.match(help('responsive').textContent!, /no saved responsive overrides/,
    'a non-responsive CSS declaration does not change the responsive scope message');
  assert.equal(r.$('.rsp')!.tagName, 'SPAN', 'an inherited value is not presented as a reset action');

  heading.css.t['font-size'] = '34px';
  r.draw(() => <Inspector />);
  assert.match(help('responsive').querySelector('summary')!.textContent!, /Tablet has overrides/);
  assert.match(help('responsive').textContent!, /1 saved responsive override/);
  assert.ok(r.$('button.rsp[aria-label="Clear Tablet override for Size"]'),
    'the original field-level override reset remains available');
});

test('Mobile inherits Tablet before Desktop and only reports its own responsive overrides', () => {
  const heading = C.N('heading');
  heading.css.d['font-size'] = '48px';
  heading.css.t['font-size'] = '34px';
  heading.css.m['box-shadow'] = '0 4px 12px rgba(0,0,0,.1)';
  inspect(heading, 'style', 'mobile');

  assert.match(help('responsive').querySelector('summary')!.textContent!, /Mobile inherits Tablet, then Desktop/);
  assert.match(help('responsive').textContent!, /values from Tablet where set, then Desktop for the rest/);
  assert.match(help('responsive').textContent!, /no saved responsive overrides/,
    'a non-responsive Mobile declaration is excluded');
  const size = r.$('.f input[type="number"]') as HTMLInputElement;
  assert.equal(size.value, '34', 'the field follows the same Mobile, Tablet, Desktop cascade');
  assert.equal(r.$('.rsp')!.tagName, 'SPAN', 'an inherited Tablet value has no Mobile reset');

  heading.css.m['font-size'] = '28px';
  r.draw(() => <Inspector />);
  assert.match(help('responsive').querySelector('summary')!.textContent!, /Mobile has overrides/);
  assert.match(help('responsive').textContent!, /1 saved responsive override/);
  assert.ok(r.$('button.rsp[aria-label="Clear Mobile override for Size"]'));
});

test('committing a live Padding edit refreshes help and its badge without remounting the control', () => {
  const section = C.N('section');
  inspect(section, 'style', 'tablet');
  const details = help('responsive');
  details.open = true;
  const spacing = r.$$('.group').find(group => group.querySelector('.gh')?.textContent?.includes('Spacing'))!;
  const top = spacing.querySelector('input[data-field-part="top"]') as HTMLInputElement;

  top.focus();
  r.type(top, '84');
  assert.equal(r.$('input[data-field-part="top"]'), top, 'live input keeps the same DOM node');
  assert.equal(document.activeElement, top, 'live input keeps focus and cursor ownership');
  assert.match(help('responsive').querySelector('summary')!.textContent!, /Tablet inherits Desktop/,
    'guidance changes when the edit commits');

  top.blur();
  assert.equal(r.$('input[data-field-part="top"]'), top, 'commit reconciles the existing input');
  assert.equal(help('responsive'), details, 'commit preserves the native disclosure element');
  assert.equal(details.open, true, 'open help stays open across the inspector repaint');
  assert.match(details.querySelector('summary')!.textContent!, /Tablet has overrides/);
  assert.match(details.textContent!, /1 saved responsive override/,
    'four stored sides belong to one responsive Padding control');
  const reset = spacing.querySelector('button.rsp[aria-label="Clear Tablet override for Padding"]')!;
  assert.ok(reset, 'the matching field reset appears on commit');

  r.click(reset);
  assert.match(help('responsive').querySelector('summary')!.textContent!, /Tablet inherits Desktop/);
  assert.equal(help('responsive').open, true, 'reset also preserves the open disclosure');
  assert.equal(spacing.querySelector('button.rsp[aria-label="Clear Tablet override for Padding"]'), null);
});

test('CMS source help explains collection scope before field binding and reuses the existing next action', () => {
  const section = C.N('section');
  const collection = C.collectionAdd('Projects')!;
  inspect(section, 'advanced');

  let cms = help('cms');
  assert.match(cms.textContent!, /First choose a collection/);
  assert.match(cms.textContent!, /Then select something inside/);
  const panel = cms.closest('.group')!;
  assert.equal(panel.querySelector('select')!.getAttribute('aria-label'), 'Content source collection');
  r.pick(panel.querySelector('select')!, collection.id);
  r.draw(() => <Inspector />);

  cms = help('cms');
  assert.match(cms.textContent!, /Projects.*sets which items and fields are available/);
  assert.match(cms.textContent!, /does not replace any content by itself/);
  const bind = cms.closest('.group')!.querySelector('button.btn.block')!;
  assert.match(bind.textContent!, /Bind the fields inside/);
  r.click(bind);
  assert.deepEqual(r.arg('bindModal'), [section.id]);
});

test('Collection list keeps the same source and binding controls with help at the point of use', () => {
  const list = C.N('list');
  C.collectionAdd('Articles');
  inspect(list);
  const cms = help('cms');
  assert.match(cms.textContent!, /First choose the collection whose items this list should repeat/);
  assert.ok(cms.closest('.f')!.querySelector('select'));
  assert.match(cms.closest('.group')!.querySelector('.gh')!.textContent!, /Collection list/);
});
