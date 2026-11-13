// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';

let r: Rig;
const background: Control = { t: 'color', c: 'background-color', label: 'Button background', r: 1 };

beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function linkedForm(colors: Array<{ id: string; name: string; value: string }>) {
  C.state.meta.tokens!.colors = colors;
  const n = C.insert('form', null, 0)!;
  n.css.d['background-color'] = C.cvar('brand');
  C.selSet([n.id]);
  r.draw(() => <Ctl n={n} c={background} />, 'right');
  return n;
}

test('a missing brand token presents its accent fallback as a linked token and unlinks to its literal', () => {
  const n = linkedForm([
    { id: 'accent', name: 'Cafe Terracotta', value: '#b55637' },
    { id: 'ink', name: 'Ink', value: '#34463b' }
  ]);

  assert.equal(r.$('.tokchip')?.textContent?.trim(), 'Cafe Terracotta');
  assert.equal(r.$('input.hex'), null, 'the linked semantic should not leak as a raw CSS value');
  assert.ok(r.$('button.tok.on[title="Cafe Terracotta"]'), 'the fallback token should be selected in the palette');
  assert.equal(n.css.d['background-color'], C.cvar('brand'), 'presentation must preserve the stored semantic reference');

  act(() => r.click(r.$('button[title^="Unlink"]')));

  assert.equal(n.css.d['background-color'], '#b55637');
  assert.ok(r.names().includes('save'), 'unlinking should commit the resolved literal');
});

test('a real brand token remains authoritative when accent also exists', () => {
  const n = linkedForm([
    { id: 'brand', name: 'Cafe Brand', value: '#123456' },
    { id: 'accent', name: 'Cafe Accent', value: '#b55637' }
  ]);

  assert.equal(r.$('.tokchip')?.textContent?.trim(), 'Cafe Brand');
  assert.ok(r.$('button.tok.on[title="Cafe Brand"]'));
  assert.equal(r.$('button.tok.on[title="Cafe Accent"]'), null);
  assert.equal(n.css.d['background-color'], C.cvar('brand'));
});
