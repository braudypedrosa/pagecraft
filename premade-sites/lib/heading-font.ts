import type { Doc, Node } from '../../app/src/core/types.ts';

/* Headings follow Settings › Typography › Heading font through `.pagecraft-heading`, unless the
   heading's text style names a font of its own. Several templates gave their heading styles the
   heading font by name (or `inherit`, which takes the body font), so a site owner who changed the
   Heading font saw no heading change (Cloud editing QA, 20 Nov 2026).

   This removes that pinned font from heading text styles (tag h1–h6) when it renders exactly the
   font the heading font already gives, so nothing looks different until the owner changes it.
   Body-text styles keep `inherit`: some body copy uses the heading element at paragraph level and
   must keep the body font. A non-heading element that uses a heading style (a testimonial quote)
   keeps its font on the element itself, because the heading font does not reach it. A heading
   that names the heading font on itself drops it for the same reason as the styles. */
const first = (stack: string) => stack.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();

export function followHeadingFont(document: Doc): { styles: string[]; kept: string[]; headings: string[] } {
  const head = String(document.meta.headFont || ''), body = String(document.meta.font || '');
  if (!head) throw new Error('Template has no heading font to follow');
  const removed = new Map<string, string>();
  for (const style of document.meta.tokens?.text || []) {
    const family = style.css?.d?.['font-family'];
    if (!family || !/^h[1-6]$/.test(String(style.tag || ''))) continue;
    const renders = family === 'inherit' ? body : family;
    if (first(renders) !== first(head)) throw new Error(`Text style ${style.id} renders ${renders}, not the heading font ${head}`);
    removed.set(style.id, family);
    delete style.css.d['font-family'];
  }
  const kept: string[] = [], headings: string[] = [];
  const visit = (nodes: Node[] | null | undefined) => {
    for (const node of nodes || []) {
      if (node.type === 'heading') for (const css of Object.values(node.css || {})) {
        const own = css?.['font-family'];
        if (own && own !== 'inherit' && first(own) === first(head)) { delete css['font-family']; if (!headings.includes(node.id)) headings.push(node.id); }
      }
      const family = removed.get(String(node.props?.ts || ''));
      if (family && node.type !== 'heading' && family !== 'inherit') {
        node.css = node.css || {};
        node.css.d = node.css.d || {};
        if (!node.css.d['font-family']) { node.css.d['font-family'] = family; kept.push(node.id); }
      }
      visit(node.children);
    }
  };
  visit(document.header); visit(document.footer);
  for (const page of document.pages) { visit(page.tree); visit(page.header); visit(page.footer); }
  for (const definition of document.meta.components || []) visit([definition.node]);
  return { styles: [...removed.keys()], kept, headings };
}
