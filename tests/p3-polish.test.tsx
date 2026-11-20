// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

/* Readiness P3 polish: small wording, layout and behaviour fixes. */
let r: Rig;
beforeEach(() => { r = rig(); C.state.ui.dev = 'desktop'; C.state.ui.st = ''; C.state.ui.target = ''; });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); C.state.ui.dev = 'desktop'; });
const builder = readFileSync('builder.html', 'utf8');
const borderGroup = () => C.COMMON_STYLE.find(group => group.g === 'Border & shadow')!.items;
const labels = () => [...r.host.querySelectorAll('.borderctl .f > label > span:first-child')].map(el => el.textContent);

test('I7: the whole-box border fields read Style, Width and Colour; an edge names itself', async () => {
  const n = C.N('box'); C.selSet([n.id]);
  r.draw(<Ctl n={n} c={borderGroup().find(c => c.t === 'border')!} />);
  assert.deepEqual(labels().slice(1), ['Style', 'Width', 'Colour']);
  await act(async () => { r.click(r.$('[data-border-side="top"]')); });
  assert.deepEqual(labels().slice(1), ['Top style', 'Top width', 'Top colour']);
});

test('I6: Radius is stacked like the other Border fields', () => {
  const radius = borderGroup().find(c => c.c === 'border-radius')!;
  assert.equal(radius.layout, undefined);
});

test('I11: Alignment is offered for an image in the flow, not one placed absolutely', () => {
  const visible = (n: any) => C.DEF.image.controls.content.some((c: any) => c.c === 'align-self' && (!c.when || c.when(n)));
  const img = C.N('image');
  assert.equal(visible(img), true);
  img.css.d.position = 'absolute';
  assert.equal(visible(img), false);
});

test('C5: Shift+Escape clears the selection in one press and is listed in the shortcuts', () => {
  const branch = builder.slice(builder.indexOf("  if (k === 'escape') {"), builder.indexOf("document.addEventListener('keydown', hotkey);"));
  assert.match(branch, /if \(e\.shiftKey\) \{ if \(state\.ui\.sel\) \{ e\.preventDefault\(\); select\(null\); \} return; \}/);
  assert.ok(branch.indexOf('e.shiftKey') < branch.indexOf('multiOn()'), 'before the one-step walk');
  assert.match(builder, /\['Clear the selection', '⇧esc'\]/);
});

test('E7: the CMS rail item opens a panel called CMS, and a hosted site has Design settings', () => {
  assert.match(builder, /const PANEL_TITLE = \{[^}]*cms: 'CMS' \}/);
  assert.match(builder, /openModal\(IS_WORDPRESS \? 'Pagecraft design settings' : SRV \? 'Design settings' : 'Project settings'/);
  assert.match(builder, /<label for="mName">\$\{SRV \? 'Site name' : 'Project name'\}<\/label>/);
});

test('E17: a hosted site has no Reset to demo content, and the backup sits beside the reset actions', () => {
  const block = builder.slice(builder.indexOf("const reset = document.createElement('div')"), builder.indexOf("$('#mDone').textContent = 'Close';"));
  assert.match(block, /if \(SRV\) \$\('#mReset'\)\.remove\(\);/);
  assert.match(block, /id="mBackup"[^>]*>Download backup<\/button>/);
  assert.match(block, /\$\('#mBackup'\)\.addEventListener\('click', event => backupJson\(event\)\)/);
  assert.doesNotMatch(block, /Download a project backup first\./);
});

test('E9: the template guide explains progress in plain words', () => {
  const guide = readFileSync('app/src/ui/FirstEditGuide.tsx', 'utf8');
  assert.doesNotMatch(guide, /Progress reflects saved changes/);
  assert.match(guide, /A step is ticked once your change saves\. Undo the change and the step comes back\./);
});
