// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

test('row count and layout choices expose their current selection after changes', () => {
  const row = C.insert('row', null, 0)!;
  C.applyCols(row, [50, 50]);
  const control = C.DEF.row.controls.content.find(c => c.t === 'cols')!;
  const draw = () => r.draw(<Ctl n={row} c={control} />);
  draw();

  assert.equal(r.$('.pick button[title="2 columns"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(r.$('.pick button[title="3 columns"]')!.getAttribute('aria-pressed'), 'false');
  assert.equal(r.$('.lay button[title="50% / 50%"]')!.getAttribute('aria-pressed'), 'true');

  act(() => r.click(r.$('.pick button[title="3 columns"]')));
  draw();
  assert.equal(row.children.length, 3);
  assert.equal(r.$('.pick button[title="3 columns"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(r.$('.pick button[title="2 columns"]')!.getAttribute('aria-pressed'), 'false');
  act(() => r.click(r.$('.lay button[title="50% / 25% / 25%"]')));
  draw();
  assert.equal(r.$$('.lay button[aria-pressed="true"]').length, 1);
  assert.equal(r.$('.lay button[title="50% / 25% / 25%"]')!.getAttribute('aria-pressed'), 'true');
  assert.equal(r.$('.lay button[title="33% / 33% / 33%"]')!.getAttribute('aria-pressed'), 'false');
});

test('clearing a column share displays an explicit unset value instead of inventing the minimum', () => {
  const n = C.insert('column', null, 0)!;
  n.css.d['flex-grow'] = '50';
  C.selSet([n.id]);
  const control = C.DEF.column.controls.content.find(c => c.c === 'flex-grow')!;
  const draw = () => r.draw(<Ctl n={n} c={control} />);
  draw();

  act(() => r.type(r.$('input[type="number"]')!, ''));
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).placeholder, 'Not set');
  assert.equal(r.$('input[type="range"]')!.getAttribute('aria-valuetext'), 'Not set');
  draw();
  assert.equal(n.css.d['flex-grow'], undefined);
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).value, '');
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).placeholder, 'Not set');
  assert.equal(r.$('input[type="range"]')!.getAttribute('aria-valuetext'), 'Not set');

  act(() => r.type(r.$('input[type="number"]')!, '50'));
  assert.equal(r.$('input[type="range"]')!.getAttribute('aria-valuetext'), null);
  draw();
  assert.equal(n.css.d['flex-grow'], '50');
  assert.equal((r.$('input[type="range"]') as HTMLInputElement).value, '50');
  assert.equal(r.$('input[type="range"]')!.getAttribute('aria-valuetext'), null);
});

test('resetting a share displays unset on Desktop and the actual inherited share on Tablet', () => {
  const n = C.insert('column', null, 0)!;
  n.css.d['flex-grow'] = '50';
  C.selSet([n.id]);
  const control = C.DEF.column.controls.content.find(c => c.c === 'flex-grow')!;
  r.draw(() => <Ctl n={n} c={control} />, 'right');
  act(() => r.click(r.$('button[aria-label="Restore default for Width (share)"]')));
  assert.equal(n.css.d['flex-grow'], undefined);
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).value, '');

  n.css.d['flex-grow'] = '50';
  n.css.t['flex-grow'] = '25';
  C.state.ui.dev = 'tablet';
  r.draw(() => <Ctl n={n} c={control} />, 'right');
  act(() => r.type(r.$('input[type="number"]')!, ''));
  assert.equal(n.css.t['flex-grow'], undefined);
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).placeholder, '50');
  assert.equal((r.$('input[type="range"]') as HTMLInputElement).value, '50');
  assert.equal(r.$('input[type="range"]')!.getAttribute('aria-valuetext'), null);

  n.css.t['flex-grow'] = '25';
  r.draw(() => <Ctl n={n} c={control} />, 'right');
  act(() => r.click(r.$('button[aria-label="Clear Tablet override for Width (share)"]')));
  assert.equal(n.css.t['flex-grow'], undefined);
  assert.equal((r.$('input[type="number"]') as HTMLInputElement).value, '50');
  assert.equal((r.$('input[type="range"]') as HTMLInputElement).value, '50');
  assert.equal(r.$('input[type="range"]')!.getAttribute('aria-valuetext'), null);
});
