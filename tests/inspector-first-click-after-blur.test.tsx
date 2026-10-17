// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { installCustomSelects } from '../shared/custom-select.js';
import { rig, type Rig } from './ui.setup';

const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
let r: Rig | null = null;
const scrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');

beforeEach(() => { HTMLElement.prototype.scrollIntoView = () => {}; });

afterEach(async () => {
  const open = document.querySelector<HTMLButtonElement>('.pc-custom-select-trigger[aria-expanded="true"]');
  if (open) open.click();
  if (r) { act(() => r!.draw(null)); r.host.remove(); r = null; }
  document.body.replaceChildren();
  await settle();
  if (scrollIntoView) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollIntoView);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

test('the first component override does not consume the adjacent variant click', async () => {
  r = rig();
  const definition = C.N('heading', { text: 'Default label' });
  C.state.meta.components = [{
    id: 'card', name: 'Card', node: definition,
    props: [{ k: 'label', label: 'Label', t: 'text', def: 'Default label' }],
    variants: [{ id: 'outline', name: 'Outline', values: { label: 'Outline label' } }]
  }];
  const instance = C.N('heading');
  instance.use = 'card';
  C.state.pages[0].tree = [instance];
  C.selSet([instance.id]);
  C.state.ui.stab = 'content';
  r.draw(() => <Inspector />, 'right');
  installCustomSelects();
  await settle();

  const label = r.$('input[aria-labelledby]') as HTMLInputElement;
  const trigger = r.$('.pc-custom-select-trigger') as HTMLButtonElement;
  assert.ok(label);
  assert.ok(trigger);
  const rect = (top: number) => ({
    x: 20, y: top, top, left: 20, right: 260, bottom: top + 40, width: 240, height: 40,
    toJSON: () => ({})
  }) as DOMRect;
  trigger.getBoundingClientRect = () => rect(
    /One value is set on this instance/.test(r!.host.textContent || '') ? 180 : 100
  );
  assert.doesNotMatch(r.host.textContent || '', /One value is set on this instance/);
  label.focus();
  act(() => r!.type(label, 'First override'));

  trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  assert.equal(trigger.hasAttribute('data-pc-pointer-activating'), true);
  trigger.dispatchEvent(new MouseEvent('pointercancel', { bubbles: true, button: 0 }));
  assert.equal(trigger.hasAttribute('data-pc-pointer-activating'), false,
    'a cancelled gesture cannot leave a stale pointer marker');
  trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  trigger.focus();
  assert.equal(C.instOwn(instance).length, 1, 'blur commits the first instance override');
  assert.doesNotMatch(r.host.textContent || '', /One value is set on this instance/,
    'structural controls wait until the in-progress activation finishes');
  trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0 }));
  assert.equal(trigger.hasAttribute('data-pc-pointer-activating'), false,
    'pointer release clears the activation marker before click');
  trigger.click();
  const menu = document.querySelector<HTMLElement>('.pc-custom-select-popover')!;
  assert.equal(menu.style.top, '146px', 'the menu initially anchors to the pre-status trigger');
  await frame();
  await settle();

  assert.equal(trigger.isConnected, true, 'the activation target survives its blur repaint');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(document.querySelectorAll('.pc-custom-select-popover:not([hidden])').length, 1);
  assert.equal(menu.style.top, '226px', 'the open menu follows the trigger after status insertion');
  assert.equal(menu.style.left, '20px');
  assert.match(r.host.textContent || '', /One value is set on this instance/,
    'the deferred repaint still exposes the new reset and status controls');

  trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  assert.equal(trigger.hasAttribute('data-pc-pointer-activating'), true);
  act(() => r!.draw(null));
  await settle();
  assert.equal(trigger.hasAttribute('data-pc-pointer-activating'), false,
    'removing the enhanced select clears an unfinished pointer activation');
});

test('Tab from a committed field refreshes conditional controls while preserving select focus', async () => {
  r = rig();
  const video = C.N('video', {
    src: 'https://cdn.example.com/clip.mp4',
    autoplay: 0,
    facade: 1,
  });
  C.state.pages[0].tree = [video];
  C.selSet([video.id]);
  C.state.ui.stab = 'content';
  r.draw(() => <Inspector />, 'right');
  installCustomSelects();
  await settle();

  const url = r.$('input[placeholder="YouTube, Vimeo or .mp4"]') as HTMLInputElement;
  const aspect = r.$('.pc-custom-select-trigger[aria-label="Aspect ratio"]') as HTMLButtonElement;
  assert.ok(url);
  assert.ok(aspect);
  assert.doesNotMatch(r.host.textContent || '', /Load player on click/);

  url.focus();
  act(() => r!.type(url, 'https://www.youtube.com/watch?feature=shared&v=aqz-KE-bpKQ'));
  assert.equal(video.props.src, 'https://www.youtube.com/watch?feature=shared&v=aqz-KE-bpKQ');
  assert.doesNotMatch(r.host.textContent || '', /Load player on click/,
    'typing keeps the active field and panel structure stable');

  act(() => {
    url.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    aspect.focus();
  });
  assert.equal(document.activeElement, aspect);
  await frame();
  await settle();

  assert.equal(aspect.isConnected, true);
  assert.equal(document.activeElement, aspect, 'the enhanced Aspect ratio trigger keeps keyboard focus');
  assert.match(r.host.textContent || '', /Load player on click/,
    'the committed YouTube URL refreshes its newly applicable facade control after Tab');
});
