// @vitest-environment jsdom
import { beforeEach, test } from 'vitest';
import a from 'node:assert/strict';
import * as C from '../app/src/core/index';
import type { Node as PcNode } from '../app/src/core/types';

beforeEach(() => C.blankProject('Boolean binding rendering'));
const dom = (edit: boolean, context = {}) => {
  const before = JSON.stringify(C.doc());
  const html = C.renderList(C.tree(), { edit, ...context });
  a.equal(JSON.stringify(C.doc()), before, 'rendering does not normalize the stored document');
  return new DOMParser().parseFromString(html, 'text/html');
};
const expose = (cid: string, key: string) => {
  const definition = C.findComponent(cid)!;
  const control = C.DEF[definition.node.type].controls.content.find(c => c.k === key)!;
  a.ok(control);
  return C.propFromControl(cid, definition.node.id, control)!;
};

const checkImages = (decorative: boolean[], lazy: boolean[], context = {}) => {
  for (const edit of [true, false]) {
    const images = [...dom(edit, context).querySelectorAll('img')];
    a.equal(images.length, decorative.length);
    images.forEach((image, i) => {
      a.equal(image.getAttribute('alt'), decorative[i] ? '' : 'QA informative coffee table', `edit=${edit}, image${i} alt`);
      a.equal(image.hasAttribute('loading'), !edit && lazy[i], `edit=${edit}, image${i} lazy loading`);
    });
  }
};

test('Image default, local false, variant false, reset and restore render distinct alt/lazy semantics', () => {
  const original = C.insert('image', null, 0)!;
  Object.assign(original.props, { src: 'https://example.invalid/qa.png', alt: 'QA informative coffee table', decorative: 1, lazy: 1 });
  const cid = C.componentFromNode(original.id, 'Image flags')!;
  const decorative = expose(cid, 'decorative'), lazy = expose(cid, 'lazy');
  const second = C.instanceInsert(cid, null, C.tree().length)!;
  checkImages([true, true], [true, true]);
  C.instSet(second, decorative, '0'); C.instSet(second, lazy, '0');
  checkImages([true, false], [true, false]);
  C.variantFromInstance(second, 'Informative eager');
  checkImages([true, false], [true, false]);
  C.instSet(second, decorative, '1'); C.instSet(second, lazy, '1');
  checkImages([true, true], [true, true]);
  C.instSet(second, decorative, undefined); C.instSet(second, lazy, undefined);
  checkImages([true, false], [true, false]);
  const saved = JSON.parse(JSON.stringify(C.doc()));
  C.restore(C.migrate(saved)!);
  checkImages([true, false], [true, false]);
  a.equal(C.instValue(C.locate(second.id)!.node, C.findComponent(cid), decorative), '0');
});

for (const flag of ['controls', 'autoplay', 'muted', 'loop', 'facade']) {
  test(`Video ${flag} binding renders actual false/true DOM in editor and public output`, () => {
    const original = C.insert('video', null, 0)!;
    Object.assign(original.props, { src: flag === 'facade' ? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' : 'https://example.invalid/qa.mp4',
      autoplay: 0, muted: 0, loop: 0, facade: 0, controls: 1, [flag]: 1 });
    const cid = C.componentFromNode(original.id, 'Video flags')!;
    const key = expose(cid, flag), second = C.instanceInsert(cid, null, C.tree().length)!;
    C.instSet(second, key, '0');
    C.variantFromInstance(second, 'Off');
    const check = () => {
      for (const edit of [true, false]) {
        const rows = [...dom(edit).querySelectorAll('.pagecraft-video')];
        a.equal(rows.length, 2);
        rows.forEach((row, i) => flag === 'facade'
          ? a.equal(row.hasAttribute('data-facade'), i === 0, `edit=${edit} facade${i}`)
          : a.equal(row.querySelector('video')!.hasAttribute(flag), i === 0, `edit=${edit} ${flag}${i}`));
      }
    };
    check();
    C.instSet(second, key, '1');
    for (const edit of [true, false]) {
      const rows = [...dom(edit).querySelectorAll('.pagecraft-video')];
      a.equal(flag === 'facade' ? rows[1].hasAttribute('data-facade') : rows[1].querySelector('video')!.hasAttribute(flag), true);
    }
    C.instSet(second, key, undefined); check();
    C.restore(C.migrate(JSON.parse(JSON.stringify(C.doc())))!); check();
  });
}

