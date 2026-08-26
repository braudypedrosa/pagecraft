import a from 'node:assert/strict';
import { test } from 'vitest';
import { freezeGoogleFontStylesheets } from '../src/font-freeze.ts';
import { blankDoc } from '../src/render.ts';
import { buildReleaseArtifact, canonicalJson, releaseStylesheetLinks } from '../src/releases.ts';

const cssHref = 'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap';
const fontHref = 'https://fonts.gstatic.com/s/inter/v1/inter.woff2';
const css = `/* latin */\n@font-face{font-family:'Inter';font-style:normal;font-weight:400;`
  + `font-display:swap;src:url('${fontHref}') format('woff2');unicode-range:U+0000-00FF}`;
const page = (path: string) => `<!doctype html><html><head>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="${cssHref.replace(/&/g, '&amp;')}">
  <style>.route-${path}{color:green}</style></head><body><main>${path}</main></body></html>`;

function fixtureFetch(fontSuffix: string, calls: string[]) {
  return (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    calls.push(url.href);
    if (url.hostname === 'fonts.googleapis.com') {
      return new Response(css, { headers: { 'content-type': 'text/css' } });
    }
    if (url.href === fontHref) {
      return new Response(Buffer.from(`wOF2${fontSuffix}`), {
        headers: { 'content-type': 'font/woff2' }
      });
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
}

test('Google font bytes freeze deterministically once into shared signed CSS', async () => {
  const source = new Map([
    ['index.html', page('home')],
    ['about.html', page('about')]
  ]);
  const firstCalls: string[] = [];
  const first = await freezeGoogleFontStylesheets(source, fixtureFetch('same-font', firstCalls));
  const second = await freezeGoogleFontStylesheets(source, fixtureFetch('same-font', []));
  a.deepEqual([...first], [...second]);
  a.equal(firstCalls.filter(url => url.startsWith('https://fonts.googleapis.com/')).length, 1);
  a.equal(firstCalls.filter(url => url.startsWith('https://fonts.gstatic.com/')).length, 1);
  a.deepEqual(releaseStylesheetLinks(first), []);
  a.equal([...first.values()].some(html => /fonts\.(?:googleapis|gstatic)\.com/.test(html)), false);

  const document = blankDoc('Frozen font');
  const built = buildReleaseArtifact({
    releaseId: 'frozen-font-release', siteId: 'frozen-font-site', sourceVersion: 1,
    document, files: first
  });
  a.equal((built.artifact.shared.css.match(/data:font\/woff2/g) || []).length, 1);
  a.equal(built.artifact.routes.some(route => route.css.includes('data:font/woff2')), false);
  a.equal(canonicalJson(built.artifact).includes('fonts.googleapis.com'), false,
    'compilation is offline after freezing and retains no mutable stylesheet URL');

  const changed = await freezeGoogleFontStylesheets(source, fixtureFetch('tampered-font', []));
  const changedBuilt = buildReleaseArtifact({
    releaseId: 'frozen-font-release', siteId: 'frozen-font-site', sourceVersion: 1,
    document, files: changed
  });
  a.notEqual(changedBuilt.artifactHash, built.artifactHash,
    'different fetched bytes produce a different signed artifact hash');
});
test('font freezing rejects redirect and dependency host escapes', async () => {
  const files = new Map([['index.html', page('home')]]);
  const redirected = (async () => new Response(null, {
    status: 302, headers: { location: 'https://evil.example/css2?family=Inter' }
  })) as typeof fetch;
  await a.rejects(() => freezeGoogleFontStylesheets(files, redirected), /exact Google Fonts CSS2/);

  const hostileCss = css.replace('https://fonts.gstatic.com/', 'https://evil.example/');
  const hostile = (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return url.hostname === 'fonts.googleapis.com'
      ? new Response(hostileCss, { headers: { 'content-type': 'text/css' } })
      : new Response(Buffer.from('wOF2unused'), { headers: { 'content-type': 'font/woff2' } });
  }) as typeof fetch;
  await a.rejects(() => freezeGoogleFontStylesheets(files, hostile), /gstatic WOFF2/);
});
