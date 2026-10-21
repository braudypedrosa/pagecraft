// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function motion() {
  const node = C.insert('accordion', null, 0)!;
  C.selSet([node.id]);
  C.state.ui.dev = 'desktop';
  C.state.ui.stab = 'style';
  r.draw(() => <Inspector />, 'right');
  const animation = r.$('select[aria-label="Animation"]') as HTMLSelectElement;
  act(() => r.pick(animation, 'fade-up'));
  return { node, duration: r.$('input[aria-label="Duration"]') as HTMLInputElement };
}

test('Motion timing fields keep invalid drafts out of the document and expose linked errors', () => {
  const { node, duration } = motion();
  duration.focus();
  act(() => r.type(duration, 'banana'));
  assert.equal(node.anim?.dur, undefined);
  assert.equal(duration.value, 'banana');
  assert.equal(duration.getAttribute('aria-invalid'), null, 'typing alone stays quiet');

  act(() => duration.blur());
  assert.equal(node.anim?.dur, undefined);
  assert.equal(duration.getAttribute('aria-invalid'), 'true');
  const errorId = duration.getAttribute('aria-describedby');
  assert.ok(errorId);
  assert.equal(r.$(`#${errorId}`)?.getAttribute('role'), 'alert');
  assert.match(r.host.textContent || '', /Enter a duration such as 0\.6s/i);
});

test('Motion accepts CSS time units, negative delay, easing, and clears to inherit', () => {
  const { node, duration } = motion();
  const delay = r.$('input[aria-label="Delay"]') as HTMLInputElement;
  const easing = r.$('input[aria-label="Easing"]') as HTMLInputElement;

  act(() => r.type(duration, '400ms'));
  act(() => r.type(delay, '-0.1s'));
  act(() => r.type(easing, 'ease-in-out'));
  assert.deepEqual(node.anim, { name: 'fade-up', dur: '400ms', delay: '-0.1s', ease: 'ease-in-out' });

  act(() => r.type(duration, ''));
  assert.equal(node.anim?.dur, undefined);
});

test('Motion rejects negative duration and invalid easing on Enter or blur', () => {
  const { node, duration } = motion();
  const easing = r.$('input[aria-label="Easing"]') as HTMLInputElement;
  duration.focus();
  act(() => r.type(duration, '-1s'));
  assert.equal(node.anim?.dur, undefined);
  act(() => { duration.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  assert.equal(duration.getAttribute('aria-invalid'), 'true');

  easing.focus();
  act(() => r.type(easing, 'banana'));
  assert.equal(node.anim?.ease, undefined);
  act(() => easing.blur());
  assert.equal(easing.getAttribute('aria-invalid'), 'true');
  assert.match(r.host.textContent || '', /Enter a CSS easing such as ease-in-out/i);
});

test('Motion keeps valid modern easing functions and rejects cubic-bezier x values outside 0..1', () => {
  const { node } = motion();
  const easing = r.$('input[aria-label="Easing"]') as HTMLInputElement;
  act(() => r.type(easing, 'steps(2, jump-none)'));
  assert.equal(node.anim?.ease, 'steps(2, jump-none)');
  act(() => r.type(easing, 'linear(0, 0.5 50%, 1)'));
  assert.equal(node.anim?.ease, 'linear(0, 0.5 50%, 1)');
  act(() => r.type(easing, 'cubic-bezier(2, 0, 2, 1)'));
  assert.equal(node.anim?.ease, 'linear(0, 0.5 50%, 1)');
});

test('Motion drafts are isolated by selected node and character typing commits as one undoable edit', () => {
  const first = motion().node;
  const duration = r.$('input[aria-label="Duration"]') as HTMLInputElement;
  duration.focus();
  for (const char of '0.8s') act(() => {
    duration.value += char;
    duration.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => duration.blur());
  assert.equal(first.anim?.dur, '0.8s');
  assert.ok(r.calls.some(([name, key]) => name === 'tx' && key === `${first.id}|motion|dur`));
  assert.ok(r.calls.some(([name]) => name === 'endTx'), 'blur closes the coalesced undo transaction');

  const second = C.insert('accordion', null, 1)!;
  C.selSet([second.id]);
  act(() => r.draw(() => <Inspector />, 'right'));
  act(() => r.pick(r.$('select[aria-label="Animation"]')!, 'fade-up'));
  assert.equal((r.$('input[aria-label="Duration"]') as HTMLInputElement).value, '');
});
