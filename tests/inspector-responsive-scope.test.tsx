// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });
const size: Control = { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: ['px'] };

function heading() {
  const n = C.insert('heading', null, 0)!;
  C.selSet([n.id]);
  n.css.d['font-size'] = '48px';
  n.css.t['font-size'] = '36px';
  C.state.ui.dev = 'mobile';
  return n;
}

test('field scope follows Mobile overrides and clearing restores Tablet inheritance', () => {
  const n = heading();
  r.draw(<Ctl n={n} c={size} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Inherited');
  assert.match(r.$('.pc-responsive-status')!.getAttribute('title')!, /Tablet where set, then Desktop/);
  const input = r.$('input') as HTMLInputElement;
  assert.equal(input.value, '36');
  assert.ok(input.getAttribute('aria-describedby')?.includes(r.$('.pc-responsive-status')!.id));

  r.type(input, '24');
  r.draw(<Ctl n={n} c={size} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Override');
  assert.equal(n.css.d['font-size'], '48px');
  assert.equal(n.css.t['font-size'], '36px');
  r.click(r.$('button.rsp'));
  r.draw(<Ctl n={n} c={size} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Inherited');
  assert.equal((r.$('input') as HTMLInputElement).value, '36');
  assert.equal(n.css.m['font-size'], undefined);

  delete n.css.t['font-size'];
  r.draw(<Ctl n={n} c={size} />);
  assert.equal((r.$('input') as HTMLInputElement).value, '48');
});

test('scope follows the targeted class and interaction state, including box sides', () => {
  const n = heading();
  n.css.m['padding-top'] = '10px';
  const padding: Control = { t: 'box', c: 'padding', label: 'Padding', r: 1 };
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Override');
  C.state.ui.st = 'hover';
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Inherited');
  assert.equal(n.css.m['padding-top'], '10px');
  C.state.ui.st = '';
  const classId = C.classAdd('Space', { t: { 'padding-top': '20px' } });
  C.classApply(n, classId);
  C.state.ui.target = classId;
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Inherited');
  C.findClass(classId)!.css.m['padding-top'] = '5px';
  r.draw(<Ctl n={n} c={padding} />);
  assert.equal(r.$('.pc-responsive-status')?.textContent, 'Override');
  r.click(r.$('button.rsp'));
  assert.equal(C.findClass(classId)!.css.m['padding-top'], undefined);
  assert.equal(n.css.m['padding-top'], '10px', 'clearing a class override leaves node styling intact');
});

test('Desktop and shared content do not show responsive field badges', () => {
  const n = heading();
  C.state.ui.dev = 'desktop';
  r.draw(<Ctl n={n} c={size} />);
  assert.equal(r.$('.pc-responsive-status'), null);
  C.state.ui.dev = 'tablet';
  r.draw(<Ctl n={n} c={{ t: 'text', k: 'text', label: 'Text' }} />);
  assert.equal(r.$('.pc-responsive-status'), null);
  C.state.ui.stab = 'content';
  r.draw(<Inspector />);
  assert.match(r.$('[data-context-help="content-scope"]')!.textContent!, /also updates Desktop/);
});
