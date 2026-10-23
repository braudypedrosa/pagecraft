// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { install } from '../app/src/ui/ctx';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, stubLegacy, type Rig } from './ui.setup';

const source = readFileSync('builder.html', 'utf8');
let r: Rig, frame: HTMLIFrameElement, canvas: Document, api: any, editing: any;
let saves: any[];
const draw = () => act(() => r.draw(() => <Inspector />, 'right'));
const paint = () => { canvas.body.innerHTML = C.tree().map(n => C.renderNode(n, { edit: true })).join(''); };
const richHosts = (id: string) => [...canvas.getElementById(id)!.querySelectorAll('.pagecraft-wysiwyg')];

beforeEach(() => {
  r = rig(); saves = [];
  frame = document.createElement('iframe'); document.body.append(frame);
  canvas = frame.contentDocument!;
  // jsdom lacks the browser's contentEditable attribute reflection.
  Object.defineProperty((frame.contentWindow! as any).HTMLElement.prototype, 'contentEditable', {
    configurable: true, get() { return this.getAttribute('contenteditable') || 'inherit'; },
    set(value) { this.setAttribute('contenteditable', value); }
  });
  const rt = document.createElement('div'); rt.id = 'rt'; document.body.append(rt);
  editing = { on: false, off: [] };
  // Execute the actual RTE entry/input/exit implementation. Layout, panel repaint and
  // persistence transport are inert; selection, property resolution, history and DOM are real.
  const start = source.indexOf('const EDIT_IN =');
  const end = source.indexOf("\ndocument.addEventListener('pointerdown', e => {", start);
  expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
  const toolbar = source.slice(source.indexOf('function placeRT() {'), source.indexOf('/* formatBlock is inconsistent')) ;
  const scope = { ...C, editing, cdoc: canvas, cwin: frame.contentWindow!,
    $: (q: string) => document.querySelector(q), paint, renderRight: () => {}, renderLayers: () => {},
    paintSel: () => {}, paintHistory: () => {}, positionHud: () => {},
    frameRect: () => ({ left: 0, top: 0 }), toScreen: (x: number, offset: number) => x + offset, window,
    selectedCanvasElement: (id: string) => canvas.getElementById(id),
    save: () => saves.push(JSON.parse(JSON.stringify(C.doc()))), toast: vi.fn(), askText: async () => 'https://example.test/rich-link' };
  api = new Function(...Object.keys(scope), toolbar + source.slice(start, end) + '\nreturn {enterEdit, syncEdit, exitEdit};')(...Object.values(scope));
  install(C, { ...stubLegacy(r.calls), enterEdit: api.enterEdit });
});
afterEach(() => { act(() => r.draw(null)); r.host.remove(); frame.remove(); document.getElementById('rt')?.remove(); });

function fixture() {
  const original = C.insert('box', null, 0)!;
  const text = C.N('text', { html: '<p>Original <b>coffee</b></p>' });
  original.children = [text];
  const cid = C.componentFromNode(original.id, 'Mixed card')!;
  const def = C.findComponent(cid)!;
  const leaf = def.node.children![0];
  const key = C.propFromControl(cid, leaf.id, { t: 'rich', k: 'html', label: 'Rich text' })!;
  const repeat = C.N('text', { html: '' });
  C.bindSet(repeat, 'html', { src: 'prop', path: key });
  def.node.children!.push(repeat);
  const second = C.instanceInsert(cid, null, C.tree().length)!;
  C.selSet([second.id]); paint(); draw();
  return { original, second, def, key, leaf };
}
function open() {
  const button = [...r.host.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Edit on canvas')!;
  expect(button).toBeTruthy(); act(() => button.click());
}
function input(html: string) {
  const el = canvas.querySelector('[contenteditable="true"]')!;
  expect(el).toBeTruthy(); el.innerHTML = html;
  act(() => { el.dispatchEvent(new Event('input', { bubbles: true })); });
}

test('actual instance Rich text button edits nested markup, isolates the instance and refreshes repeated bindings', () => {
  const { original, second, def, key, leaf } = fixture();
  const before = JSON.stringify(C.doc()), history = C.hist.u.length;
  open();
  expect(canvas.querySelector('[contenteditable="true"]')).toBe(richHosts(second.id)[0]);
  expect(document.getElementById('rt')!.classList.contains('show')).toBe(true);
  act(() => api.exitEdit());
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u.length).toBe(history);
  expect(saves).toHaveLength(0);
  open();
  input('<p>Updated <b>coffee</b> <a href="https://example.test/menu">menu</a></p><ul><li>Tea</li></ul>');
  act(() => api.exitEdit());
  expect(C.instValue(second, def, key)).toContain('<b>coffee</b>');
  expect(C.instValue(original, def, key)).toBe('<p>Original <b>coffee</b></p>');
  expect(leaf.props.html).toBe('<p>Original <b>coffee</b></p>');
  expect(richHosts(second.id).map(el => el.innerHTML)).toEqual([second.vals![key], second.vals![key]]);
  expect(C.hist.u.length).toBe(history + 1);
  let savedInstance: any; C.eachNode(saves.at(-1).pages[0].tree, node => { if (node.id === second.id) savedInstance = node; });
  expect(savedInstance.vals[key]).toBe(second.vals![key]);
  const saved = JSON.parse(JSON.stringify(C.doc()));
  C.undo();
  expect(C.instValue(C.locate(second.id)!.node, C.findComponent(def.id), key)).toBe('<p>Original <b>coffee</b></p>');
  C.restore(C.migrate(saved)!); paint();
  const restored = C.locate(second.id)!.node;
  expect(C.renderNode(restored, { edit: false })).toContain('Updated <b>coffee</b>');
});

