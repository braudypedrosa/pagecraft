// @vitest-environment jsdom
import { afterEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { mount } from '../app/src/ui/index';
import { stubLegacy } from './ui.setup';

afterEach(() => { document.body.replaceChildren(); });

test('the inspector header shows an anchor the author chose, never a generated CSS id', async () => {
  /* Found on staging: the header read "#pagecraft-heading-stillwood-text-42" under the name,
     internal detail that also wrapped the header onto two lines for images. */
  document.body.innerHTML = '<div id="right"></div>';
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  const heading = C.insert('heading', null, 0)!;
  const ui = mount(C, stubLegacy([]));
  C.selSet([heading.id]);
  act(() => ui.renderRight());
  assert.equal(document.querySelector('.sHead b')?.textContent, C.kindOf(heading));
  assert.equal(document.querySelector('.sHead .tt small'), null, 'no generated id under the name');
  assert.ok(!document.querySelector('.sHead')!.textContent!.includes(C.domIdOf(heading)));

  heading.adv.htmlId = 'pricing';
  act(() => ui.renderRight());
  assert.equal(document.querySelector('.sHead .tt small')?.textContent, '#pricing', 'a chosen anchor is shown');
});
