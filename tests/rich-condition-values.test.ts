import { beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as C from '../app/src/core/index';
import type { CondOp } from '../app/src/core/types';

beforeEach(() => {
  C.seed(); C.state.ui = C.initUi(); C.blankProject('Rich condition QA');
  C.state.meta.collections = []; C.state.meta.components = [];
});

function fieldFixture(type: 'rich' | 'text' = 'rich') {
  const col = C.collectionAdd('Workshops')!;
  const field = C.fieldAdd(col.id, 'Details', type)!;
  const item = C.itemAdd(col.id)!;
  const node = C.N('text', { html: '<p>Visible workshop</p>' });
  return { col, field, item, node };
}

function richResult(html: string, op: CondOp, value = '') {
  const { col, field, item, node } = fieldFixture();
  C.itemSet(col.id, item.id, field.id, html);
  C.condSet(node, { bind: C.bindField(field.id)!, op, value });
  return C.showsNode(node, col, item);
}

test('rich equality compares visible text while retaining exact stored-markup matches', () => {
  const html = '<p>Seasonal <strong>workshop</strong></p>';
  assert.equal(richResult(html, 'eq', 'Seasonal workshop'), true);
  assert.equal(richResult(html, 'ne', 'Seasonal workshop'), false);
  assert.equal(richResult(html, 'eq', html), true, 'existing markup comparison remains valid');
  assert.equal(richResult(html, 'ne', html), false);
  assert.equal(richResult(html, 'eq', 'Other workshop'), false);
  assert.equal(richResult(html, 'ne', 'Other workshop'), true);
});

test('inline formatting does not invent word breaks, while blocks and breaks separate words', () => {
  assert.equal(richResult('<p>work<strong>shop</strong></p>', 'eq', 'workshop'), true);
  assert.equal(richResult('<p>Morning</p><p>workshop<br>today</p>', 'eq', 'Morning workshop today'), true);
  assert.equal(richResult('<ul><li>Morning</li><li>workshop</li></ul>', 'eq', 'Morning workshop'), true);
});

test('rich text decodes named and numeric references once after removing markup', () => {
  assert.equal(richResult('<p>Caf&eacute;&nbsp;&amp; &#x1f33f; &#8212; &copy;</p>', 'eq', 'Café & 🌿 — ©'), true);
  assert.equal(richResult('<p>&lt;sample&gt; &amp;lt;</p>', 'eq', '<sample> &lt;'), true);
  assert.equal(richResult('<p>A &NotEqualTilde; B</p>', 'eq', 'A ≂̸ B'), true);
  assert.equal(richResult('<p>&copy coffee &notit; &#x1f33f</p>', 'eq', '© coffee ¬it; 🌿'), true);
  assert.equal(richResult('<p>Morning&emsp;workshop</p>', 'eq', 'Morning workshop'), true);
});

test('HTML-only whitespace is empty for every operator', () => {
  for (const html of ['<p><br></p>', '<div>&nbsp; &#32;\n</div>', '<p><strong></strong></p>']) {
    assert.equal(richResult(html, 'set'), false, html);
    assert.equal(richResult(html, 'empty'), true, html);
    assert.equal(richResult(html, 'eq', ''), true, html);
    assert.equal(richResult(html, 'ne', ''), false, html);
    assert.equal(richResult(html, 'eq', html), true, 'raw HTML compatibility');
  }
});

test('quoted tag delimiters and dropped code are handled by the rich sanitizer', () => {
  assert.equal(richResult('<p><a href="https://example.com/?q=>">Workshop</a></p>', 'eq', 'Workshop'), true);
  assert.equal(richResult('<script>not content</script><style>not content</style><!-- hidden -->', 'empty'), true);
  assert.equal(richResult('<p>Visible <b>words', 'eq', 'Visible words'), true);
});

test('plain Text field comparisons keep literal markup and entities unchanged', () => {
  const { col, field, item, node } = fieldFixture('text');
  C.itemSet(col.id, item.id, field.id, '<sample> &amp;');
  C.condSet(node, { bind: C.bindField(field.id)!, op: 'eq', value: '<sample> &amp;' });
  assert.equal(C.showsNode(node, col, item), true);
  C.condSet(node, { bind: C.bindField(field.id)!, op: 'eq', value: '&' });
  assert.equal(C.showsNode(node, col, item), false);
  C.itemSet(col.id, item.id, field.id, '<p><br></p>');
  C.condSet(node, { bind: C.bindField(field.id)!, op: 'set' });
  assert.equal(C.showsNode(node, col, item), true);
});

test('rich conditions follow a reference to the terminal field type', () => {
  const { col, field, item, node } = fieldFixture();
  C.itemSet(col.id, item.id, field.id, '<p>Shared <i>workshop</i></p>');
  const listings = C.collectionAdd('Listings')!;
  const ref = C.fieldAdd(listings.id, 'Workshop', 'ref')!; ref.ref = col.id;
  const listing = C.itemAdd(listings.id)!; C.itemSet(listings.id, listing.id, ref.id, item.id);
  C.condSet(node, { bind: C.bindField(`${ref.id}.${field.id}`)!, op: 'eq', value: 'Shared workshop' });
  assert.equal(C.showsNode(node, listings, listing), true);
});

function componentFixture() {
  const root = C.N('text', { html: '<p>Root content</p>' });
  C.state.pages[0].tree = [root];
  const id = C.componentFromNode(root.id, 'Workshop details')!;
  const def = C.findComponent(id)!;
  const property = C.propAdd(id, 'Details', 'rich', '<p>Default <b>workshop</b></p>')!;
  C.bindSet(def.node, 'html', { src: 'prop', path: property });
  const instance = C.locate(root.id)!.node;
  return { def, property, instance };
}

test('rich component properties compare defaults, variants and explicit instance text', () => {
  const { def, property, instance } = componentFixture();
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'eq', value: 'Default workshop' });
  assert.equal(C.showsNode(def.node, null, null, instance, def), true);
  C.instSet(instance, property, '<p>Variant <em>workshop</em></p>');
  C.variantFromInstance(instance, 'Variant');
  delete instance.vals;
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'eq', value: 'Variant workshop' });
  assert.equal(C.showsNode(def.node, null, null, instance, def), true);
  C.instSet(instance, property, '<p>Own <u>workshop</u></p>');
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'eq', value: 'Own workshop' });
  assert.equal(C.showsNode(def.node, null, null, instance, def), true);
});

