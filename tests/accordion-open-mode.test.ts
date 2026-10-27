import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.blankProject('Accordion open mode');
  C.state.ui = C.initUi();
  C.hist.u.length = 0;
  C.hist.r.length = 0;
});

const control = (key: 'open' | 'single') =>
  C.DEF.accordion.controls.content.find(item => item.k === key)!;

test('direct Accordion controls keep All open and One open at a time mutually valid in one undo step', () => {
  const accordion = C.insert('accordion', null, 0)!;

  C.edit(() => C.applyC(accordion, control('open'), 'all'));
  expect(accordion.props).toMatchObject({ open: 'all', single: 0 });
  expect(C.hist.u).toHaveLength(1);

  C.edit(() => C.applyC(accordion, control('single'), 1));
  expect(accordion.props).toMatchObject({ open: 'first', single: 1 });
  expect(C.hist.u).toHaveLength(2);
  C.undo();
  expect(C.locate(accordion.id)!.node.props).toMatchObject({ open: 'all', single: 0 });
  C.redo();
  expect(C.locate(accordion.id)!.node.props).toMatchObject({ open: 'first', single: 1 });

  const restored = C.locate(accordion.id)!.node;
  C.edit(() => C.applyC(restored, control('open'), 'all'));
  expect(restored.props).toMatchObject({ open: 'all', single: 0 });
  expect(C.hist.u).toHaveLength(3);
  C.undo();
  expect(C.locate(accordion.id)!.node.props).toMatchObject({ open: 'first', single: 1 });
  C.redo();
  expect(C.locate(accordion.id)!.node.props).toMatchObject({ open: 'all', single: 0 });
});

test('component Accordion controls repair only the edited instance and preserve peers and definition defaults', () => {
  const original = C.insert('box', null, 0)!;
  const accordion = C.insert('accordion', original, 0)!;
  Object.assign(accordion.props, { open: 'all', single: 0 });
  const componentId = C.componentFromNode(original.id, 'Accordion card')!;
  const definition = C.findComponent(componentId)!;
  const definitionAccordion = definition.node.children[0];
  const openProperty = C.propFromControl(componentId, definitionAccordion.id, control('open'))!;
  const singleProperty = C.propFromControl(componentId, definitionAccordion.id, control('single'))!;
  const peer = C.instanceInsert(componentId, null, C.tree().length)!;
  const singleControl = C.instControls(original).find(item => item.k === C.VAL + singleProperty)!;
  const openControl = C.instControls(original).find(item => item.k === C.VAL + openProperty)!;
  const defaults = C.clone(definition.props);
  C.hist.u.length = 0;
  C.hist.r.length = 0;

  C.edit(() => C.applyC(original, singleControl, 1));
  expect(C.instValue(original, definition, singleProperty)).toBe('1');
  expect(C.instValue(original, definition, openProperty)).toBe('first');
  expect(C.instValue(peer, definition, singleProperty)).toBe('0');
  expect(C.instValue(peer, definition, openProperty)).toBe('all');
  expect(definition.props).toEqual(defaults);
  expect(definitionAccordion.props).toMatchObject({ open: 'all', single: 0 });
  expect(C.hist.u).toHaveLength(1);

  C.undo();
  let current = C.locate(original.id)!.node;
  let currentDefinition = C.findComponent(componentId)!;
  expect(C.instValue(current, currentDefinition, singleProperty)).toBe('0');
  expect(C.instValue(current, currentDefinition, openProperty)).toBe('all');
  C.redo();
  current = C.locate(original.id)!.node;
  currentDefinition = C.findComponent(componentId)!;
  expect(C.instValue(current, currentDefinition, singleProperty)).toBe('1');
  expect(C.instValue(current, currentDefinition, openProperty)).toBe('first');

  C.edit(() => C.applyC(current, openControl, 'all'));
  expect(C.instValue(current, currentDefinition, openProperty)).toBe('all');
  expect(C.instValue(current, currentDefinition, singleProperty)).toBe('0');
  expect(C.instValue(C.locate(peer.id)!.node, currentDefinition, openProperty)).toBe('all');
  expect(C.instValue(C.locate(peer.id)!.node, currentDefinition, singleProperty)).toBe('0');
  expect(currentDefinition.props).toEqual(defaults);

  C.edit(() => C.applyC(current, { c: 'margin-top', r: 1 }, '24px'));
  expect(C.instValue(current, currentDefinition, openProperty)).toBe('all');
  expect(C.instValue(current, currentDefinition, singleProperty)).toBe('0');
});

