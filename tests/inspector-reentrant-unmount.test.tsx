// @vitest-environment jsdom
import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { mount } from '../app/src/ui/index';
import { stubLegacy } from './ui.setup';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('structural inspector remount ignores a blur repaint during Preact unmount', async () => {
  document.body.innerHTML = '<div id="right"></div>';
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  const gallery = C.insert('gallery', null, 0)!;
  const heading = C.insert('heading', null, 1)!;
  const ui = mount(C, stubLegacy([], { dynamicContentProvider: 'wordpress' }));
  C.selSet([gallery.id]);
  C.state.ui.stab = 'content';
  act(() => ui.renderRight());
  await settle();

  const input = document.querySelector<HTMLInputElement>('input[aria-label="Columns value"]');
  assert.ok(input, 'Gallery Columns numeric input mounted');
  input.focus();
  assert.equal(document.activeElement, input, 'numeric input received focus');
  let injected = false;
  const removeChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (!injected && this.contains(input)) {
      injected = true;
      input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    }
    return removeChild.call(this, child) as T;
  };

  try {
    C.selSet([heading.id]);
    assert.doesNotThrow(() => act(() => ui.renderRight()));
  } finally {
    Node.prototype.removeChild = removeChild;
  }
  assert.equal(injected, true, 'the focused input was removed during the structural unmount');
  await settle();
  assert.equal(document.querySelector('.sHead b')?.textContent, C.kindOf(heading));
  assert.equal(document.querySelectorAll('#inspector-panel').length, 1);
});

afterEach(() => { document.body.replaceChildren(); });
