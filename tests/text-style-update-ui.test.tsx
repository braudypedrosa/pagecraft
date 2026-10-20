// @vitest-environment jsdom
import { test, beforeEach, afterEach } from 'vitest';
import a from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function linkedButtons() {
  const source = C.insert('button', null, 0)!;
  const other = C.insert('button', null, 1)!;
  C.tsApply(source, 'btn');
  C.tsApply(other, 'btn');
  source.css.d['padding-top'] = '0';
  other.css.d['padding-top'] = '10px';
  const control = C.DEF.button.controls.content.find(c => c.t === 'tstyle')!;
  r.draw(() => <Ctl n={source} c={control} />, 'right');
  return { source, other, control };
}

test('appearance-only button edits cannot claim a shared typography update', async () => {
  linkedButtons();
  const update = r.$('.pc-text-style-actions button') as HTMLButtonElement;
  a.match(update.textContent || '', /^Update typography · 2 uses$/);
  a.equal(update.disabled, true);
  a.match(update.title, /typography/i);
  a.match(update.title, /Spacing, backgrounds and borders stay local/i);
  const before = JSON.stringify(C.doc());
  await act(async () => { r.click(update); });
  a.equal(JSON.stringify(C.doc()), before);
  a.equal(r.names().includes('askConfirm'), false);
  a.equal(r.names().includes('toast'), false);
});

test('the confirmed typography update shares fonts, keeps spacing, and becomes disabled', async () => {
  const { source, other, control } = linkedButtons();
  source.css.d['font-size'] = '18px';
  r.draw(() => <Ctl n={source} c={control} />, 'right');
  const update = r.$('.pc-text-style-actions button') as HTMLButtonElement;
  const previousSharedSize = C.findStyle('btn')!.css.d['font-size'];
  a.equal(update.disabled, false);
  await act(async () => { r.click(update); });
  const confirmation = r.arg('askConfirm')!;
  a.equal(confirmation[0], 'Update typography everywhere?');
  a.match(confirmation[1], /Button label/);
  a.match(confirmation[1], /Spacing, backgrounds and borders stay local/i);
  a.equal(confirmation[2].ok, 'Update typography');
  a.equal(C.findStyle('btn')!.css.d['font-size'], '18px');
  a.equal(source.css.d['font-size'], undefined);
  a.equal(source.css.d['padding-top'], '0');
  a.equal(other.css.d['padding-top'], '10px');
  a.equal(r.arg('toast')![0], 'Typography updated');
  r.draw(() => <Ctl n={source} c={control} />, 'right');
  a.equal((r.$('.pc-text-style-actions button') as HTMLButtonElement).disabled, true);

  a.equal(C.historyLabel('undo'), 'Update typography');
  C.undo();
  a.equal(C.historyLabel('redo'), 'Update typography');
  a.equal(C.findStyle('btn')!.css.d['font-size'], previousSharedSize);
  a.equal(C.locate(source.id)!.node.css.d['font-size'], '18px');
  C.redo();
  a.equal(C.historyLabel('undo'), 'Update typography');
  a.equal(C.findStyle('btn')!.css.d['font-size'], '18px');
  a.equal(C.locate(source.id)!.node.css.d['font-size'], undefined);
});
