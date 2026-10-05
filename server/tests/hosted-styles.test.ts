/* What a hosted publication ships: fonts and the shared foundation as files every page links,
   canonical tags and a sitemap from the site's own address, and a real page for a missing one. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import type { Context } from 'hono';
import { createApp } from '../src/app.ts';
import { MemoryStore } from '../src/store.ts';
import { MemoryAuthStore } from '../src/auth.ts';
import { MemoryAssetStore } from '../src/assets.ts';
import { MemoryHostedPublicationStore } from '../src/publications.ts';
import { FileSiteTemplateStore } from '../src/site-templates.ts';
import { freezeGoogleFontStylesheets, shareHostedStyles } from '../src/font-freeze.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import type { AccountAuth, VerifiedIdentity } from '../src/account-auth.ts';
import type { Doc } from '../../app/src/core/types.ts';

/* Google answers a variable family with one file per subset, named by every weight asked for.
   About 27.6 KB a file, which reproduces the eight 37 KB base64 faces measured on staging. */
const fontBytes = (subset: string) => new Uint8Array(Buffer.from(`wOF2-dm-sans-${subset}-`.padEnd(27_650, 'x')));
const googleCss = ['latin-ext', 'latin'].map(subset => `/* ${subset} */\n` + ['400', '500', '600', '700'].map(weight =>
  `@font-face{font-family:'DM Sans';font-style:normal;font-weight:${weight};font-display:swap;`
  + `src:url(https://fonts.gstatic.com/s/dmsans/v1/${subset}.woff2) format('woff2');unicode-range:U+0000-00FF}`).join('\n')).join('\n');
const googleFetch = (async (input: string | URL | Request) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname === 'fonts.googleapis.com') return new Response(googleCss, { headers: { 'content-type': 'text/css' } });
  const subset = url.pathname.match(/dmsans\/v1\/([a-z-]+)\.woff2$/)?.[1];
  if (subset) return new Response(fontBytes(subset), { headers: { 'content-type': 'font/woff2' } });
  return new Response('missing', { status: 404 });
}) as typeof fetch;

const pages = (files: Map<string, string>) => [...files].filter(([path]) => path.endsWith('.html'));

