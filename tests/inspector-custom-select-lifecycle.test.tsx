// @vitest-environment jsdom
import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { mount } from '../app/src/ui/index';
import { stubLegacy } from './ui.setup';

const settleEnhancements = () => new Promise(resolve => setTimeout(resolve, 0));

test('mounted inspector stays coherent across enhanced-select selection and tab changes', async () => {
  document.body.innerHTML = '<div id="app"><div class="main"><aside id="right"></aside></div></div>';
  const right = document.getElementById('right')!;
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  const heading = C.insert('heading', null, 0)!;
  const text = C.insert('text', null, 1)!;
  const image = C.insert('image', null, 2)!;
  const section = C.insert('section', null, 3)!;
  const ui = mount(C, stubLegacy([], { dynamicContentProvider: 'wordpress' }));

  const assertOneInspector = () => {
    for (const selector of ['.sHead', '.tabs', '.sFoot', '#inspector-panel']) {
      assert.equal(right.querySelectorAll(selector).length, 1, `${selector} is not duplicated`);
    }
  };
  const draw = async (node: typeof heading, tab: 'content' | 'style' | 'advanced') => {
    C.selSet([node.id]);
    C.state.ui.stab = tab;
    act(() => ui.renderRight());
    await settleEnhancements();
    assertOneInspector();
    assert.equal(right.querySelector('.sHead b')?.textContent, C.kindOf(node));
  };

  await draw(heading, 'content');
  assert.ok(right.querySelector('.pc-custom-select-trigger'), 'real select enhancement ran inside the inspector');
  const headingPanel = right.querySelector<HTMLElement>('#inspector-panel')!;
  const headingField = right.querySelector<HTMLElement>('textarea, input')!;
  headingField.focus();
  headingPanel.scrollTop = 73;
  act(() => ui.renderRight());
  assert.equal(right.querySelector('#inspector-panel'), headingPanel,
    'ordinary repaints keep the mounted inspector and focused controls');
  assert.equal(document.activeElement, headingField);

  await draw(text, 'content');
  const textPanel = right.querySelector('#inspector-panel');
  assert.notEqual(textPanel, headingPanel,
    'a structural selection change discards DOM that the select enhancer mutated');
  await draw(image, 'content');
  assert.notEqual(right.querySelector('#inspector-panel'), textPanel);
  assert.match(right.textContent || '', /Image source/);
  assert.doesNotMatch(right.textContent || '', /Rich text/);
  const imagePanel = right.querySelector('#inspector-panel');
  const alt = right.querySelector<HTMLInputElement>('input[placeholder="Describe the image"]')!;
  alt.focus();
  alt.value = 'Bakery counter';
  act(() => { alt.dispatchEvent(new Event('input', { bubbles: true })); });
  act(() => alt.blur());
  await settleEnhancements();
  assert.equal(image.props.alt, 'Bakery counter');
  assert.equal(right.querySelector('#inspector-panel'), imagePanel,
    'an image property repaint stays in the same mounted inspector');
  assertOneInspector();

  await draw(heading, 'content');
  assert.doesNotMatch(right.textContent || '', /Image source|Rich text/);

  section.css.m['padding-top'] = '12px';
  C.state.ui.dev = 'mobile';
  await draw(section, 'style');
  const modified = right.querySelector<HTMLInputElement>('.inspector-modified-filter input')!;
  assert.ok(modified);
  act(() => modified.click());
  assert.equal(modified.checked, true);
  const reset = right.querySelector<HTMLButtonElement>('.inspector-breakpoint-reset')!;
  assert.ok(reset);
  act(() => reset.click());
  assert.equal(section.css.m['padding-top'], undefined);

  await draw(section, 'advanced');
  assert.notEqual(right.querySelector('#inspector-panel'), reset.closest('#inspector-panel'),
    'a tab change gets a clean Preact-owned child tree');
  assert.equal(right.querySelectorAll('[role="tab"]').length, 3);
  assert.equal(right.querySelector('[role="tab"][aria-selected="true"]')?.textContent, 'Advanced');
  assert.equal(right.querySelector<HTMLInputElement>('.inspector-modified-filter input')?.checked, true,
    'changing tabs keeps the modified-settings filter through a whole-inspector remount');

  await draw(heading, 'style');
  assert.equal(right.querySelector<HTMLInputElement>('.inspector-modified-filter input')?.checked, true,
    'changing element kind also keeps the modified-settings filter');

  await draw(heading, 'content');
  assert.equal(right.querySelector<HTMLElement>('#inspector-panel')!.scrollTop, 73,
    'selection and tab scope keep their own inspector scroll position');
});

afterEach(() => {
  document.body.replaceChildren();
});
