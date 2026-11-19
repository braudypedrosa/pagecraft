// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { act } from 'preact/test-utils';
import * as C from '../app/src/core/index';
import { ReviewList } from '../app/src/ui/ReviewList';
import { rig, type Rig } from './ui.setup';

let r: Rig;
beforeEach(() => {
  r = rig();
  C.seed(); C.state.ui = C.initUi(); C.state.cur = 0;
  C.state.pages = [C.state.pages[0]];
  C.state.pages[0].tree = []; C.state.header = []; C.state.footer = [];
  Object.assign(C.state.pages[0], { title: 'Home', desc: 'A page' });
});
afterEach(() => { act(() => r.draw(null)); r.host.remove(); });

/** A component whose image has no width/height, placed three times on one page. */
function threeUses() {
  const heading = C.insert('heading', null, 0)!;
  Object.assign(heading.props, { level: 'h1', text: 'Cabins' });
  const section = C.insert('section', null, 1)!;
  const image = C.insert('image', section, 0)!;
  Object.assign(image.props, { src: 'cabin.webp', alt: 'A cabin', w: '', h: '' });
  const id = C.componentFromNode(section.id, 'Cabin portrait')!;
  expect(id).toBeTruthy();
  C.instanceInsert(id, null, C.tree().length);
  C.instanceInsert(id, null, C.tree().length);
  return id;
}

test('a component issue repeated on a page is one finding to fix, everywhere it is counted', () => {
  threeUses();
  const repeated = C.lint().filter(f => f.code === 'no-dimensions');
  expect(repeated).toHaveLength(3);
  expect(repeated.every(f => f.component?.name === 'Cabin portrait')).toBe(true);
  expect(C.lintGroups(repeated)).toHaveLength(1);
  expect(C.lintCounts(repeated)).toEqual({ error: 0, warn: 1 });
});

test('Site checks shows one row with its places, steps Show me through them, and offers the component', () => {
  const componentId = threeUses();
  const targets = C.lint().filter(f => f.code === 'no-dimensions').map(f => f.target);
  act(() => r.draw(<ReviewList defaultOpen />));

  const rows = r.$$('li').filter(li => li.textContent!.includes('no width/height'));
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toContain('3 places');
  expect(rows[0].textContent).toContain('Fix it once in the “Cabin portrait” component');

  const show = () => r.$$('li .go').find(b => b.textContent!.startsWith('Show me'))!;
  expect(show().textContent).toBe('Show me 1/3');
  for (let i = 0; i < 4; i++) act(() => r.click(show()));
  const visited = r.calls.filter(c => c[0] === 'showReviewTarget').map(c => c[1]);
  expect(visited).toEqual([targets[0], targets[1], targets[2], targets[0]]);
  expect(show().textContent).toBe('Show me 2/3');

  const edit = r.$$('li .go').find(b => b.textContent === 'Edit component')!;
  act(() => r.click(edit));
  expect(r.names()).toContain('closeReviewSurface');
  expect(r.arg('editComponent')).toEqual([componentId]);
});

test('a single finding keeps the plain Show me and no place count', () => {
  const image = C.insert('image', null, 0)!;
  Object.assign(image.props, { src: 'courtyard.webp', alt: '', w: '800', h: '600' });
  act(() => r.draw(<ReviewList defaultOpen />));
  const row = r.$$('li').find(li => li.textContent!.includes('no alt text'))!;
  expect(row.textContent).not.toContain('places');
  expect(r.$$('li .go').map(b => b.textContent)).toContain('Show me');
});
