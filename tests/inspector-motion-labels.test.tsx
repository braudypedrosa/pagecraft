// @vitest-environment jsdom
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig } from './ui.setup';

test('motion choices and timing fields have names matching their visible labels', () => {
  const r = rig();
  try {
    const node = C.insert('heading', null, 0)!;
    C.selSet([node.id]);
    C.state.ui.dev = 'desktop';
    C.state.ui.stab = 'style';
    r.draw(() => <Inspector />, 'right');
    const choice = r.$('select[aria-label="Animation"]') as HTMLSelectElement;
    assert.ok(choice);
    assert.equal(choice.options.length, C.ANIM_NAMES.filter(name => name !== 'fade-out').length + 1);
    act(() => {
      choice.value = 'fade-up';
      choice.dispatchEvent(new Event('change', { bubbles: true }));
    });
    for (const label of ['Duration', 'Delay', 'Easing']) {
      const input = r.$(`input[aria-label="${label}"]`);
      assert.ok(input, `${label} is discoverable without guessing its placeholder`);
      assert.ok(input.closest('.f')?.querySelector('label')?.textContent?.includes(label));
    }
    assert.equal(node.anim?.name, 'fade-up');
  } finally {
    act(() => r.draw(null));
    r.host.remove();
  }
});
