import { beforeEach, expect, test } from 'vitest';
import * as core from '../app/src/core/index';

/* Two Site checks that fired on the curated templates where nothing was wrong. A fresh
   template should open without suggestions it does not deserve; the real misses next to
   them must still be reported. */

let page: (typeof core.state.pages)[number];
beforeEach(() => {
  core.blankProject('Blind spot fixture');
  core.state.meta.tokens = core.defaultTokens();
  core.state.ui = core.initUi();
  core.state.header = []; core.state.footer = [];
  page = core.state.pages[0];
  Object.assign(page, { name: 'Find your cabin', title: 'Find your cabin', slug: 'cabins', desc: 'Cabins' });
  core.state.pages.push({ ...core.clone(page), id: 'other', name: 'Home', title: 'Home', slug: 'index', tree: [] });
  core.state.cur = 0;
});
/** Desktop styles: the node helper takes a breakpoint map. */
const d = (css: Record<string, string>) => ({ d: css });
const codes = (code: string) => core.lint().filter(f => f.code === code && f.where.slug === 'cabins');

function textOnPhoto(shade: Record<string, string> | null, bgImage = false) {
  const heading = core.N('heading', { level: 'h1', text: 'Your holiday, in three steps' }, d({ color: '#fff', 'font-size': '18px' }));
  const copy = core.N('box', {}, d({ position: 'relative' }), [heading]);
  const layers = [core.N('image', { src: 'asset:photo', alt: 'Coast', w: '1600', h: '900' }, d({ position: 'absolute', inset: '0' }))];
  if (shade) layers.push(core.N('box', {}, d({ position: 'absolute', inset: '0', ...shade }), []));
  const section = core.N('section', {}, d(bgImage ? { 'background-image': 'url(x.webp)' } : { position: 'relative' }),
    bgImage ? [copy] : [...layers, copy]);
  page.tree = [section];
  return heading;
}

test('white text over a shaded photograph is not measured against the page colour', () => {
  textOnPhoto({ 'background-color': '#10251f', opacity: '.72' });
  expect(codes('contrast')).toEqual([]);
});

test('text over a background image is not measured against the page colour', () => {
  textOnPhoto(null, true);
  expect(codes('contrast')).toEqual([]);
});

test('white text on a plain light section is still reported', () => {
  const heading = core.N('heading', { level: 'h1', text: 'Hard to read' }, d({ color: '#fff', 'font-size': '18px' }));
  page.tree = [core.N('section', {}, d({ 'background-color': '#f4efe6' }), [heading])];
  expect(codes('contrast')).toHaveLength(1);
});

test('a solid box behind the text still decides its contrast, even inside a photo section', () => {
  textOnPhoto({ 'background-color': '#10251f' });
  const heading = page.tree[0].children[2].children[0];
  heading.css.d['background-color'] = '#ffffff';
  expect(codes('contrast')).toHaveLength(1);
});

test('a menu item that names the current page by a meaningful word is its current item', () => {
  page.tree = [core.N('nav', { items: [{ label: 'The cabins', href: 'cabins.html' }] })];
  expect(codes('nav-page-top')).toEqual([]);
});

test('a menu item that names another destination is still reported', () => {
  page.tree = [core.N('nav', { items: [{ label: 'Work', href: 'cabins.html' }, { label: 'Our story', href: 'cabins.html' }] })];
  expect(codes('nav-page-top')).toHaveLength(2);
});
