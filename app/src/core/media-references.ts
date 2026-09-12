import type { Doc, Node } from './types.ts';

export type MediaPath = (string | number)[];
export interface MediaReference {
  assetId: string;
  path: MediaPath;
  label: string;
  scope: 'page' | 'header' | 'footer' | 'component' | 'block' | 'cms' | 'site' | 'style';
  ownerId?: string;
  nodeId?: string;
}

const managedUrlPattern = () => /url\(\s*(['"]?)(asset:[A-Za-z0-9][A-Za-z0-9._:-]*(?:@\d+)?)\1\s*\)/gi;
const tokenPattern = () => /asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@(\d+))?/g;

/** References are addresses in the saved document, not expanded component instances.
 * Custom HTML/CSS is deliberately excluded: it cannot be safely rewritten as a field.
 */
export function mediaReferences(document: Doc): MediaReference[] {
  const result: MediaReference[] = [];
  type Context = Omit<MediaReference, 'assetId' | 'path'>;
  const scan = (value: unknown, path: MediaPath, context: Context, embedded = false) => {
    if (typeof value !== 'string') return;
    if (!embedded && !/^asset:[A-Za-z0-9][A-Za-z0-9._:-]*(?:@\d+)?$/.test(value)) return;
    const seen = new Set<string>();
    const tokens = embedded ? Array.from(value.matchAll(managedUrlPattern()), match => match[2]).join(' ') : value;
    for (const match of tokens.matchAll(tokenPattern())) {
      if (!seen.has(match[1])) result.push({ ...context, assetId: match[1], path });
      seen.add(match[1]);
    }
  };
  const styles = (value: unknown, path: MediaPath, context: Context) => {
    if (!value || typeof value !== 'object') return;
    Object.entries(value).forEach(([key, child]) => {
      if (typeof child === 'string') {
        if (key === 'background' || key === 'background-image' || key === 'mask-image') scan(child, [...path, key], context, true);
      } else styles(child, [...path, key], context);
    });
  };
  const nodes = (list: Node[], path: MediaPath, context: Context) => list.forEach((node, i) => {
    const base = [...path, i];
    const where = { ...context, nodeId: node.id };
    const props = node.props as unknown as Record<string, unknown>;
    const fields = node.type === 'image' ? ['src'] : node.type === 'video' ? ['src', 'poster'] : [];
    fields.forEach(key => scan(props[key], [...base, 'props', key], where));
    if (node.type === 'gallery' && Array.isArray(props.items)) props.items.forEach((item, j) =>
      scan(item.src, [...base, 'props', 'items', j, 'src'], where));
    const definition = document.meta.components?.find(def => def.id === node.use);
    definition?.props.filter(prop => prop.t === 'img').forEach(prop =>
      scan(node.vals?.[prop.k], [...base, 'vals', prop.k], where));
    styles(node.css, [...base, 'css'], where);
    styles(node.st, [...base, 'st'], where);
    nodes(node.children, [...base, 'children'], context);
  });
  document.pages.forEach((page, i) => {
    const context: Context = { scope: 'page', label: page.name, ownerId: page.id };
    scan(page.ogImage, ['pages', i, 'ogImage'], context);
    nodes(page.tree, ['pages', i, 'tree'], context);
  });
  for (const scope of ['header', 'footer'] as const) nodes(document[scope], [scope], { scope, label: `Global ${scope}` });
  document.meta.components?.forEach((def, i) => {
    const context: Context = { scope: 'component', label: def.name, ownerId: def.id };
    // Reuse the node walker without introducing an artificial array address.
    const start = result.length;
    nodes([def.node], ['meta', 'components', i, 'node'], context);
    result.slice(start).forEach(ref => ref.path.splice(4, 1));
    def.props.forEach((prop, j) => {
      if (prop.t !== 'img') return;
      scan(prop.def, ['meta', 'components', i, 'props', j, 'def'], context);
      def.variants?.forEach((variant, k) => scan(variant.values[prop.k], ['meta', 'components', i, 'variants', k, 'values', prop.k], context));
    });
  });
  document.meta.blocks.forEach((block, i) => {
    const start = result.length;
    nodes([block.node], ['meta', 'blocks', i, 'node'], { scope: 'block', label: block.name, ownerId: block.id });
    result.slice(start).forEach(ref => ref.path.splice(4, 1));
  });
  document.meta.collections?.forEach((collection, i) => collection.items.forEach((item, j) =>
    collection.fields.filter(field => field.type === 'image').forEach(field => scan(item.values[field.id],
      ['meta', 'collections', i, 'items', j, 'values', field.id],
      { scope: 'cms', label: `${collection.name} / ${item.slug} / ${field.name}`, ownerId: collection.id }))));
  for (const key of ['favicon', 'ogImage'] as const) scan(document.meta[key], ['meta', key], { scope: 'site', label: key === 'favicon' ? 'Favicon' : 'Social image' });
  styles(document.meta.tokens, ['meta', 'tokens'], { scope: 'style', label: 'Shared styles' });
  return result;
}

/** Pure operation: the caller owns version checks and the single editor Undo transaction. */
export function replaceMediaReferences(document: Doc, sourceId: string, replacementId: string): Doc {
  if (![sourceId, replacementId].every(id => /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id))) throw new Error('Invalid asset ID');
  const next = structuredClone(document);
  for (const ref of mediaReferences(next).filter(ref => ref.assetId === sourceId)) {
    let parent: any = next;
    for (const key of ref.path.slice(0, -1)) parent = parent[key];
    const key = ref.path[ref.path.length - 1];
    const replaceToken = (value: string) => value.replace(tokenPattern(), (token: string, id: string, width: string) =>
      id === sourceId ? `asset:${replacementId}${width ? `@${width}` : ''}` : token);
    parent[key] = parent[key].startsWith('asset:') ? replaceToken(parent[key])
      : parent[key].replace(managedUrlPattern(), (value: string) => replaceToken(value));
  }
  return next;
}
