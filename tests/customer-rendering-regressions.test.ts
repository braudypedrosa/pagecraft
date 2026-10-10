import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';
import * as C from '../app/src/core/index';

const { JSDOM } = createRequire(import.meta.url)('jsdom') as { JSDOM: any };
const doms: any[] = [];

beforeEach(() => C.blankProject('Customer renderer regressions'));
afterEach(() => { for (const dom of doms.splice(0)) dom.window.close(); });

const mediaBlocks = (css: string) => {
  const tabletAt = css.indexOf(C.MQ.t);
  const mobileAt = css.indexOf(C.MQ.m);
  return {
    base: css.slice(0, tabletAt < 0 ? mobileAt : tabletAt),
    tablet: tabletAt < 0 ? '' : css.slice(tabletAt, mobileAt < 0 ? undefined : mobileAt),
    mobile: mobileAt < 0 ? '' : css.slice(mobileAt),
  };
};

describe('customer rendering defects', () => {
  test.each([
    ['linked', { link: 'https://example.com' }],
    ['captioned', { caption: 'A useful caption' }],
    ['linked and captioned', { link: 'https://example.com', caption: 'A useful caption' }],
  ])('%s images keep layout on their wrapper and visual sizing on the image', (_label, props) => {
    const image = C.N('image', { src: 'photo.jpg', alt: 'View', ...props }, {
      d: { width: '72%', height: '240px', 'object-fit': 'cover', 'border-radius': '20px', 'margin-bottom': '28px' },
      t: { height: '200px' }, m: { height: '160px' },
    });
    const html = C.renderNode(image, { edit: false });
    const dom = new JSDOM(html);
    doms.push(dom);
    const root = dom.window.document.querySelector(`.${C.nodeClass(image)}`)!;
    const img = root.querySelector('img.pagecraft-image')!;
    expect(root).not.toBe(img);

    const blocks = mediaBlocks(C.treeCss([[image]], false));
    const rootRule = new RegExp(`\\.${C.nodeClass(image)}\\{[^}]*width:72%;[^}]*margin-bottom:28px;`);
    const imageRule = (height: string) => new RegExp(`\\.${C.nodeClass(image)} \\.pagecraft-image\\{[^}]*height:${height};`);
    expect(blocks.base).toMatch(rootRule);
    expect(blocks.base).toMatch(imageRule('240px'));
    const baseImageRule = blocks.base.match(new RegExp(`\\.${C.nodeClass(image)} \\.pagecraft-image\\{([^}]*)}`))?.[1] || '';
    expect(baseImageRule).toContain('object-fit:cover');
    expect(baseImageRule).toContain('border-radius:20px');
    expect(baseImageRule).toContain('width:100%');
    expect(blocks.tablet).toMatch(imageRule('200px'));
    expect(blocks.mobile).toMatch(imageRule('160px'));
    expect(blocks.base.match(rootRule)?.[0]).not.toContain('height:240px');
  });

  test('plain images retain direct image sizing', () => {
    const image = C.N('image', { src: 'photo.jpg', alt: 'View' }, {
      d: { width: '72%', height: '240px', 'object-fit': 'cover', 'border-radius': '20px' }, t: {}, m: {},
    });
    expect(C.renderNode(image, { edit: false })).toMatch(new RegExp(`<img[^>]+class="pagecraft-image ${C.nodeClass(image)}`));
    const rule = C.bucket(image, 'd', false).match(new RegExp(`\\.${C.nodeClass(image)}\\{([^}]*)}`))?.[1] || '';
    expect(rule).toContain('width:72%');
    expect(rule).toContain('height:240px');
    expect(rule).toContain('object-fit:cover');
    expect(rule).toContain('border-radius:20px');
  });

  test.each(['solid', 'outline', 'ghost', 'link'])('button %s variant reaches renderer', variant => {
    const button = C.N('button', { text: 'Continue', link: 'https://example.com', variant }, {
      d: { 'background-color': 'var(--c-brand)', color: 'var(--c-ink)', 'border-width': '0px' }, t: {}, m: {},
    });
    expect(C.renderNode(button, { edit: false })).toContain(`data-variant="${variant}"`);
  });

  test('button variant rules outrank a template node selector', () => {
    const css = C.baseCss(false);
    expect(css).toContain('.pagecraft-button[data-variant=outline]{background-color:transparent;border-width:1px;border-style:solid;border-color:currentColor}');
    expect(css).toContain('.pagecraft-button[data-variant=ghost]{background-color:transparent;border-color:transparent}');
    expect(css).toContain('.pagecraft-button[data-variant=link]{background-color:transparent;border-width:0;border-color:transparent;border-radius:0;padding:0}');
  });

  test('mobile output repeats inherited tablet element typography after mobile text-style rules', () => {
    C.ensureTokens();
    const display = C.findStyle('display')!;
    display.css.m['font-size'] = '36px';
    const heading = C.N('heading', { text: 'Responsive', ts: 'display' }, {
      d: { 'font-size': '56px' }, t: { 'font-size': '44px' }, m: {},
    });
    const mobile = mediaBlocks(C.treeCss([[heading]], false)).mobile;
    const textStyleAt = mobile.indexOf('.ts-display{');
    const nodeAt = mobile.indexOf(`.${C.nodeClass(heading)}{`);
    expect(textStyleAt).toBeGreaterThanOrEqual(0);
    expect(nodeAt).toBeGreaterThan(textStyleAt);
    expect(mobile.slice(textStyleAt, mobile.indexOf('}', textStyleAt))).toContain('font-size:36px');
    expect(mobile.slice(nodeAt, mobile.indexOf('}', nodeAt))).toContain('font-size:44px');
  });

  test('explicit mobile element typography wins over a tablet inheritance bridge', () => {
    C.ensureTokens();
    const display = C.findStyle('display')!;
    display.css.t['font-size'] = '20px';
    const heading = C.N('heading', { text: 'Responsive', ts: 'display' }, {
      d: { 'font-size': '40px' }, t: {}, m: { 'font-size': '18px' },
    });
    const blocks = mediaBlocks(C.treeCss([[heading]], false));
    const selector = `.${C.nodeClass(heading)}{`;
    const tabletNodeAt = blocks.tablet.indexOf(selector);
    const mobileNodeAt = blocks.mobile.indexOf(selector);
    expect(tabletNodeAt).toBeGreaterThanOrEqual(0);
    expect(blocks.tablet.slice(tabletNodeAt, blocks.tablet.indexOf('}', tabletNodeAt))).toContain('font-size:40px');
    expect(mobileNodeAt).toBeGreaterThanOrEqual(0);
    expect(blocks.mobile.slice(mobileNodeAt, blocks.mobile.indexOf('}', mobileNodeAt))).toContain('font-size:18px');
    expect(blocks.tablet).not.toContain(`.${C.nodeClass(heading)}.${C.nodeClass(heading)}{`);
  });

  test('wrapped image inheritance bridges target the inner image', () => {
    C.ensureTokens();
    const framed = C.classAdd('Framed image', { t: { 'border-radius': '4px' } });
    const image = C.N('image', { src: 'photo.jpg', alt: 'View', caption: 'Caption' }, {
      d: { 'border-radius': '24px' }, t: {}, m: {},
    });
    C.classApply(image, framed);
    const tablet = mediaBlocks(C.treeCss([[image]], false)).tablet;
    const innerRule = `.${C.nodeClass(image)} .pagecraft-image{border-radius:24px;}`;
    expect(tablet).toContain(innerRule);
    expect(tablet).not.toContain(`.${C.nodeClass(image)}{border-radius:24px;}`);
  });

  test('percentage-width forms honor Grid instead of forcing flex', () => {
    const form = C.N('form', {
      fields: [{ type: 'text', label: 'First', width: 50 }, { type: 'text', label: 'Last', width: 50 }],
    }, { d: { '--f-layout': 'grid', '--f-columns': 'repeat(2,minmax(0,1fr))' }, t: {}, m: {} });
    const css = C.treeCss([[form]], false);
    expect(C.renderNode(form, { edit: false })).toContain('pagecraft-form-percent');
    expect(css).toContain(`.${C.nodeClass(form)}.pagecraft-form-percent{display:var(--f-layout,flex)}`);
    expect(css).not.toContain(`.${C.nodeClass(form)}.pagecraft-form-percent{display:flex}`);
  });

  test('new collections select Grid and an explicit no-wrap reaches the rendered list', () => {
    const collection = C.collectionAdd('Projects');
    C.itemAdd(collection.id);
    const list = C.N('list', {}, { d: { 'flex-wrap': 'nowrap' }, t: {}, m: {} }, [C.N('column')]);
    C.srcSet(list, collection.id);

    expect(list.props.collectionLayout).toBe('grid');
    const html = C.renderNode(list, { edit: false });
    expect(html).toContain('pagecraft-list');
    expect(html).not.toContain('pagecraft-slider');
    expect(C.treeCss([[list]], false))
      .toContain(`.${C.nodeClass(list)}.pagecraft-list{flex-wrap:nowrap}`);
  });

  test('palette collections arrive with an editable card and Add targets that card', () => {
    const list = C.insert('list', null, 0)!;
    expect(list.type).toBe('list');
    expect(list.children).toHaveLength(1);
    const card = list.children[0];
    expect(card.type).toBe('column');
    expect(C.renderNode(list, { edit: true })).toContain('Pick a collection for this list');

    C.selSet([list.id]);
    const [container, index] = C.smartTarget('heading');
    expect(container).toBe(card);
    expect(index).toBe(0);
    const heading = C.insert('heading', container, index)!;
    expect(card.children).toEqual([heading]);

    expect(C.N('list').children).toHaveLength(0);
  });

  test('new Rows read back their built-in Wrap enum without storing redundant CSS', () => {
    const row = C.N('row');
    expect(row.css.d['flex-wrap']).toBeUndefined();
    expect(C.cssVal(row, 'flex-wrap')).toEqual({ v: 'wrap', own: false });
  });

  test('built mobile menu preserves nested link metadata and renders it', () => {
    const nav = C.N('nav', { items: [
      { id: 'parent', label: 'Parent', href: '/parent', cls: 'featured', rel: 'nofollow', target: '_blank' },
      { id: 'child', parentId: 'parent', label: 'Child', href: '/child', cls: 'sub-link', rel: 'sponsored' },
    ] });
    const definition = C.ensureMobileMenuComponent(nav);
    const buttons: any[] = [];
    C.eachNode([definition.node], node => { if (node.type === 'button') buttons.push(node); });
    expect(buttons).toHaveLength(2);
    expect(buttons[0].props).toMatchObject({ link: '/parent', target: '_blank', rel: 'nofollow' });
    expect(buttons[0].adv.cls).toBe('featured');
    expect(buttons[1].props).toMatchObject({ link: '/child', rel: 'sponsored' });
    expect(buttons[1].adv.cls).toBe('sub-link');
    expect(buttons[1]).toBe(definition.node.children[0].children[0].children[0].children[1].children[0]);

    const html = C.renderNode(buttons[0], { edit: false });
    expect(html).toContain('class="pagecraft-button');
    expect(html).toContain(' featured"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="nofollow noopener"');
  });

  test('component Add targets its editable root before any canvas selection', () => {
    const root = C.N('section', { tag: 'div', width: 'full' }, {}, []);
    C.state.meta.components = [{ id: 'mobile-menu', name: 'Mobile menu', mobileMenu: true, node: root, props: [] }];
    C.state.ui.mode = 'component';
    C.state.ui.cedit = 'mobile-menu';
    C.selSet([]);

    const [container, index] = C.smartTarget('heading');
    expect(container).toBe(root);
    expect(index).toBe(0);
    const heading = C.insert('heading', container, index);
    expect(heading).not.toBeNull();
    expect(root.children[0].type).toBe('row');
    expect(root.children[0].children[0].children[0]).toBe(heading);

    const leafRoot = C.N('heading', { text: 'Fixed root' });
    C.state.meta.components = [{ id: 'leaf', name: 'Leaf', node: leafRoot, props: [] }];
    C.state.ui.cedit = 'leaf';
    const [refused, refusedIndex] = C.smartTarget('button');
    expect(refused).toBeNull();
    expect(refusedIndex).toBe(0);
    expect(C.insert('button', refused, refusedIndex)).toBeNull();
  });

  test('fullscreen menu declares modality, traps Tab, closes on Escape and restores focus', () => {
    const nav = C.N('nav', { aria: 'Primary', mobileMenu: 'fullscreen', items: [
      { id: 'one', label: 'One', href: '#one' }, { id: 'two', label: 'Two', href: '#two' },
    ] });
    const dom = new JSDOM(`<body><header>${C.renderNode(nav, { edit: false })}</header><button id="outside">Outside</button></body>`, {
      runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test/',
    });
    doms.push(dom);
    const { window } = dom;
    const document = window.document;
    window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    window.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new window.Event('close')); };
    document.querySelector('header')!.getBoundingClientRect = () => ({ bottom: 72 } as DOMRect);
    window.eval(C.NAV_JS.replace(/^<script>\s*/, '').replace(/<\/script>\s*$/, ''));

    const toggle = document.querySelector('[data-nav-t]') as HTMLElement;
    toggle.click();
    const dialog = document.querySelector('.pagecraft-mobile-menu') as HTMLElement;
    const focusable = [...dialog.querySelectorAll('button,a[href]')] as HTMLElement[];
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(focusable[0]);

    focusable.at(-1)!.focus();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(focusable[0]);
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(focusable.at(-1));

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(document.querySelector('.pagecraft-mobile-menu')).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });

  test('Box no-wrap matches base selector specificity', () => {
    const box = C.N('box', { layout: 'flex' }, { d: { 'flex-wrap': 'nowrap' }, t: {}, m: {} });
    const css = C.treeCss([[box]], false);
    expect(css).toContain(`.${C.nodeClass(box)}.pagecraft-box{flex-wrap:nowrap}`);
  });

  test('border edge longhands emit after broad width declarations', () => {
    expect(C.decl({ 'border-left-width': '6px', 'border-width': '2px', color: 'red' }))
      .toBe('border-width:2px;border-left-width:6px;color:red;');
  });

  test('table row headings use header background and zebra affects data cells only', () => {
    const css = C.baseCss(false);
    expect(css).toContain('.pagecraft-table tbody th{background:var(--tbl-head-bg,transparent);');
    expect(css).toContain('.pagecraft-table[data-zebra] tbody tr:nth-child(even)>td{background:var(--tbl-zebra,#f8f6ef)}');
    expect(css).not.toContain('.pagecraft-table[data-zebra] tbody tr:nth-child(even)>*{');
  });

  test('manual breadcrumbs preserve link metadata while current page stays a span', () => {
    const crumbs = C.N('crumbs', { mode: 'manual', items: [
      { label: 'Home', href: 'index.html', cls: 'qa-crumb', rel: 'nofollow', target: '_blank' },
      { label: 'Current', href: 'ignored.html', cls: 'current-crumb', rel: 'sponsored', target: '_blank' },
    ] });
    const dom = new JSDOM(C.renderNode(crumbs, { edit: false }));
    doms.push(dom);
    const items = dom.window.document.querySelectorAll('li');
    const link = items[0].querySelector('a')!;
    expect(items[0].className).toBe('qa-crumb');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('nofollow noopener');
    expect(items[1].className).toBe('current-crumb');
    expect(items[1].querySelector('a')).toBeNull();
    expect(items[1].querySelector('[aria-current="page"]')?.textContent).toBe('Current');
  });
});
