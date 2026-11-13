// @vitest-environment jsdom
/* Copy styles in one project, switch projects (a full editor reload), Paste styles in another.
   A reload is simulated by importing a fresh core module, which runs its startup load from
   this browser's storage the way a page load does. */
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { act } from 'preact/test-utils';

type Core = typeof import('../app/src/core/index');
const builder = readFileSync('builder.html', 'utf8');
const KEY = 'pagecraft.styleClip';

/* this jsdom has no storage of its own; one Map stands in for the browser's across reloads */
const stored = new Map<string, string>();
beforeEach(() => {
  stored.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => stored.has(k) ? stored.get(k)! : null,
    setItem: (k: string, v: string) => { stored.set(k, String(v)); },
    removeItem: (k: string) => { stored.delete(k); },
    clear: () => stored.clear()
  });
});
afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ''; });

async function boot(project: string, ui = false) {
  vi.resetModules();
  const C: Core = await import('../app/src/core/index');
  const extra = ui ? {
    Inspector: (await import('../app/src/ui/inspector/Inspector')).Inspector,
    rig: (await import('./ui.setup')).rig
  } : null;
  C.setStyleClipProject(project);
  return { C, extra };
}
function blank(C: Core) {
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  C.hist.u.length = 0; C.hist.r.length = 0;
}

/* Project A: a heading using a colour token, a text style with tablet/mobile values and a
   class with tablet/mobile and Hover values; the element has its own Hover too. */
async function copyInProjectA() {
  const { C } = await boot('cloud:A');
  blank(C);
  const ink = C.colorAdd('QA ink', '#112233');
  C.findColor('muted')!.value = '#445566';
  const card = C.classAdd('QA card', {
    d: { 'padding-top': '24px', 'background-color': C.cvar(ink) },
    t: { 'padding-top': '16px' }, m: { 'padding-top': '8px' }
  });
  C.findClass(card)!.st = { hover: { d: { 'background-color': '#ff0000' }, t: { 'background-color': '#00aa00' }, m: {} } };
  const source = C.insert('heading', null, 0)!;
  C.tsApply(source, 'lead');
  C.classApply(source, card);
  source.css.d['margin-top'] = '4px';
  source.st = { hover: { d: { color: C.cvar(ink) }, t: {}, m: {} } };
  expect(C.copyStyles(source.id)).toBe(true);
  return { C, ink, card, sourceId: source.id, doc: C.clone(C.doc()) };
}

/* Project B reuses every id with different meanings. */
async function projectBWithCollisions(ui = false) {
  const booted = await boot('cloud:B', ui);
  const C = booted.C;
  const r = booted.extra ? booted.extra.rig() : null;
  blank(C);
  expect(C.colorAdd('QA ink', '#ff00ff')).toBe('qa-ink');
  C.findColor('muted')!.value = '#00ff00';
  C.findStyle('lead')!.css = { d: { 'font-size': '40px' }, t: {}, m: {} };
  expect(C.classAdd('QA card', { d: { 'padding-top': '99px' }, t: {}, m: {} })).toBe('qa-card');
  const target = C.insert('heading', null, 0)!;
  C.hist.u.length = 0; C.hist.r.length = 0;
  C.selSet([target.id]);
  return { C, target, r, Inspector: booted.extra?.Inspector };
}