test('Stillwood ships its fonts and foundation once, without reordering any page cascade', async () => {
  const templates = new FileSiteTemplateStore(resolve(process.cwd(), 'premade-sites'));
  const installed = (await templates.instantiate('stillwood'))!;
  const rendered = renderSite(installed.document, installed.assets, '', { foundation: true });
  const frozen = await freezeGoogleFontStylesheets(rendered.files, googleFetch);
  const before = Buffer.byteLength(frozen.get('index.html')!);
  a.equal((frozen.get('index.html')!.match(/data:font\/woff2/g) || []).length, 8, 'the fixture reproduces staging: eight inline faces');

  const shared = shareHostedStyles(frozen, rendered.foundation);
  const extra = new Map(shared.extra.map(file => [file.path, file]));
  const sheets = shared.extra.filter(file => file.path.endsWith('.css'));
  a.equal(sheets.length, 1, 'every page links the same stylesheet');
  const css = new TextDecoder().decode(sheets[0].bytes);
  a.match(sheets[0].path, /^assets\/site\.[a-f0-9]{16}\.css$/);
  a.equal(sheets[0].mediaType, 'text/css; charset=utf-8');
  a.doesNotMatch(css, /data:font/);

  const fonts = [...css.matchAll(/url\('(fonts\/[^']+)'\)/g)].map(match => 'assets/' + match[1]);
  a.equal(fonts.length, 8);
  a.equal(new Set(fonts).size, 2, 'faces that share bytes share one file');
  for (const path of fonts) {
    a.match(path, /^assets\/fonts\/dm-sans-400-700-normal\.[a-f0-9]{16}\.woff2$/);
    a.equal(extra.get(path)?.mediaType, 'font/woff2', `${path} is not in the publication`);
  }

  for (const [path, html] of pages(shared.files)) {
    a.doesNotMatch(html, /data:font\/woff2|data-pagecraft-frozen-fonts/, path);
    const rel = '../'.repeat(path.split('/').length - 1);
    const link = `<link rel="stylesheet" href="${rel}${sheets[0].path}">\n`;
    a.ok(html.includes(link + '<style>\n'), `${path} links the shared stylesheet right before its own`);
    /* Put the foundation back where it was and drop the fonts: the page is what it was. */
    const page = rendered.foundation!.pages.get(path)!;
    const original = frozen.get(path)!.replace(/<style data-pagecraft-frozen-fonts="[a-f0-9]{64}">\n[\s\S]*?\n<\/style>\n?/, '');
    a.equal(html.replace(link + '<style>\n', '<style>\n' + page.inline), original, `${path} changed beyond the move`);
  }
  const after = Buffer.byteLength(shared.files.get('index.html')!);
  a.ok(after < before / 4, `index.html went from ${before} to ${after} bytes`);
  console.info(`Stillwood index.html: ${before} -> ${after} bytes (${gzipSync(shared.files.get('index.html')!).byteLength} gzipped); `
    + `shared CSS ${sheets[0].bytes.byteLength} bytes (${gzipSync(sheets[0].bytes).byteLength} gzipped), once per site`);

  a.deepEqual([...renderSite(installed.document, installed.assets).files].map(([path, html]) => [path, html.length]),
    [...rendered.files].map(([path, html]) => [path, html.length]),
    'exports and previews keep their self-contained pages');
});

class SignedIn implements Partial<AccountAuth> {
  current: VerifiedIdentity = { authUserId: 'auth-owner', email: 'owner@example.test', name: 'Owner' };
  async identity(_c: Context) { return this.current; }
}

async function hosted(doc: Doc) {
  const store = new MemoryStore();
  const auth = new MemoryAuthStore();
  const publications = new MemoryHostedPublicationStore();
  const app = createApp({
    store, auth, publications, assets: new MemoryAssetStore(),
    accountAuth: new SignedIn() as unknown as AccountAuth,
    editorHost: 'admin.test', editorOrigin: 'http://admin.test', editorHtml: '<title>Builder</title>',
    fontFetch: googleFetch,
  });
  const owner = await auth.ensureAuthUser('auth-owner', 'owner@example.test', 'Owner');
  const site = await store.create({ host: 'unclaimed-hosted.invalid', slug: 'cabins', name: 'Cabins', doc });
  await auth.grant(site.id, owner.id, 'owner');
  const request = (path: string, init: RequestInit = {}) => app.request(new Request(`http://admin.test${path}`, {
    ...init, headers: { host: 'admin.test', origin: 'http://admin.test', 'content-type': 'application/json', ...(init.headers || {}) },
  }));
  const published = await request(`/api/sites/${site.id}/publish`, {
    method: 'POST', body: JSON.stringify({ sourceVersion: site.version, acknowledgeWarnings: true }),
  });
  a.equal(published.status, 200, await published.clone().text());
  return { request, publication: (await publications.currentBySlug('cabins'))! };
}

const fontDoc = () => {
  const doc = blankDoc('Cabins');
  doc.meta.font = "'DM Sans',system-ui,sans-serif";
  doc.meta.baseUrl = '';
  return doc;
};

test('a hosted page links a cached stylesheet and same-origin fonts that load in its sandbox', async () => {
  const { request, publication } = await hosted(fontDoc());
  const page = await request('/cabins/');
  a.equal(page.status, 200);
  a.match(page.headers.get('content-security-policy') || '', /^sandbox allow-scripts/);
  const html = await page.text();
  a.doesNotMatch(html, /data:font\/woff2/);
  const href = html.match(/<link rel="stylesheet" href="([^"]+)">/)?.[1];
  a.match(href || '', /^\/cabins\/assets\/site\.[a-f0-9]{16}\.css$/, 'the router gives the stylesheet an absolute path');
  a.ok(publication.files.some(file => '/cabins/' + file.path === href));

  const sheet = await request(href!);
  a.equal(sheet.status, 200);
  a.equal(sheet.headers.get('content-type'), 'text/css; charset=utf-8');
  a.equal(sheet.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  const font = (await sheet.text()).match(/url\('(fonts\/[^']+\.woff2)'\)/)?.[1];
  a.ok(font);
  const face = await request(new URL(font!, `http://admin.test${href}`).pathname);
  a.equal(face.status, 200);
  a.equal(face.headers.get('content-type'), 'font/woff2');
  a.equal(face.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  a.equal(face.headers.get('access-control-allow-origin'), '*', 'an opaque-origin page loads fonts in CORS mode');
  a.equal(new TextDecoder().decode((await face.arrayBuffer()).slice(0, 4)), 'wOF2');

  /* The review preview runs where third-party cookies may not exist, so it still inlines the
     publication's own stylesheet and fonts. */
  const preview = await request(`/api/sites/${publication.siteId}/publication-snapshots/${publication.id}/files/index.html`);
  a.equal(preview.status, 200);
  const inlined = (await preview.text()).match(/href="data:text\/css;base64,([^"]+)"/)?.[1];
  a.ok(inlined, 'the preview inlines the shared stylesheet');
  a.match(Buffer.from(inlined!, 'base64').toString(), /url\(data:font\/woff2;base64,/);
});

test('a hosted site without a Site URL gets canonical tags and a sitemap at its public address', async () => {
  const doc = fontDoc();
  const { request } = await hosted(doc);
  const html = await (await request('/cabins/')).text();
  a.match(html, /<link rel="canonical" href="http:\/\/admin\.test\/cabins\/">/);
  const sitemap = await request('/cabins/sitemap.xml');
  a.equal(sitemap.status, 200);
  a.match(sitemap.headers.get('content-type') || '', /xml/);
  a.equal(sitemap.headers.get('cache-control'), 'public, max-age=0, must-revalidate',
    'a sitemap keeps its name across publishes, so it is not cached as immutable');
  a.match(await sitemap.text(), /<loc>http:\/\/admin\.test\/cabins\/<\/loc>/);
  a.match(await (await request('/cabins/robots.txt')).text(), /Sitemap: http:\/\/admin\.test\/cabins\/sitemap\.xml/);
  a.equal(doc.meta.baseUrl, '', 'the stored document keeps the owner’s own setting');
});

test('a missing hosted page is a styled page that leads home, or the site’s own 404 page', async () => {
  const { request } = await hosted(fontDoc());
  const missing = await request('/cabins/no/such/page');
  a.equal(missing.status, 404);
  a.match(missing.headers.get('content-type') || '', /^text\/html/);
  a.match(missing.headers.get('content-security-policy') || '', /^sandbox allow-scripts/);
  const body = await missing.text();
  a.match(body, /<!doctype html>/i);
  a.match(body, /<a href="\/cabins\/">/);
  a.doesNotMatch(body, /https?:\/\//, 'the fallback loads nothing from anywhere');

  const own = fontDoc();
  own.pages.push({ ...structuredClone(own.pages[0]), id: 'p404', name: 'Lost', slug: '404', title: 'Lost in the woods' });
  const site = await hosted(own);
  const custom = await site.request('/cabins/no/such/page');
  a.equal(custom.status, 404);
  const customHtml = await custom.text();
  a.match(customHtml, /Lost in the woods/);
  a.match(customHtml, /href="\/cabins\/assets\/site\.[a-f0-9]{16}\.css"/, 'a 404 at any depth still finds its stylesheet');
});
