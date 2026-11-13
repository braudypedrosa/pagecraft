// @vitest-environment jsdom
import {afterEach, expect, test, vi} from 'vitest';
import {act} from 'preact/test-utils';
import {render} from 'preact';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as C from '../app/src/core/index';
import {AssetField} from '../app/src/ui/AssetField';
import {Ctl} from '../app/src/ui/inspector/Controls';
import {L} from '../app/src/ui/ctx';
import {rig, type Rig} from './ui.setup';

let activeRig: Rig | null = null;
afterEach(() => {
  if (activeRig) { render(null, activeRig.host); activeRig.host.remove(); activeRig = null; }
  window.__pcFeedback?.destroy();
  vi.restoreAllMocks();
});

const asset = (id: string) => ({id, url:'blob:' + id, name:id + '.png', size:100, w:640, h:480});

test.each([
  ['field', () => <AssetField value="asset:old" onChange={() => {}} />],
  ['inspector', () => {
    const image = C.insert('image', null, 0)!;
    image.props.src = 'asset:old';
    return <Ctl n={image} c={{t:'img', k:'src', label:'Image'}} />;
  }],
] as const)('%s image controls name replacement and choice pickers before opening them', async (_surface, view) => {
  activeRig = rig({asset: id => asset(id)});
  L.mediaPicker = vi.fn(async () => null);
  activeRig.draw(view());
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Replace'))!));
  expect(L.mediaPicker).toHaveBeenLastCalledWith(expect.objectContaining({title:'Replace image', view:'upload'}));
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Library'))!));
  expect(L.mediaPicker).toHaveBeenLastCalledWith({title:'Replace image'});
});

test('component image property library choices change only the local value and undo atomically', async () => {
  activeRig = rig({asset: id => asset(id)});
  C.seed(); C.blankProject('Component image property QA');
  const box = C.insert('box', null, 0)!;
  const componentId = C.componentFromNode(box.id, 'Image card')!;
  const property = C.propAdd(componentId, 'Photo', 'img', 'asset:old')!;
  const instanceId = box.id;
  const instance = C.locate(instanceId)!.node;
  instance.props.w = '777'; instance.props.h = '333';
  const control = C.instControls(instance).find(item => item.k === C.VAL + property)!;
  C.hist.u.length = 0; C.hist.r.length = 0;
  L.mediaPicker = vi.fn(async () => 'new');

  activeRig.draw(<Ctl n={instance} c={control} />);
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Library'))!));

  expect(C.locate(instanceId)!.node.vals).toEqual({[property]:'asset:new'});
  expect(C.locate(instanceId)!.node.props).toMatchObject({w:'777', h:'333'});
  expect(C.hist.u).toHaveLength(1);
  C.undo();
  expect(C.locate(instanceId)!.node.vals).toBeUndefined();
  expect(C.locate(instanceId)!.node.props).toMatchObject({w:'777', h:'333'});
  C.redo();
  expect(C.locate(instanceId)!.node.vals).toEqual({[property]:'asset:new'});
  expect(C.locate(instanceId)!.node.props).toMatchObject({w:'777', h:'333'});
});

test('direct image library choices still adopt intrinsic dimensions', async () => {
  activeRig = rig({asset: id => asset(id)});
  C.seed(); C.blankProject('Direct image dimensions QA');
  const image = C.insert('image', null, 0)!;
  image.props.src = 'asset:old';
  L.mediaPicker = vi.fn(async () => 'new');

  activeRig.draw(<Ctl n={image} c={{t:'img', k:'src', label:'Image'}} />);
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Library'))!));

  expect(image.props).toMatchObject({src:'asset:new', w:'640', h:'480'});
});

test('multi-image replacement adopts every selected image dimension in one history step', async () => {
  activeRig = rig({asset: id => ({...asset(id), w:400, h:800})});
  C.seed(); C.blankProject('Multi-image dimensions QA');
  const first = C.insert('image', null, 0)!;
  const second = C.insert('image', null, 1)!;
  const untouched = C.insert('image', null, 2)!;
  const heading = C.insert('heading', null, 3)!;
  Object.assign(first.props, {src:'asset:wide', w:'1200', h:'300'});
  Object.assign(second.props, {src:'asset:square', w:'640', h:'640'});
  Object.assign(untouched.props, {src:'asset:peer', w:'900', h:'600'});
  C.selSet([first.id, second.id, heading.id]);
  C.hist.u.length = 0; C.hist.r.length = 0;
  const before = JSON.stringify(C.doc());
  const untouchedBefore = JSON.stringify(untouched);
  const headingBefore = JSON.stringify(heading);
  L.mediaPicker = vi.fn(async () => 'portrait');

  activeRig.draw(<Ctl n={first} c={{t:'img', k:'src', label:'Image'}} />);
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Library'))!));

  for (const id of [first.id, second.id]) {
    expect(C.locate(id)!.node.props).toMatchObject({src:'asset:portrait', w:'400', h:'800'});
  }
  expect(JSON.stringify(C.locate(untouched.id)!.node)).toBe(untouchedBefore);
  expect(JSON.stringify(C.locate(heading.id)!.node)).toBe(headingBefore);
  expect(C.hist.u).toHaveLength(1);
  const after = JSON.stringify(C.doc());
  C.undo();
  expect(JSON.stringify(C.doc())).toBe(before);
  C.redo();
  expect(JSON.stringify(C.doc())).toBe(after);
});