test('a rich property bound to a plain Text field keeps that field literal', () => {
  const { def, property, instance } = componentFixture();
  const { col, field, item } = fieldFixture('text');
  C.itemSet(col.id, item.id, field.id, '<sample> &amp;');
  C.bindSet(instance, C.VAL + property, C.bindField(field.id));
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'eq', value: '<sample> &amp;' });
  assert.equal(C.showsNode(def.node, col, item, instance, def), true);
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'eq', value: '&' });
  assert.equal(C.showsNode(def.node, col, item, instance, def), false);
});

test('CMS-bound rich properties normalize the terminal rich field and preserve raw condValue', () => {
  const { def, property, instance } = componentFixture();
  const { col, field, item } = fieldFixture();
  const html = '<p>CMS <strong>workshop</strong></p>';
  C.itemSet(col.id, item.id, field.id, html);
  C.bindSet(instance, C.VAL + property, C.bindField(field.id));
  const condition = { bind: { src: 'prop' as const, path: property }, op: 'eq' as const, value: 'CMS workshop' };
  C.condSet(def.node, condition);
  assert.equal(C.condValue(condition, col, item, instance, def), html);
  const before = JSON.stringify(C.doc());
  assert.equal(C.showsNode(def.node, col, item, instance, def), true);
  assert.equal(JSON.stringify(C.doc()), before, 'a condition check never rewrites author data');
});

test('public and edit rendering share rich comparison results without altering content markup', () => {
  const { def, property, instance } = componentFixture();
  C.instSet(instance, property, '<p>Seasonal <strong>workshop</strong></p>');
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'eq', value: 'Seasonal workshop' });
  assert.match(C.renderNode(instance, { edit: false }), /<p>Seasonal <strong>workshop<\/strong><\/p>/);
  assert.doesNotMatch(C.renderNode(instance, { edit: true }), /s-cond-off/);
  C.condSet(def.node, { bind: { src: 'prop', path: property }, op: 'ne', value: 'Seasonal workshop' });
  assert.equal(C.renderNode(instance, { edit: false }), '');
  assert.match(C.renderNode(instance, { edit: true }), /s-cond-off/);
});

test('standalone editor, Core and compiler bundles retain the decoder notice without an external runtime import', () => {
  const license = readFileSync(new URL('../vendor/entities/LICENSE', import.meta.url), 'utf8').trim();
  assert.doesNotMatch(license, /\*\/|<\/script/i, 'the retained notice is safe in an inline script');
  for (const file of ['index.html', 'dist/core.cjs', 'packages/editor/dist/editor.html', 'packages/editor/dist/compiler-worker.js']) {
    const bundled = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.ok(bundled.includes(license), `${file} retains the full BSD-2-Clause notice`);
    assert.doesNotMatch(bundled, /(?:from\s*|require\s*\()\s*["']entities(?:\/|["'])/, `${file} bundles its decoder`);
    if (file.endsWith('.html')) assert.ok(bundled.includes('<script>\n/* ====================================================================='),
      `${file} retains the existing host-configuration injection marker`);
  }
});
