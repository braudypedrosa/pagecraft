// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';
import type { Control, FieldType, Node as PcNode, PropBag } from '../app/src/core/types';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function rootOf(node: PcNode): PcNode {
  let handle = C.locate(node.id)!;
  while (handle.parent) handle = C.locate(handle.parent.id)!;
  return handle.node;
}

function bind(node: PcNode, control: Control, fieldType: FieldType, value: string) {
  const collection = C.collectionAdd('Bound control values')!;
  const field = C.fieldAdd(collection.id, control.label || control.k || 'Value', fieldType)!;
  const item = C.itemAdd(collection.id)!;
  C.itemSet(collection.id, item.id, field.id, value);
  C.srcSet(rootOf(node), collection.id);
  C.bindSet(node, control.k!, C.bindField(field.id));
}

type Case = {
  name: string;
  type: 'heading' | 'image' | 'icon' | 'quote' | 'section';
  control(): Control;
  fieldType: FieldType;
  boundValue: string;
  fallback: string | number;
  leaf(): HTMLInputElement | HTMLSelectElement | HTMLButtonElement;
  visibleValue(leaf: HTMLElement): string;
  attempt(leaf: HTMLElement): void;
  changedValue: string | number;
};

const cases: Case[] = [
  {
    name: 'text', type: 'quote',
    control: () => C.DEF.quote.controls.content.find(control => control.k === 'by')!,
    fieldType: 'text', boundValue: 'CMS attribution', fallback: 'Local attribution',
    leaf: () => r.$('input.ctl') as HTMLInputElement,
    visibleValue: leaf => (leaf as HTMLInputElement).value,
    attempt: leaf => { (leaf as HTMLInputElement).value = 'Attempted attribution'; leaf.dispatchEvent(new Event('input', { bubbles: true })); },
    changedValue: 'Changed attribution',
  },
  {
    name: 'select', type: 'heading',
    control: () => C.DEF.heading.controls.content.find(control => control.k === 'level')!,
    fieldType: 'text', boundValue: 'h3', fallback: 'h2',
    leaf: () => r.$('select.ctl') as HTMLSelectElement,
    visibleValue: leaf => (leaf as HTMLSelectElement).value,
    attempt: leaf => { (leaf as HTMLSelectElement).value = 'h4'; leaf.dispatchEvent(new Event('change', { bubbles: true })); },
    changedValue: 'h5',
  },
  {
    name: 'pick', type: 'section',
    control: () => C.DEF.section.controls.content.find(control => control.k === 'width')!,
    fieldType: 'text', boundValue: 'full', fallback: 'boxed',
    leaf: () => r.$$('.pick button').find(button => button.textContent === 'Full width') as HTMLButtonElement,
    visibleValue: leaf => leaf.getAttribute('aria-pressed') || '',
    attempt: leaf => (leaf as HTMLButtonElement).click(),
    changedValue: 'full',
  },
  {
    name: 'toggle', type: 'image',
    control: () => C.DEF.image.controls.content.find(control => control.k === 'decorative')!,
    fieldType: 'bool', boundValue: '1', fallback: 0,
    leaf: () => r.$('.sw-tog') as HTMLButtonElement,
    visibleValue: leaf => leaf.getAttribute('aria-checked') || '',
    attempt: leaf => (leaf as HTMLButtonElement).click(),
    changedValue: 1,
  },
  {
    name: 'icon', type: 'icon',
    control: () => C.DEF.icon.controls.content.find(control => control.k === 'name')!,
    fieldType: 'text', boundValue: 'star', fallback: 'check',
    leaf: () => r.$('.iconpick button[title="star"]') as HTMLButtonElement,
    visibleValue: leaf => leaf.classList.contains('on') ? 'star' : '',
    attempt: leaf => (leaf as HTMLButtonElement).click(),
    changedValue: 'star',
  },
];

for (const specimen of cases) {
  test(`CMS-bound ${specimen.name} shows the bound value, stays inert, and preserves its fallback`, () => {
    const node = C.insert(specimen.type, null, 0)!;
    const control = specimen.control();
    const props = node.props as PropBag;
    props[control.k!] = specimen.fallback;
    bind(node, control, specimen.fieldType, specimen.boundValue);

    r.draw(<Ctl n={node} c={control} />);
    const boundLeaf = specimen.leaf();
    a.equal(boundLeaf.disabled, true, 'a bound control cannot imply that its local fallback is editable');
    a.equal(specimen.visibleValue(boundLeaf), specimen.name === 'pick' ? 'true'
      : specimen.name === 'toggle' ? 'true' : specimen.boundValue,
    'the control shows the value used by the canvas');
    boundLeaf.click();
    boundLeaf.focus();
    a.notEqual(document.activeElement, boundLeaf, 'a bound control cannot receive user focus');
    a.equal(props[control.k!], specimen.fallback, 'an attempted bound edit does not mutate the hidden fallback');

    C.bindSet(node, control.k!, null);
    r.draw(<Ctl n={node} c={control} />);
    const unboundLeaf = specimen.leaf();
    a.equal(unboundLeaf.disabled, false, 'unbinding restores the incumbent editable control');

    if (specimen.name === 'text') r.type(unboundLeaf, String(specimen.changedValue));
    else if (specimen.name === 'select') r.pick(unboundLeaf, String(specimen.changedValue));
    else specimen.attempt(unboundLeaf);
    a.equal(props[control.k!], specimen.changedValue, 'the unbound control still writes normally');
  });
}
