import type { Doc, Node } from '../../app/src/core/types.ts';

/* An outline, ghost or link button draws no fill unless its own fill is treated as authored.
   The compiler cannot tell a desktop fill equal to the Button factory default (the brand colour)
   from an untouched default, so it leaves that fill to the variant, which draws none. The editor
   marks a fill chosen in the inspector; a template source sets CSS directly and has no mark. So
   Salt House's terracotta buttons, built as outlines, published with no fill: "Find your holiday
   home" was white text on chalk (Cloud rendered review, 20 Nov 2026).

   A button that names the factory fill on desktop without the authored mark is a solid button;
   this gives it that variant so the fill it names is the fill it shows. Other fills already
   render (the compiler bridges any value that differs from the default) and are left alone. */
export const FACTORY_FILL = 'var(--c-brand)';
const AUTHORED = '--pc-authored-button-';

export function hiddenFactoryFill(node: Node): boolean {
  if (node.type !== 'button' || String(node.props?.variant || 'solid') === 'solid') return false;
  const d = node.css?.d || {};
  const fill = String(d['background-color'] ?? d.background ?? '').replace(/\s+/g, '');
  return fill === FACTORY_FILL && d[AUTHORED + 'background-color'] !== '1' && d[AUTHORED + 'background'] !== '1';
}

export function solidFilledButtons(document: Doc): string[] {
  const changed: string[] = [];
  const visit = (nodes: Node[] | null | undefined) => {
    for (const node of nodes || []) {
      if (hiddenFactoryFill(node)) { node.props.variant = 'solid'; changed.push(node.id); }
      visit(node.children);
    }
  };
  visit(document.header); visit(document.footer);
  for (const page of document.pages) { visit(page.tree); visit(page.header); visit(page.footer); }
  for (const definition of document.meta.components || []) visit([definition.node]);
  return changed;
}
