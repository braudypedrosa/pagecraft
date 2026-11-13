// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const field = (name: string) => r.$$('.f').find(el => {
  const label = el.getAttribute('aria-labelledby');
  return label && document.getElementById(label)?.textContent?.trim() === name;
});

test('Collection Slider hides ineffective Wrap without losing responsive Grid settings', () => {
  const n = C.insert('list', null, 0)!;
  n.css.d['flex-wrap'] = 'wrap';
  n.css.t['flex-wrap'] = 'nowrap';
  n.css.m['flex-wrap'] = 'wrap';
  C.selSet([n.id]);
  C.state.ui.stab = 'content';
  const draw = () => r.draw(() => <Inspector />, 'right');
  draw();
  const original = JSON.stringify(C.doc());

  for (const breakpoint of ['desktop', 'tablet', 'mobile'] as const) {
    C.state.ui.dev = breakpoint;
    draw();
    const wrap = field('Wrap')?.querySelector('select') as HTMLSelectElement;
    expect(wrap, `${breakpoint} Grid exposes Wrap`).toBeTruthy();
    expect(wrap.value).toBe(breakpoint === 'tablet' ? 'nowrap' : 'wrap');

    act(() => r.pick(field('Layout')!.querySelector('select')!, 'slider'));
    draw();
    expect(field('Wrap'), `${breakpoint} Slider cannot wrap its slide track`).toBeUndefined();

    act(() => r.pick(field('Layout')!.querySelector('select')!, 'grid'));
    draw();
    expect((field('Wrap')!.querySelector('select') as HTMLSelectElement).value)
      .toBe(breakpoint === 'tablet' ? 'nowrap' : 'wrap');
    expect(JSON.stringify(C.doc())).toBe(original);
  }
});
