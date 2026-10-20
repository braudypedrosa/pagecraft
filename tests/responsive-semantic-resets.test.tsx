// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { TextStyles } from '../app/src/ui/TextStyles';
import { installCustomSelects } from '../shared/custom-select.js';
import type { Control, Node as PcNode } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const commonControl = (property: string) => C.COMMON_STYLE
  .flatMap(group => group.items).find(control => control.c === property)!;
const moduleControl = (type: string, property: string) => [...C.DEF[type].controls.content, ...C.DEF[type].controls.style]
  .find(control => control.c === property)!;

function place(node: PcNode, inColumn = false) {
  C.state.pages[0].tree = inColumn
    ? [C.N('section', {}, {}, [C.N('row', {}, {}, [C.N('column', {}, {}, [node])])])]
    : [node];
  C.selSet([node.id]);
}

function restoredNode(id: string) {
  const saved = C.clone(C.doc());
  let found: PcNode | null = null;
  C.eachNode(saved.pages[0].tree, node => { if (node.id === id) found = node; });
  return found!;
}

const cases: Array<{
  name: string;
  node: () => PcNode;
  control: () => Control;
  property: string;
  desktop: string;
  reset: string;
  conditional?: boolean;
}> = [
  {
    name: 'Shadow', node: () => C.N('section'), control: () => commonControl('box-shadow'),
    property: 'box-shadow', desktop: '0 8px 20px -8px rgba(17,19,17,.18)', reset: 'none'
  },
  {
    name: 'Filter', node: () => C.N('image'), control: () => moduleControl('image', 'filter'),
    property: 'filter', desktop: 'grayscale(1)', reset: 'none'
  },
  {
    name: 'Position', node: () => C.N('button'), control: () => moduleControl('button', 'margin-top'),
    property: 'margin-top', desktop: 'auto', reset: '0', conditional: true
  }
];

test.each(cases)('$name has a matched Default and an explicit responsive reset', item => {
  const fresh = item.node();
  place(fresh, item.conditional);
  const control = item.control();
  expect(!control.when || control.when(fresh)).toBe(true);
  C.state.ui.dev = 'desktop';
  r.draw(() => <Ctl n={fresh} c={control} />, 'right');
  const freshSelect = r.$(`select[aria-label="${item.name}"]`) as HTMLSelectElement;
  expect(freshSelect.value).toBe('');
  expect(freshSelect.selectedOptions[0]?.textContent).toBe('Default');

  fresh.css.d[item.property] = item.desktop;
  C.state.ui.dev = 'tablet';
  r.draw(() => <Ctl n={fresh} c={control} />, 'right');
  act(() => r.pick(r.$(`select[aria-label="${item.name}"]`)!, item.reset));
  expect(fresh.css.t[item.property]).toBe(item.reset);
  expect(C.cssVal(fresh, item.property, true)).toEqual({ v: item.reset, own: true });

  C.state.ui.dev = 'mobile';
  r.draw(() => <Ctl n={fresh} c={control} />, 'right');
  act(() => r.pick(r.$(`select[aria-label="${item.name}"]`)!, item.reset));
  expect(fresh.css.m[item.property]).toBe(item.reset);
  expect(C.cssVal(fresh, item.property, true)).toEqual({ v: item.reset, own: true });
  if (control.t === 'opt') expect(r.$('.f > input.ctl')).toBeNull();

  const restored = restoredNode(fresh.id);
  expect(restored.css.t[item.property]).toBe(item.reset);
  expect(restored.css.m[item.property]).toBe(item.reset);
  const buckets = { d: '', t: '', m: '' };
  C.nodeCss(restored, false, buckets);
  expect(buckets.t).toContain(`${item.property}:${item.reset};`);
  expect(buckets.m).toContain(`${item.property}:${item.reset};`);

  act(() => r.click(r.$(`button[aria-label="Clear Mobile override for ${item.name}"]`)));
  expect(fresh.css.m[item.property]).toBeUndefined();
  expect(C.cssVal(fresh, item.property, true)).toEqual({ v: item.reset, own: false });

  C.state.ui.dev = 'tablet';
  r.draw(() => <Ctl n={fresh} c={control} />, 'right');
  act(() => r.click(r.$(`button[aria-label="Clear Tablet override for ${item.name}"]`)));
  expect(fresh.css.t[item.property]).toBeUndefined();
  expect(C.cssVal(fresh, item.property, true)).toEqual({ v: item.desktop, own: false });
});

