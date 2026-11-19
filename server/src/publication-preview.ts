import type { HostedPublicationStore, PublicationSummary } from './publications.ts';

export interface PublicationPreviewOptions {
  /** A URL that serves this snapshot file without cookies, or null to inline it. Images make
   *  up nearly all of a page's weight; inlining them as base64 turned one page into megabytes
   *  that had to be rebuilt and re-sent on every look. Fonts and stylesheets stay inline:
   *  fonts from an opaque origin would also need CORS, and they are small. */
  link?: (path: string, mediaType: string) => string | null;
  /** Mark images without a loading attribute lazy. A published page may fetch every photo at
   *  once; over a slow host link the first screen then finishes last. Lazy images in or near
   *  view still load at once, so what the preview shows is unchanged. */
  lazyImages?: boolean;
}

/** An opaque sandbox must not depend on third-party cookies for image/font requests.
 * Inline this snapshot's materialized resources, or point at cookie-free links the caller
 * signs; never fetch an external URL. */
export async function publicationPreviewHtml(store: HostedPublicationStore, publication: PublicationSummary, path: string, html: string, options: PublicationPreviewOptions = {}): Promise<string> {
  const files = new Map(publication.files.filter(file => !file.mediaType.startsWith('text/html')).map(file => [file.path, file.mediaType]));
  const linked = new Map<string, string>();
  for (const [file, type] of files) {
    const url = options.link?.(file, type);
    if (url) linked.set(file, url);
  }
  const resources = new Map<string, { type: string; bytes: Uint8Array }>();
  await Promise.all([...files].filter(([file]) => !linked.has(file)).map(async ([file, type]) => {
    const bytes = await store.file(publication, file);
    if (!bytes) throw new Error('Snapshot resource unavailable');
    resources.set(file, { type, bytes });
  }));
  const cache = new Map<string, string>();
  const active = new Set<string>();
  const resource = (raw: string, from: string): string => {
    if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return raw;
    let target: string;
    try { target = decodeURIComponent(new URL(raw, `https://preview.invalid/${from}`).pathname.slice(1)); }
    catch { return raw; }
    const link = linked.get(target);
    if (link) return link;
    const stored = resources.get(target);
    if (!stored) return raw;
    if (cache.has(target)) return cache.get(target)!;
    if (active.has(target)) throw new Error('Cyclic snapshot stylesheet');
    active.add(target);
    const bytes = stored.type.startsWith('text/css')
      ? Buffer.from(css(new TextDecoder().decode(stored.bytes), target)) : stored.bytes;
    const data = `data:${stored.type.split(';')[0]};base64,${Buffer.from(bytes).toString('base64')}`;
    active.delete(target); cache.set(target, data);
    return data;
  };
  const css = (text: string, from: string) => text.replace(/url\(\s*(['"]?)([^)'"\s]+)\1\s*\)/gi,
    (_match, _quote, raw) => `url(${resource(raw, from)})`);
  const page = options.lazyImages ? html.replace(/<img\b(?![^>]*\bloading\s*=)/gi, '<img loading="lazy"') : html;
  return css(page, path).replace(/\b(src|href|poster|srcset)=(['"])(.*?)\2/gi, (match, attribute, quote, raw) => {
    if (/\bdata:/i.test(raw)) return match;
    const value = attribute.toLowerCase() === 'srcset'
      ? raw.split(',').map((part: string) => { const [url, ...size] = part.trim().split(/\s+/); return [resource(url, path), ...size].join(' '); }).join(', ')
      : resource(raw, path);
    return value === raw ? match : `${attribute}=${quote}${value}${quote}`;
  });
}
