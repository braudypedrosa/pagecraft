/** @vitest-environment jsdom */
import { test, beforeEach, afterEach } from 'vitest';
import a from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { PropKind, FieldType } from '../app/src/core/types';
let r: Rig;
beforeEach(() => { r = rig(); C.state.meta.collections = []; C.state.meta.components = []; });
afterEach(() => r.host.remove());

function fixture(kind: PropKind = 'text', type: FieldType = 'text') {
  const col = C.collectionAdd('Cabins')!;
  const field = C.fieldAdd(col.id, 'CMS value', type)!;
  const item = C.itemAdd(col.id)!; C.itemSet(col.id, item.id, field.id, 'Pine cabin');
  const h = C.insert('heading', null, 0)!;
  const cid = C.componentFromNode(h.id, 'Card')!;
  const key = C.propAdd(cid, 'Card value', kind, 'Saved value')!;
  const node = C.locate(h.id)!.node;
  C.srcSet(C.state.pages[0].tree[0], col.id);
  const control = C.instControls(node)[0];
  return { col, field, item, node, key, control };
}

test('component field connects and disconnects through the keyboard-accessible CMS picker', async () => {
  const { node, field, control, key } = fixture();
  L.askPick = async (_title, choices) => { a.ok(choices.some(x => x[0] === field.id)); return field.id; };
  const draw = () => r.draw(<Ctl n={node} c={control} />);
  draw();
  await act(async () => { r.$('.bnd')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  draw();
  a.equal(C.boundField(node, C.VAL + key), field.id);
  a.equal((r.$('input') as HTMLInputElement).value, 'Pine cabin');
  a.equal((r.$('input') as HTMLInputElement).disabled, true);
  a.match(r.$('.note')!.textContent!, /CMS value.*Cabins/);
  L.askPick = async () => '';
  await act(async () => r.click(r.$('.bnd'))); draw();
  a.equal(C.boundField(node, C.VAL + key), '');
  a.equal((r.$('input') as HTMLInputElement).value, 'Saved value');
  a.equal((r.$('input') as HTMLInputElement).disabled, false);
});

for (const [kind, type] of [['text','text'], ['rich','rich'], ['img','image'], ['link','link'], ['color','text'], ['select','option'], ['bool','bool'], ['icon','text']] as [PropKind, FieldType][]) {
  test(`${kind} component fields only offer compatible CMS types and become read-only when bound`, async () => {
    const { col, node, field, control } = fixture(kind, type);
    const incompatible = C.fieldAdd(col.id, 'Wrong type', type === 'image' ? 'number' : 'image')!;
    L.askPick = async (_title, choices) => {
      a.ok(choices.some(x => x[0] === field.id));
      a.ok(!choices.some(x => x[0] === incompatible.id));
      return field.id;
    };
    r.draw(<Ctl n={node} c={control} />);
    await act(async () => r.click(r.$('.bnd')));
    r.draw(<Ctl n={node} c={control} />);
    a.equal((r.$('input') as HTMLInputElement).disabled, true);
    a.equal(r.$$('button').length, 0, 'no upload, link editor or token picker can overwrite a bound field');
  });
}

test('a disconnected source keeps a recovery action and does not erase the saved fallback', async () => {
  const { node, field, control } = fixture();
  C.bindSet(node, control.k!, C.bindField(field.id));
  C.srcSet(C.state.pages[0].tree[0], '');
  r.draw(<Ctl n={node} c={control} />);
  a.match(r.$('.note')!.textContent!, /missing/);
  a.equal((r.$('input') as HTMLInputElement).value, 'Saved value');
  await act(async () => r.click(r.$('.bnd')));
  a.equal(C.boundField(node, control.k!), '');
});

test('manual component link editing writes the exposed value and restores after disconnecting', () => {
  const { node, control, key, field } = fixture('link', 'link');
  C.instSet(node, key, 'https://example.com/original');
  r.draw(<Ctl n={node} c={control} />);
  r.type(r.$('input')!, 'https://example.com/new');
  a.equal(node.vals![key], 'https://example.com/new');
  a.equal((node.props as any)[control.k!], undefined);
  C.bindSet(node, control.k!, C.bindField(field.id));
  C.bindSet(node, control.k!, null);
  a.equal(C.propVal(node, control.k!), 'https://example.com/new');
});

test('content-only accounts cannot change the CMS mapping', () => {
  const { node, control } = fixture();
  L.canStructure = () => false;
  r.draw(<Ctl n={node} c={control} />);
  a.equal(r.$('.bnd'), null);
});
