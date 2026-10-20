// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { TextStyles } from '../app/src/ui/TextStyles';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const transformControl = (type: 'heading' | 'button' | 'nav') =>
  C.DEF[type].controls.style.find(control => control.c === 'text-transform')!;

test.each(['heading', 'button', 'nav'] as const)(
  '%s Transform None is an explicit responsive value and reset restores inheritance',
  type => {
    const node = C.N(type, {}, { d: { 'text-transform': 'uppercase' }, t: {}, m: {} });
    C.state.pages[0].tree = [node];
    C.selSet([node.id]);
    const control = transformControl(type);

    C.state.ui.dev = 'tablet';
    r.draw(() => <Ctl n={node} c={control} />, 'right');
    act(() => r.pick(r.$('select[aria-label="Transform"]')!, 'none'));
    expect(node.css.t['text-transform']).toBe('none');
    expect((r.$('select[aria-label="Transform"]') as HTMLSelectElement).value).toBe('none');

    C.state.ui.dev = 'mobile';
    r.draw(() => <Ctl n={node} c={control} />, 'right');
    act(() => r.pick(r.$('select[aria-label="Transform"]')!, 'none'));
    expect(node.css.m['text-transform']).toBe('none');
    expect((r.$('select[aria-label="Transform"]') as HTMLSelectElement).value).toBe('none');

    const saved = C.clone(C.doc());
    const restored = saved.pages[0].tree[0];
    const buckets = { d: '', t: '', m: '' };
    C.nodeCss(restored, false, buckets);
    const rule = `.${C.nodeClass(restored)}{text-transform:none;}`;
    expect(buckets.t).toContain(rule);
    expect(buckets.m).toContain(rule);

    act(() => r.click(r.$('button[aria-label="Clear Mobile override for Transform"]')));
    expect(node.css.m['text-transform']).toBeUndefined();
    expect(C.cssVal(node, 'text-transform', true)).toEqual({ v: 'none', own: false });

    C.state.ui.dev = 'tablet';
    r.draw(() => <Ctl n={node} c={control} />, 'right');
    act(() => r.click(r.$('button[aria-label="Clear Tablet override for Transform"]')));
    expect(node.css.t['text-transform']).toBeUndefined();
    expect(C.cssVal(node, 'text-transform', true)).toEqual({ v: 'uppercase', own: false });
  },
);

test('a project text style distinguishes responsive None from Inherit', () => {
  const styleId = C.styleAdd('Transform QA');
  const style = C.findStyle(styleId)!;
  style.css.d['text-transform'] = 'uppercase';
  const heading = C.N('heading', { text: 'Responsive text style', ts: styleId });
  C.state.pages[0].tree = [heading];

  r.draw(() => <TextStyles />, 'styles');
  act(() => r.click(r.$(`button[aria-label="Expand Transform QA"]`)));
  const device = (name: string) => r.$$('button').find(button => button.textContent?.trim() === name)!;
  const transform = () => r.$$('.f').find(field => field.querySelector('label')?.textContent === 'Transform')!
    .querySelector('select')!;

  act(() => r.click(device('Tablet')));
  act(() => r.pick(transform(), 'none'));
  expect(style.css.t['text-transform']).toBe('none');

  act(() => r.click(device('Mobile')));
  act(() => r.pick(transform(), 'none'));
  expect(style.css.m['text-transform']).toBe('none');
  const persisted = C.clone(C.doc()).meta.tokens!.text.find(item => item.id === styleId)!;
  expect(persisted.css.t['text-transform']).toBe('none');
  expect(persisted.css.m['text-transform']).toBe('none');
  const css = C.tokenCss();
  expect(css.t).toContain(`.ts-${styleId}{text-transform:none;}`);
  expect(css.m).toContain(`.ts-${styleId}{text-transform:none;}`);

  act(() => r.pick(transform(), ''));
  expect(style.css.m['text-transform']).toBeUndefined();
  expect(C.tokenCss().m).not.toContain(`.ts-${styleId}{text-transform:`);
  expect(C.tokenCss().t).toContain(`.ts-${styleId}{text-transform:none;}`);

  act(() => r.click(device('Tablet')));
  act(() => r.pick(transform(), ''));
  expect(style.css.t['text-transform']).toBeUndefined();
  expect(C.tokenCss().t).not.toContain(`.ts-${styleId}{text-transform:`);
  expect(C.tokenCss().d).toContain(`.ts-${styleId}{font-size:16px;font-weight:400;line-height:1.5;text-transform:uppercase;}`);
});
