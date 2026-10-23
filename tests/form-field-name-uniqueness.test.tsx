// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { install } from '../app/src/ui/ctx';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, stubLegacy, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function installHistory(onRepaint?: () => void) {
  let transaction = '';
  const legacy = stubLegacy(r.calls);
  install(C, {
    ...legacy,
    tx(key: string) {
      r.calls.push(['tx', key]);
      if (transaction === key) return;
      transaction = key;
      C.checkpoint();
    },
    endTx() {
      r.calls.push(['endTx']);
      transaction = '';
    },
    repaint() {
      r.calls.push(['repaint']);
      onRepaint?.();
    }
  });
}

function formFixture(onRepaint?: () => void) {
  const form = C.insert('form', null, 0)!;
  form.props.fields = [
    { type: 'text', label: 'Name', name: 'name', ph: 'Your name', required: 1 },
    { type: 'email', label: 'Email', name: 'email', ph: 'you@example.com', required: 1 },
    { type: 'tel', label: 'Phone', name: 'qa-phone', ph: 'Mobile', required: 0 },
    { type: 'textarea', label: 'Message', name: 'email-2', ph: 'How can we help?', required: 0 }
  ];
  C.selSet([form.id]);
  C.state.ui.stab = 'content';
  r.host.id = 'right';
  installHistory(onRepaint);
  r.draw(() => <Inspector />, 'right');
  return form;
}

function openField(index: number) {
  let row = r.$$('.repeater-row')[index];
  if (!row.classList.contains('on')) act(() => r.click(r.$$('.repeater-toggle')[index]));
  row = r.$$('.repeater-row')[index];
  const settings = [...row.querySelectorAll('button')].find(button => button.textContent === 'Advanced');
  if (settings?.getAttribute('aria-pressed') !== 'true') act(() => r.click(settings!));
  row = r.$$('.repeater-row')[index];
  return row.querySelector('input.ctl') as HTMLInputElement;
}

function savedFields(doc: ReturnType<typeof C.doc>, id: string) {
  const visit = (items: any[]): any => {
    for (const item of items) {
      if (item.id === id) return item;
      const found = visit(item.children || []);
      if (found) return found;
    }
  };
  return visit(doc.pages[0].tree).props.fields as Array<Record<string, any>>;
}

test('manual duplicate field names repair on blur and the first Style click still lands', () => {
  const form = formFixture();
  const fields = form.props.fields as Array<Record<string, any>>;
  const before = structuredClone(fields);
  const input = openField(2);
  const style = r.$('#inspector-tab-style') as HTMLButtonElement;

  input.focus();
  r.type(input, 'email');
  act(() => {
    style.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 14 }));
    input.dispatchEvent(new FocusEvent('blur', { bubbles: true, relatedTarget: style }));
    style.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 14 }));
    style.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  expect(fields[2]).toEqual({ ...before[2], name: 'email-3' });
  expect(C.state.ui.stab).toBe('style');
  expect([...C.renderNode(form, { edit: false }).matchAll(/\bname="([^"]+)"/g)].map(match => match[1]))
    .toEqual(['name', 'email', 'email-3', 'email-2']);
  expect(C.hist.u).toHaveLength(1);
  C.undo();
  expect((C.locate(form.id)!.node.props.fields as Array<Record<string, any>>)).toEqual(before);
});

test('Tab commits a duplicate, while unique raw and blank fallback names stay authored', () => {
  const form = formFixture();
  const fields = form.props.fields as Array<Record<string, any>>;
  let input = openField(2);
  input.focus();
  r.type(input, 'email');
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  act(() => (r.$('#inspector-tab-style') as HTMLButtonElement).focus());
  expect(fields[2].name).toBe('email-3');

  C.state.ui.stab = 'content';
  r.draw(() => <Inspector />, 'right');
  input = openField(2);
  input.focus();
  r.type(input, '  customer_phone  ');
  const repaintsAfterUniqueInput = r.names().filter(name => name === 'repaint').length;
  act(() => input.blur());
  expect(fields[2].name).toBe('  customer_phone  ');
  expect(r.names().filter(name => name === 'repaint')).toHaveLength(repaintsAfterUniqueInput);

  C.state.ui.stab = 'content';
  r.draw(() => <Inspector />, 'right');
  input = openField(2);
  input.focus();
  r.type(input, '');
  act(() => input.blur());
  expect(fields[2].name).toBe('');

  fields[3].name = 'message';
  C.state.ui.stab = 'style';
  r.draw(() => <Inspector />, 'right');
  C.state.ui.stab = 'content';
  r.draw(() => <Inspector />, 'right');
  input = openField(2);
  input.focus();
  r.type(input, 'email-2');
  act(() => input.blur());
  expect(fields[2].name).toBe('email-2');
});

test('a colliding cleared fallback repairs once and survives UI type and reorder actions', () => {
  const form = formFixture();
  const fields = form.props.fields as Array<Record<string, any>>;
  fields[2].label = 'Email';
  let input = openField(2);
  input.focus();
  r.type(input, '');
  act(() => input.blur());
  expect(fields[2].name).toBe('email-3');

  const row = r.$$('.repeater-row')[2];
  act(() => r.click([...row.querySelectorAll('button')].find(button => button.textContent === 'Content')!));
  r.pick(row.querySelector('select[aria-label="Field type"]')!, 'number');
  expect(fields[2].type).toBe('number');
  expect(fields[2].name).toBe('email-3');
  expect(fields[2].ph).toBe('Mobile');
  expect(fields[2].required).toBe(0);

  act(() => r.click(row.querySelector('button[title="Move up"]')));
  expect(fields[1].name).toBe('email-3');
  expect(fields[1].type).toBe('number');
  expect(fields[1].ph).toBe('Mobile');
});

test('focus and blur without typing do not repair legacy duplicates or add history', () => {
  const form = formFixture();
  const fields = form.props.fields as Array<Record<string, any>>;
  fields[2].name = 'email';
  const input = openField(2);
  const repaintCount = r.names().filter(name => name === 'repaint').length;
  act(() => { input.focus(); input.blur(); });
  expect(fields[2].name).toBe('email');
  expect(r.names().filter(name => name === 'repaint')).toHaveLength(repaintCount);
  expect(C.hist.u).toHaveLength(0);
});

test('a duplicate typed long enough to autosave is persisted again after blur repair', () => {
  let persisted: ReturnType<typeof C.doc> | null = null;
  const form = formFixture(() => { persisted = structuredClone(C.doc()); });
  const input = openField(2);

  input.focus();
  r.type(input, 'email');
  expect(savedFields(persisted!, form.id)[2].name).toBe('email');
  const repaintsAfterInput = r.names().filter(name => name === 'repaint').length;

  act(() => input.blur());
  expect(r.names().filter(name => name === 'repaint')).toHaveLength(repaintsAfterInput + 1);
  expect(savedFields(persisted!, form.id)[2].name).toBe('email-3');

  C.restore(structuredClone(persisted!));
  const restored = C.locate(form.id)!.node.props.fields as Array<Record<string, any>>;
  expect(restored.map((field, index) => C.formFieldName(field, index)))
    .toEqual(['name', 'email', 'email-3', 'email-2']);
});
