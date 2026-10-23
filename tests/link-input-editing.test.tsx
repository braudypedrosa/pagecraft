// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { r.host.remove(); });

const control = { t: 'link' as const, k: 'link', label: 'Link' };

function externalUrlInput(node: any) {
  r.draw(() => <Ctl n={node} c={control} />, 'right');
  r.pick(r.$('[data-field-part="type"]')!, 'url');
  return r.$('input[aria-label="Custom or external URL"]') as HTMLInputElement;
}

test('sequential hash URL typing keeps focus and classifies only after blur', () => {
  const node = C.insert('button', null, 0)!;
  const input = externalUrlInput(node);
  input.focus();
  const beforeTypingEnds = r.names().filter(name => name === 'endTx').length;
  for (const char of '#qa-image-111-b') {
    input.value += char;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    assert.ok(input.isConnected, `input remains connected after ${char}`);
    assert.equal(document.activeElement, input, `focus remains in the URL input after ${char}`);
    assert.equal(input.value, '#qa-image-111-b'.slice(0, input.value.length));
  }
  assert.equal(r.names().filter(name => name === 'endTx').length, beforeTypingEnds, 'typing stays in one open transaction');
  assert.equal(node.props.link, '#qa-image-111-b');
  assert.equal((r.$('[data-field-part="type"]') as HTMLSelectElement).value, 'url');
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  assert.equal(r.names().filter(name => name === 'endTx').length, beforeTypingEnds + 1, 'blur closes one coalesced transaction');
  assert.equal((r.$('[data-field-part="type"]') as HTMLSelectElement).value, 'page');
  assert.equal((r.$('[data-field-part="anchor"]') as HTMLSelectElement).value, 'qa-image-111-b');
});

test('normal URL, email, and telephone inputs keep their shared commit path', () => {
  const node = C.insert('button', null, 0)!;
  let input = externalUrlInput(node);
  r.type(input, 'https://example.test/path');
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  assert.equal(node.props.link, 'https://example.test/path');
  assert.equal((r.$('[data-field-part="type"]') as HTMLSelectElement).value, 'url');

  r.pick(r.$('[data-field-part="type"]')!, 'email');
  input = r.$('input[aria-label="Email address"]') as HTMLInputElement;
  r.type(input, 'hello@example.test');
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  assert.equal(node.props.link, 'mailto:hello@example.test');

  r.pick(r.$('[data-field-part="type"]')!, 'phone');
  input = r.$('input[aria-label="Phone number"]') as HTMLInputElement;
  r.type(input, '+1 555 0100');
  input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  assert.equal(node.props.link, 'tel:+1 555 0100');
});


test('committing a typed anchor preserves the first click on an inspector tab', () => {
  const node = C.insert('button', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'content';
  r.host.id = 'right';
  r.draw(() => <Inspector />, 'right');
  r.pick(r.$('[data-field-part="type"]')!, 'url');
  const input = r.$('input[aria-label="Custom or external URL"]') as HTMLInputElement;
  input.focus();
  r.type(input, '#finished-anchor');
  const style = r.$$('button').find(button => button.textContent?.trim() === 'Style')!;
  style.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 19 }));
  style.focus();
  assert.ok(style.isConnected, 'blur must keep the next inspector control mounted');
  style.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 19 }));
  if (style.isConnected) style.click();
  assert.equal(C.state.ui.stab, 'style');
  assert.equal(node.props.link, '#finished-anchor');
});
