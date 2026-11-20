// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import type { Control } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

/* I4: Padding and Margin show two axis fields when opposite sides match and four when they
   differ; the link button switches, and linking makes opposite sides equal. */
let r: Rig;
beforeEach(() => { r = rig(); C.state.ui.dev = 'desktop'; C.state.ui.st = ''; C.state.ui.target = ''; });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); C.state.ui.dev = 'desktop'; });
const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
const section = () => { const n = C.insert('section', null, 0)!; C.selSet([n.id]); return n; };
const field = (part: string) => r.$(`input[data-field-part="${part}"]`) as HTMLInputElement;
const sides = (n: any, bp = 'd') => ['top', 'right', 'bottom', 'left'].map(s => n.css[bp][`padding-${s}`]);

test('two axis fields write their opposite sides together', () => {
  const n = section();
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(r.$('.boxctl.split'), null);
  act(() => r.type(field('top and bottom'), '16'));
  act(() => r.type(field('left and right'), '24'));
  assert.deepEqual(sides(n), ['16px', '24px', '16px', '24px']);
  assert.equal(n.css.d.padding, undefined, 'the shorthand gives way to four longhands');
});

test('sides that differ open split, and linking makes bottom match top and right match left', () => {
  const n = section();
  Object.assign(n.css.d, { 'padding-top': '8px', 'padding-right': '12px', 'padding-bottom': '30px', 'padding-left': '20px' });
  r.draw(<Ctl n={n} c={padding} />);
  assert.ok(r.$('.boxctl.split'));
  assert.deepEqual(r.$$('input').map(i => (i as HTMLInputElement).value), ['8', '12', '30', '20']);
  const link = r.$('.boxctl-link')!;
  assert.equal(link.getAttribute('aria-pressed'), 'false');
  assert.equal(link.getAttribute('aria-label'), 'Padding: link opposite sides');
  act(() => r.click(link));
  assert.deepEqual(sides(n), ['8px', '20px', '8px', '20px']);
  assert.equal(r.$('.boxctl.split'), null);
  assert.equal(field('top and bottom').value, '8');
  assert.equal(field('left and right').value, '20');
});

test('splitting matching sides changes nothing until a side is edited', () => {
  const n = section();
  Object.assign(n.css.d, { 'padding-top': '10px', 'padding-right': '10px', 'padding-bottom': '10px', 'padding-left': '10px' });
  r.draw(<Ctl n={n} c={padding} />);
  const before = JSON.stringify(n.css);
  act(() => r.click(r.$('.boxctl-link')!));
  assert.ok(r.$('.boxctl.split'));
  assert.equal(JSON.stringify(n.css), before, 'splitting writes nothing');
  act(() => r.type(field('bottom'), '40'));
  assert.deepEqual(sides(n), ['10px', '10px', '40px', '10px']);
  act(() => r.click(r.$('.boxctl-link')!));
  assert.deepEqual(sides(n), ['10px', '10px', '10px', '10px']);
});

test('axis edits land in the current breakpoint, and split resets with the scope', () => {
  const n = section();
  const desktop = JSON.stringify(n.css.d);
  C.state.ui.dev = 'mobile';
  r.draw(<Ctl n={n} c={padding} />);
  act(() => r.type(field('top and bottom'), '12'));
  const [t, right, b, left] = sides(n, 'm');
  assert.equal(t, '12px'); assert.equal(b, '12px');
  assert.equal(right, left, 'left and right stay a matching pair');
  assert.equal(JSON.stringify(n.css.d), desktop, 'desktop is untouched');
  act(() => r.click(r.$('.boxctl-link')!));
  assert.ok(r.$('.boxctl.split'));
  C.state.ui.dev = 'desktop';
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(r.$('.boxctl.split'), null, 'desktop opens from its own matching sides');
});

test('a unit applies to both axis fields', () => {
  const n = section();
  r.draw(<Ctl n={n} c={padding} />);
  act(() => r.type(field('top and bottom'), '1'));
  act(() => r.type(field('left and right'), '2'));
  act(() => r.pick(r.$('select[data-field-part="unit"]')!, 'rem'));
  assert.deepEqual(sides(n), ['1rem', '2rem', '1rem', '2rem']);
});