test('variant rich default remains inherited until a real edit and reset restores it', () => {
  const { second, def, key } = fixture();
  C.instSet(second, key, '<p>Variant <em>tea</em></p>');
  const variant = C.variantFromInstance(second, 'Tea')!;
  paint(); draw(); const before = JSON.stringify(C.doc());
  open(); act(() => api.exitEdit()); expect(JSON.stringify(C.doc())).toBe(before);
  expect(second.vals).toBeUndefined();
  open(); input('<p>Local <strong>cake</strong></p>'); act(() => api.exitEdit());
  expect(second.variant).toBe(variant);
  expect(C.instValue(second, def, key)).toBe('<p>Local <strong>cake</strong></p>');
  C.instSet(second, key, undefined); paint();
  expect(richHosts(second.id)[0].innerHTML).toBe('<p>Variant <em>tea</em></p>');
});

test('CMS-bound instance rich value stays inert and ordinary rich editing keeps markup', () => {
  const { second, key } = fixture();
  C.bindSet(second, C.VAL + key, { src: 'field', path: 'body' });
  const before = JSON.stringify(C.doc());
  act(() => api.enterEdit(second.id, C.VAL + key));
  expect(canvas.querySelector('[contenteditable]')).toBeNull();
  expect(JSON.stringify(C.doc())).toBe(before);
  const ordinary = C.insert('text', null, C.tree().length)!;
  ordinary.props.html = '<p>Plain <b>rich</b></p>'; C.selSet([ordinary.id]); paint(); draw();
  open(); input('<p>New <em>rich</em></p>'); act(() => api.exitEdit());
  expect(ordinary.props.html).toBe('<p>New <em>rich</em></p>');
});


test('nested rich keyboard and link toolbar use the rich target and exported markup stays sanitized', async () => {
  const { second, def, key } = fixture();
  open();
  const host = canvas.querySelector('[contenteditable="true"]')!;
  const enter = new (frame.contentWindow! as any).KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  host.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(false);
  expect(editing.on).toBe(true);
  const range = canvas.createRange(); range.selectNodeContents(host);
  frame.contentWindow!.getSelection()!.addRange(range);
  const command = vi.fn(() => true); canvas.execCommand = command;
  host.dispatchEvent(new (frame.contentWindow! as any).KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
  await act(async () => { await Promise.resolve(); });
  expect(command).toHaveBeenCalledWith('createLink', false, 'https://example.test/rich-link');
  expect(frame.contentWindow!.getSelection()!.anchorNode).not.toBeNull();
  input('<p onclick="bad()">Safe <b>rich</b> <a href="javascript:bad()">bad link</a></p><script>bad()</script>');
  act(() => api.exitEdit());
  expect(C.instValue(second, def, key)).toContain('<b>rich</b>');
  const rendered = C.renderNode(second, { edit: false });
  expect(rendered).toContain('Safe <b>rich</b>');
  expect(rendered).not.toMatch(/onclick|javascript:|<script/);
});


test('imported definition node IDs do not become unsafe CSS selectors', () => {
  const { second, leaf } = fixture();
  leaf.id = 'nimported:rich.node'; paint(); draw();
  open();
  expect(canvas.querySelector('[contenteditable="true"]')).toBe(richHosts(second.id)[0]);
  act(() => api.exitEdit());
});
