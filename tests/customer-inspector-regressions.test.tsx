// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { MobileMenuBuilder } from '../app/src/ui/inspector/MobileMenuBuilder';
import { rig, type Rig } from './ui.setup';
import type { Control } from '../app/src/core/types';
import { installCustomSelects } from '../shared/custom-select.js';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const lineHeight: Control = {
  t: 'unit', c: 'line-height', label: 'Line height', r: 1, units: ['', 'px', 'em', '%']
};

test('an empty unit field keeps the selected unit until a number is entered', () => {
  const n = C.insert('heading', null, 0)!;
  delete n.css.d['line-height'];
  r.draw(() => <Ctl n={n} c={lineHeight} />, 'right');

  const unit = r.$('select') as HTMLSelectElement;
  act(() => r.pick(unit, 'px'));
  assert.equal((r.$('select') as HTMLSelectElement).value, 'px');
  assert.equal(n.css.d['line-height'], undefined);

  act(() => r.type(r.$('input')!, '60'));
  assert.equal(n.css.d['line-height'], '60px');
});

test('legacy Nav items without ids remain available as parents and normalize on selection', () => {
  const n = C.insert('nav', null, 0)!;
  n.props.items = [
    { label: 'Parent', href: 'index.html' },
    { label: 'Child', href: 'index.html#child' },
  ];
  const control = C.DEF.nav.controls.content.find(c => c.t === 'items')!;
  r.draw(<Ctl n={n} c={control} />);

  const parent = r.$$('.navitem-body select').find(select =>
    select.previousElementSibling?.textContent === 'Parent item') as HTMLSelectElement;
  assert.ok(parent);
  const candidate = [...parent.options].find(option => option.textContent === 'Child')!;
  assert.equal(candidate.disabled, false);

  act(() => r.pick(parent, candidate.value));
  const items = n.props.items as Array<{ id?: string; parentId?: string }>;
  assert.ok(items.every(item => item.id));
  assert.equal(items[0].parentId, items[1].id);
});

test('Nav parent choices still block descendants that would create a cycle', () => {
  const n = C.insert('nav', null, 0)!;
  n.props.items = [
    { id: 'a', label: 'A', href: 'index.html', parentId: '' },
    { id: 'b', label: 'B', href: 'index.html', parentId: 'a' },
    { id: 'c', label: 'C', href: 'index.html', parentId: 'b' },
  ];
  const control = C.DEF.nav.controls.content.find(c => c.t === 'items')!;
  r.draw(<Ctl n={n} c={control} />);
  const parent = r.$$('.navitem-body select').find(select =>
    select.previousElementSibling?.textContent === 'Parent item') as HTMLSelectElement;
  assert.equal([...parent.options].find(option => option.value === 'b')?.disabled, true);
  assert.equal([...parent.options].find(option => option.value === 'c')?.disabled, true);
});

test('clearing a Mobile Slider override immediately shows its inherited Tablet value', () => {
  const n = C.insert('slider', null, 0)!;
  C.selSet([n.id]);
  C.state.ui.dev = 'mobile';
  const control = C.DEF.slider.controls.content.find(c => c.c === '--sl-w')!;
  r.draw(() => <Ctl n={n} c={control} />, 'right');
  assert.equal((r.$('select') as HTMLSelectElement).value, '86%');

  act(() => r.click(r.$('button.rsp')));
  assert.equal(n.css.m['--sl-w'], undefined);
  assert.equal((r.$('select') as HTMLSelectElement).value, 'calc((100% - var(--sl-gap,24px)) / 2)');
});

function motionInspector() {
  const n = C.insert('heading', null, 0)!;
  C.selSet([n.id]);
  C.state.ui.stab = 'style';
  r.draw(() => <Inspector />, 'right');
  const animation = r.$$('select').find(select =>
    [...(select as HTMLSelectElement).options].some(option => option.value === 'fade-up'))!;
  return { n, animation };
}

test('native input events retain Motion timing values in state and preview markup', () => {
  const { n, animation } = motionInspector();
  act(() => r.pick(animation, 'fade-up'));
  const motion = r.$$('.group').find(group => group.querySelector('.gh')?.textContent?.trim() === 'Motion')!;
  const inputs = [...motion.querySelectorAll('input.ctl')] as HTMLInputElement[];
  assert.equal(inputs.length, 3);

  act(() => {
    r.type(inputs[0], '0.8s');
    r.type(inputs[1], '0.1s');
    r.type(inputs[2], 'linear');
  });
  assert.deepEqual(n.anim, { name: 'fade-up', dur: '0.8s', delay: '0.1s', ease: 'linear' });
  const html = C.renderNode(n, { edit: false });
  assert.match(html, /bp-duration="0\.8s"/);
  assert.match(html, /bp-delay="0\.1s"/);
  assert.match(html, /bp-easing="linear"/);
});

