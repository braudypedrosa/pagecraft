import { beforeEach, describe, expect, test } from 'vitest';
import * as C from '../app/src/core/index';
import type { Bp, Node as PcNode } from '../app/src/core/types';

const VISIBILITY_MEDIA: Record<Bp, string> = {
  d: '@media (min-width:1025px)',
  t: '@media (min-width:768px) and (max-width:1024px)',
  m: C.MQ.m,
};

function reset() {
  C.seed();
  C.state.ui = C.initUi();
  C.state.cur = 0;
  C.state.pages[0].tree = [];
  C.state.header = [];
  C.state.footer = [];
  C.ensureTokens().classes = [];
  C.state.meta.components = [];
}

function mediaBody(css: string, query: string) {
  const at = css.indexOf(query + '{');
  if (at < 0) return '';
  const open = at + query.length;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] !== '}') continue;
    depth--;
    if (depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`Unclosed media query: ${query}`);
}

const selector = (node: PcNode) => `.${C.nodeClass(node)}`;
const hiddenRule = (node: PcNode) => `${selector(node)}{display:none !important;}`;
const ghostRule = (node: PcNode) =>
  `${selector(node)}{opacity:.32;outline:1px dashed #f0a132;outline-offset:2px;}`;

beforeEach(reset);

describe('responsive visibility', () => {
  test('all breakpoint flag combinations stay in their exact viewport bands', () => {
    for (let mask = 0; mask < 8; mask++) {
      const node = C.N('accordion');
      node.hide = {
        d: !!(mask & 1),
        t: !!(mask & 2),
        m: !!(mask & 4),
      };
      const css = C.treeCss([[node]], false);

      (['d', 't', 'm'] as Bp[]).forEach((breakpoint, bit) => {
        expect(mediaBody(css, VISIBILITY_MEDIA[breakpoint]).includes(hiddenRule(node)),
          `mask ${mask}, ${breakpoint}`).toBe(!!(mask & (1 << bit)));
      });
      expect(css.slice(0, css.indexOf(C.MQ.t) < 0 ? css.length : css.indexOf(C.MQ.t)))
        .not.toContain(hiddenRule(node));
    }
  });

  test('editor ghosts follow the same exact matrix without removing elements', () => {
    for (let mask = 0; mask < 8; mask++) {
      const node = C.N('accordion');
      node.hide = {
        d: !!(mask & 1),
        t: !!(mask & 2),
        m: !!(mask & 4),
      };
      const css = C.treeCss([[node]], true);

      (['d', 't', 'm'] as Bp[]).forEach((breakpoint, bit) => {
        expect(mediaBody(css, VISIBILITY_MEDIA[breakpoint]).includes(ghostRule(node)),
          `mask ${mask}, ${breakpoint}`).toBe(!!(mask & (1 << bit)));
      });
      expect(css).not.toContain(hiddenRule(node));
    }
  });

  test('visible bands retain each widget and class display mode without generated resets', () => {
    const accordion = C.N('accordion');
    const gallery = C.N('gallery');
    const flexBox = C.N('box', { layout: 'flex' });
    const gridBox = C.N('box', { layout: 'grid' });
    const button = C.N('button');
    const styled = C.N('heading');
    const displayClass = C.classAdd('Responsive display', {
      d: { display: 'inline-grid' }, t: { display: 'flex' }, m: { display: 'grid' },
    });
    C.classApply(styled, displayClass);
    const nodes = [accordion, gallery, flexBox, gridBox, button, styled];
    nodes.forEach(node => { node.hide = { d: true }; });

    const css = C.treeCss([nodes], false);
    expect(css).toContain('.pagecraft-accordion{display:flex');
    expect(css).toContain('.pagecraft-gallery{display:grid');
    expect(css).toContain('.pagecraft-box.l-flex{display:flex');
    expect(css).toContain('.pagecraft-box.l-grid{display:grid');
    expect(css).toContain('.pagecraft-button{display:inline-flex');
    expect(css).toContain(`.c-${displayClass}{display:inline-grid;}`);
    expect(mediaBody(css, C.MQ.t)).toContain(`.c-${displayClass}{display:flex;}`);
    expect(mediaBody(css, C.MQ.m)).toContain(`.c-${displayClass}{display:grid;}`);

    const desktopVisibility = mediaBody(css, VISIBILITY_MEDIA.d);
    nodes.forEach(node => expect(desktopVisibility).toContain(hiddenRule(node)));
    for (const breakpoint of ['t', 'm'] as const) {
      const visible = mediaBody(css, VISIBILITY_MEDIA[breakpoint]);
      nodes.forEach(node => expect(visible).not.toContain(`${selector(node)}{display:`));
    }
  });

  test('page, globals, and component definition and instance rules keep their stylesheet ownership', () => {
    const header = C.N('accordion');
    header.hide = { d: true };
    const footer = C.N('gallery');
    footer.hide = { t: true };
    const pageButton = C.N('button');
    pageButton.hide = { m: true };
    const componentRoot = C.N('box', { layout: 'grid' });
    C.state.header = [header];
    C.state.footer = [footer];
    C.state.pages[0].tree = [pageButton, componentRoot];

    const componentId = C.componentFromNode(componentRoot.id, 'Responsive card');
    expect(componentId).toBeTruthy();
    const definition = C.findComponent(componentId!)!;
    const instance = C.state.pages[0].tree[1];
    definition.node.hide = { t: true };
    instance.hide = { m: true };

    const wordpress = C.wordpressStyles(C.state.pages[0]);
    expect(mediaBody(wordpress.global, VISIBILITY_MEDIA.d)).toContain(hiddenRule(header));
    expect(mediaBody(wordpress.global, VISIBILITY_MEDIA.t)).toContain(hiddenRule(footer));
    expect(wordpress.global).not.toContain(selector(pageButton));
    expect(wordpress.global).not.toContain(selector(definition.node));
    expect(mediaBody(wordpress.page, VISIBILITY_MEDIA.t)).toContain(hiddenRule(definition.node));
    expect(mediaBody(wordpress.page, VISIBILITY_MEDIA.m)).toContain(hiddenRule(pageButton));
    expect(mediaBody(wordpress.page, VISIBILITY_MEDIA.m)).toContain(hiddenRule(instance));
    expect(wordpress.page).not.toContain(selector(header));
    expect(wordpress.page).not.toContain(selector(footer));

    const standalone = C.buildPage(C.state.pages[0]);
    for (const node of [header, footer, pageButton, definition.node, instance]) {
      expect(standalone).toContain(hiddenRule(node));
    }
  });

  test('integer breakpoint boundaries cover exactly one visibility band', () => {
    const node = C.N('accordion');
    node.hide = { d: true, t: true, m: true };
    const css = C.treeCss([[node]], false);
    const bodies = {
      d: mediaBody(css, VISIBILITY_MEDIA.d),
      t: mediaBody(css, VISIBILITY_MEDIA.t),
      m: mediaBody(css, VISIBILITY_MEDIA.m),
    };
    const bandAt = (width: number): Bp => width >= 1025 ? 'd' : width >= 768 ? 't' : 'm';

    for (const [width, expected] of [[1440, 'd'], [1025, 'd'], [1024, 't'], [834, 't'],
      [768, 't'], [767, 'm'], [414, 'm']] as Array<[number, Bp]>) {
      expect(bandAt(width), `${width}px`).toBe(expected);
      expect(bodies[expected], `${width}px`).toContain(hiddenRule(node));
    }
    expect((css.match(/@media \(min-width:1025px\)/g) || [])).toHaveLength(1);
    expect((css.match(/@media \(min-width:768px\) and \(max-width:1024px\)/g) || [])).toHaveLength(1);
    expect((css.match(/@media \(max-width:767px\)/g) || [])).toHaveLength(1);
  });
});
