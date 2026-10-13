import type { Doc, Node as PcNode } from './types';

type NodePlace = { node: PcNode; parent: string; index: number; region: string };
const KIND: Record<string, string> = {
  section: 'section', row: 'row', column: 'column', box: 'box', heading: 'heading', text: 'text', quote: 'quote',
  image: 'image', gallery: 'gallery', video: 'video', icon: 'icon', button: 'button', nav: 'menu', form: 'form',
  accordion: 'accordion', tabs: 'tabs', table: 'table', code: 'code', crumbs: 'breadcrumbs', slider: 'slider',
  embed: 'embed', spacer: 'spacer', divider: 'divider', list: 'list'
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const kind = (node: PcNode) => KIND[node.type] || 'element';

function nodes(doc: Doc): Map<string, NodePlace> {
  const out = new Map<string, NodePlace>();
  const walk = (list: PcNode[], parent: string, region: string) => list.forEach((node, index) => {
    out.set(node.id, { node, parent, index, region });
    walk(node.children || [], node.id, region);
  });
  walk(doc.header, '', 'header');
  doc.pages.forEach(page => walk(page.tree, '', `page:${page.id}`));
  walk(doc.footer, '', 'footer');
  for (const component of doc.meta.components || []) walk([component.node], '', `component:${component.id}`);
  for (const block of doc.meta.blocks || []) walk([block.node], '', `block:${block.id}`);
  return out;
}

function changedLeafKeys(before: unknown, after: unknown): string[] {
  const keys = new Set<string>();
  const collect = (value: any) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === 'object') collect(child); else keys.add(key);
    }
  };
  collect(before); collect(after);
  const values = (value: any, wanted: string): unknown[] => {
    const found: unknown[] = [];
    const visit = (part: any) => {
      if (!part || typeof part !== 'object') return;
      for (const [key, child] of Object.entries(part)) {
        if (key === wanted && (!child || typeof child !== 'object')) found.push(child);
        else if (child && typeof child === 'object') visit(child);
      }
    };
    visit(value);
    return found;
  };
  return [...keys].filter(key => !same(values(before, key), values(after, key)));
}

function cssChange(before: PcNode, after: PcNode): string | null {
  const changed = changedLeafKeys({ css: before.css, st: before.st }, { css: after.css, st: after.st });
  if (!changed.length) return null;
  if (changed.some(key => /^(padding|margin)(-|$)|^gap$/.test(key))) return 'spacing';
  if (changed.some(key => /font-size|width|height|max-width|min-height|flex-(?:grow|basis)/.test(key))) return 'size';
  if (changed.some(key => /align|justify|text-align/.test(key))) return 'alignment';
  if (changed.some(key => /color/.test(key))) return 'colour';
  if (changed.some(key => /background/.test(key))) return 'background';
  if (changed.some(key => /^border/.test(key))) return 'border';
  if (changed.some(key => /shadow/.test(key))) return 'shadow';
  if (changed.some(key => /opacity/.test(key))) return 'opacity';
  if (changed.some(key => /transform/.test(key))) return 'transform';
  if (changed.some(key => /position|^(?:top|right|bottom|left|z-index)$/.test(key))) return 'position';
  return 'style';
}

function propChange(before: PcNode, after: PcNode): string | null {
  const keys = new Set([...Object.keys(before.props || {}), ...Object.keys(after.props || {})]);
  const changed = [...keys].filter(key => !same((before.props as any)[key], (after.props as any)[key]));
  if (!changed.length && !same(before.vals, after.vals)) return 'content';
  if (!changed.length) return null;
  if (changed.some(key => /link|href|target|url|src/.test(key))) return changed.some(key => /src/.test(key)) ? 'source' : 'link';
  if (changed.some(key => /text|html|label|caption|alt|title|by|source/.test(key))) return 'text';
  return 'content';
}

