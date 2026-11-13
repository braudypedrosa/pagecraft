import assert from 'node:assert/strict';
import { test } from 'vitest';
import { cleanRichHtml } from '../server/src/safe-html';

test('rich sanitizer discards deeply nested iframe fallback without recursion failure', () => {
  const depth = 2000;
  const input = '<iframe>'.repeat(depth) + 'safe fallback' + '</iframe>'.repeat(depth);

  let output = '';
  assert.doesNotThrow(() => {
    output = cleanRichHtml(input);
  });
  assert.match(output, /safe fallback/);
  assert.doesNotMatch(output, /<iframe\b/i);
});

test('rich sanitizer retains the existing iframe discard contract for ordinary input', () => {
  const output = cleanRichHtml('<p>Before</p><iframe src="https://unsafe.example">fallback</iframe><p>After</p>');

  assert.equal(output, '<p>Before</p>fallback<p>After</p>');
  assert.doesNotMatch(output, /<iframe\b|\bsrc=/i);
});
