import { beforeEach, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };

beforeEach(() => {
  C.blankProject('Slotless insertion');
  C.state.pages[0].tree = [];
  C.state.ui.sel = null;
  C.state.ui.mode = 'page';
});

function slotlessInstance() {
  const root = C.N('section', {}, {}, [
    C.N('row', {}, {}, [C.N('column', {}, {}, [C.N('heading', { text: 'Outer' })])])
  ]);
  C.state.pages[0].tree.push(root);
  const componentId = C.componentFromNode(root.id, 'Outer');
  expect(componentId).toBeTruthy();
  return C.locate(root.id)!.node;
}

function bodyText() {
  const dom = new JSDOM(C.buildPage(C.state.pages[0]));
  try { return dom.window.document.body.textContent || ''; } finally { dom.window.close(); }
}

test('smartTarget skips a selected slotless component instance', () => {
  const instance = slotlessInstance();
  C.state.ui.sel = instance.id;

  const [container, index] = C.smartTarget('tabs');

  expect(container).toBeNull();
  expect(index).toBe(1);
});

test('direct insertion redirects a slotless component parent instead of storing hidden content', () => {
  const instance = slotlessInstance();
  const before = instance.children.length;

  const made = C.insert('tabs', instance, 0);

  expect(made).toBeTruthy();
  expect(instance.children).toHaveLength(before);
  expect(C.state.pages[0].tree).toHaveLength(2);
  expect(C.locate(made!.id)!.parent?.id).not.toBe(instance.id);
});

test('omitted-parent library, pattern, component, and paste paths all stay outside a slotless instance', () => {
  const instance = slotlessInstance();
  const source = C.insert('heading', null, 1)!;
  source.props.text = 'Block visible';
  C.state.ui.sel = instance.id;
  const componentId = instance.use!;
  const blockId = C.blockSave(source.id, 'Saved heading');
  expect(blockId).toBeTruthy();

  const before = instance.children.length;
  const block = C.blockInsert(blockId!);
  expect(block).toBeTruthy();
  expect(bodyText()).toContain('Block visible');
  const component = C.instanceInsert(componentId);
  expect(component).toBeTruthy();
  expect(bodyText()).toContain('Outer');
  const pattern = C.patternInsert(C.PATTERNS[0].id);
  expect(pattern).toBeTruthy();
  expect(bodyText()).toContain('A headline with weight');
  expect(C.copyNode(source.id)).toBe(true);
  const pasted = C.pasteNode(instance.id);
  expect(pasted).toBeTruthy();
  expect(bodyText().match(/Block visible/g)?.length).toBeGreaterThanOrEqual(3);

  expect(instance.children).toHaveLength(before);
  expect(C.state.pages[0].tree.length).toBeGreaterThan(1);
});

test('explicit library parents redirect outside a slotless instance and preserve fresh-node placement', () => {
  const instance = slotlessInstance();
  const source = C.insert('heading', null, 1)!;
  const blockId = C.blockSave(source.id, 'Explicit heading')!;
  const componentId = instance.use!;
  const before = instance.children.length;

  const block = C.blockInsert(blockId, instance, 0);
  const component = C.instanceInsert(componentId, instance, 0);
  const pattern = C.patternInsert(C.PATTERNS[0].id, instance, 0);

  expect(block && component && pattern).toBeTruthy();
  expect(instance.children).toHaveLength(before);
  expect(C.locate(block!.id)!.parent?.id).not.toBe(instance.id);
  expect(C.locate(component!.id)!.parent?.id).not.toBe(instance.id);
  expect(C.locate(pattern!.id)!.parent?.id).not.toBe(instance.id);
  expect(bodyText()).toContain('A headline that carries weight');
});

test('Navigator inside targets reject slotless instances but preserve sibling targets', () => {
  const instance = slotlessInstance();

  expect(C.layerTarget(instance.id, 'inside', 'tabs')).toBeNull();
  expect(C.layerTarget(instance.id, 'after', 'section')).toMatchObject({ container: null, index: 1 });
});

test('declared slots preserve instance insertion and output', () => {
  const root = C.N('section', {}, {}, [
    C.N('row', {}, {}, [C.N('column', {}, {}, [C.N('heading', { text: 'Default' })])])
  ]);
  C.state.pages[0].tree.push(root);
  const componentId = C.componentFromNode(root.id, 'Slotted outer');
  const definition = C.findComponent(componentId!);
  expect(definition).toBeTruthy();
  const slotNode = definition!.node.children[0];
  expect(C.slotMark(componentId!, slotNode.id, 'body')).toBe(true);
  const instance = C.locate(root.id)!.node;
  C.state.ui.sel = instance.id;

  const [target] = C.smartTarget('heading');
  expect(target?.id).toBe(instance.id);
  const made = C.insert('heading', instance, 0);
  expect(made).toBeTruthy();
  made!.props.text = 'Visible slot content';
  expect(instance.children).toHaveLength(1);
  expect(C.buildPage(C.state.pages[0])).toContain('Visible slot content');
});

test('multiple slots preserve explicit slot routing', () => {
  const root = C.N('section', {}, {}, [
    C.N('row', {}, {}, [C.N('column', {}, {}, [C.N('heading', { text: 'First default' })])]),
    C.N('row', {}, {}, [C.N('column', {}, {}, [C.N('heading', { text: 'Second default' })])])
  ]);
  C.state.pages[0].tree.push(root);
  const componentId = C.componentFromNode(root.id, 'Two slots')!;
  const definition = C.findComponent(componentId)!;
  expect(C.slotMark(componentId, definition.node.children[0].id, 'first')).toBe(true);
  expect(C.slotMark(componentId, definition.node.children[1].id, 'second')).toBe(true);
  const instance = C.locate(root.id)!.node;
  const first = C.insert('heading', instance, 0)!;
  first.props.text = 'First supplied';
  const second = C.insert('heading', instance, 1)!;
  second.props.text = 'Second supplied';
  second.slot = 'second';

  const text = bodyText();
  expect(text).toContain('First supplied');
  expect(text).toContain('Second supplied');
  expect(instance.children).toHaveLength(2);
});

test('component edit mode keeps the throwaway root and no-selection rules', () => {
  const instance = slotlessInstance();
  const componentId = instance.use!;
  expect(C.componentOpen(componentId)).toBe(true);
  C.state.ui.sel = null;
  const root = C.findComponent(componentId)!.node;
  const before = JSON.stringify(root);

  const [target] = C.smartTarget('heading');
  expect(target?.id).toBe(root.id);
  expect(C.insert('heading', null, 0)).toBeNull();
  expect(C.dropTree(C.N('heading', { text: 'lost' }), null)).toBeNull();
  expect(JSON.stringify(root)).toBe(before);
});

test('ordinary wrapper destinations and list card initialization remain unchanged', () => {
  const section = C.N('section');
  C.state.pages[0].tree.push(section);
  const row = C.N('row');
  section.children.push(row);
  const heading = C.dropTree(C.N('heading', { text: 'Wrapped' }), row.id);
  expect(heading).toBeTruthy();
  expect(row.children).toHaveLength(1);
  expect(bodyText()).toContain('Wrapped');

  const instance = slotlessInstance();
  const list = C.insert('list', instance, 0);
  expect(list).toBeTruthy();
  expect(list!.children[0]?.type).toBe('column');
  expect(instance.children).toHaveLength(0);
  const dom = new JSDOM(C.renderNode(list!, { edit: true }));
  try { expect(dom.window.document.querySelector('.pagecraft-list')).not.toBeNull(); }
  finally { dom.window.close(); }
});