/** Infer an action name from structure and field names only. Saved values never enter labels. */
export function inferHistoryAction(before: Doc, after: Doc): string {
  const beforePages = new Map(before.pages.map((page, index) => [page.id, { page, index }]));
  const afterPages = new Map(after.pages.map((page, index) => [page.id, { page, index }]));
  if (after.pages.some(page => !beforePages.has(page.id))) return 'Add page';
  if (before.pages.some(page => !afterPages.has(page.id))) return 'Remove page';
  if (after.pages.some((page, index) => beforePages.get(page.id)?.index !== index)) return 'Move page';

  /* Definitions contain full node trees. Inspect their identities before flattening nodes:
     saved blocks intentionally reuse source ids, while component creation replaces the source
     tree with an instance, so node-level inference cannot name either operation reliably. */
  const beforeBlocks = before.meta.blocks || [], afterBlocks = after.meta.blocks || [];
  const oldBlocks = new Map(beforeBlocks.map(block => [block.id, block]));
  const newBlocks = new Map(afterBlocks.map(block => [block.id, block]));
  if (afterBlocks.some(block => !oldBlocks.has(block.id))) return 'Save block';
  if (beforeBlocks.some(block => !newBlocks.has(block.id))) return 'Delete block';
  const beforeComponents = before.meta.components || [], afterComponents = after.meta.components || [];
  const oldComponents = new Map(beforeComponents.map(component => [component.id, component]));
  const newComponents = new Map(afterComponents.map(component => [component.id, component]));
  if (afterComponents.some(component => !oldComponents.has(component.id))) return 'Create component';
  if (beforeComponents.some(component => !newComponents.has(component.id))) return 'Delete component';
  for (const block of afterBlocks) if (oldBlocks.get(block.id)?.name !== block.name) return 'Rename block';
  for (const component of afterComponents) {
    const old = oldComponents.get(component.id)!;
    if (old.name !== component.name) return 'Rename component';
    if (!same(old.props, component.props)) return 'Change component settings';
  }

  /* CMS deletes atomically disconnect list, page and reference bindings. Recognize the
     collection/schema change before those necessary node prop changes so history names the
     action the editor chose rather than one cleanup side effect. */
  const beforeCollections = before.meta.collections || [];
  const afterCollections = after.meta.collections || [];
  const oldCollections = new Map(beforeCollections.map(collection => [collection.id, collection]));
  const newCollections = new Map(afterCollections.map(collection => [collection.id, collection]));
  if (afterCollections.some(collection => !oldCollections.has(collection.id))) return 'Add collection';
  if (beforeCollections.some(collection => !newCollections.has(collection.id))) return 'Delete collection';
  for (const collection of afterCollections) {
    const old = oldCollections.get(collection.id)!;
    const oldFields = new Map((old.fields || []).map(field => [field.id, field]));
    const newFields = new Map((collection.fields || []).map(field => [field.id, field]));
    if (collection.fields.some(field => !oldFields.has(field.id))) return 'Add collection field';
    if (old.fields.some(field => !newFields.has(field.id))) return 'Delete collection field';
    if (!same(old.fields, collection.fields)) return 'Change collection fields';
    const oldItems = new Map((old.items || []).map(item => [item.id, item]));
    const newItems = new Map((collection.items || []).map(item => [item.id, item]));
    if (collection.items.some(item => !oldItems.has(item.id))) return 'Add collection entry';
    if (old.items.some(item => !newItems.has(item.id))) return 'Delete collection entry';
    if (!same(old.items, collection.items)) return 'Change collection content';
    if (old.name !== collection.name) return 'Rename collection';
    if (!same({ slug: old.slug, detail: old.detail, views: old.views }, { slug: collection.slug, detail: collection.detail, views: collection.views })) return 'Change collection settings';
  }

  const a = nodes(before), b = nodes(after);
  const added = [...b.values()].reverse().find(place => !a.has(place.node.id));
  if (added) return `Add ${kind(added.node)}`;
  const removed = [...a.values()].find(place => !b.has(place.node.id));
  if (removed) return `Remove ${kind(removed.node)}`;
  const moved = [...b.values()].find(place => {
    const old = a.get(place.node.id);
    return old && (old.parent !== place.parent || old.index !== place.index || old.region !== place.region);
  });
  if (moved) return `Move ${kind(moved.node)}`;

  for (const [id, old] of a) {
    const current = b.get(id);
    if (!current) continue;
    const css = cssChange(old.node, current.node);
    if (css) return `Change ${kind(current.node)} ${css}`;
    const prop = propChange(old.node, current.node);
    if (prop) return `Change ${kind(current.node)} ${prop}`;
    if (!same(old.node.hide, current.node.hide)) return `Change ${kind(current.node)} visibility`;
    if (!same(old.node.anim, current.node.anim)) return `Change ${kind(current.node)} motion`;
    if (!same(old.node.cls, current.node.cls)) return `Change ${kind(current.node)} classes`;
    if (!same(old.node.adv, current.node.adv)) return `Change ${kind(current.node)} advanced settings`;
  }

  for (const page of after.pages) {
    const old = beforePages.get(page.id)?.page;
    if (!old) continue;
    if (old.name !== page.name) return 'Rename page';
    if (old.slug !== page.slug) return 'Change page URL';
    if (!same({ title: old.title, desc: old.desc, ogImage: old.ogImage, collection: old.collection, bindTitle: old.bindTitle, bindDesc: old.bindDesc, headHtml: old.headHtml },
      { title: page.title, desc: page.desc, ogImage: page.ogImage, collection: page.collection, bindTitle: page.bindTitle, bindDesc: page.bindDesc, headHtml: page.headHtml })) return 'Change page settings';
  }
  if (before.meta.name !== after.meta.name) return 'Rename project';
  if (!same(before.meta, after.meta)) return 'Change project settings';
  if (!same(before.header, after.header)) return 'Edit header';
  if (!same(before.footer, after.footer)) return 'Edit footer';
  return 'Edit page';
}

export function conciseHistoryLabel(label?: string): string | null {
  const clean = label?.replace(/\s+/g, ' ').trim();
  return clean ? clean.slice(0, 80) : null;
}
