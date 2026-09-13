import type { HostedPublicationStore, PublicationSummary } from './publications.ts';

/** An opaque sandbox must not depend on third-party cookies for image/font requests.
 * Inline only this snapshot's materialized resources; never fetch an external URL. */
export async function publicationPreviewHtml(store: HostedPublicationStore, publication: PublicationSummary, path: string, html: string): Promise<string> {
  const resources = new Map<string, { type: string; bytes: Uint8Array }>();
  await Promise.all(publication.files.filter(file => !file.mediaType.startsWith('text/html')).map(async file => {
    const bytes = await store.file(publication, file.path);
    if (!bytes) throw new Error('Snapshot resource unavailable');
    resources.set(file.path, { type: file.mediaType, bytes });
  }));
  const cache = new Map<string, string>();
  const active = new Set<string>();
  const resource = (raw: string, from: string): string => {
    if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return raw;
    let target: string;
    try { target = decodeURIComponent(new URL(raw, `https://preview.invalid/${from}`).pathname.slice(1)); }
    catch { return raw; }
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
  return css(html, path).replace(/\b(src|href|poster|srcset)=(['"])(.*?)\2/gi, (match, attribute, quote, raw) => {
    if (/\bdata:/i.test(raw)) return match;
    const value = attribute.toLowerCase() === 'srcset'
      ? raw.split(',').map((part: string) => { const [url, ...size] = part.trim().split(/\s+/); return [resource(url, path), ...size].join(' '); }).join(', ')
      : resource(raw, path);
    return value === raw ? match : `${attribute}=${quote}${value}${quote}`;
  });
}
