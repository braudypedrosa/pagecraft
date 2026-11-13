import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../builder.html', import.meta.url), 'utf8');
const start = source.indexOf('function syncProjectSettingsCodeFields() {');
const end = source.indexOf('\n}\n\nfunction projectModal()', start);
if (start < 0 || end < 0) throw new Error('project settings live-field helper is missing');
const helperSource = source.slice(start, end + 2);

function harness() {
  const dom = new JSDOM('<textarea id="mCss"></textarea><textarea id="mHeadHtml"></textarea>', {
    pretendToBeVisual: true,
  });
  const state = { meta: { css: '', headHtml: '' } };
  const $ = selector => dom.window.document.querySelector(selector);
  const sync = Function('state', 'document', '$', `${helperSource}; return syncProjectSettingsCodeFields;`)(
    state, dom.window.document, $,
  );
  return { dom, state, sync };
}

test('reopening Custom code reads CSS rewritten by a resource deletion', () => {
  const { dom, state, sync } = harness();
  const css = dom.window.document.querySelector('#mCss');
  css.value = 'body{color:var(--c-deleted)}';
  state.meta.css = 'body{color:#106b50}';

  sync();

  assert.equal(css.value, 'body{color:#106b50}');
  assert.match(source, /if \(id === 'code'\) syncProjectSettingsCodeFields\(\);/,
    'the Custom code section must refresh before it is shown');
});

test('live settings refresh never overwrites the focused code transaction', () => {
  const { dom, state, sync } = harness();
  const css = dom.window.document.querySelector('#mCss');
  css.value = 'body{color:blue}';
  css.focus();
  state.meta.css = 'body{color:#106b50}';

  sync();
  assert.equal(css.value, 'body{color:blue}', 'focused authoring remains untouched');

  css.blur();
  sync();
  assert.equal(css.value, 'body{color:#106b50}', 'the next activation reads the live project value');
});
