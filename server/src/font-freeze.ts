import { createHash } from 'node:crypto';
import { fontFaceCss, parseFontCss } from '../../app/src/core/index.ts';
import { decodeHtmlEntities, utf8ByteCompare } from './releases.ts';

const CSS_HOST = 'fonts.googleapis.com';
const FONT_HOST = 'fonts.gstatic.com';
const MAX_REDIRECTS = 2;
const MAX_CSS_BYTES = 512 * 1024;
const MAX_FONT_FILES = 128;
const MAX_FONT_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_FONT_BYTES = 32 * 1024 * 1024;

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function attribute(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const quoted = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  if (quoted) return decodeHtmlEntities(quoted[2].trim());
  const bare = tag.match(new RegExp(`\\s${escaped}\\s*=\\s*([^\\s"'\u0060=<>]+)`, 'i'))?.[1] || '';
  return decodeHtmlEntities(bare.trim());
}

function rels(tag: string) {
  return attribute(tag, 'rel').toLowerCase().split(/\s+/).filter(Boolean);
}

function cssUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('font stylesheet URL is invalid'); }
  if (url.protocol !== 'https:' || url.hostname !== CSS_HOST || url.port || url.username
    || url.password || url.pathname !== '/css2' || url.hash || !url.searchParams.has('family')) {
    throw new Error('only the exact Google Fonts CSS2 endpoint can be frozen');
  }
  return url;
}

function fontUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('font file URL is invalid'); }
  if (url.protocol !== 'https:' || url.hostname !== FONT_HOST || url.port || url.username
    || url.password || url.search || url.hash || !url.pathname.toLowerCase().endsWith('.woff2')) {
    throw new Error('Google Fonts CSS may reference only exact HTTPS gstatic WOFF2 files');
  }
  return url;
}

