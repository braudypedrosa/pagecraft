import { beforeEach, expect, test } from 'vitest';
import * as C from '../app/src/core/index';

beforeEach(() => {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  C.state.meta.collections = [];
});

test('a 26-entry public collection keeps filtering, pagination, limits, drafts, and nested bindings aligned', () => {
  const authors = C.collectionAdd('Authors')!;
  const ada = C.itemAdd(authors.id)!;
  const grace = C.itemAdd(authors.id)!;
  C.itemSet(authors.id, ada.id, 'title', 'Ada Lovelace');
  C.itemSet(authors.id, grace.id, 'title', 'Grace Hopper');

  const journal = C.collectionAdd('Journal')!;
  const category = C.fieldAdd(journal.id, 'Category', 'text')!;
  const rank = C.fieldAdd(journal.id, 'Rank', 'number')!;
  const summary = C.fieldAdd(journal.id, 'Summary', 'text')!;
  const author = C.fieldAdd(journal.id, 'Author', 'ref')!;
  author.ref = authors.id;
  const featured = new Set([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  const drafts = new Set([4, 8, 18, 20]);

  for (let number = 1; number <= 26; number++) {
    const item = C.itemAdd(journal.id)!;
    C.itemSet(journal.id, item.id, 'title', `Entry ${number}`);
    C.itemSet(journal.id, item.id, category.id, featured.has(number) ? 'Featured' : 'News');
    C.itemSet(journal.id, item.id, rank.id, String(number));
    C.itemSet(journal.id, item.id, summary.id, `Summary ${number}`);
    C.itemSet(journal.id, item.id, author.id, number % 4 === 0 ? grace.id : ada.id);
    if (drafts.has(number)) C.itemDraft(journal.id, item.id, true);
  }

  const title = C.N('heading', { text: 'Title placeholder' });
  const copy = C.N('text', { html: '<p>Summary placeholder</p>' });
  const byline = C.N('heading', { text: 'Author placeholder', level: 'p' });
  C.bindSet(title, 'text', C.bindField('title'));
  C.bindSet(copy, 'html', C.bindField(summary.id));
  C.bindSet(byline, 'text', C.bindField(`${author.id}.title`));
  const card = C.N('column', {}, {}, [C.N('box', {}, {}, [title, copy, byline])]);
  const list = C.N('list', {
    collectionLayout: 'grid', where: category.id, op: 'is', val: 'Featured',
    sort: rank.id, dir: 'desc', per: '2', limit: '3',
  }, {}, [card]);
  list.src = journal.id;
  const page = C.state.pages[0];
  page.slug = 'journal';
  page.tree = [C.N('section', {}, {}, [list])];

  expect(journal.items).toHaveLength(26);
  expect(C.published(journal)).toHaveLength(22);
  expect(C.listItems(list, journal).map(item => item.values[rank.id])).toEqual(['16', '14', '12', '10', '6', '2']);
  expect(C.listPageCount(list, journal)).toBe(3);

  const targets = C.exportTargets().filter(target => target.pg.id === page.id);
  expect(targets.map(target => [target.path, target.pageNo, target.pages])).toEqual([
    ['journal.html', 1, 3],
    ['journal/page-2.html', 2, 3],
    ['journal/page-3.html', 3, 3],
  ]);

  const expected = [[16, 14], [12, 10], [6, 2]];
  targets.forEach((target, index) => {
    const html = C.buildPage(target.pg, target);
    expect(html).toContain('class="pagecraft-list');
    expect(html).not.toContain('class="pagecraft-list pagecraft-slider');
    expected[index].forEach(number => {
      expect(html).toContain(`Entry ${number}`);
      expect(html).toContain(`<p>Summary ${number}</p>`);
      expect(html).toContain(number % 4 === 0 ? 'Grace Hopper' : 'Ada Lovelace');
    });
    for (const draft of drafts) expect(html).not.toContain(`Entry ${draft}`);
    expect(html).toContain(`aria-current="page">${index + 1}</span>`);
    expect(C.pageAt(target.path)?.pageNo).toBe(index + 1);
  });
  expect(C.pageAt('../journal/page-2.html')?.pageNo).toBe(2);
  expect(C.pageAt('../journal/page-3.html')?.pageNo).toBe(3);
  expect(C.pageAt('journal/page-4.html')).toBeNull();

  list.props.per = '';
  expect(C.listItems(list, journal).map(item => item.values[rank.id])).toEqual(['16', '14', '12']);
  const limited = C.buildPage(page);
  expect(limited).not.toContain('<nav class="pagecraft-pager"');
  expect(limited).toContain('Entry 16');
  expect(limited).toContain('Entry 14');
  expect(limited).toContain('Entry 12');
  expect(limited).not.toContain('Entry 10');
});
