// @vitest-environment jsdom
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import type { Node } from '../app/src/core/types';
import { rig } from './ui.setup';

const openMotion = (r: ReturnType<typeof rig>, node: Node) => {
  C.selSet([node.id]);
  C.state.ui.dev = 'desktop';
  C.state.ui.stab = 'style';
  r.draw(() => <Inspector />, 'right');
  return r.$('select[aria-label="Animation"]') as HTMLSelectElement;
};

const findSerializedNode = (value: any, id: string): any => {
  if (!value || typeof value !== 'object') return null;
  if (value.id === id && value.type) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSerializedNode(item, id);
      if (found) return found;
    }
    return null;
  }
  for (const item of Object.values(value)) {
    const found = findSerializedNode(item, id);
    if (found) return found;
  }
  return null;
};

test('new entrance animations exclude fade out', () => {
  const r = rig();
  try {
    const node = C.insert('heading', null, 0)!;
    const choice = openMotion(r, node);
    const names = [...choice.options].map(option => option.value).filter(Boolean);
    assert.equal(names.length, 26);
    assert.deepEqual(names, C.ANIM_NAMES.filter(name => name !== 'fade-out'));
    assert.ok(!names.includes('fade-out'));
  } finally {
    act(() => r.draw(null));
    r.host.remove();
  }
});

test('an existing fade out remains readable and serializable until another animation is chosen', () => {
  const r = rig();
  try {
    const node = C.insert('heading', null, 0)!;
    node.anim = { name: 'fade-out', dur: '1.2s', once: 1 };
    const serialized = JSON.parse(JSON.stringify(C.doc()));
    assert.deepEqual(findSerializedNode(serialized, node.id)?.anim, node.anim);

    const choice = openMotion(r, node);
    const legacy = [...choice.options].find(option => option.value === 'fade-out');
    assert.equal(choice.value, 'fade-out');
    assert.equal(legacy?.textContent, 'Fade out (existing)');

    act(() => r.pick(choice, 'fade-up'));
    const rerendered = r.$('select[aria-label="Animation"]') as HTMLSelectElement;
    assert.equal(node.anim?.name, 'fade-up');
    assert.ok(![...rerendered.options].some(option => option.value === 'fade-out'));
  } finally {
    act(() => r.draw(null));
    r.host.remove();
  }
});

test('preset animations describe an omitted duration as the preset default', () => {
  const r = rig();
  try {
    const node = C.insert('heading', null, 0)!;
    openMotion(r, node);
    for (const name of ['bounce', 'spin']) {
      act(() => r.pick(r.$('select[aria-label="Animation"]')!, name));
      const duration = r.$('input[aria-label="Duration"]') as HTMLInputElement;
      assert.equal(node.anim?.name, name);
      assert.equal(duration.value, '');
      assert.equal(duration.placeholder, 'Preset default');
    }
  } finally {
    act(() => r.draw(null));
    r.host.remove();
  }
});
