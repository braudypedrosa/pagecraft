// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import type { Node as PcNode } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const commonControl = (property: string) => C.COMMON_STYLE
  .flatMap(group => group.items).find(control => control.c === property)!;
const moduleControl = (type: string, property: string) => [...C.DEF[type].controls.content, ...C.DEF[type].controls.style]
  .find(control => control.c === property)!;

function place(node: PcNode) {
  C.state.pages[0].tree = [node];
  C.selSet([node.id]);
}

function savedNode(id: string) {
  let found: PcNode | undefined;
  C.eachNode(C.clone(C.doc()).pages[0].tree, node => { if (node.id === id) found = node; });
  return found!;
}

const cases = [
  { name: 'Button Weight', node: () => C.N('button'), control: () => moduleControl('button', 'font-weight'), property: 'font-weight' },
  {
    name: 'Box Distribute', node: () => { const n = C.N('box'); n.props.layout = 'flex'; return n; },
    control: () => moduleControl('box', 'justify-content'), property: 'justify-content'
  },
  {
    name: 'Box Wrap', node: () => { const n = C.N('box'); n.props.layout = 'flex'; return n; },
    control: () => moduleControl('box', 'flex-wrap'), property: 'flex-wrap'
  },
  {
    name: 'Background Size', node: () => { const n = C.N('section'); C.setCss(n, 'background-image', 'url(a.jpg)'); return n; },
    control: () => commonControl('background-size'), property: 'background-size'
  },
  {
    name: 'Background Repeat', node: () => { const n = C.N('section'); C.setCss(n, 'background-image', 'url(a.jpg)'); return n; },
    control: () => commonControl('background-repeat'), property: 'background-repeat'
  }
] as const;

test.each(cases)('$name exposes Default and preserves an empty reset across breakpoints', item => {
  const node = item.node();
  place(node);
  const control = item.control();
  expect(!control.when || control.when(node)).toBe(true);
  const selected = item.property === 'font-weight' ? '700' : item.property === 'flex-wrap' ? 'nowrap' : item.property === 'background-repeat' ? 'repeat' : item.property === 'background-size' ? 'cover' : 'center';
  const tabletSelected = item.property === 'font-weight' ? '500' : item.property === 'flex-wrap' ? 'wrap' : item.property === 'background-repeat' ? 'no-repeat' : item.property === 'background-size' ? 'contain' : 'flex-end';

  C.state.ui.dev = 'desktop';
  r.draw(() => <Ctl n={node} c={control} />, 'right');
  const select = () => r.$(`select[aria-label="${control.label}"]`) as HTMLSelectElement;
  expect(select().value).toBe('');
  expect(select().selectedOptions[0]?.textContent).toBe('Default');
  let buckets = { d: '', t: '', m: '' };
  C.nodeCss(node, false, buckets);
  expect(buckets.d).not.toContain(`${item.property}:`);

  act(() => r.pick(select(), selected));
  expect(node.css.d[item.property]).toBe(selected);

  act(() => r.pick(select(), ''));
  expect(node.css.d[item.property]).toBeUndefined();
  expect(savedNode(node.id).css.d[item.property]).toBeUndefined();
  expect(select().value).toBe('');
  expect(select().selectedOptions[0]?.textContent).toBe('Default');
  buckets = { d: '', t: '', m: '' };
  C.nodeCss(node, false, buckets);
  expect(buckets.d).not.toContain(`${item.property}:`);

  act(() => r.pick(select(), selected));
  expect(node.css.d[item.property]).toBe(selected);

  C.state.ui.dev = 'tablet';
  r.draw(() => <Ctl n={node} c={control} />, 'right');
  expect(select().value).toBe(selected);
  act(() => r.pick(select(), tabletSelected));
  expect(node.css.t[item.property]).toBe(tabletSelected);
  act(() => r.pick(select(), ''));
  expect(node.css.t[item.property]).toBeUndefined();
  expect(C.cssVal(node, item.property, true)).toEqual({ v: selected, own: false });
  expect(select().value).toBe(selected);
  expect(savedNode(node.id).css.t[item.property]).toBeUndefined();
});
