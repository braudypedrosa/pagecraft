// @vitest-environment jsdom
/* The text style control's Detach, None and pick paths change element typography, so
   without an explicit label history inferred "Change button size" from the side effect.
   These drive the real control so a missing label at the call site fails here. */
import { test, beforeEach, afterEach } from 'vitest';
import a from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

/* Labels name the action only: never the style's name, id or any baked value. */
const PRIVATE = /Button label|btn|Lead|15px|600|\dpx|size/i;

function styledButton() {
  const button = C.insert('button', null, 0)!;
  C.tsApply(button, 'btn');
  C.hist.u.length = 0;
  C.hist.r.length = 0;
  const control = C.DEF.button.controls.content.find(c => c.t === 'tstyle')!;
  r.draw(() => <Ctl n={button} c={control} />, 'right');
  return { button, control };
}

function expectLabelBothWays(label: string) {
  a.equal(C.historyLabel('undo'), label);
  a.doesNotMatch(C.historyLabel('undo') || '', PRIVATE);
  C.undo();
  a.equal(C.historyLabel('redo'), label);
  a.doesNotMatch(C.historyLabel('redo') || '', PRIVATE);
  C.redo();
  a.equal(C.historyLabel('undo'), label);
}

test('Detach is labelled Detach text style in Undo and Redo', async () => {
  const { button } = styledButton();
  const detach = r.$$('.pc-text-style-actions button').find(b => b.textContent?.trim() === 'Detach')!;
  a.ok(detach);
  await act(async () => { r.click(detach); });
  a.equal(C.locate(button.id)!.node.props.ts, '');
  a.equal(C.locate(button.id)!.node.css.d['font-size'], '15px');
  expectLabelBothWays('Detach text style');
});

test('choosing None in the text style menu is labelled Detach text style', async () => {
  const { button } = styledButton();
  await act(async () => { r.pick(r.$('select.ctl')!, ''); });
  a.equal(C.locate(button.id)!.node.props.ts, '');
  expectLabelBothWays('Detach text style');
});

test('choosing a text style is labelled Apply text style', async () => {
  const { button } = styledButton();
  C.locate(button.id)!.node.css.d['font-size'] = '22px';
  await act(async () => { r.pick(r.$('select.ctl')!, 'lead'); });
  a.equal(C.locate(button.id)!.node.props.ts, 'lead');
  expectLabelBothWays('Apply text style');
});

test('Save as text style is labelled Create text style without its name', async () => {
  const button = C.insert('button', null, 0)!;
  button.props.ts = '';
  button.css.d['font-size'] = '19px';
  C.hist.u.length = 0;
  const control = C.DEF.button.controls.content.find(c => c.t === 'tstyle')!;
  r.draw(() => <Ctl n={button} c={control} />, 'right');
  const save = r.$$('.pc-text-style-actions button').find(b => /Save as text style/.test(b.textContent || ''))!;
  a.ok(save);
  await act(async () => { r.click(save); });
  a.ok(C.findStyle(C.locate(button.id)!.node.props.ts));
  a.equal(C.historyLabel('undo'), 'Create text style');
  a.doesNotMatch(C.historyLabel('undo') || '', /Stub name|19px/);
});