test('CMS bool false reaches both direct toggle bindings and component-property mappings', () => {
  const original = C.insert('image', null, 0)!;
  Object.assign(original.props, { src: 'https://example.invalid/qa.png', alt: 'QA informative coffee table', decorative: 1, lazy: 1 });
  const cid = C.componentFromNode(original.id, 'CMS flags')!;
  const decorative = expose(cid, 'decorative'), lazy = expose(cid, 'lazy');
  const direct = C.insert('image', null, C.tree().length)!;
  Object.assign(direct.props, { src: 'https://example.invalid/direct.png', alt: 'QA informative coffee table', decorative: 1, lazy: 1 });
  const collection = C.collectionAdd('Flags')!, field = C.fieldAdd(collection.id, 'Enabled', 'bool')!;
  const item = C.itemAdd(collection.id)!;
  C.itemSet(collection.id, item.id, field.id, '0');
  C.bindSet(original, C.VAL + decorative, C.bindField(field.id));
  C.bindSet(original, C.VAL + lazy, C.bindField(field.id));
  for (const key of ['decorative', 'lazy']) {
    const control = C.DEF.image.controls.content.find(c => c.k === key)!;
    a.equal(C.cmsBindable(direct, control), true);
    a.deepEqual(C.cmsFieldTypes(control), ['bool']);
    C.bindSet(direct, key, C.bindField(field.id));
  }
  checkImages([false, false], [false, false], { col: collection, item });
  C.itemSet(collection.id, item.id, field.id, '1');
  checkImages([true, true], [true, true], { col: collection, item });
});

test('binding normalization follows toggle destinations and preserves text/select zero and raw storage', () => {
  const image = C.insert('image', null, 0)!;
  image.props.decorative = 1;
  const cid = C.componentFromNode(image.id, 'False values')!, key = expose(cid, 'decorative');
  const definition = C.findComponent(cid)!;
  for (const value of ['', '0', 'false', 0, false, null, undefined, '1', 'true', 1, true]) {
    image.vals = { [key]: value } as unknown as Record<string, string>;
    const before = structuredClone(C.doc());
    const resolvedValue = value === undefined ? '1' : value;
    a.equal(C.instValue(image, definition, key), resolvedValue, 'missing override falls back, explicit false/null stays explicit');
    const expected = !['', '0', 'false'].includes(String(resolvedValue ?? ''));
    a.equal(C.boundProps(definition.node, null, null, image, definition).decorative, expected ? 1 : 0);
    a.deepEqual(C.doc(), before);
  }
  const button = C.insert('button', null, C.tree().length)!;
  const buttonCid = C.componentFromNode(button.id, 'Literal zero')!;
  const text = expose(buttonCid, 'text'), select = expose(buttonCid, 'variant');
  C.instSet(button, text, '0'); C.instSet(button, select, '0');
  const buttonDef = C.findComponent(buttonCid)!;
  const resolved = C.boundProps(buttonDef.node, null, null, button, buttonDef);
  a.equal(resolved.text, '0'); a.equal(resolved.variant, '0');
  for (const edit of [true, false]) a.equal(dom(edit).querySelector('.pagecraft-button > span')?.textContent, '0');
  const collection = C.collectionAdd('Zero values')!, field = C.fieldAdd(collection.id, 'Zero', 'number')!;
  const item = C.itemAdd(collection.id)!; C.itemSet(collection.id, item.id, field.id, '0');
  const direct = C.insert('button', null, C.tree().length)!;
  for (const k of ['text', 'variant']) C.bindSet(direct, k, C.bindField(field.id));
  C.bindSet(button, C.VAL + text, C.bindField(field.id));
  C.bindSet(button, C.VAL + select, C.bindField(field.id));
  for (const [node, instance, def] of [[direct, null, null], [buttonDef.node, button, buttonDef]] as const) {
    const got = C.boundProps(node, collection, item, instance, def);
    a.equal(got.text, '0'); a.equal(got.variant, '0');
  }
});


test('all 18 declared toggle destinations normalize bound zero/one without changing storage', () => {
  const controls = Object.entries(C.DEF).flatMap(([type, definition]) =>
    definition.controls.content.filter(control => control.t === 'toggle' && control.k)
      .map(control => ({ type: type as PcNode['type'], key: control.k! })));
  a.equal(controls.length, 18, 'finite current toggle destination catalogue');
  for (const { type, key } of controls) {
    C.blankProject('Toggle destination ' + type + '.' + key);
    const instance = C.insert(type, null, 0)!;
    const cid = C.componentFromNode(instance.id, 'Toggle ' + key)!;
    const property = expose(cid, key), definition = C.findComponent(cid)!;
    for (const value of ['0', '1']) {
      C.instSet(instance, property, value);
      const before = JSON.stringify(C.doc());
      const resolved = C.boundProps(definition.node, null, null, instance, definition) as Record<string, unknown>;
      a.equal(resolved[key], Number(value), type + '.' + key);
      a.equal(C.instValue(instance, definition, property), value);
      a.equal(JSON.stringify(C.doc()), before);
    }
  }
});

test('Slider arrow controls and Accordion exclusive groups follow false/true bindings in actual output', () => {
  for (const [type, key, selector] of [['slider', 'arrows', '[data-slide-p]'], ['accordion', 'single', 'details[name]']] as const) {
    C.blankProject('Rendered ' + key);
    const instance = C.insert(type, null, 0)!;
    const cid = C.componentFromNode(instance.id, 'Rendered toggle')!, property = expose(cid, key);
    for (const value of ['0', '1']) {
      C.instSet(instance, property, value);
      for (const edit of [true, false]) a.equal(!!dom(edit).querySelector(selector), value === '1', type + ', edit=' + edit);
    }
  }
});
