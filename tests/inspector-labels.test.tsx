// @vitest-environment jsdom
import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { Inspector } from '../app/src/ui/inspector/Inspector';
import { rig, type Rig } from './ui.setup';

let r: Rig;

beforeEach(() => { r = rig(); });
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

function assertInspectorNamesAreUnique() {
  const ids = r.$$('[id]').map(element => element.id);
  assert.equal(new Set(ids).size, ids.length, 'inspector DOM ids must remain unique');

  for (const control of r.$$('input, textarea, select')) {
    const labelId = control.getAttribute('aria-labelledby');
    if (!labelId) continue;
    const matches = r.$$(`[id="${labelId}"]`);
    assert.equal(matches.length, 1, `${control.tagName} must reference exactly one label`);
    assert.notEqual(matches[0].classList.contains('gb'), true, 'a control label cannot resolve to a group body');
  }
}

test('inspector labels stay unique through selection and delete/undo remounts', () => {
  const heading = C.insert('heading', null, 0)!;
  const image = C.insert('image', null, 1)!;
  C.state.ui.stab = 'content';

  C.selSet([heading.id]);
  r.draw(() => <Inspector />, 'right');
  assertInspectorNamesAreUnique();

  C.selSet([image.id]);
  r.draw(() => <Inspector />);
  assertInspectorNamesAreUnique();

  C.selSet([heading.id]);
  r.draw(() => <Inspector />);
  assertInspectorNamesAreUnique();
  assert.equal(r.$('textarea')?.getAttribute('aria-labelledby') != null, true);

  C.edit(() => C.delNode(heading.id));
  r.draw(() => <Inspector />);
  assertInspectorNamesAreUnique();

  C.undo();
  C.selSet([heading.id]);
  r.draw(() => <Inspector />);
  assertInspectorNamesAreUnique();
  assert.equal(r.$('textarea')?.getAttribute('aria-labelledby') != null, true);
});
