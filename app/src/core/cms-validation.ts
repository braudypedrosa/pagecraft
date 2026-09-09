import type { Collection, Doc, Item } from './types.ts';

export const cmsBoolean = (value: unknown) => ['1', 'true', 'yes'].includes(String(value).toLowerCase());
export const cmsChoices = (value?: string) => (value || '').split(',').map(s => s.trim()).filter(Boolean);
/** Portable conservative rich-text check; the server additionally uses its HTML sanitizer. */
export function cmsSafeRich(value: string): boolean {
  const tags = new Set(['p','br','h2','h3','blockquote','ul','ol','li','b','strong','i','em','u','s','strike','a','div']);
  if (/\x3c!--|\x3c!|\x3c\?|[\u0000-\u0008]/.test(value)) return false;
  let rest = value.replace(/<\/?([a-z][a-z0-9]*)([^<>]*)>/gi, (whole, tag, attrs) => {
    if (!tags.has(tag.toLowerCase())) return whole;
    if (/^<\//.test(whole)) return attrs.trim() ? whole : '';
    if (!attrs.trim() || (tag.toLowerCase() === 'br' && attrs.trim() === '/')) return '';
    if (tag.toLowerCase() !== 'a') return whole;
    const match = attrs.match(/^\s+href=(?:"([^"]*)"|'([^']*)')\s*$/i);
    const href = match && (match[1] ?? match[2]);
    return href != null && !/[&\u0000-\u0020]/.test(href) && /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href) ? '' : whole;
  });
  return !/[<>]/.test(rest);
}
export function validateCmsEntry(doc: Doc, col: Collection, item: Item, assets: ReadonlySet<string>, richSafe = cmsSafeRich): Record<string,string> {
  const errors: Record<string,string> = {};
  if (!item.id || col.items.filter(i => i.id === item.id).length > 1) errors._entry = 'Entry IDs must be unique.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug) || ['index','assets','admin','api','edit','templates','content','robots','sitemap'].includes(item.slug)) errors._slug = 'Use a non-reserved URL slug with lowercase letters, numbers and hyphens.';
  if (col.items.some(i => i.id !== item.id && i.slug === item.slug) || doc.pages.some(p => !p.collection && p.slug === `${col.slug}/${item.slug}`)) errors._slug = 'This URL is already in use.';
  for (const key of Object.keys(item.values)) if (!col.fields.some(f => f.id === key)) errors[key] = 'This field no longer exists.';
  for (const f of col.fields) {
    const value = item.values[f.id] ?? '';
    const fail = (message: string) => { errors[f.id] = message; };
    if (typeof value !== 'string') { fail('Use a text-encoded field value.'); continue; }
    if (f.required && !value.trim()) { fail(`${f.name} is required.`); continue; }
    if (!value) continue;
    if (new TextEncoder().encode(value).length > (f.type === 'rich' ? 100000 : 5000)) { fail('This value is too long.'); continue; }
    if (f.type !== 'rich' && /[\u0000-\u001f\u007f]/.test(value)) { fail('Remove unsupported control characters.'); continue; }
    switch (f.type) {
      case 'rich': if (!richSafe(value)) fail('Use supported text formatting only.'); break;
      case 'number': if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) || !Number.isFinite(Number(value))) fail('Enter a valid number.'); break;
      case 'date': if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail('Enter a valid date.'); break;
      case 'bool': if (!['0','1','true','false','yes','no'].includes(value.toLowerCase())) fail('Choose yes or no.'); break;
      case 'option': if (!cmsChoices(f.opts).includes(value)) fail('Choose one of the configured options.'); break;
      case 'ref': if (!doc.meta.collections?.find(c => c.id === f.ref)?.items.some(i => i.id === value)) fail('Choose an existing entry.'); break;
      case 'image': { const id = value.match(/^asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@\d+)?$/)?.[1]; if (!id || !assets.has(id)) fail('Choose an image from this site’s media library.'); break; }
      case 'link': if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value) || /[\s<>]/.test(value)) fail('Enter a safe URL, site path or anchor.'); break;
      case 'text': break;
      default: fail('Unsupported field type.');
    }
  }
  return errors;
}