test('clearing a Motion preset removes state and preview animation attributes', () => {
  const { n, animation } = motionInspector();
  act(() => r.pick(animation, 'zoom-out'));
  assert.match(C.renderNode(n, { edit: false }), /bp-animate/);

  const current = r.$$('select').find(select =>
    [...(select as HTMLSelectElement).options].some(option => option.value === 'zoom-out'))!;
  act(() => r.pick(current, ''));
  assert.equal(n.anim, undefined);
  assert.doesNotMatch(C.renderNode(n, { edit: false }), /bp-animate/);
});

test('invalid colours stay editable with feedback and do not replace the valid style', () => {
  const n = C.insert('heading', null, 0)!;
  n.css.d.color = '#112233';
  const control = C.DEF.heading.controls.style.find(c => c.c === 'color')!;
  r.draw(<Ctl n={n} c={control} />);

  const input = r.$('input.hex') as HTMLInputElement;
  act(() => r.type(input, 'not-a-colour'));
  assert.equal(input.value, 'not-a-colour');
  assert.equal(input.getAttribute('aria-invalid'), 'true');
  assert.match(r.host.textContent || '', /valid colour/i);
  assert.equal(n.css.d.color, '#112233');

  act(() => r.click(r.$('button[title="Clear"]')));
  assert.equal((r.$('input.hex') as HTMLInputElement).value, '');
  assert.doesNotMatch(r.host.textContent || '', /valid colour/i);
  assert.equal(n.css.d.color, undefined);
});

test('opacity clamps to its declared range in both inputs and stored CSS', () => {
  const n = C.insert('image', null, 0)!;
  const control: Control = { t: 'slider', c: 'opacity', label: 'Opacity', min: 0, max: 1, step: .01, raw: 1 };
  r.draw(<Ctl n={n} c={control} />);
  const number = r.$('input.num') as HTMLInputElement;

  act(() => r.type(number, '2'));
  assert.equal(number.value, '1');
  assert.equal(n.css.d.opacity, '1');
});

test('a gradient is paint rather than a missing background asset and angle editing stays open', () => {
  const n = C.insert('section', null, 0)!;
  n.css.d['background-image'] = 'linear-gradient(90deg, #111311, #b7f34a)';
  const colour = C.COMMON_STYLE.find(group => group.g === 'Background')!.items.find(c => c.paint)!;
  const image = C.COMMON_STYLE.find(group => group.g === 'Background')!.items.find(c => c.t === 'img')!;

  r.draw(<Ctl n={n} c={image} />);
  assert.doesNotMatch(r.host.textContent || '', /Not in this project/);

  r.draw(() => <Ctl n={n} c={colour} />, 'right');
  act(() => r.click(r.$('button.sw')));
  const angle = r.$('.cp-gradient select') as HTMLSelectElement;
  act(() => r.pick(angle, '180'));
  assert.ok(r.$('.cp'), 'gradient picker remains open after changing its angle');
  assert.match(String(n.css.d['background-image']), /^linear-gradient\(180deg,/);
});

test('module controls replace matching shared controls instead of duplicating a property', () => {
  const n = C.insert('quote', null, 0)!;
  C.selSet([n.id]);
  C.state.ui.stab = 'style';
  r.draw(<Inspector />);
  const labels = r.$$('.f > label > span').filter(label => label.textContent === 'Padding');
  assert.equal(labels.length, 1);
});

test('opening a mobile menu component selects its root as the insertion target', () => {
  const n = C.insert('nav', null, 0)!;
  r.draw(<MobileMenuBuilder n={n} />);
  act(() => r.click(r.$('button.btn')));
  const definition = C.findComponent(String(n.props.mobileMenuComponent))!;
  assert.equal(r.arg('editComponent')?.[0], definition.id);
  assert.equal(r.arg('select')?.[0], definition.node.id);
});

test('the enhanced Slider select refreshes its visible label after clearing an override', async () => {
  const n = C.insert('slider', null, 0)!;
  C.state.ui.dev = 'mobile';
  const control = C.DEF.slider.controls.content.find(c => c.c === '--sl-w')!;
  r.draw(() => <Ctl n={n} c={control} />, 'right');
  installCustomSelects();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(r.$('.pc-custom-select-trigger')?.textContent || '', /One and a peek/);

  await act(async () => {
    r.click(r.$('button.rsp'));
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  assert.match(r.$('.pc-custom-select-trigger')?.textContent || '', /Two/);
});
