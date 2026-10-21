// @vitest-environment jsdom
import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as C from '../app/src/core/index';

afterEach(() => {
  document.head.replaceChildren();
  document.body.replaceChildren();
});

test('the active component badge passes canvas clicks through while a locked region keeps its Edit button interactive', () => {
  const style = document.createElement('style');
  style.textContent = C.baseCss(true).replaceAll(':hover', '.hover-probe');
  document.head.append(style);
  document.body.innerHTML = `
    <section class="s-region hover-probe" data-state="edit">
      <div class="s-lockbar"><span class="s-lockchip on">Editing component</span></div>
      <div class="s-rbody"><h2 data-id="component-root">Heading</h2></div>
    </section>
    <section class="s-region hover-probe" data-state="locked">
      <div class="s-lockbar">
        <span class="s-lockchip">Global header</span>
        <button type="button" class="s-lockopen">Edit header</button>
      </div>
      <div class="s-rbody">Locked content</div>
    </section>`;

  const editBar = document.querySelector<HTMLElement>('[data-state="edit"] > .s-lockbar')!;
  const lockedBar = document.querySelector<HTMLElement>('[data-state="locked"] > .s-lockbar')!;
  const editButton = lockedBar.querySelector<HTMLButtonElement>('button.s-lockopen')!;
  assert.equal(getComputedStyle(editBar).opacity, '1', 'the active badge stays visible on hover');
  assert.equal(getComputedStyle(editBar).pointerEvents, 'none', 'the active badge cannot cover its root');
  assert.equal(getComputedStyle(lockedBar).pointerEvents, 'auto', 'locked regions retain their action target');
  assert.equal(editButton.disabled, false);
  assert.equal(editButton.tabIndex, 0);
  assert.equal(editButton.textContent, 'Edit header');
  assert.doesNotMatch(C.baseCss(false), /s-lockbar|s-lockopen/, 'editor hit-testing rules stay out of public output');
});
