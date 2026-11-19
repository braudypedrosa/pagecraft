import type { Doc, Node, Page } from '../../app/src/core/types.ts';

/* A component instance that swaps its photo through an image property needs that photo's
   intrinsic size recorded beside the value, or it publishes without width/height and Site
   checks reports "no width/height" once per use. The editor records it when someone picks an
   image (instImageSizeSet); template sources set the value directly and never did.

   This records the size for every image-property value in a template document, using the
   size the same asset has wherever the template places it as an ordinary image. The value
   format matches imageSizeKey/imageSizeValue in the core. A value whose asset has no known
   size throws, so a template cannot quietly ship a guessed size. */
const SIZE_KEY = (key: string) => '@image-size:' + key;
const ASSET = /^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function each(nodes: Node[] | undefined, visit: (node: Node) => void) {
  for (const node of nodes || []) { visit(node); each(node.children, visit); }
}

export function recordInstanceImageSizes(document: Doc): number {
  const definitions = document.meta.components || [];
  const roots: Node[][] = [document.header, document.footer,
    ...document.pages.flatMap((page: Page) => [page.tree, page.header ?? [], page.footer ?? []]),
    ...definitions.map(definition => [definition.node])];

  const sizes = new Map<string, { w: number; h: number }>();
  for (const root of roots) each(root, node => {
    const src = String(node.props?.src || ''), w = Number(node.props?.w), h = Number(node.props?.h);
    if (node.type === 'image' && ASSET.test(src) && Number.isSafeInteger(w) && w > 0 && Number.isSafeInteger(h) && h > 0) {
      const known = sizes.get(src);
      if (known && (known.w !== w || known.h !== h)) throw new Error(`${src} is placed at two sizes (${known.w}×${known.h}, ${w}×${h})`);
      sizes.set(src, { w, h });
    }
  });

  /* Which image properties actually drive an image's source in each definition. */
  const imageKeys = new Map<string, string[]>();
  for (const definition of definitions) {
    const keys: string[] = [];
    each([definition.node], node => {
      const binding = node.bind?.src;
      if (node.type === 'image' && binding?.src === 'prop' && binding.path
        && (definition.props || []).some(prop => prop.k === binding.path && prop.t === 'img')) keys.push(binding.path);
    });
    if (keys.length) imageKeys.set(definition.id, [...new Set(keys)]);
  }

  let recorded = 0;
  for (const root of roots) each(root, node => {
    const keys = node.use ? imageKeys.get(node.use) : undefined;
    if (!keys) return;
    const definition = definitions.find(item => item.id === node.use)!;
    for (const key of keys) {
      const value = node.vals && Object.prototype.hasOwnProperty.call(node.vals, key)
        ? node.vals[key] : String((definition.props || []).find(prop => prop.k === key)?.def || '');
      if (!ASSET.test(value)) continue;
      const size = sizes.get(value);
      if (!size) throw new Error(`No placed image gives ${value} a size for ${definition.name}`);
      node.vals = { ...(node.vals || {}), [SIZE_KEY(key)]: JSON.stringify({ src: value, w: size.w, h: size.h }) };
      recorded += 1;
    }
  });
  return recorded;
}