test('component ownership limits never repair through CMS, an unexposed control, or a shared property default', () => {
  const makeComponent = (single: 0 | 1, exposeOpen: boolean) => {
    C.blankProject('Component Accordion ownership');
    const original = C.insert('box', null, 0)!;
    const accordion = C.insert('accordion', original, 0)!;
    Object.assign(accordion.props, { open: 'all', single });
    const componentId = C.componentFromNode(original.id, 'Accordion ownership')!;
    const definition = C.findComponent(componentId)!;
    const definitionAccordion = definition.node.children[0];
    const openProperty = exposeOpen
      ? C.propFromControl(componentId, definitionAccordion.id, control('open'))! : '';
    const singleProperty = C.propFromControl(componentId, definitionAccordion.id, control('single'))!;
    const peer = C.instanceInsert(componentId, null, C.tree().length)!;
    return { original, definition, definitionAccordion, openProperty, singleProperty, peer };
  };

  let setup = makeComponent(0, true);
  C.bindSet(setup.original, C.VAL + setup.openProperty, C.bindField('cms-open-mode'));
  C.edit(() => C.applyC(setup.original,
    C.instControls(setup.original).find(item => item.k === C.VAL + setup.singleProperty)!, 1));
  expect(C.boundField(setup.original, C.VAL + setup.openProperty)).toBe('cms-open-mode');
  expect(setup.original.vals).not.toHaveProperty(setup.openProperty);
  expect(C.instValue(setup.peer, setup.definition, setup.openProperty)).toBe('all');
  expect(setup.definition.props.find(item => item.k === setup.openProperty)!.def).toBe('all');

  setup = makeComponent(0, false);
  C.edit(() => C.applyC(setup.original,
    C.instControls(setup.original).find(item => item.k === C.VAL + setup.singleProperty)!, 1));
  expect(C.instValue(setup.original, setup.definition, setup.singleProperty)).toBe('1');
  expect(setup.definitionAccordion.props).toMatchObject({ open: 'all', single: 0 });
  expect(C.instValue(setup.peer, setup.definition, setup.singleProperty)).toBe('0');

  setup = makeComponent(1, false);
  const singleDefault = setup.definition.props.find(item => item.k === setup.singleProperty)!.def;
  setup.definitionAccordion.props.open = 'first';
  C.edit(() => C.applyC(setup.definitionAccordion, control('open'), 'all'));
  expect(setup.definitionAccordion.props).toMatchObject({ open: 'all', single: 0 });
  expect(setup.definition.props.find(item => item.k === setup.singleProperty)!.def).toBe(singleDefault);
  expect(C.instValue(setup.original, setup.definition, setup.singleProperty)).toBe('1');
  expect(C.instValue(setup.peer, setup.definition, setup.singleProperty)).toBe('1');
});

test('an unrelated style edit does not normalize a legacy invalid Accordion', () => {
  const accordion = C.insert('accordion', null, 0)!;
  Object.assign(accordion.props, { open: 'all', single: 1 });

  C.edit(() => C.applyC(accordion, { c: 'margin-top', r: 1 }, '18px'));

  expect(accordion.props).toMatchObject({ open: 'all', single: 1 });
  expect(accordion.css.d['margin-top']).toBe('18px');
});
