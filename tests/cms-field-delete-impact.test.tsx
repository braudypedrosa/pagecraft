// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import { bindingImpact } from '../app/src/ui/CmsWorkspace';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => { r = rig(); });
afterEach(() => { r.host.remove(); });

/* Deleting a field asks the author to review what used it. A condition is a use: without the
   field it reads as empty, so the element is shown or hidden for good. */
test('the field delete warning names conditions as well as bindings', () => {
  const col = C.collectionAdd('Stories')!;
  const sub = C.fieldAdd(col.id, 'Subtitle', 'text');
  const flag = C.fieldAdd(col.id, 'Featured', 'bool');
  const heading = C.N('heading', { text: 'Subtitle' });
  C.bindSet(heading, 'text', C.bindField(sub.id));
  const badge = C.N('text', { html: '<p>Featured</p>' });
  C.condSet(badge, { bind: { src: 'field', path: flag.id }, op: 'set' } as any);
  const list = C.N('list', {}, {}, [C.N('column', {}, {}, [heading, badge])]);
  list.src = col.id;
  C.state.pages[0].tree.push(C.N('section', {}, {}, [list]));
  const page = C.state.pages[0].name;

  expect(bindingImpact(col.id, flag.id)).toBe(`Review these bindings: ${page} / ${C.nameOf(badge)} (condition).`);
  expect(bindingImpact(col.id, sub.id)).toBe(`Review these bindings: ${page} / ${C.nameOf(heading)}.`);
  expect(bindingImpact(col.id, C.titleField(col)!.id)).toMatch(/^No page field bindings were found/);
});
