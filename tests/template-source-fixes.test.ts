import { expect, test } from 'vitest';
import * as core from '../app/src/core/index';
import { followHeadingFont } from '../premade-sites/lib/heading-font';

/* Template source fixes from the 20 Nov 2026 Cloud QA: Settings › Typography › Heading font must
   change a template's headings (three curated templates pinned their heading styles to a font by
   name), and a button must show the fill it sets. */
function fixture(headFont: string, font: string, headingFamily: string) {
  core.blankProject('Heading font fixture');
  const tokens = core.defaultTokens();
  for (const style of tokens.text) {
    if (/^h[1-6]$/.test(String(style.tag))) style.css.d['font-family'] = headingFamily;
    if (['lead', 'body', 'small'].includes(style.id)) style.css.d['font-family'] = 'inherit';
  }
  core.state.meta = { ...core.state.meta, font, headFont, tokens };
  const heading = core.N('heading', { level: 'h2', text: 'Our cabins', ts: 'title' });
  const paragraph = core.N('heading', { level: 'p', text: 'Body copy at paragraph level', ts: 'body' });
  const quote = core.N('quote', { text: 'A quiet weekend.', ts: 'title' });
  core.state.pages[0].tree = [core.N('section', {}, {}, [heading, paragraph, quote])];
  core.state.header = []; core.state.footer = [];
  return { document: core.doc(), heading: heading.id, paragraph: paragraph.id, quote: quote.id };
}
const style = (document: ReturnType<typeof core.doc>, id: string) => document.meta.tokens!.text.find(s => s.id === id)!;
const find = (document: ReturnType<typeof core.doc>, id: string) => {
  let hit: any; const walk = (nodes: any[]) => nodes.forEach(n => { if (n.id === id) hit = n; walk(n.children || []); }); walk(document.pages[0].tree); return hit;
};

test('heading styles stop naming the heading font, so headings follow the setting', () => {
  const { document, heading } = fixture("Georgia, serif", 'Arial, sans-serif', 'Georgia, serif');
  const result = followHeadingFont(document);
  expect(result.styles.sort()).toEqual(['display', 'subtitle', 'title']);
  for (const id of result.styles) expect(style(document, id).css.d['font-family']).toBeUndefined();
  core.restore(document);
  // The heading rule carries the heading font, and no heading text style overrides it.
  expect(core.baseCss(false)).toMatch(/\.pagecraft-heading\{[^}]*font-family:Georgia, serif/);
  expect(JSON.stringify(core.tokenCss())).not.toMatch(/\.ts-(display|title|subtitle)\{[^}]*font-family/);
  expect(find(document, heading).css?.d?.['font-family']).toBeUndefined();
});

test('body styles keep inherit, so paragraph-level headings keep the body font', () => {
  const { document } = fixture('Georgia, serif', 'Arial, sans-serif', 'Georgia, serif');
  followHeadingFont(document);
  expect(style(document, 'body').css.d['font-family']).toBe('inherit');
  expect(style(document, 'lead').css.d['font-family']).toBe('inherit');
});

test('a quote using a heading style keeps its font on the element, so it looks the same', () => {
  const { document, quote } = fixture('Georgia, serif', 'Arial, sans-serif', 'Georgia, serif');
  const result = followHeadingFont(document);
  expect(result.kept).toEqual([quote]);
  expect(find(document, quote).css.d['font-family']).toBe('Georgia, serif');
});

test('inherit is removed only when the body font is the heading font', () => {
  const same = fixture("'Outfit',sans-serif", "'Outfit',sans-serif", 'inherit');
  expect(followHeadingFont(same.document).styles.length).toBe(3);
  const different = fixture("'Newsreader',serif", "'Outfit',sans-serif", 'inherit');
  expect(() => followHeadingFont(different.document)).toThrow(/renders/);
});

test('a heading style in a different font from the heading font is refused, not silently changed', () => {
  const { document } = fixture("'Manrope',sans-serif", 'Arial, sans-serif', 'Georgia, serif');
  expect(() => followHeadingFont(document)).toThrow(/not the heading font/);
});

test('a heading that names the heading font on itself drops it; another font stays', () => {
  const { document, heading } = fixture('Georgia, serif', 'Arial, sans-serif', 'Georgia, serif');
  const named = find(document, heading);
  named.css = { d: { 'font-family': "'Georgia',serif", 'font-size': '30px' }, m: { 'font-family': 'Georgia, serif' } };
  const other = core.N('heading', { level: 'h3', text: 'Signage', ts: 'subtitle' }, { d: { 'font-family': 'Courier, monospace' } });
  document.pages[0].tree[0].children.push(other);
  const result = followHeadingFont(document);
  expect(result.headings).toEqual([heading]);
  expect(named.css.d).toEqual({ 'font-size': '30px' });
  expect(named.css.m['font-family']).toBeUndefined();
  expect(other.css.d['font-family']).toBe('Courier, monospace');
});

/* The compiler drops an outline button's desktop fill when it equals the factory brand fill
   (it cannot tell it from an untouched default). solidFilledButtons relies on that rule. */
test('an outline button with the factory brand fill publishes no fill; solid keeps it', async () => {
  const { FACTORY_FILL, solidFilledButtons } = await import('../premade-sites/lib/filled-buttons');
  const { document } = fixture('Georgia, serif', 'Arial, sans-serif', 'Georgia, serif');
  const button = core.N('button', { text: 'Find your home', link: '#', variant: 'outline' }, { d: { 'background-color': FACTORY_FILL, color: '#fff' } });
  document.pages[0].tree[0].children.push(button);
  core.restore(document);
  const css = () => core.treeCss([core.state.pages[0].tree], false);
  const bridged = (text: string) => new RegExp(`\\.${core.nodeClass(button)}\\.pagecraft-button\\{[^}]*background-color:${FACTORY_FILL.replace(/[()]/g, '\\$&')}`).test(text);
  expect(bridged(JSON.stringify(css()))).toBe(false);
  expect(solidFilledButtons(document)).toEqual([button.id]);
  expect(button.props.variant).toBe('solid');
});

test('the same button compiled as solid keeps its brand fill', async () => {
  const { FACTORY_FILL } = await import('../premade-sites/lib/filled-buttons');
  const { document } = fixture('Georgia, serif', 'Arial, sans-serif', 'Georgia, serif');
  const button = core.N('button', { text: 'Find your home', link: '#', variant: 'solid' }, { d: { 'background-color': FACTORY_FILL, color: '#fff' } });
  document.pages[0].tree[0].children.push(button);
  core.restore(document);
  // Solid's variant rule has no specificity (:where), so the element's own rule supplies the fill.
  expect(JSON.stringify(core.treeCss([core.state.pages[0].tree], false))).toContain(`.${core.nodeClass(button)}{`);
  expect(core.baseCss(false)).toMatch(/:where\(\.pagecraft-button\[data-variant=solid\]\)/);
});
