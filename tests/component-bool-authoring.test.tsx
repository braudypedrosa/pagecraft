// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { install } from '../app/src/ui/ctx';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, stubLegacy, type Rig } from './ui.setup';

let r: Rig, ask: HTMLElement;
const source = readFileSync('builder.html', 'utf8');
const settle = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  r = rig();
  // Use the actual builder dialog markup and choice/name handlers. Only motion/layer
  // infrastructure is inert here; the property is created by the rendered badge and choice.
  const parsed = new DOMParser().parseFromString(source, 'text/html');
  ask = document.importNode(parsed.querySelector('#ask')!, true);
  document.body.append(ask);
  const start = source.indexOf('let askDone = null;');
  const end = source.indexOf('\nfunction mediaPicker(', start);
  const listeners = source.slice(source.indexOf("$('#askX').addEventListener('click',"),
    source.indexOf("$('#ask').addEventListener('keydown',"));
  a.ok(start > 0 && end > start);
  const dialogs = new Function('$', '$$', 'esc', 'PC_UI', 'syncDialogLayers',
    source.slice(start, end) + '\n' + listeners + '\nreturn {askPick, askText, askConfirm};')(
      (s: string) => document.querySelector(s),
      (s: string) => [...document.querySelectorAll(s)], C.esc,
      { installUiMotion: () => null }, () => {});
  install(C, { ...stubLegacy(r.calls), ...dialogs });
});
afterEach(() => { act(() => r.draw(null)); r.host.remove(); ask.remove(); });

const draw = () => act(() => r.draw(() => <Inspector />, 'right'));
const button = (label: string) => [...r.host.querySelectorAll<HTMLButtonElement>('button')]
  .find(b => b.getAttribute('aria-label') === label || b.textContent?.trim() === label);
const chooseNewProperty = async (label: string) => {
  const badge = button('Make ' + label + ' vary between instances');
  a.ok(badge, `${label} definition toggle exposes its property badge`);
  act(() => badge.click());
  a.equal(ask.hidden, false);
  a.equal(ask.querySelector('#askTitle')!.textContent, 'This value on each instance');
  const choice = ask.querySelector<HTMLButtonElement>('[data-p="+"]')!;
  a.equal(choice.textContent, 'New property from this value');
  act(() => choice.click());
  await settle();
  a.equal(ask.hidden, true);
};

test('Image boolean property is authored through the real badge/dialog and remains isolated through variants and reload', async () => {
  const original = C.insert('image', null, 0)!;
  original.props.src = 'https://example.test/qa-image.png';
  original.props.alt = 'QA image';
  original.props.decorative = 1;
  const cid = C.componentFromNode(original.id, 'QA boolean image')!;
  C.componentOpen(cid);
  const definition = C.findComponent(cid)!;
  C.selSet([definition.node.id]);
  draw();
  r.$$('[role="switch"][aria-describedby]').forEach(toggle => {
    toggle.getAttribute('aria-describedby')!.split(/\s+/).forEach(id =>
      a.ok(document.getElementById(id), 'definition switch description resolves to rendered help'));
  });
  await chooseNewProperty('Decorative image');
  const property = definition.props![0];
  a.equal(property.t, 'bool');
  a.equal(property.def, '1');
  a.deepEqual(C.bindGet(definition.node, 'decorative'), { src: 'prop', path: property.k });
  a.ok(button('Varies per instance — “Decorative image” — click to change'));

  C.componentClose();
  const second = C.instanceInsert(cid, null, C.tree().length)!;
  C.selSet([second.id]);
  draw();
  const toggle = r.$('[role="switch"][aria-label="Decorative image"]') as HTMLButtonElement;
  a.equal(toggle.getAttribute('aria-checked'), 'true');
  act(() => toggle.click());
  a.equal(C.instValue(second, definition, property.k), '0', 'an explicit false is stored as an override');
  a.equal(C.instValue(original, definition, property.k), '1', 'the other instance keeps its true default');
  draw();
  act(() => button('Save as variant')!.click());
  a.equal(ask.querySelector('#askTitle')!.textContent, 'Save as variant');
  (ask.querySelector('#askIn') as HTMLInputElement).value = 'Informative';
  act(() => (ask.querySelector('#askYes') as HTMLButtonElement).click());
  await settle();
  const variant = C.variantsOf(definition)[0];
  a.equal(variant.values[property.k], '0');
  a.equal(second.variant, variant.id);
  a.equal(second.vals, undefined, 'variant owns the captured false instead of a redundant override');

  draw();
  act(() => (r.$('[role="switch"][aria-label="Decorative image"]') as HTMLButtonElement).click());
  a.equal(C.instValue(second, definition, property.k), '1');
  draw();
  act(() => button('Back to the variant')!.click());
  a.equal(C.instValue(second, definition, property.k), '0');
  const saved = JSON.parse(JSON.stringify(C.doc()));
  C.restore(C.migrate(saved)!);
  const reloadedDefinition = C.findComponent(cid)!;
  const reloadedSecond = C.locate(second.id)!.node;
  a.equal(C.instValue(reloadedSecond, reloadedDefinition, property.k), '0');
  a.equal(C.instValue(C.locate(original.id)!.node, reloadedDefinition, property.k), '1');
  C.selSet([reloadedSecond.id]);
  draw();
  a.equal(r.$('[role="switch"][aria-label="Decorative image"]')!.getAttribute('aria-checked'), 'false');
});

test('ordinary Image switches stay inline and only component definitions expose boolean authoring', () => {
  const image = C.insert('image', null, 0)!;
  const control = C.DEF.image.controls.content.find(c => c.k === 'decorative')!;
  act(() => r.draw(<Ctl n={image} c={control} />));
  a.equal(r.$$('.tog-row').length, 1);
  a.equal(r.$$('.f > label').length, 0, 'ordinary inline layout stays unchanged');
  a.equal(button('Make Decorative image vary between instances'), undefined);
  const toggle = r.$('[role="switch"]') as HTMLButtonElement;
  const descriptionId = toggle.getAttribute('aria-describedby');
  a.ok(descriptionId, 'ordinary inline switch retains its explanation');
  a.match(document.getElementById(descriptionId)!.textContent || '', /Screen readers skip decorative images/);
  act(() => toggle.click());
  a.equal(image.props.decorative, 1);
});