test('background image library choices remain dimensionless', async () => {
  activeRig = rig({asset: id => asset(id)});
  C.seed(); C.blankProject('Background image dimensions QA');
  const box = C.insert('box', null, 0)!;
  box.css.d['background-image'] = 'url("asset:old")';
  box.props.w = '777'; box.props.h = '333';
  L.mediaPicker = vi.fn(async () => 'new');

  activeRig.draw(<Ctl n={box} c={{t:'img', c:'background-image', label:'Background image', bg:1}} />);
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Library'))!));

  expect(box.css.d['background-image']).toBe('url("asset:new")');
  expect(box.props).toMatchObject({w:'777', h:'333'});
});

test('an empty field names its picker Choose image and disabled fields ignore upload gestures', async () => {
  activeRig = rig({asset: id => asset(id)});
  L.mediaPicker = vi.fn(async () => null);
  L.mediaTake = vi.fn(async () => 'new');
  activeRig.draw(<AssetField value="" onChange={() => {}} />);
  await act(async () => activeRig!.click(activeRig!.$$('button').find(button => button.textContent?.includes('Upload'))!));
  expect(L.mediaPicker).toHaveBeenLastCalledWith(expect.objectContaining({title:'Choose image', view:'upload'}));
  vi.mocked(L.mediaPicker).mockClear();
  activeRig.draw(<AssetField value="" disabled onChange={() => {}} />);
  expect(activeRig.$$('.pc-field-actions button').every(button => (button as HTMLButtonElement).disabled)).toBe(true);
  const drop = new Event('drop', {bubbles:true, cancelable:true});
  Object.defineProperty(drop, 'dataTransfer', {value:{files:[new File(['x'], 'new.png', {type:'image/png'})]}});
  activeRig.$('.imgdrop')!.dispatchEvent(drop);
  activeRig.$('.imgdrop')!.click();
  expect(L.mediaTake).not.toHaveBeenCalled();
  expect(L.mediaPicker).not.toHaveBeenCalled();
});

function intentHarness() {
  C.seed(); C.blankProject('Media intent QA');
  const image = C.N('image', {src:'asset:old', alt:'Meaningful alt', caption:'Keep caption'});
  image.css.d.width = '72%';
  const sibling = C.N('text', {html:'<p>Sibling</p>'});
  const column = C.N('column', {}, {}, [image, sibling]);
  C.state.pages[0].tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [column])])];
  C.state.ui.mode = 'page'; C.state.cur = 0; C.selSet([image.id]);
  C.hist.u.length = 0; C.hist.r.length = 0;
  const assets = new Map([['old', asset('old')], ['new', asset('new')]]);
  const context = {
    state:C.state, multiOn:C.multiOn, locate:C.locate, page:C.page,
    findComponent:C.findComponent, nameOf:C.nameOf, AS:{mem:assets}, edit:C.edit,
    insert:C.insert, smartTarget:C.smartTarget, selSet:C.selSet, Object, String,
  };
  const source = readFileSync('builder.html', 'utf8');
  const start = source.indexOf('function mediaSelectedImageTarget()');
  const end = source.indexOf('function mediaModal()', start);
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  return {context:context as typeof context & {
    mediaSelectedImageTarget(): any;
    mediaApplyIntent(intent:string, target:any, assetId:string): string;
  }, image, sibling};
}

test('replace uses the captured Image after selection changes and preserves its semantics and layout', () => {
  const {context, image, sibling} = intentHarness();
  const target = context.mediaSelectedImageTarget();
  expect(target.label).toContain('Meaningful alt');
  C.selSet([sibling.id]);
  expect(context.mediaApplyIntent('replace', target, 'new')).toBe('replaced');
  const current = C.locate(image.id)!.node;
  expect(current.props).toMatchObject({src:'asset:new', alt:'Meaningful alt', caption:'Keep caption', w:'640', h:'480'});
  expect(current.css.d.width).toBe('72%');
  expect(C.state.ui.sel).toBe(sibling.id);
  C.undo();
  expect(C.locate(image.id)!.node.props.src).toBe('asset:old');
});

test('replace reacquires the captured target after Undo and refuses a changed target', () => {
  const {context, image} = intentHarness();
  const target = context.mediaSelectedImageTarget();
  C.edit(() => { C.locate(image.id)!.node.props.caption = 'Temporary'; });
  C.undo();
  expect(C.locate(image.id)!.node).not.toBe(image);
  expect(context.mediaApplyIntent('replace', target, 'new')).toBe('replaced');
  C.undo();
  C.edit(() => { C.locate(image.id)!.node.props.src = 'asset:intervening'; });
  const depth = C.hist.u.length;
  expect(context.mediaApplyIntent('replace', target, 'new')).toBe('stale');
  expect(C.locate(image.id)!.node.props.src).toBe('asset:intervening');
  expect(C.hist.u).toHaveLength(depth);
});

test('insert creates a distinct undoable Image and capturing or canceling changes nothing', () => {
  const {context, image} = intentHarness();
  const before = JSON.stringify(C.doc()), depth = C.hist.u.length;
  const target = context.mediaSelectedImageTarget();
  expect(JSON.stringify(C.doc())).toBe(before);
  expect(C.hist.u).toHaveLength(depth);
  expect(context.mediaApplyIntent('insert', target, 'new')).toBe('inserted');
  const images: any[] = [];
  C.eachNode(C.tree(), node => { if (node.type === 'image') images.push(node); });
  expect(images).toHaveLength(2);
  expect(C.locate(image.id)!.node.props.src).toBe('asset:old');
  expect(images.find(node => node.id !== image.id)?.props.src).toBe('asset:new');
  C.undo();
  const restored: any[] = [];
  C.eachNode(C.tree(), node => { if (node.type === 'image') restored.push(node); });
  expect(restored).toHaveLength(1);
});
