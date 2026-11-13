// @vitest-environment jsdom
/* A gradient colour can be a colour token. The picker works in rgb, and used to write every
   stop back as a literal: opening it on a token-linked background and choosing Gradient, or
   only changing the angle of a gradient written with a token, quietly dropped the link. */
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

const paint = () => C.COMMON_STYLE.find(group => group.g === 'Background')!.items.find(c => c.paint)!;
const image = (n: ReturnType<typeof C.N>) => String(n.css.d['background-image'] || '');
function open(n: ReturnType<typeof C.N>) {
  C.selSet([n.id]);
  r.draw(() => <Ctl n={n} c={paint()} />, 'right');
  act(() => r.click(r.$('button.sw')));
}
const tokenButton = (name: string) =>
  r.$$('.cp-tokens button').find(b => b.getAttribute('aria-label') === `Link this colour to the ${name} token`)!;

test('changing the angle of a gradient written with tokens keeps both tokens', () => {
  const teal = C.colorAdd('Teal', '#1f6f8b'), gold = C.colorAdd('Gold', '#f4d35e');
  const n = C.insert('section', null, 0)!;
  n.css.d['background-image'] = `linear-gradient(90deg, ${C.cvar(teal)} 0%, ${C.cvar(gold)} 100%)`;
  open(n);

  act(() => r.pick(r.$('.cp-gradient select') as HTMLSelectElement, '180'));
  assert.equal(image(n), `linear-gradient(180deg, ${C.cvar(teal)}, ${C.cvar(gold)})`);
  /* the editor's own chrome has no project variables, so what it draws is resolved */
  const preview = (r.$('.cp-gradient-preview') as HTMLElement).getAttribute('style') || '';
  assert.doesNotMatch(preview, /var\(/);
  const stops = r.$$('.cp-stops > button');
  assert.match(stops[0].getAttribute('aria-label')!, /linked to the Teal token/);
  assert.match(stops[1].getAttribute('aria-label')!, /linked to the Gold token/);
});

test('choosing a colour by hand unlinks that stop and leaves the other linked', () => {
  const teal = C.colorAdd('Teal', '#1f6f8b'), gold = C.colorAdd('Gold', '#f4d35e');
  const n = C.insert('section', null, 0)!;
  n.css.d['background-image'] = `linear-gradient(90deg, ${C.cvar(teal)}, ${C.cvar(gold)})`;
  open(n);

  const field = r.$('input.cp-val') as HTMLInputElement;
  act(() => { field.dispatchEvent(new window.Event('focus')); r.type(field, '#ff0000'); field.dispatchEvent(new window.Event('blur')); });
  assert.equal(image(n), `linear-gradient(90deg, #ff0000, ${C.cvar(gold)})`);
  assert.doesNotMatch(r.$$('.cp-stops > button')[0].getAttribute('aria-label')!, /linked/);
});

test('turning a token-linked background into a gradient starts from the token', () => {
  const teal = C.colorAdd('Teal', '#1f6f8b');
  const n = C.insert('section', null, 0)!;
  n.css.d['background-color'] = C.cvar(teal);
  open(n);

  act(() => r.click(r.$$('.cp-modes button')[1]));
  assert.equal(image(n), `linear-gradient(135deg, ${C.cvar(teal)}, #ffffff)`);
  assert.equal(n.css.d['background-color'], C.cvar(teal), 'the solid colour keeps its own link');
});

test('a stop can be linked to a token from the picker', () => {
  const gold = C.colorAdd('Gold', '#f4d35e');
  const n = C.insert('section', null, 0)!;
  n.css.d['background-image'] = 'linear-gradient(90deg, #111311, #b7f34a)';
  const before = image(n);
  open(n);

  assert.ok(r.$('.cp-tokens'), 'the token row is offered for a gradient');
  act(() => r.click(r.$$('.cp-stops > button')[1]));        // the second colour
  act(() => r.click(tokenButton('Gold')));
  assert.equal(image(n), `linear-gradient(90deg, #111311, ${C.cvar(gold)})`);
  assert.equal(tokenButton('Gold').getAttribute('aria-pressed'), 'true');

  /* the token changes, and so does the gradient, with nothing rewritten on the element */
  C.findColor(gold)!.value = '#ffcc00';
  assert.equal(image(n), `linear-gradient(90deg, #111311, ${C.cvar(gold)})`);

  assert.ok(r.names().includes('save'), 'linking commits through the hard writer, so it is its own Undo step');
  assert.notEqual(image(n), before);
});

test('a reference to a token that no longer exists is not written back as a live link', () => {
  const n = C.insert('section', null, 0)!;
  n.css.d['background-color'] = '#123456';
  n.css.d['background-image'] = 'linear-gradient(90deg, var(--c-gone), #ffffff)';
  open(n);
  /* nothing to resolve the first colour from, so the picker treats it as no gradient */
  assert.equal(r.$('.cp-modes button.on')!.textContent, 'Solid');
  assert.equal(image(n), 'linear-gradient(90deg, var(--c-gone), #ffffff)', 'opening changes nothing');
});
