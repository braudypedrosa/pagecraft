import { test, expect, vi } from 'vitest';
import * as core from '../app/src/core/index';
import { openReviewTarget } from '../app/src/ui/review-navigation';
import type { Legacy } from '../app/src/ui/ctx';
test('review navigation finds exported node IDs without editing the document', () => {
  core.seed();
  const page = core.state.pages[0], node = page.tree[0];
  const before = JSON.stringify({pages:core.state.pages,header:core.state.header,footer:core.state.footer});
  const legacy = {appRender:vi.fn(),select:vi.fn()} as unknown as Legacy;
  openReviewTarget(core, legacy, '?reviewPage='+page.slug+'.html&reviewNode='+encodeURIComponent(core.domIdOf(node)));
  expect(legacy.select).toHaveBeenCalledWith(node.id,{scroll:true});
  expect(JSON.stringify({pages:core.state.pages,header:core.state.header,footer:core.state.footer})).toBe(before);
  vi.mocked(legacy.select).mockClear();
  openReviewTarget(core, legacy, '?reviewPage='+page.slug+'.html&reviewNode=pc-review-anchor-missing');
  expect(legacy.select).not.toHaveBeenCalled();
  vi.mocked(legacy.appRender).mockClear();
  openReviewTarget(core, legacy, '?reviewPage=missing.html');
  expect(legacy.appRender).not.toHaveBeenCalled();
});

function linkFixture() {
  core.seed();
  const home = core.blankProject('Link review fixture');
  core.state.meta.collections = [];
  core.state.meta.components = [];
  core.state.meta.blocks = [];
  const front = core.N('section', {}, {}, []);
  front.adv.htmlId = 'front-top';
  home.tree = [front];
  const nested = core.clone(home);
  nested.id = 'nested-page';
  nested.name = 'Guides';
  nested.slug = 'guides/index';
  nested.tree = [core.N('section', {}, {}, [])];
  nested.tree[0].adv.htmlId = 'guide-top';
  core.state.pages.push(nested);
  const crumbs = core.N('crumbs', { mode: 'manual', items: [
    { label: 'Home', href: '/' }, { label: 'Guides', href: '' },
  ] });
  nested.tree[0].children.push(crumbs);
  core.state.cur = 1;
  return { home, nested, crumbs };
}

const linkFindings = () => core.lint().filter(f => ['dead-link', 'dead-anchor'].includes(f.code));

test('written breadcrumb root and clean links resolve to real pages, including query strings and anchors', () => {
  const { crumbs } = linkFixture();
  for (const href of ['/', '/index.html', '/?from=guides#front-top', '/index.html?from=guides#front-top',
    '/guides/', '/guides/index.html?from=home#guide-top', 'guides/index?from=home#guide-top',
    '?from=home#guide-top']) {
    (crumbs.props.items as { href: string }[])[0].href = href;
    expect(linkFindings(), href).toEqual([]);
  }
});

test('unknown rooted routes and absent anchors remain blocking review findings', () => {
  const { crumbs } = linkFixture();
  for (const href of ['/missing', '/missing.html?from=home', '/guides/absent#guide-top']) {
    (crumbs.props.items as { href: string }[])[0].href = href;
    const findings = linkFindings();
    expect(findings, href).toHaveLength(1);
    expect(findings[0].code).toBe('dead-link');
  }
  for (const href of '/?from=home#absent /guides/?from=home#absent'.split(' ')) {
    (crumbs.props.items as { href: string }[])[0].href = href;
    expect(linkFindings().map(f => f.code), href).toEqual(['dead-anchor']);
  }
});

test('Preview follows rooted front-page, folder-index and query links to the correct page index', () => {
  linkFixture();
  for (const href of ['/', '/index.html', '/?ref=qa#front-top', '/index.html?ref=qa#front-top']) {
    const target = core.pageAt(href);
    expect(target, href).not.toBeNull();
    expect(target!.at, href).toBe(0);
    expect(target!.frag, href).toBe(href.includes('#') ? 'front-top' : '');
  }
  for (const href of ['/guides/', '/guides/index.html', 'guides/index?ref=qa#guide-top', '?ref=qa#guide-top']) {
    const target = core.pageAt(href);
    expect(target, href).not.toBeNull();
    expect(target!.at, href).toBe(1);
    expect(target!.frag, href).toBe(href.includes('#') ? 'guide-top' : '');
  }
  for (const href of ['/missing', '/guides/missing.html?ref=qa', '//elsewhere.test/', 'https://elsewhere.test/']) {
    expect(core.pageAt(href), href).toBeNull();
  }
});

test('a root URL does not invent a front page when the project has no exported index', () => {
  const { home } = linkFixture();
  home.slug = 'landing';
  expect(core.pageAt('/')).toBeNull();
  expect(linkFindings().map(f => f.code)).toEqual(['dead-link']);
});

test('navigation promises and global anchors keep their checks after target normalization', () => {
  const { home } = linkFixture();
  const nav = core.N('nav', { items: [
    { label: 'Home', href: '/' }, { label: 'Work', href: '/index.html?ref=qa' },
  ] });
  home.tree.push(nav);
  expect(core.lint().filter(f => f.code === 'nav-page-top')).toHaveLength(1);
  const button = core.N('button', { text: 'Guide top', link: '?ref=qa#guide-top' });
  core.state.header.push(button);
  expect(core.lint().filter(f => f.code === 'global-fragment')).toHaveLength(2);
});

test('clean generated detail and pagination routes resolve only while those export targets exist', () => {
  const { crumbs, home } = linkFixture();
  const col = core.collectionAdd('Articles');
  const bread = core.itemAdd(col.id)!;
  core.itemSet(col.id, bread.id, 'title', 'Bread');
  const coffee = core.itemAdd(col.id)!;
  core.itemSet(col.id, coffee.id, 'title', 'Coffee');
  const list = core.N('list', { per: '1' });
  list.src = col.id;
  const archive = { ...core.clone(home), id: 'archive', slug: 'guides/archive', tree: [list] };
  const detail = { ...core.clone(home), id: 'article-detail', slug: 'article-template', collection: col.id };
  core.state.pages.push(archive, detail);
  const detailUrl = '/articles/bread?ref=qa#front-top';
  (crumbs.props.items as { href: string }[])[0].href = detailUrl;
  expect(linkFindings()).toEqual([]);
  const target = core.pageAt(detailUrl)!;
  expect(target.at).toBe(core.state.pages.indexOf(detail));
  expect(target.col!.id).toBe(col.id);
  expect(target.item!.id).toBe(bread.id);
  expect(target.frag).toBe('front-top');
  const pageTwo = core.pageAt('/guides/archive/page-2?ref=qa')!;
  expect(pageTwo.at).toBe(core.state.pages.indexOf(archive));
  expect(pageTwo.pageNo).toBe(2);
  expect(core.pageAt('/guides/archive/page-99')).toBeNull();
  core.itemDraft(col.id, bread.id, true);
  expect(core.pageAt(detailUrl)).toBeNull();
  expect(linkFindings().map(f => f.code)).toEqual(['dead-link']);
});
