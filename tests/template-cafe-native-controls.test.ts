import { test } from 'vitest';
import assert from 'node:assert/strict';
import { DEF, eachNode } from '../app/src/core/index';
import { buildTemplateDocument } from '../premade-sites/neighborhood-cafe/1.0.0/source';

test('Morning Field static choices remain editable in native module controls', () => {
  const doc = buildTemplateDocument();
  let choices = 0;
  for (const tree of [doc.header, doc.footer, ...doc.pages.map(page => page.tree)]) {
    eachNode(tree, node => {
      const definition = DEF[node.type];
      const props = node.props as Record<string, unknown>;
      for (const control of [...definition.controls.content, ...definition.controls.style]) {
        if (control.t !== 'select' || !control.k || !Array.isArray(control.opts)
          || props[control.k] == null || node.bind?.[control.k]) continue;
        const values = control.opts.map(option => String(option[0]));
        assert.ok(values.includes(String(props[control.k])),
          `${node.id}: ${control.label} must display an existing native choice`);
        choices++;
      }
    });
  }
  assert.ok(choices > 40, 'the contract covers the complete multi-page document');
});
