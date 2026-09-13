import { mediaReferences } from "../../app/src/core/media-references.ts";
import type { Doc } from '../../app/src/core/types.ts';

export interface PublicationChange {
  group: 'Pages' | 'CMS content' | 'Shared components' | 'Global regions' | 'Styles' | 'Assets';
  label: string;
  status: 'added' | 'removed' | 'changed';
  pages: { id: string; name: string; slug: string }[];
}
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => JSON.stringify(key) + ':' + stable(child)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
};
/** Shared document changes conservatively include every page: nested components, bindings,
 * custom CSS and global regions can affect pages without a direct asset or node reference. */
export function publicationChanges(before: Doc | null, after: Doc): PublicationChange[] {
  const result: PublicationChange[] = [];
  const pages = after.pages.map(({ id, name, slug }) => ({ id, name, slug }));
  const add = (group: PublicationChange['group'], label: string, old: unknown, next: unknown, affected = pages) => {
    if (stable(old) === stable(next)) return;
    result.push({ group, label, status: old == null ? 'added' : next == null ? 'removed' : 'changed', pages: affected });
  };
  const oldPages = new Map((before?.pages || []).map(page => [page.id, page]));
  for (const page of after.pages) {
    add('Pages', page.name, oldPages.get(page.id), page, [{ id: page.id, name: page.name, slug: page.slug }]);
    oldPages.delete(page.id);
  }
  for (const page of oldPages.values()) add('Pages', page.name, page, null, [{ id: page.id, name: page.name, slug: page.slug }]);
  add('Pages', 'Page order and home route', before?.pages.map(page => page.id), after.pages.map(page => page.id));
  add('CMS content', 'Collections and entries', before?.meta.collections, after.meta.collections);
  add('Shared components', 'Component definitions', before?.meta.components, after.meta.components);
  add('Shared components', 'Saved blocks', before?.meta.blocks, after.meta.blocks, []);
  add('Global regions', 'Header', before?.header, after.header);
  add('Global regions', 'Footer', before?.footer, after.footer);
  const settings = (doc: Doc | null) => doc ? Object.fromEntries(Object.entries(doc.meta)
    .filter(([key]) => !['collections', 'components', 'blocks', 'ogImage', 'favicon'].includes(key))) : null;
  add('Styles', 'Site styles and settings', settings(before), settings(after));
  add('Assets', 'Social image', before?.meta.ogImage, after.meta.ogImage);
  add('Assets', 'Favicon', before?.meta.favicon, after.meta.favicon);
  add('Assets', 'Managed image references', before ? mediaReferences(before) : null, mediaReferences(after));
  return result;
}