test.each(['heading', 'button', 'nav'] as const)(
  '%s Transform reads Default when unset and returns to it after a Desktop reset',
  type => {
    const node = C.N(type);
    place(node);
    const control = moduleControl(type, 'text-transform');
    C.state.ui.dev = 'desktop';
    r.draw(() => <Ctl n={node} c={control} />, 'right');
    const transform = () => r.$('select[aria-label="Transform"]') as HTMLSelectElement;
    expect(transform().value).toBe('');
    expect(transform().selectedOptions[0]?.textContent).toBe('Default');

    act(() => r.pick(transform(), 'uppercase'));
    expect(node.css.d['text-transform']).toBe('uppercase');
    act(() => r.click(r.$('button[aria-label="Restore default for Transform"]')));
    expect(node.css.d['text-transform']).toBeUndefined();
    expect(transform().value).toBe('');
    expect(transform().selectedOptions[0]?.textContent).toBe('Default');
  },
);

test('Transition None overrides an applied class and Default restores the class', () => {
  const node = C.N('button');
  const classId = C.classAdd('Motion card', { d: { transition: 'all .25s ease' }, t: {}, m: {} });
  C.classApply(node, classId);
  place(node);
  const control: Control = {
    t: 'opt', c: 'transition', label: 'Transition', opts: C.TRANSITIONS,
    ph: 'all .25s ease'
  };
  r.draw(() => <Ctl n={node} c={control} />, 'right');
  const transition = () => r.$('select[aria-label="Transition"]') as HTMLSelectElement;
  expect(transition().value).toBe('');
  expect(transition().selectedOptions[0]?.textContent).toBe('Default');
  expect(C.effectiveAt(node.id, 'transition')).toBe('all .25s ease');

  act(() => r.pick(transition(), 'all .15s ease'));
  expect(node.css.d.transition).toBe('all .15s ease');
  expect(C.effectiveAt(node.id, 'transition')).toBe('all .15s ease');
  act(() => r.pick(transition(), 'none'));
  expect(node.css.d.transition).toBe('none');
  expect(C.effectiveAt(node.id, 'transition')).toBe('none');

  const restored = restoredNode(node.id);
  expect(restored.css.d.transition).toBe('none');
  const buckets = { d: '', t: '', m: '' };
  C.nodeCss(restored, false, buckets);
  expect(buckets.d).toContain('transition:none;');
  expect(C.tokenCss().d).toContain(`.c-${classId}{transition:all .25s ease;}`);

  act(() => r.click(r.$('button[aria-label="Restore default for Transition"]')));
  expect(node.css.d.transition).toBeUndefined();
  expect(transition().value).toBe('');
  expect(transition().selectedOptions[0]?.textContent).toBe('Default');
  expect(C.effectiveAt(node.id, 'transition')).toBe('all .25s ease');
});

test('every visible Text Style field keeps its specific accessible name after select enhancement', () => {
  const styleId = C.styleAdd('Accessible choices');
  r.draw(() => <TextStyles />, 'styles');
  act(() => r.click(r.$(`button[aria-label="Expand Accessible choices"]`)));

  for (const label of ['Weight', 'Transform']) {
    const field = r.$$('.f').find(candidate => candidate.querySelector('label')?.textContent === label)!;
    const select = field.querySelector('select')!;
    expect(select.getAttribute('aria-label')).toBe(label);
  }
  for (const label of ['Size', 'Line height', 'Letter spacing']) {
    expect(r.$(`input[aria-label="${label} value"]`)).not.toBeNull();
    expect(r.$(`select[aria-label="${label} unit"]`)).not.toBeNull();
  }
  expect(r.$('select[aria-label="Default HTML tag"]')).not.toBeNull();
  expect(r.$('input[aria-label="Colour"]')).not.toBeNull();

  installCustomSelects();
  for (const label of [
    'Size unit', 'Weight', 'Line height unit', 'Letter spacing unit', 'Font',
    'Default HTML tag', 'Transform'
  ]) expect(r.$(`.pc-custom-select-trigger[aria-label="${label}"]`)).not.toBeNull();
  expect(C.findStyle(styleId)).not.toBeNull();
});
