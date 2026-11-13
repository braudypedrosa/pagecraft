import { expect, test } from 'vitest';
import * as C from '../app/src/core/index';

const navBridge = (selector: string) =>
  `${selector}:where(.pagecraft-nav-menu):has(:focus-visible)`;

test('Nav node Focus CSS follows its keyboard controls at every breakpoint', () => {
  const n = C.N('nav', { items: [{ id: 'home', label: 'Home', href: '/' }] });
  n.st = { focus: {
    d: { 'background-color': '#bbccdd' },
    t: { 'border-color': '#abcdef' },
    m: { outline: '4px solid #112233' },
  } };

  const selector = `.${C.nodeClass(n)}`;
  const css = C.treeCss([[n]], false);
  expect(css).toContain(`${navBridge(selector)}{background-color:#bbccdd;}`);
  expect(css).toContain(`${navBridge(selector)}{border-color:#abcdef;}`);
  expect(css).toContain(`${navBridge(selector)}{outline:4px solid #112233;}`);
  expect(css).not.toContain(`${selector}:focus-visible{background-color:#bbccdd;}`);
  expect(css).not.toContain(`${selector}:focus-within`);
  expect(css).not.toContain(`${selector}:where(.pagecraft-nav-menu):has(:focus)`);

  const html = C.renderNode(n, { edit: false });
  expect(html).toContain('data-nav');
  expect(html).toContain('data-nav-t');
  expect(html).toContain('<a href="/">Home</a>');
  expect(html).not.toMatch(new RegExp(`class="[^"]*${C.nodeClass(n)}[^"]*"[^>]*tabindex`));
});

test('managed Nav Focus uses links without adding a nested toggle or landmark', () => {
  const parent = C.N('nav', { items: [{ id: 'work', label: 'Work', href: '/work' }] });
  const follow = C.ensureMobileMenuComponent(parent, 'follow');
  const managed = C.mobileMenuLinksNode(follow)!;
  managed.st = { focus: { d: { color: '#123456' }, t: {}, m: {} } };

  const selector = `.${C.nodeClass(managed)}`;
  const css = C.treeCss([[follow.node]], false);
  expect(css).toContain(`${navBridge(selector)}{color:#123456;}`);
  expect(css).not.toContain(`${selector}:focus-visible{color:#123456;}`);

  const html = C.renderNode(managed, { edit: false, mobileMenuItems: parent.props.items });
  expect(html).toContain('<div');
  expect(html).toContain('<a href="/work">Work</a>');
  expect(html).not.toContain('<nav');
  expect(html).not.toContain('data-nav');
  expect(html).not.toContain('data-nav-t');
  expect(html).not.toContain('pagecraft-mobile-menu');
});

test('ordinary Custom mobile content can activate Nav Focus from any keyboard control', () => {
  const n = C.N('nav', { items: [{ id: 'home', label: 'Home', href: '/' }] });
  const custom = C.ensureMobileMenuComponent(n, 'custom');
  const column = custom.node.children[0].children[0];
  column.children.push(C.N('button', { text: 'Custom action', link: '/action' }));
  n.props.mobileMenuMode = 'custom';
  n.st = { focus: { d: { 'background-color': '#223344' }, t: {}, m: {} } };

  const selector = `.${C.nodeClass(n)}`;
  const css = C.treeCss([[n]], false);
  expect(css).toContain(`${navBridge(selector)}{background-color:#223344;}`);
  expect(css).not.toContain(`${selector}:focus-within`);
  expect(css).not.toContain(`${selector}:where(.pagecraft-nav-menu):has(:focus)`);
  const html = C.renderNode(n, { edit: false });
  expect(html).toContain('pagecraft-button');
  expect(html).toContain('Custom action');
});

test('a reusable Focus class keeps its generic and Gallery paths beside the Nav bridge', () => {
  const n = C.N('nav');
  const classId = C.classAdd('Keyboard navigation', { d: {} });
  C.findClass(classId)!.st = { focus: {
    d: { color: '#123456' },
    t: { 'border-color': '#abcdef' },
    m: {},
  } };
  C.classApply(n, classId);
  n.st = { hover: { d: { color: '#654321' }, t: {}, m: {} } };

  const css = C.treeCss([[n]], false);
  const classSelector = `.c-${classId}`;
  const classNavFocus = `${navBridge(classSelector)}{color:#123456;}`;
  const nodeHover = `.${C.nodeClass(n)}:hover{color:#654321;}`;
  expect(css).toContain(`${classSelector}:focus-visible{color:#123456;}`);
  expect(css).toContain(classNavFocus);
  expect(css).toContain(`${navBridge(classSelector)}{border-color:#abcdef;}`);
  expect(css).toContain(`${classSelector}:where(.pagecraft-gallery):has(:where(.pagecraft-gallery-frame):focus-visible){color:#123456;}`);
  expect(css).toContain(nodeHover);
  expect(css.indexOf(classNavFocus)).toBeLessThan(css.indexOf(nodeHover));
  expect(css).not.toContain(`${classSelector}:focus-within`);
});