async function boundedBytes(response: Response, maximum: number, label: string) {
  const declared = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(declared) && declared > maximum) throw new Error(`${label} exceeds its byte limit`);
  if (!response.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const reader = response.body.getReader();
  while (true) {
    const item = await reader.read();
    if (item.done) break;
    length += item.value.byteLength;
    if (length > maximum) {
      await reader.cancel().catch(() => undefined);
      throw new Error(`${label} exceeds its byte limit`);
    }
    chunks.push(item.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function strictFetch(
  fetcher: typeof fetch,
  initial: URL,
  validate: (value: string) => URL,
  maximum: number,
  mediaTypes: Set<string>,
  label: string
) {
  let url = initial;
  for (let redirects = 0; ; redirects++) {
    const response = await fetcher(url, {
      redirect: 'manual',
      headers: {
        accept: label === 'font stylesheet' ? 'text/css' : 'font/woff2',
        'user-agent': 'Pagecraft Connected Release/1.0'
      }
    });
    if (response.status >= 300 && response.status < 400) {
      if (redirects >= MAX_REDIRECTS) throw new Error(`${label} exceeded its redirect limit`);
      const location = response.headers.get('location');
      if (!location) throw new Error(`${label} redirect has no location`);
      url = validate(new URL(location, url).href);
      continue;
    }
    if (!response.ok) throw new Error(`${label} fetch failed with HTTP ${response.status}`);
    const mediaType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!mediaTypes.has(mediaType)) throw new Error(`${label} has an unsupported content type`);
    return boundedBytes(response, maximum, label);
  }
}

async function freezeCss(fetcher: typeof fetch, href: string) {
  const cssBytes = await strictFetch(
    fetcher, cssUrl(href), cssUrl, MAX_CSS_BYTES, new Set(['text/css']), 'font stylesheet'
  );
  let css = new TextDecoder().decode(cssBytes);
  if (!css.trim() || /<\/?style\b/i.test(css) || /@(?:import|namespace|charset)\b/i.test(css)) {
    throw new Error('Google Fonts returned unsupported stylesheet content');
  }
  const structural = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@font-face\s*\{[^{}]*\}/gi, '').trim();
  if (structural) throw new Error('Google Fonts stylesheet contains unsupported rules');

  const declaredUrls = new Set<string>();
  for (const match of css.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^\s"')]+))\s*\)/gi)) {
    declaredUrls.add(fontUrl(match[2] || match[3] || '').href);
  }
  if (!declaredUrls.size || declaredUrls.size > MAX_FONT_FILES) {
    throw new Error('Google Fonts stylesheet has an invalid font count');
  }
  const everyFace = parseFontCss(css, []);
  const faceBlocks = css.match(/@font-face\s*\{/gi)?.length || 0;
  if (!everyFace.length || everyFace.length !== faceBlocks) {
    throw new Error('Google Fonts stylesheet has a malformed font face');
  }
  for (const face of everyFace) fontUrl(face.url);

  const parsedFaces = parseFontCss(css);
  const uniqueFaces = new Map<string, (typeof parsedFaces)[number]>();
  for (const face of parsedFaces) {
    const url = fontUrl(face.url).href;
    const key = [face.family, face.weight, face.style, face.subset, face.range].join('\0');
    const existing = uniqueFaces.get(key);
    if (existing && existing.url !== url) {
      throw new Error('Google Fonts stylesheet repeats a font face with different bytes');
    }
    uniqueFaces.set(key, { ...face, url });
  }
  const faces = [...uniqueFaces.values()].sort((a, b) => utf8ByteCompare(
    [a.family, a.weight, a.style, a.subset, a.range, a.url].join('\0'),
    [b.family, b.weight, b.style, b.subset, b.range, b.url].join('\0')
  ));
  const urls = new Set(faces.map(face => face.url));
  if (!faces.length || urls.size > MAX_FONT_FILES) throw new Error('Google Fonts stylesheet has an invalid font count');

  const frozen = new Map<string, { bytes: Uint8Array; digest: string }>();
  let total = 0;
  for (const url of [...urls].sort(utf8ByteCompare)) {
    const bytes = await strictFetch(
      fetcher, fontUrl(url), fontUrl, MAX_FONT_BYTES, new Set(['font/woff2']), 'font file'
    );
    if (bytes.byteLength < 4 || new TextDecoder().decode(bytes.slice(0, 4)) !== 'wOF2') {
      throw new Error('Google Fonts returned a file without the WOFF2 signature');
    }
    total += bytes.byteLength;
    if (total > MAX_TOTAL_FONT_BYTES) throw new Error('Google Fonts files exceed their total byte limit');
    frozen.set(url, { bytes, digest: hash(bytes) });
  }
  css = fontFaceCss(faces, face => {
    const item = frozen.get(fontUrl(face.url).href);
    if (!item) throw new Error('Google Fonts stylesheet changed during freezing');
    return `data:font/woff2;pagecraft-sha256=${item.digest};base64,${Buffer.from(item.bytes).toString('base64')}`;
  });
  if (/https?:\/\/|url\(\s*(?!["']?data:)/i.test(css)) {
    throw new Error('frozen font stylesheet still contains a remote dependency');
  }
  return `<style data-pagecraft-frozen-fonts="${hash(new TextEncoder().encode(css))}">\n${css}\n</style>`;
}

/** Replace renderer-generated Google Fonts links with deterministic, signed inline CSS and
 * WOFF2 data. Authored links are rejected earlier; every remaining linked stylesheet fails. */
export async function freezeGoogleFontStylesheets(
  files: Map<string, string>,
  fetcher: typeof fetch = fetch
): Promise<Map<string, string>> {
  const hrefs = new Set<string>();
  for (const [path, html] of files) {
    if (!path.toLowerCase().endsWith('.html')) continue;
    for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
      if (!rels(match[0]).includes('stylesheet')) continue;
      hrefs.add(cssUrl(attribute(match[0], 'href')).href);
    }
  }
  if (!hrefs.size) return new Map(files);

  const styles = new Map<string, string>();
  for (const href of [...hrefs].sort(utf8ByteCompare)) styles.set(href, await freezeCss(fetcher, href));
  const output = new Map<string, string>();
  for (const [path, html] of files) {
    if (!path.toLowerCase().endsWith('.html')) { output.set(path, html); continue; }
    output.set(path, html.replace(/<link\b[^>]*>/gi, tag => {
      const rel = rels(tag);
      const href = attribute(tag, 'href');
      if (rel.includes('stylesheet')) return styles.get(cssUrl(href).href) || tag;
      if (rel.includes('preconnect')) {
        try {
          const url = new URL(href);
          if (url.protocol === 'https:' && (url.hostname === CSS_HOST || url.hostname === FONT_HOST)) return '';
        } catch { /* an unrelated malformed hint stays inert and is not a stylesheet */ }
      }
      return tag;
    }));
  }
  return output;
}