function expectInlinedLook(C: Core, id: string) {
  const t = C.locate(id)!.node;
  expect(t.props.ts).toBe('');
  expect(t.cls || []).toEqual([]);
  expect(JSON.stringify({ css: t.css, st: t.st })).not.toMatch(/var\(--/);
  // the element's own values
  expect(t.css.d['margin-top']).toBe('4px');
  // text style "lead" from A, not B's 40px, including its mobile value and its colour token
  expect(t.css.d['font-size']).toBe('18px');
  expect(t.css.m['font-size']).toBe('16px');
  expect(t.css.d['line-height']).toBe('1.65');
  expect(t.css.d.color).toBe('#445566');
  // class "QA card" from A on every device, with its colour token resolved
  expect(t.css.d['padding-top']).toBe('24px');
  expect(t.css.t['padding-top']).toBe('16px');
  expect(t.css.m['padding-top']).toBe('8px');
  expect(t.css.d['background-color']).toBe('#112233');
  // Hover from the class (desktop and tablet) and from the element itself
  expect(t.st!.hover!.d['background-color']).toBe('#ff0000');
  expect(t.st!.hover!.t['background-color']).toBe('#00aa00');
  expect(t.st!.hover!.d.color).toBe('#112233');
  // project B's definitions are untouched
  expect(C.findColor('qa-ink')!.value).toBe('#ff00ff');
  expect(C.findStyle('lead')!.css.d['font-size']).toBe('40px');
}

function expectAtomicHistory(C: Core, id: string, before: unknown) {
  const after = C.clone(C.locate(id)!.node);
  expect(C.hist.u.length).toBe(1);
  expect(C.historyLabel('undo')).toBe('Paste styles');
  C.undo();
  expect(C.locate(id)!.node).toEqual(before);
  expect(C.historyLabel('redo')).toBe('Paste styles');
  C.redo();
  expect(C.locate(id)!.node).toEqual(after);
  expect(C.historyLabel('undo')).toBe('Paste styles');
}

test('the style clipboard survives a reload', async () => {
  await copyInProjectA();
  expect(localStorage.getItem(KEY)).toBeTruthy();
  const { C } = await boot('cloud:A');
  blank(C);
  expect(C.styleClip.css).toBeTruthy();
  expect(C.styleClip.from).toBeTruthy();
  const t = C.insert('heading', null, 0)!;
  expect(C.menuFor([t.id]).some((m: any) => m.act === 'stpaste')).toBe(true);
});

test('Forget it clears the stored clipboard too', async () => {
  const { C } = await copyInProjectA();
  C.styleClipClear();
  expect(C.styleClip.css).toBeNull();
  expect(localStorage.getItem(KEY)).toBeNull();
  const again = await boot('cloud:A');
  expect(again.C.styleClip.css).toBeNull();
});

test('keyboard paste in another project inlines values and links nothing of the target', async () => {
  await copyInProjectA();
  const { C, target } = await projectBWithCollisions();
  const before = C.clone(target);
  const toast = vi.fn();
  const start = builder.indexOf("  if (meta && e.shiftKey && k === 'v') {");
  const end = builder.indexOf('  const oneDeep =', start);
  expect(start).toBeGreaterThan(0);
  const run = new Function('styleClip', 'stylePasteCheck', 'selIds', 'edit', 'pasteStylesMany', 'toast', 'e',
    'const meta = true, k = "v";\n' + builder.slice(start, end));
  run(C.styleClip, C.stylePasteCheck, C.selIds, C.edit, C.pasteStylesMany, toast, { shiftKey: true, preventDefault() {} });
  expect(toast).toHaveBeenCalledWith('Styles pasted');
  expect(toast).not.toHaveBeenCalledWith(expect.stringMatching(/No styles copied/));
  expectInlinedLook(C, target.id);
  expectAtomicHistory(C, target.id, before);
});

test('context menu paste in another project inlines values atomically', async () => {
  await copyInProjectA();
  const { C, target } = await projectBWithCollisions();
  const before = C.clone(target);
  const toast = vi.fn();
  const start = builder.indexOf("    case 'stpaste': {");
  const end = builder.indexOf("    case 'hide':", start);
  const run = new Function('styleClip', 'stylePasteCheck', 'edit', 'pasteStylesMany', 'list', 'toast',
    'switch ("stpaste") {' + builder.slice(start, end) + '}');
  run(C.styleClip, C.stylePasteCheck, C.edit, C.pasteStylesMany, [target.id], toast);
  expect(toast).toHaveBeenCalledWith('Styles pasted');
  expectInlinedLook(C, target.id);
  expectAtomicHistory(C, target.id, before);
});

test('Paste bar in another project inlines values atomically', async () => {
  await copyInProjectA();
  const { C, target, r, Inspector } = await projectBWithCollisions(true);
  const before = C.clone(target);
  const I = Inspector!;
  r!.draw(() => <I />, 'right');
  const paste = r!.$$('.stclip button').find(b => b.textContent?.trim() === 'Paste');
  expect(paste).toBeTruthy();
  act(() => paste!.click());
  expectInlinedLook(C, target.id);
  expectAtomicHistory(C, target.id, before);
  act(() => r!.draw(null)); r!.host.remove();
});

test('paste after a reload in the same project still links tokens, text styles and classes', async () => {
  const { ink, card, doc } = await copyInProjectA();
  const { C } = await boot('cloud:A');
  blank(C);
  C.restore(doc);
  C.hist.u.length = 0;
  const target = C.insert('heading', null, 1)!;
  C.edit(() => { C.pasteStylesMany([target.id]); }, 'Paste styles');
  const t = C.locate(target.id)!.node;
  expect(t.props.ts).toBe('lead');
  expect(t.cls).toEqual([card]);
  expect(t.css.d['padding-top']).toBeUndefined();
  expect(t.st!.hover!.d.color).toBe(C.cvar(ink));
});

test('same-project paste after a reload keeps the deleted-class message', async () => {
  const first = (await boot('cloud:A')).C;
  blank(first); first.ensureTokens().classes = [];
  const source = first.insert('heading', null, 0)!;
  first.insert('button', null, 1);
  const low = first.classAdd('Low'), high = first.classAdd('High');
  first.findClass(low)!.st = { focus: { d: { color: 'red' }, t: {}, m: {} } };
  first.findClass(high)!.st = { hover: { d: { color: 'blue' }, t: {}, m: {} } };
  first.classApply(source, low); first.classApply(source, high); first.copyStyles(source.id);
  first.classRemove(source, low); first.classDelete(low);
  const doc = first.clone(first.doc());
  const { C } = await boot('cloud:A');
  blank(C); C.restore(doc);
  expect(C.stylePasteCheck()).toEqual({ ok: false, reason: 'Copied styles use a deleted class. Copy the source styles again.' });
});

test('corrupt, malformed and old-version storage is dropped safely', async () => {
  for (const raw of ['{not json', JSON.stringify({ v: 0, project: 'cloud:A', clip: {} }),
    JSON.stringify({ v: 1, project: 'cloud:A', clip: { css: 'x' } }), '[]', 'null']) {
    localStorage.setItem(KEY, raw);
    const { C } = await boot('cloud:B');
    expect(C.styleClip.css).toBeNull();
    expect(C.styleClipLoad()).toBe(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  }
});

test('unavailable storage keeps the clipboard working in memory', async () => {
  vi.stubGlobal('localStorage', {
    getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); }, clear() {}
  });
  const { C } = await boot('cloud:A');
  blank(C);
  const a = C.insert('heading', null, 0)!, b = C.insert('heading', null, 1)!;
  a.css.d['margin-top'] = '7px';
  expect(C.copyStyles(a.id)).toBe(true);
  C.edit(() => { C.pasteStylesMany([b.id]); }, 'Paste styles');
  expect(C.locate(b.id)!.node.css.d['margin-top']).toBe('7px');
});

test('the editor tells core which project is open before anything can be copied', () => {
  const at = builder.indexOf('setStyleClipProject(');
  expect(at).toBeGreaterThan(0);
  expect(builder.slice(at, at + 200)).toMatch(/'cloud:' \+ SRV\.siteId/);
  expect(at).toBeLessThan(builder.indexOf("case 'stcopy'"));
});
