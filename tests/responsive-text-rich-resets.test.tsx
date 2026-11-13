// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { advControls } from '../app/src/ui/inspector/Inspector';
import type { Control, Node as PcNode } from '../app/src/core/types';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const fontControl = (type: 'heading' | 'text') =>
  C.DEF[type].controls.style.find(control => control.c === 'font-family')!;
const overflowControl = (node: PcNode) =>
  advControls(node).find(control => control.c === 'overflow')!;

function place(node: PcNode) {
  C.state.pages[0].tree = [node];
  C.selSet([node.id]);
}

function select(label: string) {
  return r.$(`select[aria-label="${label}"]`) as HTMLSelectElement;
}

function choose(node: PcNode, control: Control, label: string, value: string) {
  r.draw(() => <Ctl n={node} c={control} />, 'right');
  act(() => r.pick(select(label), value));
}

test.each(['heading', 'text'] as const)(
  '%s offers distinct defaults and explicit Font inheritance and Overflow visibility',
  type => {
    const node = C.N(type);
    const font = fontControl(type);
    const overflow = overflowControl(node);
    expect(font.og?.()[0]).toEqual([
      'Standard',
      expect.arrayContaining([['', 'Default'], ['inherit', 'Inherit']]),
    ]);
    expect(overflow.opts).toEqual([
      ['', 'Default'], ['visible', 'Visible'], ['hidden', 'Hidden'], ['auto', 'Auto'],
    ]);
  },
);

test.each(['heading', 'text'] as const)(
  '%s persists explicit Tablet and Mobile resets and clears back to Desktop',
  type => {
    const node = C.N(type, {}, {
      d: { 'font-family': "Georgia,'Times New Roman',serif", overflow: 'hidden' },
      t: {}, m: {},
    });
    place(node);
    const font = fontControl(type);
    const overflow = overflowControl(node);

    C.state.ui.dev = 'tablet';
    choose(node, font, 'Font', 'inherit');
    choose(node, overflow, 'Overflow', 'visible');
    expect(node.css.t).toMatchObject({ 'font-family': 'inherit', overflow: 'visible' });

    C.state.ui.dev = 'mobile';
    choose(node, font, 'Font', 'inherit');
    choose(node, overflow, 'Overflow', 'visible');
    expect(node.css.m).toMatchObject({ 'font-family': 'inherit', overflow: 'visible' });

    const restored = C.clone(C.doc()).pages[0].tree[0];
    const buckets = { d: '', t: '', m: '' };
    C.nodeCss(restored, false, buckets);
    expect(buckets.t).toContain('font-family:inherit;overflow:visible;');
    expect(buckets.m).toContain('font-family:inherit;overflow:visible;');

    choose(node, font, 'Font', 'inherit');
    act(() => r.click(r.$('button[aria-label="Clear Mobile override for Font"]')));
    choose(node, overflow, 'Overflow', 'visible');
    act(() => r.click(r.$('button[aria-label="Clear Mobile override for Overflow"]')));
    expect(node.css.m['font-family']).toBeUndefined();
    expect(node.css.m.overflow).toBeUndefined();
    expect(C.cssVal(node, 'font-family', true)).toEqual({ v: 'inherit', own: false });
    expect(C.cssVal(node, 'overflow', true)).toEqual({ v: 'visible', own: false });

    C.state.ui.dev = 'tablet';
    choose(node, font, 'Font', 'inherit');
    act(() => r.click(r.$('button[aria-label="Clear Tablet override for Font"]')));
    choose(node, overflow, 'Overflow', 'visible');
    act(() => r.click(r.$('button[aria-label="Clear Tablet override for Overflow"]')));
    expect(node.css.t['font-family']).toBeUndefined();
    expect(node.css.t.overflow).toBeUndefined();
    expect(C.cssVal(node, 'font-family', true)).toEqual({ v: "Georgia,'Times New Roman',serif", own: false });
    expect(C.cssVal(node, 'overflow', true)).toEqual({ v: 'hidden', own: false });
  },
);

test.each(['heading', 'text'] as const)(
  '%s explicit resets beat a shared class and Default restores the class',
  type => {
    const node = C.N(type);
    const classId = C.classAdd('Text reset base', {
      d: { 'font-family': "Georgia,'Times New Roman',serif", overflow: 'hidden' },
    });
    C.classApply(node, classId);
    place(node);
    const font = fontControl(type);
    const overflow = overflowControl(node);

    C.state.ui.dev = 'tablet';
    choose(node, font, 'Font', 'inherit');
    choose(node, overflow, 'Overflow', 'visible');
    C.state.ui.dev = 'mobile';
    choose(node, font, 'Font', 'inherit');
    choose(node, overflow, 'Overflow', 'visible');

    const css = C.treeCss([C.state.pages[0].tree], false);
    const nodeSelector = `.${C.nodeClass(node)}`;
    const explicitRule = `${nodeSelector}{font-family:inherit;overflow:visible;}`;
    expect(css).toContain(`.c-${classId}{font-family:Georgia,'Times New Roman',serif;overflow:hidden;}`);
    expect(css.split(explicitRule)).toHaveLength(3);

    choose(node, font, 'Font', '');
    choose(node, overflow, 'Overflow', '');
    expect(node.css.m['font-family']).toBeUndefined();
    expect(node.css.m.overflow).toBeUndefined();
    expect(C.treeCss([C.state.pages[0].tree], false).split(explicitRule)).toHaveLength(2);

    C.state.ui.dev = 'tablet';
    choose(node, font, 'Font', '');
    choose(node, overflow, 'Overflow', '');
    expect(node.css.t['font-family']).toBeUndefined();
    expect(node.css.t.overflow).toBeUndefined();
    const resetCss = C.treeCss([C.state.pages[0].tree], false);
    expect(resetCss).not.toContain(explicitRule);
    expect(resetCss).toContain(`.c-${classId}{font-family:Georgia,'Times New Roman',serif;overflow:hidden;}`);
  },
);
