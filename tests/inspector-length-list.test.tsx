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

function inspect(type: 'code' | 'table', device: 'desktop' | 'tablet' | 'mobile' = 'desktop') {
  const node = C.insert(type, null, 0)!;
  C.selSet([node.id]);
  C.state.ui.stab = 'style';
  C.state.ui.dev = device;
  r.draw(() => <Inspector />, 'right');
  const field = r.$$('.f').find(item => item.querySelector('label span')?.textContent?.trim() === (type === 'code' ? 'Padding' : 'Cell padding'));
  assert.ok(field);
  return { node, field, input: field.querySelector('input') as HTMLInputElement };
}

function fieldFor(label: string) {
  const field = r.$$('.f').find(item => item.querySelector('label span')?.textContent?.trim() === label);
  assert.ok(field);
  return field;
}

test('Code and Table padding fields show complete desktop and mobile shorthands', () => {
  for (const type of ['code', 'table'] as const) {
    const desktop = inspect(type);
    assert.equal(desktop.input.type, 'text');
    assert.equal(desktop.input.value, type === 'code' ? '16px 18px' : '10px 12px');
    act(() => { r.draw(null); });
    const mobile = inspect(type, 'mobile');
    assert.equal(mobile.input.value, type === 'code' ? '12px 13px' : '8px 10px');
  }
});

test('Code and Table accept exact one, two, three, and four-token shorthands', () => {
  for (const type of ['code', 'table'] as const) {
    const { node, input } = inspect(type);
    for (const value of ['2rem', '1px 2rem', '1px 2rem 3%', '1px 2rem 3% 4px']) {
      act(() => {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
      });
      assert.equal(node.css.d[type === 'code' ? '--cd-pad' : '--tbl-pad'], value);
    }
  }
});

test('invalid, malformed, negative, and overlong drafts stay unsaved with plain error text', () => {
  for (const value of ['-1px 2px', '12px nope', '1px 2px 3px 4px 5px']) {
    const { node, input } = inspect('table');
    const saved = node.css.d['--tbl-pad'];
    act(() => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => { input.dispatchEvent(new Event('blur', { bubbles: true })); });
    assert.equal(node.css.d['--tbl-pad'], saved);
    const currentInput = fieldFor('Cell padding').querySelector('input') as HTMLInputElement;
    assert.equal(currentInput.value, value);
    assert.equal(currentInput.getAttribute('aria-invalid'), 'true');
    assert.match(fieldFor('Cell padding').textContent || '', /Enter up to four sizes, such as 8px 12px/);
  }
});

test('validation waits for blur or Enter and links the error to the input', () => {
  const { node, field, input } = inspect('code');
  const saved = node.css.d['--cd-pad'];
  input.value = '12';
  act(() => { input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.equal(input.getAttribute('aria-invalid'), null);
  assert.equal(field.querySelector('[role="alert"]'), null);
  assert.equal(node.css.d['--cd-pad'], saved);

  act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  const invalidInput = fieldFor('Padding').querySelector('input') as HTMLInputElement;
  assert.equal(invalidInput.getAttribute('aria-invalid'), 'true');
  const describedBy = invalidInput.getAttribute('aria-describedby')?.split(/\s+/) || [];
  assert.ok(describedBy.some(id => document.getElementById(id)?.textContent?.includes('Enter up to four sizes')));

  input.value = '12px';
  act(() => { input.dispatchEvent(new Event('input', { bubbles: true })); });
  const correctedInput = fieldFor('Padding').querySelector('input') as HTMLInputElement;
  assert.equal(correctedInput.getAttribute('aria-invalid'), null);
  assert.equal(fieldFor('Padding').querySelector('[role="alert"]'), null);
  assert.equal(node.css.d['--cd-pad'], '12px');
});

test('unitless zero is accepted while nonzero unitless input is rejected', () => {
  const { node, input } = inspect('code');
  for (const value of ['0', '.0', '0.0']) {
    act(() => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    assert.equal(node.css.d['--cd-pad'], value);
  }
  const saved = node.css.d['--cd-pad'];
  act(() => {
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { input.dispatchEvent(new Event('blur', { bubbles: true })); });
  assert.equal(node.css.d['--cd-pad'], saved);
  assert.equal((fieldFor('Padding').querySelector('input') as HTMLInputElement).getAttribute('aria-invalid'), 'true');
});

test('tablet and mobile resets clear only their shorthand and fall back to desktop', () => {
  for (const device of ['tablet', 'mobile'] as const) {
    const current = inspect('table', device);
    assert.ok(current.input.value);
    act(() => {
      current.input.value = '7px 8px';
      current.input.dispatchEvent(new Event('input', { bubbles: true }));
      current.input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    const reset = fieldFor('Cell padding').querySelector('button.rsp.ovr') as HTMLButtonElement;
    assert.ok(reset);
    act(() => r.click(reset));
    assert.equal(current.node.css[device === 'tablet' ? 't' : 'm']['--tbl-pad'], undefined);
    assert.equal(C.cssVal(current.node, '--tbl-pad', true).v, '10px 12px');
  }
});

test('ordinary UnitCtl remains a numeric input', () => {
  inspect('code');
  const textSize = fieldFor('Text size');
  const input = textSize.querySelector('input') as HTMLInputElement;
  assert.equal(input.type, 'number');
});
