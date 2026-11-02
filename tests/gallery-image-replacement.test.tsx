// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act } from 'preact/test-utils';
import { render } from 'preact';
import * as C from '../app/src/core/index';
import { L } from '../app/src/ui/ctx';
import { Ctl } from '../app/src/ui/inspector/Controls';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { render(null, r.host); r.host.remove(); vi.restoreAllMocks(); });

function fixture() {
  const gallery = C.insert('gallery', null, 0)!;
  gallery.props.items = [
    { src: 'asset:old', alt: 'Original description', caption: 'Original caption', w: '800', h: '600' },
    { src: 'asset:peer', alt: 'Peer description', caption: 'Peer caption', w: '400', h: '400' }
  ];
  L.asset = id => id === 'replacement' ? { url: 'blob:replacement', name: 'Replacement', size: 100, w: 1200, h: 900 } : null;
  r.draw(() => {
    const current = C.locate(gallery.id)?.node;
    return current ? <Ctl n={current} c={{ t: 'imgs', k: 'items', label: 'Gallery' }} /> : null;
  }, 'right');
  return gallery;
}
function replaceButton() {
  const button = r.$('button[aria-label="Replace image 1"]');
  expect(button).not.toBeNull();
  return button!;
}
function deferredPicker() {
  let finish!: (id: string | null) => void;
  L.mediaPicker = vi.fn(() => new Promise<string | null>(resolve => { finish = resolve; }));
  return (id: string | null) => finish(id);
}

test('replacing one Gallery image preserves its copy, order and peers in one Undo step', async () => {
  const gallery = fixture();
  const before = JSON.stringify(C.doc());
  const undo = C.hist.u.length;
  L.mediaPicker = vi.fn(async () => 'replacement');
  expect(replaceButton().getAttribute('title')).toBe('Replace image');
  await act(async () => r.click(replaceButton()));
  expect(L.mediaPicker).toHaveBeenCalledWith({ title: 'Replace image 1', multiple: false });
  expect(gallery.props.items).toEqual([
    { src: 'asset:replacement', alt: 'Original description', caption: 'Original caption', w: '1200', h: '900' },
    { src: 'asset:peer', alt: 'Peer description', caption: 'Peer caption', w: '400', h: '400' }
  ]);
  expect(C.hist.u.length).toBe(undo + 1);
  const after = JSON.stringify(C.doc());
  C.undo(); expect(JSON.stringify(C.doc())).toBe(before);
  C.redo(); expect(JSON.stringify(C.doc())).toBe(after);
});

for (const outcome of ['cancel', 'missing asset', 'failure'] as const) test(`Gallery replacement ${outcome} leaves the document and history exact`, async () => {
  fixture();
  const before = JSON.stringify(C.doc()), undo = C.hist.u.length;
  L.mediaPicker = vi.fn(async () => {
    if (outcome === 'failure') throw new Error('Picker unavailable');
    return outcome === 'cancel' ? null : 'missing';
  });
  await act(async () => r.click(replaceButton()));
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u.length).toBe(undo);
  expect(replaceButton().hasAttribute('disabled')).toBe(false);
  if (outcome === 'failure') expect(r.names()).toContain('toast');
});

test('a Gallery row reordered while its picker is open keeps its replacement and latest copy', async () => {
  const gallery = fixture(), finish = deferredPicker();
  await act(() => r.click(replaceButton()));
  const items = gallery.props.items as any[];
  C.edit(() => { items[0].alt = 'New description'; [items[0], items[1]] = [items[1], items[0]]; });
  await act(async () => finish('replacement'));
  expect(items[0].src).toBe('asset:peer');
  expect(items[1]).toMatchObject({ src: 'asset:replacement', alt: 'New description', caption: 'Original caption' });
});

for (const change of ['remove row', 'replace row', 'change source', 'remove gallery', 'Undo'] as const) test(`Gallery replacement ignores a stale target after ${change}`, async () => {
  const gallery = fixture(), finish = deferredPicker();
  if (change === 'Undo') C.edit(() => { gallery.props.caption = 'History marker'; });
  await act(() => r.click(replaceButton()));
  if (change === 'Undo') C.undo();
  else C.edit(() => {
    if (change === 'remove gallery') C.delNode(gallery.id);
    else if (change === 'change source') (gallery.props.items as any[])[0].src = 'asset:other';
    else if (change === 'remove row') (gallery.props.items as any[]).shift();
    else (gallery.props.items as any[])[0] = { src: 'asset:other' };
  });
  const before = JSON.stringify(C.doc()), undo = C.hist.u.length;
  await act(async () => finish('replacement'));
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u.length).toBe(undo);
});

test('Gallery replacement clears stale dimensions when the selected media has none', async () => {
  const gallery = fixture();
  L.asset = () => ({ url: 'blob:vector', name: 'Vector', size: 30 });
  L.mediaPicker = vi.fn(async () => 'vector');
  await act(async () => r.click(replaceButton()));
  expect((gallery.props.items as any[])[0]).toEqual({
    src: 'asset:vector', alt: 'Original description', caption: 'Original caption', w: '', h: ''
  });
});

test('choosing the same Gallery image with unchanged dimensions adds no history', async () => {
  fixture();
  L.asset = () => ({ url: 'blob:old', name: 'Original', size: 100, w: 800, h: 600 });
  L.mediaPicker = vi.fn(async () => 'old');
  const before = JSON.stringify(C.doc()), undo = C.hist.u.length;
  await act(async () => r.click(replaceButton()));
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u.length).toBe(undo);
});
