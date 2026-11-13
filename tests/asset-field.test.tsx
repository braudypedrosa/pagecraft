// @vitest-environment jsdom
import {afterEach, expect, test, vi} from 'vitest';
import {act} from 'preact/test-utils';
import {render} from 'preact';
import * as C from '../app/src/core/index';
import {AssetField} from '../app/src/ui/AssetField';
import {CmsWorkspace} from '../app/src/ui/CmsWorkspace';
import {L} from '../app/src/ui/ctx';
import {rig, type Rig} from './ui.setup';

let activeRig: Rig | null = null;

afterEach(() => {
  if (activeRig) { render(null, activeRig.host); activeRig.host.remove(); activeRig = null; }
  window.__pcFeedback?.destroy();
  vi.restoreAllMocks();
});

test('removing an image does not bubble into the newly rendered upload dropzone', async () => {
  activeRig = rig({asset: id => ({id, url: `blob:${id}`, name: `${id}.png`, size: 100, w: 640, h: 480})});
  let value = 'asset:old';
  const draw = () => activeRig!.draw(<AssetField value={value} onChange={next => { value = next; draw(); }} />);
  L.mediaPicker = vi.fn(async () => null);
  L.writeNow = vi.fn();
  L.toast = vi.fn();
  draw();

  await act(async () => activeRig!.click(activeRig!.$('button.x')));

  expect(L.writeNow).toHaveBeenCalledTimes(1);
  expect(L.toast).toHaveBeenCalledWith('Image removed from this field.');
  expect(L.mediaPicker).not.toHaveBeenCalled();
  expect(activeRig.$('.imgdrop')).not.toBeNull();
});

test('CMS image removal rerenders the real entry field without opening a chooser', async () => {
  activeRig = rig({asset: id => ({id, url: `blob:${id}`, name: `${id}.png`, size: 100, w: 640, h: 480})});
  const collection = C.collectionAdd('Photos');
  collection.fields = [{id: 'photo', name: 'Photo', type: 'image'}];
  collection.items = [{id: 'photo-1', slug: 'photo-1', draft: 1, values: {photo: 'asset:old'}}];
  L.mediaPicker = vi.fn(async () => null);
  L.writeNow = vi.fn();
  L.toast = vi.fn();
  activeRig.draw(<CmsWorkspace collectionId={collection.id} close={() => {}} />);

  await act(async () => activeRig!.click(activeRig!.$('.cms-entry-open')));
  await act(async () => activeRig!.click(activeRig!.$('button.x')));

  expect(L.mediaPicker).not.toHaveBeenCalled();
  expect(activeRig.$('.imgdrop')).not.toBeNull();
  expect(L.toast).toHaveBeenCalledWith('Image removed from this field.');
});

test('image upload and library buttons still open their intended pickers', async () => {
  activeRig = rig({asset: id => ({id, url: `blob:${id}`, name: `${id}.png`, size: 100, w: 640, h: 480})});
  L.mediaPicker = vi.fn(async () => null);
  activeRig.draw(<AssetField value="asset:old" onChange={() => {}} />);

  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Replace'))!));
  expect(L.mediaPicker).toHaveBeenLastCalledWith(expect.objectContaining({title: 'Replace image', view: 'upload'}));
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Library'))!));
  expect(L.mediaPicker).toHaveBeenLastCalledWith({title: 'Replace image'});
});
