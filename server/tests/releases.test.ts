import { readFileSync, writeFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { test } from 'vitest';
import a from 'node:assert/strict';
import * as Core from '../../app/src/core/index.ts';
import type { Node as PcNode, WidgetType } from '../../app/src/core/types.ts';
import { blankDoc, renderSite } from '../src/render.ts';
import {
  authoredCssAtRuleIssues, authoredStylesheetIssues, buildKeysetEnvelope, buildReleaseArtifact, canonicalJson,
  canonicalCssSyntax, deploymentForTarget, existingThemeCssIssues, fromBase64url,
  hasUnsafeCssParserDirective, keyFromRawPublic, manifestForRelease,
  migrateIndexedWordPressLinks,
  parseReleaseArtifact, rawPublicKey, scopeCss, sha256, signDeploymentEnvelope,
  releaseStylesheetLinks, signReleaseManifest, unsafeExistingThemeCss, verifyKeysetEnvelope,
  verifySignedDeployment, verifySignedRelease, type DesiredReleaseV1
} from '../src/releases.ts';

const releasePrivate = () => createPrivateKey({
  key: Buffer.from('MC4CAQAwBQYDK2VwBCIEIMNTuWc8LwcyLbbFextWs2zgG5yUj6Rjte9kaVImnQTd', 'base64url'),
  format: 'der', type: 'pkcs8'
});
const rootPrivate = () => createPrivateKey({
  key: Buffer.from('MC4CAQAwBQYDK2VwBCIEIAfeCT4-i2gK-kDDZNAmzFNt1KRreItHOq14dLd-vV26', 'base64url'),
  format: 'der', type: 'pkcs8'
});

const MATRIX_WIDGETS = [
  'section', 'row', 'list', 'slider', 'column', 'box', 'heading', 'text', 'quote', 'image',
  'gallery', 'video', 'icon', 'tabs', 'table', 'code', 'crumbs', 'button', 'nav', 'form',
  'accordion', 'embed', 'spacer', 'divider'
] as const satisfies readonly WidgetType[];

const golden = () => {
  const signing = { keyId: 'pagecraft-release-test-v1', privateKey: releasePrivate() };
  const document = blankDoc('Golden');
  document.meta.baseUrl = 'https://pagecraft.example/source';
  document.meta.font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  document.meta.headFont = '';
  document.meta.ogImage = 'asset:assethero';
  for (const style of document.meta.tokens?.text || []) {
    for (const breakpoint of ['d', 't', 'm'] as const) delete style.css[breakpoint]['font-family'];
  }
  const home = document.pages[0];
  Object.assign(home, {
    id: 'page-home', name: 'Home', slug: 'index', title: 'Golden Home', desc: 'Portable home'
  });
  const about = structuredClone(home);
  Object.assign(about, {
    id: 'page-about', name: 'About', slug: 'nested/about',
    title: 'Golden About', desc: 'Portable about'
  });
  document.pages = [home, about];
  document.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '',
    fields: [
      { id: 'title', name: 'Title', type: 'text', required: 1 },
      { id: 'hero', name: 'Hero', type: 'image' }
    ],
    items: [
      { id: 'post-one', slug: 'post-one', values: { title: 'Golden post', hero: 'asset:assethero' } },
      { id: 'post-two', slug: 'post-two', values: { title: 'Golden second post', hero: 'asset:assethero' } },
      { id: 'post-three', slug: 'post-three', values: { title: 'Golden third post', hero: 'asset:assethero' } }
    ]
  }];
  const asset = {
    id: 'assethero', siteId: 'site-golden', name: 'Hero.png', type: 'image/png', w: 1, h: 1,
    bytes: new Uint8Array(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    ))
  };
  let nodeOrder = 0;
  const make = (type: WidgetType, key: string, matrix = false): PcNode => {
    const node = Core.makeFor(type);
    node.id = `n-golden-${key}`;
    node.adv.htmlId = `${matrix ? 'pc-matrix' : 'pc-golden'}-${key}`;
    node.adv.cls = `golden-${type}`;
    node.css.d['--golden-desktop'] = String(++nodeOrder);
    node.css.t['--golden-tablet'] = `${nodeOrder}px`;
    node.css.m['--golden-mobile'] = `${nodeOrder}px`;
    return node;
  };
  const component = (type: WidgetType) => make(type, type, true);

  const heading = component('heading');
  Object.assign(heading.props, { text: 'Every real Pagecraft component', level: 'h1', link: 'index.html' });
  heading.anim = { name: 'fade-up', dur: '0.8s', delay: '0.1s', ease: 'ease-out', once: 1 };
  const text = component('text');
  text.props.html = '<p>Rendered by Core with clean, portable content.</p>';
  text.hide.m = true;
  const quote = component('quote');
  Object.assign(quote.props, { text: 'Portability is a product feature.', by: 'Pagecraft', source: 'https://example.com/' });
  const image = component('image');
  Object.assign(image.props, {
    src: 'asset:assethero', alt: 'Golden component fixture', caption: 'A signed raster asset',
    w: '1', h: '1', lazy: 0, link: 'index.html'
  });
  const gallery = component('gallery');
  Object.assign(gallery.props, {
    items: [{ src: 'asset:assethero', alt: 'Golden gallery tile', caption: 'CMS-ready media', w: '1', h: '1' }],
    captions: 1, lightbox: 1, lazy: 1
  });
  const video = component('video');
  Object.assign(video.props, {
    src: 'https://youtu.be/aqz-KE-bpKQ', poster: 'asset:assethero', facade: 1, autoplay: 0
  });
  const icon = component('icon');
  Object.assign(icon.props, { name: 'check', label: 'Return home', link: 'index.html' });
  const tabs = component('tabs');
  const table = component('table');
  const code = component('code');
  Object.assign(code.props, { body: 'const portable = true;\nconsole.log(portable);', copy: 1, numbers: 1 });
  const crumbs = component('crumbs');
  const button = component('button');
  Object.assign(button.props, { text: 'Back home', link: 'index.html', icon: 'arrow' });
  button.css.d['margin-top'] = 'auto';
  button.st = {
    hover: { d: { transform: 'translateY(-1px)' }, t: {}, m: {} },
    focus: { d: { outline: '2px solid currentColor' }, t: {}, m: {} }
  };
  const nav = component('nav');
  Object.assign(nav.props, {
    collapse: 'mobile', aria: 'Component matrix',
    items: [
      { label: 'Home', href: 'index.html', cls: 'menu-home' },
      { label: 'About', href: 'nested/about.html', cls: 'menu-about' },
      { label: 'External', href: 'https://example.com/', target: '_blank', cls: 'menu-external' }
    ]
  });
  const form = component('form');
  form.id = 'contact-form';
  Object.assign(form.props, {
    mode: 'wordpress', method: 'post', submit: 'Send request', aria: 'Golden managed form',
    fields: [
      { type: 'text', label: 'Name', name: 'name', required: 1, ph: 'Your name' },
      { type: 'email', label: 'Email', name: 'email', required: 1, ph: 'you@example.com' },
      { type: 'tel', label: 'Phone', name: 'phone', required: 0, ph: '' },
      { type: 'number', label: 'Party size', name: 'party_size', required: 0, ph: '' }
    ]
  });
  const accordion = component('accordion');
  const embed = component('embed');
  embed.props.html = '<iframe src="https://player.vimeo.com/video/76979871" '
    + 'title="Golden Vimeo embed" loading="lazy" '
    + 'allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
  const spacer = component('spacer');
  spacer.hide.t = true;
  const divider = component('divider');

  const firstColumn = component('column');
  firstColumn.children = [heading, text, quote, image, gallery, video, icon, tabs, table];
  const secondColumn = make('column', 'column-secondary');
  secondColumn.children = [code, crumbs, button, nav, form, accordion, embed, spacer, divider];
  const row = component('row');
  row.children = [firstColumn, secondColumn];
  row.css.d['align-items'] = 'stretch';

  const listHeading = make('heading', 'list-heading');
  listHeading.bind = { text: { src: 'field', path: 'title' } };
  const listImage = make('image', 'list-image');
  Object.assign(listImage.props, { alt: 'CMS image', w: '1', h: '1', lazy: 1 });
  listImage.bind = { src: { src: 'field', path: 'hero' } };
  const listColumn = make('column', 'list-column');
  listColumn.children = [listHeading, listImage];
  const list = component('list');
  list.src = 'posts';
  list.props.per = '1';
  list.children = [listColumn];

  const slider = component('slider');
  slider.children = [1, 2, 3].map(index => {
    const slideHeading = make('heading', `slider-heading-${index}`);
    Object.assign(slideHeading.props, { text: `Real slide ${index}`, level: 'h2' });
    const slide = make('column', `slider-column-${index}`);
    slide.children = [slideHeading];
    return slide;
  });

  const boxText = make('text', 'box-text');
  boxText.props.html = '<p>A real flexible Box rendered by Core.</p>';
  const box = component('box');
  Object.assign(box.props, { layout: 'grid', tag: 'aside' });
  box.css.d['grid-template-columns'] = 'repeat(2,minmax(0,1fr))';
  box.adv.css = '&{outline-offset:2px}';
  box.children = [boxText];

  const section = component('section');
  section.css.d['background-color'] = '#f8f6ef';
  section.children = [row, list, slider, box];
  about.tree = [section];
  about.ogImage = 'asset:assethero';
  about.headHtml = '<meta property="og:image:secure_url" content="asset:assethero">'
    + '<meta name="twitter:title" content="Golden tweet">'
    + '<meta name="twitter:description" content="Golden tweet description">'
    + '<meta name="twitter:image" content="asset:assethero">'
    + '<script>window.pagecraftGoldenHeadOrder=true</script>';

  const homeHeading = make('heading', 'home-heading');
  Object.assign(homeHeading.props, { text: 'Golden Home', level: 'h1', link: 'nested/about.html' });
  const homeColumn = make('column', 'home-column'); homeColumn.children = [homeHeading];
  const homeRow = make('row', 'home-row'); homeRow.children = [homeColumn];
  const homeSection = make('section', 'home-section'); homeSection.children = [homeRow];
  home.tree = [homeSection];
  home.ogImage = 'asset:assethero';

  const headerHeading = make('heading', 'header-heading');
  Object.assign(headerHeading.props, { text: 'Golden', level: 'div', link: 'index.html' });
  const headerColumn = make('column', 'header-column'); headerColumn.children = [headerHeading];
  const headerRow = make('row', 'header-row'); headerRow.children = [headerColumn];
  const headerSection = make('section', 'header-section');
  Object.assign(headerSection.props, { tag: 'header' }); headerSection.children = [headerRow];
  document.header = [headerSection];

  const footerText = make('text', 'footer-text'); footerText.props.html = '<p>Golden footer</p>';
  const footerColumn = make('column', 'footer-column'); footerColumn.children = [footerText];
  const footerRow = make('row', 'footer-row'); footerRow.children = [footerColumn];
  const footerSection = make('section', 'footer-section');
  Object.assign(footerSection.props, { tag: 'footer' }); footerSection.children = [footerRow];
  document.footer = [footerSection];

  const rendered = renderSite(document, [asset]);
  const errors = rendered.findings.filter(finding => finding.level === 'error');
  if (errors.length) throw new Error(`golden Core document has lint errors: ${errors.map(f => f.code).join(', ')}`);
  const warnings = rendered.findings.filter(finding => finding.level === 'warn');
  const warningCodes = [...new Set(warnings.map(finding => finding.code))].sort();
  const files = rendered.files;
  const built = buildReleaseArtifact({
    releaseId: 'release-golden-1', siteId: 'site-golden', sourceVersion: 7, document, files,
    assets: [asset]
  });
  const manifest = manifestForRelease({
    releaseId: 'release-golden-1', siteId: 'site-golden', sequence: 1, sourceVersion: 7,
    schemaVersion: document.schemaVersion, parentReleaseId: null,
    createdAt: '2026-08-26T00:00:00.000Z',
    audit: {
      acknowledgeWarnings: warnings.length > 0, warningCodes, warningCount: warnings.length,
      errorCodes: [], errorCount: 0
    },
    built
  });
  const release = signReleaseManifest(manifest, signing);
  const deployment = signDeploymentEnvelope(deploymentForTarget({
    release: manifest, releaseManifest: release.manifest,
    connectionId: 'connection-golden', installationId: 'installation-golden',
    environment: 'staging', profile: 'existing-theme', targetOrigin: 'https://wp.example',
    targetPath: '/site', targetSequence: 4, issuedAt: '2026-08-26T00:01:00.000Z'
  }), signing);
  const keysetEnvelope = buildKeysetEnvelope({
    rootKeyId: 'pagecraft-root-v1', rootPrivateKey: rootPrivate(),
    generatedAt: '2026-08-26T00:00:00.000Z', expiresAt: '2036-08-26T00:00:00.000Z',
    releaseKeys: [{
      key: signing, notBefore: '2026-08-26T00:00:00.000Z', notAfter: '2030-08-26T00:00:00.000Z'
    }]
  }).envelope;
  return {
    format: 'pagecraft.wordpress-golden.v1',
    trust: {
      rootKeyId: 'pagecraft-root-v1', rootPublicKey: rawPublicKey(createPublicKey(rootPrivate())),
      releaseKeyId: signing.keyId, releasePublicKey: rawPublicKey(createPublicKey(releasePrivate()))
    },
    keysetEnvelope,
    desired: {
      release: {
        ...release,
        artifact: {
          url: 'https://pagecraft.example/v1/releases/release-golden-1/artifact',
          expiresAt: '2026-08-26T00:06:00.000Z'
        }
      },
      deployment,
      keysetEnvelope
    } satisfies DesiredReleaseV1,
    artifact: built.artifact
  };
};

test('the shared WordPress golden vector is deterministic and verifies end-to-end', () => {
  const fixtureUrl = new URL('./fixtures/wordpress-artifact-v1.json', import.meta.url);
  let expected = JSON.parse(readFileSync(fixtureUrl, 'utf8'));
  const actual = golden();
  /* The fixture is signed across two runtimes. Updating it is explicit so an ordinary
     test run can never bless a contract drift, while intentional schema changes have a
     deterministic one-command regeneration path. */
  if (process.env.PAGECRAFT_UPDATE_WORDPRESS_GOLDEN === '1') {
    writeFileSync(fixtureUrl, JSON.stringify(actual, null, 2) + '\n');
    expected = actual;
  }
  a.deepEqual(actual, expected);
  const keyset = verifyKeysetEnvelope({
    envelope: actual.keysetEnvelope,
    rootPublicKey: keyFromRawPublic(actual.trust.rootPublicKey),
    now: '2026-08-27T00:00:00.000Z'
  });
  a.equal(keyset.keys[0].publicKey, actual.trust.releasePublicKey);
  const artifactBytes = new TextEncoder().encode(canonicalJson(actual.artifact));
  const manifest = verifySignedRelease({
    signed: actual.desired.release,
    publicKey: keyFromRawPublic(actual.trust.releasePublicKey), artifactBytes
  });
  const deployment = verifySignedDeployment({
    signed: actual.desired.deployment,
    publicKey: keyFromRawPublic(actual.trust.releasePublicKey),
    releaseManifest: actual.desired.release.manifest,
    expected: {
      connectionId: 'connection-golden', installationId: 'installation-golden',
      environment: 'staging', profile: 'existing-theme', targetOrigin: 'https://wp.example',
      targetPath: '/site', releaseId: 'release-golden-1'
    },
    afterSequence: 3
  });
  a.equal(deployment.artifactHash, sha256(artifactBytes));
  a.deepEqual(parseReleaseArtifact(artifactBytes), actual.artifact);
  a.equal('document' in actual.artifact, false);
  a.equal(manifest.forms[0].id, 'contact-form');
});

test('compiled routes are clean, target-neutral, asset-complete, and script-auditable', () => {
  const { artifact, desired } = golden();
  const matrix = artifact.routes.find(route => route.path === '/nested/about');
  a.ok(matrix);
  a.deepEqual(artifact.routes.filter(route => route.path.startsWith('/nested/about')).map(route => route.path),
    ['/nested/about', '/nested/about/page-2', '/nested/about/page-3'],
  'paginated CMS output is compiled into clean signed WordPress routes');
  a.match(matrix.bodyHtml, /href="\/nested\/about\/page-2"/,
    'the public pager uses the clean next-page route');
  const serialized = canonicalJson(artifact);
  a.equal(serialized.includes('https://pagecraft.example/source'), false);
  a.equal(artifact.routes.some(route => /(?:href|action)=["'][^"']*\.html/i.test(route.bodyHtml)), false,
    'visitor links do not expose generated filenames');
  a.match(matrix.bodyHtml, /pc-asset:\/\/assethero/);
  a.equal(artifact.routes.some(route => /<script/i.test(route.bodyHtml)), false);
  const runtimeScripts = matrix.runtime.match(/<script\b[\s\S]*?<\/script>/gi) || [];
  a.equal(runtimeScripts.length, matrix.scripts.length);
  runtimeScripts.forEach((script, index) => {
    a.equal(matrix.scripts[index].hash, sha256(new TextEncoder().encode(script)),
      'script hashes cover the final Core-rendered runtime template');
  });
  a.equal(matrix.scripts.some(script => script.hash === sha256(new TextEncoder().encode(
    '<script type="application/ld+json">x</script>'
  ))), false, 'JSON-LD is structured SEO, not executable code');
  a.deepEqual(artifact.forms, artifact.entities.forms);
  a.deepEqual(artifact.redirects.map(item => item.from), [
    '/index', '/index.html', '/nested/about.html',
    '/nested/about/page-2.html', '/nested/about/page-3.html'
  ]);
  a.ok(artifact.redirects.every(item => item.status === 301));
  const decoded = JSON.parse(new TextDecoder().decode(fromBase64url(desired.release.manifest)));
  a.deepEqual(decoded.forms, artifact.forms);
  a.deepEqual(decoded.redirects, artifact.redirects);
  a.deepEqual(decoded.cms.collections,
    (artifact.cms.collections as Array<{ id: string; name: string }>).map(collection => ({
      id: collection.id, name: collection.name
    })).sort((left, right) => left.id.localeCompare(right.id)),
  'the signed CMS inventory is the exact deterministic projection of the hashed artifact schema');
});

test('indexed WordPress links compile as signed target-neutral placeholders and migrate legacy staging URLs', () => {
  const document = blankDoc('Native links');
  document.meta.font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  document.meta.headFont = '';
  for (const style of document.meta.tokens?.text || []) {
    for (const breakpoint of ['d', 't', 'm'] as const) delete style.css[breakpoint]['font-family'];
  }
  const button = Core.makeFor('button');
  button.id = 'native-link-button';
  button.props.text = 'Native contact';
  button.props.link = 'https://staging.example.test/preview/native-contact/';
  document.pages[0].tree = [button];

  const migrated = migrateIndexedWordPressLinks(document, [{
    targetOrigin: 'https://staging.example.test',
    targetPath: '/preview',
    items: [{ objectType: 'page', url: 'https://staging.example.test/preview/native-contact/' }]
  }]);
  a.equal(migrated.migrated, 1);
  a.deepEqual(migrated.unsafeTargetUrls, []);
  a.equal(document.pages[0].tree[0].props.link,
    'https://staging.example.test/preview/native-contact/', 'the immutable source revision is untouched');
  const stored = String(migrated.document.pages[0].tree[0].props.link);
  a.deepEqual(Core.parseWordPressContentReference(stored), {
    objectType: 'page', path: '/native-contact/'
  });

  const rendered = renderSite(migrated.document);
  const built = buildReleaseArtifact({
    releaseId: 'release-native-links', siteId: 'site-native-links', sourceVersion: 3,
    document: migrated.document, files: rendered.files
  });
  const artifactJson = canonicalJson(built.artifact);
  a.equal(artifactJson.includes('staging.example.test'), false,
    'the selected staging host is absent from the identical release artifact');
  a.equal(artifactJson.includes('pagecraft:wordpress-content:'), false,
    'the internal document reference never survives compilation');
  const placeholder = built.placeholders.find(item => item.kind === 'wordpress-content');
  a.deepEqual(placeholder && {
    routePath: placeholder.routePath,
    kind: placeholder.kind,
    objectType: placeholder.objectType,
    path: placeholder.path,
    token: placeholder.token
  }, {
    routePath: '/', kind: 'wordpress-content', objectType: 'page', path: '/native-contact/',
    token: Core.wordpressContentToken({ objectType: 'page', path: '/native-contact/' })
  });
  a.match(built.artifact.routes[0].bodyHtml, /href="%%PAGECRAFT_WP_CONTENT:page:[A-Za-z0-9_-]+%%"/);

  const invalid = (href: string) => buildReleaseArtifact({
    releaseId: 'release-native-invalid', siteId: 'site-native-links', sourceVersion: 3,
    document: blankDoc('Invalid native link'),
    files: new Map([['index.html', `<html><head><title>Invalid</title></head><body><main><a href="${href}">Bad</a></main></body></html>`]])
  });
  a.throws(() => invalid('pagecraft:wordpress-content:page:L25hdGl2ZS8'),
    /raw WordPress content reference/);
  a.throws(() => invalid('%%PAGECRAFT_WP_CONTENT:page:tampered%%'),
    /invalid WordPress content placeholder/);

  const unsafeLegacy = structuredClone(document);
  unsafeLegacy.pages[0].tree[0].props.link =
    'https://staging.example.test/preview/native-contact/?preview=1';
  const unsafeMigration = migrateIndexedWordPressLinks(unsafeLegacy, [{
    targetOrigin: 'https://staging.example.test',
    targetPath: '/preview',
    items: [{
      objectType: 'page',
      url: 'https://staging.example.test/preview/native-contact/?preview=1'
    }]
  }]);
  a.deepEqual(unsafeMigration.unsafeTargetUrls, [
    'https://staging.example.test/preview/native-contact/?preview=1'
  ], 'an untouched legacy query-bearing picker value blocks publication instead of dropping its query');

  const removedFromIndex = migrateIndexedWordPressLinks(document, [{
    targetOrigin: 'https://staging.example.test', targetPath: '/preview', items: []
  }]);
  a.deepEqual(removedFromIndex.unsafeTargetUrls, [
    'https://staging.example.test/preview/native-contact/'
  ], 'a removed or unpublished native destination cannot leave its staging URL in a release');

  const adjacentPath = structuredClone(document);
  adjacentPath.pages[0].tree[0].props.link = 'https://staging.example.test/preview-two/contact/';
  a.deepEqual(migrateIndexedWordPressLinks(adjacentPath, [{
    targetOrigin: 'https://staging.example.test', targetPath: '/preview', items: []
  }]).unsafeTargetUrls, [], 'target-path matching observes a segment boundary');
});

test('manual Breadcrumb links use the same target-neutral WordPress release contract as Nav items', () => {
  const document = blankDoc('Native breadcrumb');
  const crumbs = Core.makeFor('crumbs');
  crumbs.id = 'native-breadcrumb';
  crumbs.props.mode = 'manual';
  crumbs.props.items = [{
    label: 'About', href: 'https://staging.example.test/about/'
  }, { label: 'Current', href: '' }];
  document.pages[0].tree = [crumbs];

  const migrated = migrateIndexedWordPressLinks(document, [{
    targetOrigin: 'https://staging.example.test', targetPath: '/',
    items: [{ objectType: 'page', url: 'https://staging.example.test/about/' }]
  }]);
  a.equal(migrated.migrated, 1);
  a.deepEqual(migrated.unsafeTargetUrls, []);
  a.equal(String(document.pages[0].tree[0].props.items?.[0]?.href),
    'https://staging.example.test/about/', 'the source revision remains immutable');
  a.deepEqual(Core.parseWordPressContentReference(
    String(migrated.document.pages[0].tree[0].props.items?.[0]?.href)
  ), { objectType: 'page', path: '/about/' });
  const html = renderSite(migrated.document).files.get('index.html') || '';
  a.equal(html.includes('staging.example.test'), false);
  a.match(html, /href="%%PAGECRAFT_WP_CONTENT:page:[A-Za-z0-9_-]+%%"/);

  const removed = migrateIndexedWordPressLinks(document, [{
    targetOrigin: 'https://staging.example.test', targetPath: '/', items: []
  }]);
  a.deepEqual(removed.unsafeTargetUrls, ['https://staging.example.test/about/'],
    'a removed manual Breadcrumb target also fails closed');
});

test('script occurrences preserve signed region, source order, and duplicate execution count', () => {
  const document = blankDoc('Script order');
  const duplicate = '<script>window.steps.push(document.currentScript.previousElementSibling.id)</script>';
  const built = buildReleaseArtifact({
    releaseId: 'script-order-release', siteId: 'script-order-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head><script>window.steps=["head"]</script></head><body>
      <header><script>window.steps.push("shared-header")</script></header>
      <main><div id="first"></div>${duplicate}<div id="second"></div>${duplicate}</main>
      <footer><script>window.steps.push("shared-footer")</script></footer>
      <script>window.steps.push("tail")</script>
    </body></html>`]])
  });
  const route = built.artifact.routes[0];
  a.deepEqual(route.scripts.map(script => [script.region, script.order, script.placement]), [
    ['route-head', 0, 'head'],
    ['route-body', 0, 'body'],
    ['route-body', 1, 'body'],
    ['route-tail', 0, 'body']
  ]);
  a.equal(route.scripts[1].hash, route.scripts[2].hash,
    'approval fingerprints may repeat without deleting an execution occurrence');
  a.notEqual(route.scripts[1].occurrenceId, route.scripts[2].occurrenceId,
    'each duplicate execution has its own stable signed identity');
  a.match(route.headHtml, new RegExp(`<!--${route.scripts[0].token}-->`));
  a.match(route.bodyHtml, new RegExp(
    `<div id="first"></div><!--${route.scripts[1].token}--><div id="second"></div><!--${route.scripts[2].token}-->`
  ), 'body runtime markers preserve document.currentScript adjacency and duplicate positions');
  a.equal(route.bodyHtml.includes(route.scripts[3].token), false,
    'the generated tail occurrence remains an explicit tail hook rather than moving into content');
  a.deepEqual(built.artifact.shared.scripts.map(script => [script.region, script.order]), [
    ['shared-header', 0], ['shared-footer', 0]
  ]);
  a.match(built.artifact.shared.headerHtml,
    new RegExp(`<!--${built.artifact.shared.scripts[0].token}-->`));
  a.match(built.artifact.shared.footerHtml,
    new RegExp(`<!--${built.artifact.shared.scripts[1].token}-->`));
  a.equal((route.runtime.match(/document\.currentScript\.previousElementSibling\.id/g) || []).length, 2);
  a.equal(built.scripts.filter(script => script.hash === route.scripts[1].hash).length, 2,
    'the signed manifest inventory preserves occurrence count too');
  a.equal(built.placeholders.filter(item => item.kind === 'runtime').length, 5,
    'every exact-position occurrence except the explicit route tail is a signed placeholder');
  const rejected = (body: string) => buildReleaseArtifact({
    releaseId: 'script-rejected-release', siteId: 'script-rejected-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head></head><body>${body}</body></html>`]])
  });
  a.throws(() => rejected('<main><!--%%PAGECRAFT_RUNTIME:script-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa%%--></main>'),
    /reserved runtime placeholder/);
  const collisionScript = '<script>window.collision=1</script>';
  const collisionHash = sha256(new TextEncoder().encode(collisionScript));
  const collisionId = `script-${sha256(new TextEncoder().encode(
    ['/', 'route-body', '0', collisionHash].join('\0')
  )).slice(0, 32)}`;
  a.throws(() => rejected(
    `<main>${collisionScript}<!--%%PAGECRAFT_RUNTIME:${collisionId}%%--></main>`
  ), /reserved runtime placeholder/,
  'an authored duplicate of the exact deterministic occurrence marker cannot reach staging');
  a.throws(() => rejected('<script>window.beforeMain=1</script><main>Content</main>'),
    /outside its portable content region/);
});

test('signed inventories use PHP-compatible UTF-8 byte order for valid mixed-case IDs', () => {
  const document = blankDoc('Ordinal inventory');
  document.pages = ['a', 'B', 'A_', 'A-'].map(id => ({
    ...structuredClone(document.pages[0]), id, name: id, title: id, slug: id
  }));
  const files = new Map<string, string>([
    ['a.html', '<html><head></head><body><main><script>window.order="a"</script></main></body></html>'],
    ['B.html', '<html><head></head><body><main><script>window.order="B"</script></main></body></html>'],
    ['A_.html', '<html><head></head><body><main><script>window.order="A_"</script></main></body></html>'],
    ['A-.html', '<html><head></head><body><main><script>window.order="A-"</script></main></body></html>']
  ]);
  const built = buildReleaseArtifact({
    releaseId: 'ordinal-release', siteId: 'ordinal-site', sourceVersion: 1, document, files
  });
  a.deepEqual(built.pages.map(page => page.id), ['A-', 'A_', 'B', 'a']);
  a.deepEqual(built.scripts.map(script => script.ownerId), ['A-', 'A_', 'B', 'a'],
    'manifest script order matches PHP strcmp rather than locale collation');
});

test('the signed golden artifact exercises the complete connected component contract', () => {
  const { artifact } = golden();
  const matrix = artifact.routes.find(route => route.path === '/nested/about');
  a.ok(matrix, 'the component matrix lives on a non-root managed route');
  const renderedClass: Record<WidgetType, string> = {
    section: 'pagecraft-section', row: 'pagecraft-row', list: 'pagecraft-list',
    slider: 'pagecraft-slider', column: 'pagecraft-column', box: 'pagecraft-box',
    heading: 'pagecraft-heading', text: 'pagecraft-wysiwyg', quote: 'pagecraft-quote',
    image: 'pagecraft-figure', gallery: 'pagecraft-gallery', video: 'pagecraft-video',
    icon: 'pagecraft-icon', tabs: 'pagecraft-tabs', table: 'pagecraft-table-wrap',
    code: 'pagecraft-code', crumbs: 'pagecraft-crumbs', button: 'pagecraft-button',
    nav: 'pagecraft-nav-menu', form: 'pagecraft-form', accordion: 'pagecraft-accordion',
    embed: 'pagecraft-embed', spacer: 'pagecraft-spacer', divider: 'pagecraft-divider'
  };
  for (const type of MATRIX_WIDGETS) {
    a.match(matrix.bodyHtml,
      new RegExp(`id="pc-matrix-${type}"[^>]*class="[^"]*\\b${renderedClass[type]}\\b`),
      `${type} uses its actual Core-rendered DOM contract`);
  }
  a.doesNotMatch(matrix.bodyHtml, /data-pagecraft-component/,
    'coverage comes from real rendered widgets, not synthetic fixture markers');
  a.match(matrix.css, /@media\s*\(/, 'responsive CSS travels in the signed route');
  a.match(matrix.css, /--golden-tablet/, 'responsive inspector overrides are compiled');
  for (const hook of [
    'scrollBy', 'data-tabs-ready', 'navigator.clipboard', 'data-nav', 'data-embed',
    'data-lightbox', 'IntersectionObserver'
  ]) a.match(matrix.runtime, new RegExp(hook.replace('.', '\\.')), `${hook} runtime is signed`);
  a.equal((matrix.runtime.match(/<script\b/g) || []).length, matrix.scripts.length,
    'every Core runtime family has one approval fingerprint');
  a.ok(matrix.scripts.length >= 7, 'the matrix exercises the interactive Core runtime families');
  a.equal(artifact.forms.some(form => form.id === 'contact-form' && form.routePath === '/nested/about'), true,
    'the vector contains a WordPress-managed form contract');
  const cmsCollections = artifact.cms.collections as Array<{ id: string; items: Array<{ id: string }> }>;
  a.equal(cmsCollections.some(collection => collection.id === 'posts'
    && collection.items.some(item => item.id === 'post-one')), true,
  'the vector contains a stable CMS collection and item');
  a.equal(artifact.assets.some(asset => asset.assetId === 'assethero'
    && asset.mime === 'image/png' && asset.bytes > 8), true,
  'the vector contains a real raster image, not only a file signature');
  a.match(matrix.bodyHtml, /href="\/"/, 'matrix navigation is normalized to a clean internal URL');
  a.match(matrix.bodyHtml,
    /data-embed="https:\/\/www\.youtube\.com\/embed\/aqz-KE-bpKQ[^>]+data-pagecraft-embed-provider="youtube"/,
  'the real Core video facade is validated and signed with provider provenance');
  a.match(matrix.bodyHtml,
    /<iframe[^>]+player\.vimeo\.com\/video\/76979871[^>]+data-pagecraft-embed-provider="vimeo"/,
  'the real Embed widget carries the narrow signed iframe contract');
  a.equal(matrix.headOrder, 'css-before-runtime');
  const headOccurrence = matrix.scripts.find(script => script.region === 'route-head');
  a.ok(headOccurrence, 'the real page head option exercises exact CSS-before-runtime ordering');
  a.match(matrix.headHtml, new RegExp(`<!--${headOccurrence.token}-->`));
});

test('SEO compilation follows browser attribute and raw-text semantics without source ownership leaks', () => {
  const document = blankDoc('Portable SEO');
  document.meta.baseUrl = 'https://source.example/base';
  Object.assign(document.pages[0], {
    id: 'page-about', slug: 'about', title: 'Portable about', desc: 'Portable description'
  });
  const assetPath = 'assets/icon-asseticon.png';
  const html = `<!doctype html><html><head data-boundary="quoted </head>">
    <title data-inert="<script>titleIgnored()</script>">Portable about</title>
    <meta content="Portable description" name=description>
    <meta data-inert="<style>attributeIgnored{}</style>" name=viewport content="width=device-width">
    <!-- inert <meta property=og:site_name content=Ignored><script>ignored()</script> -->
    <textarea><meta property=og:site_name content=AlsoIgnored><script>stillIgnored()</script></textarea>
    <link href=https://source.example/base/about.html rel=canon&#105;cal>
    <meta content=https://source.example/base/about.html property=og&colon;url>
    <meta content="About OG" property=og:title><meta content="OG description" property=og:description>
    <meta property=og:type content=article>
    <meta content=https&colon;&sol;&sol;source.example/base/${assetPath} property=og:image>
    <meta property=og:image:secure_url content=https://source.example/base/${assetPath}>
    <meta content=summary_large_image name=twitter:card><meta content="Tweet title" name=twitter:title>
    <meta name=twitter:description content="Tweet description">
    <meta content=https://source.example/base/${assetPath} name=twitter:image>
    <link media=screen href=https://source.example/base/fr/about.html hreflang=fr rel=alternate>
    <link href=https://external.example/fr/ hreflang=x-default rel=alternate>
    <link color=#fff sizes=any href=https://source.example/base/${assetPath} rel=mask-icon type=image/png>
    <link fetchpriority=high imagesizes=100vw imagesrcset="https://source.example/base/${assetPath} 1x, https://source.example/base/${assetPath} 2x" media=screen type=image/png href=https://source.example/base/${assetPath} as=image rel=preload>
    <meta content=https://source.example/base/${assetPath} name=msapplication-TileImage>
    <script nonce=seo type=application&#x2f;ld+json>{"@context":"https://schema.org","@id":"https://source.example/base/about.html#page","url":"https://source.example/base/about.html","name":"literal </head>","markup":"<meta property=og:site_name content=Ignored><link rel=canonical href=https://ignored.example>","image":"https://source.example/base/${assetPath}","logo":{"@type":"ImageObject","url":"https://source.example/base/${assetPath}","caption":"Hero"}}</script>
    <script>window.boundary="</head><body><main>Fake main</main>";window.realExecutable=1</script>
  </head><body>
    <main><a href=https://source.example/base/about.html#team>Actual main</a><img src=https://source.example/base/${assetPath}></main>
  </body></html>`;
  const built = buildReleaseArtifact({
    releaseId: 'portable-seo-release', siteId: 'portable-seo-site', sourceVersion: 1, document,
    files: new Map([['about.html', html]]),
    assets: [{
      id: 'asset-icon', siteId: 'portable-seo-site', name: 'icon.png', type: 'image/png', w: 1, h: 1,
      bytes: new Uint8Array(Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64'
      ))
    }]
  });
  const route = built.artifact.routes[0];
  a.deepEqual(route.seo, {
    title: 'Portable about', description: 'Portable description', canonical: '/about', robots: '',
    ogTitle: 'About OG', ogDescription: 'OG description', ogType: 'article', ogUrl: '/about',
    ogImage: 'pc-asset://asset-icon', ogImageSecureUrl: 'pc-asset://asset-icon',
    twitterCard: 'summary_large_image', twitterTitle: 'Tweet title',
    twitterDescription: 'Tweet description', twitterImage: 'pc-asset://asset-icon',
    structuredData: canonicalJson([{
      '@context': 'https://schema.org', '@id': '/about#page', url: '/about',
      name: 'literal </head>',
      markup: '<meta property=og:site_name content=Ignored><link rel=canonical href=https://ignored.example>',
      image: 'pc-asset://asset-icon',
      logo: { '@type': 'ImageObject', url: 'pc-asset://asset-icon', caption: 'Hero' }
    }])
  });
  a.equal(route.headHtml.includes('https://source.example'), false);
  a.equal(route.bodyHtml.includes('https://source.example'), false);
  a.match(route.headHtml, /href="\/fr\/about" hreflang=fr rel=alternate/);
  a.match(route.headHtml, /href="https:\/\/external\.example\/fr\/"/);
  a.match(route.headHtml, /href="pc-asset:\/\/asset-icon" rel=mask-icon/);
  a.match(route.headHtml, /imagesrcset="pc-asset:\/\/asset-icon 1x, pc-asset:\/\/asset-icon 2x"/);
  a.match(route.headHtml, /<textarea><meta property=og:site_name content=AlsoIgnored><script>stillIgnored\(\)<\/script><\/textarea>/,
    'inert RCDATA is preserved and not treated as SEO or executable markup');
  a.match(route.headHtml, /data-inert="<script>titleIgnored\(\)<\/script>"/);
  a.match(route.headHtml, /data-inert="<style>attributeIgnored\{\}<\/style>"/);
  a.equal(route.headHtml.includes('<script'), true, 'inert textarea text remains byte-semantic');
  a.equal(route.headHtml.includes('application/ld+json'), false, 'typed JSON-LD has one owner');
  a.equal(route.scripts.length, 1, 'the real executable script is inventoried once');
  a.match(route.runtime, /window\.boundary="<\/head><body><main>Fake main<\/main>"/);
  a.match(route.bodyHtml, /Actual main/);
  a.doesNotMatch(route.bodyHtml, /Fake main/);
});

test('unsupported owned SEO, mutable resources, invalid JSON-LD, and templates fail publication', () => {
  const document = blankDoc('Unsupported portable output');
  document.meta.baseUrl = 'https://source.example/base';
  const build = (head: string, body = '<main>Safe</main>') => buildReleaseArtifact({
    releaseId: 'unsupported-seo-release', siteId: 'unsupported-seo-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head>${head}</head><body>${body}</body></html>`]])
  });
  a.throws(() => build('<meta content=Name property=og:site_name>'), /unsupported owned SEO field og:site_name/);
  a.throws(() => build('<link rel=manifest href=/site.webmanifest>'), /unsupported mutable manifest/);
  a.throws(() => build('<script type=application&sol;ld&plus;json>{not-json}</script>'), /invalid JSON-LD/);
  a.throws(() => build('', '<main><template><script>window.templateExecutable=1</script></template></main>'),
    /unsupported template element/);
  a.throws(() => build('', '<main>%%PAGECRAFT_UNKNOWN:lowercase-id%%</main>'),
    /unresolved dynamic placeholders/);
  a.throws(() => build('<meta property=og:image content=https://source.example/base/assets/missing.png>'),
    /unfrozen local asset/);
  a.doesNotThrow(() => build('<!-- <meta property=og:site_name content=Ignored> -->'
    + '<textarea><meta property=og:site_name content=Ignored></textarea>'));
});

test('shared shells are exact, source-neutral, and never silently discard structured data', () => {
  const document = blankDoc('Shared shell');
  document.meta.baseUrl = 'https://source.example/base';
  const page = structuredClone(document.pages[0]);
  Object.assign(page, { id: 'other-page', slug: 'other', name: 'Other', title: 'Other' });
  document.pages.push(page);
  const file = (header: string, footer = '<footer>Same</footer>') =>
    `<html><head><title>Shared</title></head><body>${header}<main>Body</main>${footer}</body></html>`;
  a.throws(() => buildReleaseArtifact({
    releaseId: 'shared-drift', siteId: 'shared-site', sourceVersion: 1, document,
    files: new Map([
      ['index.html', file('<header>First</header>')],
      ['other.html', file('<header>Second</header>')]
    ])
  }), /routes disagree about the shared header/);
  a.throws(() => buildReleaseArtifact({
    releaseId: 'shared-jsonld', siteId: 'shared-site', sourceVersion: 1, document,
    files: new Map([['index.html', file('<header><script type=application/ld+json>{"name":"x"}</script></header>')]])
  }), /shared site shell contains unsupported JSON-LD/);
  a.throws(() => buildReleaseArtifact({
    releaseId: 'shared-source', siteId: 'shared-site', sourceVersion: 1, document,
    files: new Map([['index.html', file('<header><img src=https://source.example/base/not-frozen.png></header>')]])
  }), /retained the Pagecraft source origin|missing asset|unfrozen/);
});

test('legacy aliases that exceed the WordPress route limit are omitted', () => {
  const document = blankDoc('Long route');
  const segment = 'a'.repeat(184);
  const file = `${segment}/index.html`;
  const built = buildReleaseArtifact({
    releaseId: 'long-route-release', siteId: 'long-route-site', sourceVersion: 1, document,
    files: new Map([[file, '<html><head></head><body><main>Long route</main></body></html>']])
  });
  a.equal(built.artifact.routes[0].path.length, 186);
  a.deepEqual(built.artifact.redirects.map(item => [item.from.length, item.from]), [
    [191, `/${segment}/index`]
  ]);
  a.equal(built.artifact.redirects.every(item => item.from.length <= 191 && item.to.length <= 191), true);
});

test('legal unquoted navigation attributes never expose generated .html filenames', () => {
  const document = blankDoc('Unquoted links');
  const built = buildReleaseArtifact({
    releaseId: 'unquoted-release', siteId: 'unquoted-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head></head><body><main>
      <a href=/about.html?from=home#team>About</a>
      <button formaction=nested/contact.html>Contact</button>
      <span action=../index.html>Home</span>
    </main></body></html>`]])
  });
  const html = built.artifact.routes[0].bodyHtml;
  a.match(html, /href="\/about\?from=home#team"/);
  a.match(html, /formaction="\/nested\/contact"/);
  a.match(html, /action="\/"/);
  a.doesNotMatch(html, /(?:href|action|formaction)\s*=\s*[^\s>]*\.html/i);
});

test('signatures fail for tampering, wrong targets, and replayed target sequences', () => {
  const vector = golden();
  const publicKey = keyFromRawPublic(vector.trust.releasePublicKey);
  const tampered = structuredClone(vector.desired.release);
  tampered.signature = (tampered.signature.startsWith('A') ? 'B' : 'A') + tampered.signature.slice(1);
  a.throws(() => verifySignedRelease({ signed: tampered, publicKey }), /signature is invalid/);
  a.throws(() => verifySignedDeployment({
    signed: vector.desired.deployment, publicKey,
    releaseManifest: vector.desired.release.manifest,
    expected: { targetOrigin: 'https://other.example' }
  }), /different targetOrigin/);
  a.throws(() => verifySignedDeployment({
    signed: vector.desired.deployment, publicKey,
    releaseManifest: vector.desired.release.manifest, afterSequence: 4
  }), /replay or rollback/);
});

test('Existing Theme CSS scopes nested rules and blocks authored globals', () => {
  a.equal(scopeCss(':root,body .x{color:red}@media(min-width:1px){html,.y{display:block}}'),
    '.pagecraft-root,.pagecraft-root .x{color:red}@media(min-width:1px){.pagecraft-root,.pagecraft-root .y{display:block}}');
  a.deepEqual(unsafeExistingThemeCss(':root, .card{color:red}'), ['unsafe-global-selector']);
  a.deepEqual(unsafeExistingThemeCss('@supports(display:grid){body{display:grid}}'), ['unsafe-global-selector']);
  a.deepEqual(unsafeExistingThemeCss('\\62ody/**/ .card{color:red}'), ['unsafe-global-selector']);
  a.deepEqual(unsafeExistingThemeCss('@\\69mport url(https://evil.example/x.css);'), ['unsafe-global-at-rule']);
  a.deepEqual(unsafeExistingThemeCss('@keyframes spin{from{opacity:0}to{opacity:1}}'),
    ['unsafe-global-at-rule'], 'an authored keyframe name cannot collide with the retained theme');
  a.equal(scopeCss('@layer reset, components;/* next */ .card{color:red}'),
    '@layer reset, components;/* next */ .pagecraft-root .card{color:red}');
  a.deepEqual(unsafeExistingThemeCss('@layer reset, components;/* next */ .card{color:red}'), []);
  a.throws(() => scopeCss('@namespace svg url(http://www.w3.org/2000/svg);.card{color:red}'),
    /unsupported CSS statement/);
  const document = blankDoc('Unsafe');
  document.meta.css = '@import url(elsewhere.css); body{margin:0}';
  a.deepEqual(existingThemeCssIssues(document), ['unsafe-global-at-rule', 'unsafe-global-selector']);
});

test('conditional styles retain media semantics and comment-prefixed at-rules remain valid', () => {
  const document = blankDoc('Conditional CSS');
  const built = buildReleaseArtifact({
    releaseId: 'conditional-css-release', siteId: 'conditional-css-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<!doctype html><html><head>
      <style media="(max-width: 600px)">.only-mobile{display:none}</style>
    </head><body>
      <header><style media=print>.print-only{display:block}</style></header>
      <main><p class="only-mobile">Mobile</p></main><footer></footer>
    </body></html>`]])
  });
  a.match(built.artifact.routes[0].css,
    /@media \(max-width: 600px\)\{\.pagecraft-root \.only-mobile\{display:none\}\}/);
  a.match(built.artifact.routes[0].css,
    /@media print\{\.pagecraft-root \.print-only\{display:block\}\}/);
  a.equal(built.artifact.shared.css, '',
    'shell-authored rules live in the route source-order stream, not a reordered shared stream');
  const cascade = buildReleaseArtifact({
    releaseId: 'conditional-css-order', siteId: 'conditional-css-site', sourceVersion: 2, document,
    files: new Map([['index.html', `<html><head><style>.same{color:red}</style></head><body>
      <header></header><main><p class=same>Same</p></main>
      <footer><style>.same{color:blue}</style></footer></body></html>`]])
  }).artifact.routes[0].css;
  a.ok(cascade.indexOf('color:red') < cascade.indexOf('color:blue'),
    'head, main, and footer CSS retain browser cascade order in one signed route stream');
  a.equal(scopeCss('/* keep */ @media(min-width:1px){.card{display:block}}'),
    '/* keep */ @media(min-width:1px){.pagecraft-root .card{display:block}}');
  a.throws(() => buildReleaseArtifact({
    releaseId: 'conditional-css-unsafe', siteId: 'conditional-css-site', sourceVersion: 2, document,
    files: new Map([['index.html', '<html><head><style scoped>.x{color:red}</style></head><body><main></main></body></html>']])
  }), /unsupported head attributes/);
});

test('route CSS is contractually before head runtime and unsupported interleaving fails closed', () => {
  const document = blankDoc('Head order');
  const build = (head: string) => buildReleaseArtifact({
    releaseId: 'head-order-release', siteId: 'head-order-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head>${head}</head><body><main>Safe</main></body></html>`]])
  });
  const ordered = build('<style>.ready{color:green}</style><script>window.readReady=1</script>');
  const route = ordered.artifact.routes[0];
  a.equal(route.headOrder, 'css-before-runtime');
  a.match(route.css, /\.pagecraft-root \.ready\{color:green\}/);
  const headOccurrence = route.scripts.find(script => script.region === 'route-head');
  a.ok(headOccurrence);
  a.match(route.headHtml, new RegExp(`<!--${headOccurrence.token}-->`));
  a.throws(() => build('<script>window.readTooEarly=1</script><style>.late{color:red}</style>'),
    /head style after executable runtime/);
  a.doesNotThrow(() => build(
    '<script type=application\/ld+json>{"name":"Inert"}</script><style>.safe{color:green}</style>'
  ), 'non-executable structured data does not create a runtime ordering boundary');
});

test('route and shared CSS may reference only frozen release resources', () => {
  const document = blankDoc('Frozen CSS resources');
  document.meta.baseUrl = 'https://pagecraft.example/source';
  const build = (style: string, shared = false) => buildReleaseArtifact({
    releaseId: `css-resource-${shared ? 'shared' : 'route'}`,
    siteId: 'css-resource-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head>${shared ? '' : `<style>${style}</style>`}</head><body>
      ${shared ? `<header><style>${style}</style></header>` : ''}<main>Safe</main><footer></footer>
    </body></html>`]])
  });
  for (const url of [
    'https://pagecraft.example/source/missing.png', '/source/missing.png', '/missing.png',
    'https://cdn.example/mutable.png'
  ]) {
    a.throws(() => build(`.hero{background-image:url("${url}")}`), /unfrozen CSS resource/, url);
  }
  a.throws(() => build('.brand{background:url(/missing-shared.png)}', true),
    /unfrozen CSS resource/);
  for (const escaped of [
    String.raw`.escaped{background:u\72l(https://cdn.example/escaped-a.png)}`,
    String.raw`.escaped{background:\75rl(https://cdn.example/escaped-b.png)}`,
    String.raw`.commented{background:u/**/rl(https://cdn.example/commented.png)}`,
    `.continued{background:u\\
rl(https://cdn.example/continued.png)}`
  ]) {
    a.throws(() => build(escaped), /unfrozen CSS resource/, escaped);
    a.throws(() => build(escaped, true), /unfrozen CSS resource/, `shared ${escaped}`);
  }
  const embedded = build('.safe{background:url(data:image/png;base64,iVBORw0KGgo=)}');
  a.match(embedded.artifact.routes[0].css, /url\(data:image\/png;base64,iVBORw0KGgo=\)/);
  const inert = build(String.raw`.safe::before{content:"u\72l(https://cdn.example/inert.png)"}`);
  a.match(inert.artifact.routes[0].css, /content:/,
    'a URL-shaped string is not mistaken for a fetched CSS resource');
});

test('portable media is frozen and provider iframes carry compiler-owned provenance', () => {
  const document = blankDoc('Portable media');
  const build = (body: string) => buildReleaseArtifact({
    releaseId: 'media-release', siteId: 'media-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head></head><body><main>${body}</main></body></html>`]]),
    assets: [{
      id: 'media', siteId: 'media-site', name: 'clip.mp4', type: 'video/mp4',
      w: 0, h: 0,
      bytes: new Uint8Array([0, 0, 0, 20, 102, 116, 121, 112, 109, 112, 52, 50])
    }]
  });
  const safe = build([
    '<iframe src="https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ" title="Video" loading=lazy allowfullscreen></iframe>',
    '<iframe src="https://player.vimeo.com/video/76979871?h=abc" title="Video"></iframe>',
    '<button type=button data-embed="https://www.youtube.com/embed/aqz-KE-bpKQ?mute=1">Play</button>',
    '<video src="assets/clip-media.mp4" controls></video>'
  ].join(''));
  const html = safe.artifact.routes[0].bodyHtml;
  a.match(html, /youtube-nocookie[^>]+data-pagecraft-embed-provider="youtube"/);
  a.match(html, /player\.vimeo[^>]+data-pagecraft-embed-provider="vimeo"/);
  a.match(html, /data-embed="https:\/\/www\.youtube\.com[^>]+data-pagecraft-embed-provider="youtube"/);
  a.match(html, /<video src="pc-asset:\/\/media"/);
  a.deepEqual(safe.artifact.assets.map(asset => asset.assetId), ['media']);

  for (const body of [
    '<iframe src="https://maps.example/embed/1"></iframe>',
    '<iframe src="http://www.youtube.com/embed/aqz-KE-bpKQ"></iframe>',
    '<iframe src="https://www.youtube.com/watch?v=aqz-KE-bpKQ"></iframe>',
    '<iframe src="https://www.youtube.com/embed/aqz-KE-bpKQ" style="border:0"></iframe>',
    '<object data="https://cdn.example/widget"></object>',
    '<embed src="https://cdn.example/widget">',
    '<video src="/media/missing.mp4"></video>',
    '<audio src="https://cdn.example/mutable.mp3"></audio>',
    '<track src="/captions/missing.vtt">',
    '<video><source src="/media/missing.webm"></video>'
  ]) a.throws(() => build(body), /unsupported|unfrozen/, body);
});

test('Connected releases reject authored stylesheet links while leaving non-stylesheet hints alone', () => {
  const document = blankDoc('External CSS');
  document.meta.headHtml = '<link rel="preconnect" href="https://cdn.example">\n'
    + '<link href=https://cdn.example/global.css rel="alternate stylesheet">';
  a.deepEqual(authoredStylesheetIssues(document), ['unsafe-external-stylesheet']);
  a.deepEqual(existingThemeCssIssues(document), ['unsafe-external-stylesheet']);

  const pageOnly = blankDoc('Safe head hint');
  pageOnly.pages[0].headHtml = '<link rel=preload as=font href=https://cdn.example/font.woff2>';
  a.deepEqual(authoredStylesheetIssues(pageOnly), []);
  a.deepEqual(existingThemeCssIssues(pageOnly), []);
});

test('authored CSS imports and parser directives are unsafe for every release profile', () => {
  const document = blankDoc('CSS parser context');
  const unsafe = [
    '@\\69mport url(https://evil.example/a.css);',
    '@\\000069mport url(https://evil.example/b.css);',
    '@im/**/port url(https://evil.example/c.css);',
    '@\\69\\6dport url(https://evil.example/d.css);',
    '@NaMeSpAcE svg url(https://evil.example/ns);'
  ];
  for (const css of unsafe) {
    document.pages[0].headHtml = `<style>${css}</style>`;
    a.deepEqual(authoredCssAtRuleIssues(document), ['unsafe-global-at-rule'], css);
    a.equal(hasUnsafeCssParserDirective(css), true, css);
  }
  a.equal(canonicalCssSyntax('@\\000069m/**/port x').startsWith('@import'), true);
  a.equal(hasUnsafeCssParserDirective('.safe{content:"@\\69mport";background:url(/@\\69mport)}'), false,
    'string and URL payloads are not parsed as CSS preludes');
  document.pages[0].headHtml = '<style>.safe{color:green}</style>';
  a.deepEqual(authoredCssAtRuleIssues(document), []);
});

test('the compiler independently rejects escaped CSS parser directives', () => {
  for (const [index, css] of [
    '@\\69mport url(https://evil.example/a.css);',
    '@\\000069mport url(https://evil.example/b.css);',
    '@im/**/port url(https://evil.example/c.css);'
  ].entries()) {
    const document = blankDoc(`Escaped CSS ${index}`);
    a.throws(() => buildReleaseArtifact({
      releaseId: `escaped-css-${index}`, siteId: 'escaped-css-site', sourceVersion: 1, document,
      files: new Map([['index.html', `<html><head><style>${css}</style></head><body><main></main></body></html>`]])
    }), /unsafe CSS parser directive/);
  }
});

test('stylesheet rel tokens use browser-equivalent HTML entity decoding', () => {
  const document = blankDoc('Entity stylesheet');
  document.meta.headHtml = '<link rel="style&#x73;heet" href="https://evil.example/x.css">';
  a.deepEqual(authoredStylesheetIssues(document), ['unsafe-external-stylesheet']);
  const files = new Map([['index.html', '<html><head>'
    + '<link rel=style&#115;heet href=https://evil.example/x.css></head><body><main></main></body></html>']]);
  a.deepEqual(releaseStylesheetLinks(files), ['https://evil.example/x.css']);
  a.throws(() => buildReleaseArtifact({
    releaseId: 'entity-stylesheet-release', siteId: 'entity-stylesheet-site', sourceVersion: 1,
    document: blankDoc('Compiler entity stylesheet'), files
  }), /unfrozen stylesheet links/);
});

test('the compiler refuses every stylesheet whose bytes are outside the signed artifact', () => {
  const document = blankDoc('Frozen styles');
  const files = new Map([['index.html', '<html><head>'
    + '<link rel=preconnect href=https://fonts.gstatic.com>'
    + '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">'
    + '</head><body><main>Safe body</main></body></html>']]);
  a.deepEqual(releaseStylesheetLinks(files), ['https://fonts.googleapis.com/css2?family=Inter']);
  a.throws(() => buildReleaseArtifact({
    releaseId: 'unfrozen-font-release', siteId: 'unfrozen-font-site',
    sourceVersion: 1, document, files
  }), /unfrozen stylesheet links/);
});

test('unquoted event, javascript, srcdoc, and data-html execution blocks publication', () => {
  const document = blankDoc('Hostile');
  const files = new Map([['index.html', `<html><head></head><body><main>
    <a href=javascript:alert(1) onclick=alert(2)>bad</a>
    <object data=data:text/html,boom></object>
    <iframe srcdoc=boom></iframe>
  </main></body></html>`]]);
  a.throws(() => buildReleaseArtifact({
    releaseId: 'hostile-release', siteId: 'hostile-site', sourceVersion: 1, document, files
  }), /unsafe inline executable markup/);
});

test('remote executable scripts require browser-enforced immutable bytes', () => {
  const document = blankDoc('Scripts');
  const build = (script: string) => buildReleaseArtifact({
    releaseId: 'script-release', siteId: 'script-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head>${script}</head><body><main>Safe</main></body></html>`]])
  });

  a.throws(() => build('<script src="https://cdn.example/widget.js"></script>'),
    /requires SRI integrity/);
  a.throws(() => build('<script src="//cdn.example/widget.js" integrity="sha384-YWJjZA==" crossorigin="anonymous"></script>'),
    /not a frozen release asset or absolute HTTPS URL/);

  const built = build('<script src="https://cdn.example/widget.js" integrity="sha384-YWJjZA==" crossorigin="anonymous"></script>');
  a.equal(built.artifact.routes[0].scripts.length, 1);
  a.match(built.artifact.routes[0].runtime, /integrity="sha384-YWJjZA=="/);
});

test('signed SVG assets are static, self-contained, and preserved byte-for-byte', () => {
  const document = blankDoc('SVG');
  const files = new Map([['index.html', '<html><head></head><body><main><img src="assets/mark-assetsvg.svg"></main></body></html>']]);
  const makeAsset = (source: string | Uint8Array) => ({
    id: 'asset-svg', siteId: 'svg-site', name: 'mark.svg', type: 'image/svg+xml', w: 24, h: 24,
    bytes: typeof source === 'string' ? new TextEncoder().encode(source) : source
  });
  const build = (source: string | Uint8Array) => buildReleaseArtifact({
    releaseId: 'svg-release', siteId: 'svg-site', sourceVersion: 1, document, files,
    assets: [makeAsset(source)]
  });
  const safe = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <defs><linearGradient id="paint"><stop stop-color="#fff"/></linearGradient><path id="shape" d="M0 0h24v24H0z"/></defs>
    <use href="#shape" fill="url(#paint)"/><title>Pagecraft mark</title>
  </svg>`;
  const frozen = build(safe).artifact.assets[0];
  a.deepEqual(fromBase64url(frozen.content), new TextEncoder().encode(safe));

  for (const hostile of [
    '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>HTML</div></foreignObject></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://evil.example/icon.svg#x"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><use href="j&#97;vascript:alert(1)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path style="fill:url(https://evil.example/a.svg)"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>',
    '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text>&xxe;</text></svg>'
  ]) {
    a.throws(() => build(hostile), /not safe static SVG/);
  }
  a.throws(() => build(new Uint8Array([0x3c, 0x73, 0x76, 0x67, 0xff, 0x3e])), /invalid UTF-8/);
});

test('only referenced assets are frozen and oversized library leftovers do not bloat a release', () => {
  const document = blankDoc('Referenced assets');
  const files = new Map([['index.html', '<html><head></head><body><main><img src="assets/used-used.png"></main></body></html>']]);
  const built = buildReleaseArtifact({
    releaseId: 'asset-filter-release', siteId: 'asset-filter-site', sourceVersion: 1, document, files,
    assets: [
      {
        id: 'used', siteId: 'asset-filter-site', name: 'used.png', type: 'image/png', w: 1, h: 1,
        bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
      },
      {
        id: 'unused', siteId: 'asset-filter-site', name: 'unused.png', type: 'image/png', w: 1, h: 1,
        bytes: new Uint8Array(10 * 1024 * 1024)
      },
      {
        id: 'unused-svg', siteId: 'asset-filter-site', name: 'unused.svg', type: 'image/svg+xml', w: 1, h: 1,
        bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      }
    ]
  });
  a.deepEqual(built.artifact.assets.map(asset => asset.assetId), ['used']);
  a.ok(built.artifactBytes.byteLength < 10_000, 'an unused 10 MiB library item is not encoded or signed');
  a.throws(() => buildReleaseArtifact({
    releaseId: 'asset-missing-release', siteId: 'asset-filter-site', sourceVersion: 1, document,
    files: new Map([['index.html', '<html><head></head><body><main><img src="pc-asset://missing"></main></body></html>']])
  }), /references missing asset missing/);
});

test('generated pagination and CMS detail routes keep valid stable source identities', () => {
  const document = blankDoc('Derived routes');
  document.pages[0].id = 'detail-template';
  document.pages[0].collection = 'posts';
  document.meta.collections = [{
    id: 'posts', name: 'Posts', slug: 'posts', detail: '',
    fields: [{ id: 'title', name: 'Title', type: 'text', required: 1 }],
    items: [{ id: 'item-stable', slug: 'first-post', values: { title: 'First post' } }]
  }];
  const detail = buildReleaseArtifact({
    releaseId: 'detail-release-1', siteId: 'derived-site', sourceVersion: 1, document,
    files: new Map([['posts/first-post.html', '<html><head><title>First post</title></head><body><main>Post</main></body></html>']])
  });
  a.match(detail.artifact.routes[0].pageId, /^route-[a-f0-9]{48}$/);
  a.equal(detail.pages[0].id, detail.artifact.routes[0].pageId);

  const moved = structuredClone(document);
  moved.meta.collections![0].slug = 'journal';
  moved.meta.collections![0].items[0].slug = 'renamed';
  const movedDetail = buildReleaseArtifact({
    releaseId: 'detail-release-2', siteId: 'derived-site', sourceVersion: 2, document: moved,
    files: new Map([['journal/renamed.html', '<html><head><title>First post</title></head><body><main>Post</main></body></html>']])
  });
  a.equal(movedDetail.artifact.routes[0].pageId, detail.artifact.routes[0].pageId,
    'changing slugs does not orphan the managed native page identity');

  const listing = blankDoc('Pagination');
  listing.pages[0].id = 'listing-page';
  listing.pages[0].slug = 'journal';
  const paged = buildReleaseArtifact({
    releaseId: 'paged-release', siteId: 'derived-site', sourceVersion: 1, document: listing,
    files: new Map([['journal/page-2.html', '<html><head><title>Journal page 2</title></head><body><main>Page 2</main></body></html>']])
  });
  a.match(paged.artifact.routes[0].pageId, /^route-[a-f0-9]{48}$/);
  a.equal(paged.pages[0].name, 'Home — page 2');

  const duplicateItem = structuredClone(document);
  duplicateItem.meta.collections!.push({
    id: 'news', name: 'News', slug: 'news', detail: '',
    fields: [{ id: 'title', name: 'Title', type: 'text' }],
    items: [{ id: 'item-stable', slug: 'duplicate', values: { title: 'Duplicate' } }]
  });
  a.throws(() => buildReleaseArtifact({
    releaseId: 'duplicate-cms-id', siteId: 'derived-site', sourceVersion: 1,
    document: duplicateItem, files: new Map()
  }), /duplicate item ID/);
});

test('forms compile an exact signed field contract and reject unsafe destinations', () => {
  const document = blankDoc('Forms');
  const build = (form: string) => buildReleaseArtifact({
    releaseId: 'form-release', siteId: 'form-site', sourceVersion: 1, document,
    files: new Map([['index.html', `<html><head></head><body><main>${form}</main></body></html>`]])
  });
  const managed = build(`<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post">
    <input name="full_name" required>
    <input name="email" type="email" required>
    <input name="phone" type="tel">
    <input name="party_size" type="number">
    <select name="topic"><option value="sales">Sales</option><option>Support</option></select>
    <textarea name="message"></textarea>
    <input name="consent" type="checkbox" required>
    <input name="ignored" disabled>
  </form>`);
  a.deepEqual(managed.artifact.forms, [{
    id: 'contact', routePath: '/', method: 'POST', fields: [
      { name: 'full_name', type: 'text', required: true },
      { name: 'email', type: 'email', required: true, privacy: 'email' },
      { name: 'phone', type: 'tel', required: false },
      { name: 'party_size', type: 'number', required: false },
      { name: 'topic', type: 'select', required: false, options: ['sales', 'Support'] },
      { name: 'message', type: 'textarea', required: false },
      { name: 'consent', type: 'checkbox', required: true }
    ]
  }]);
  const twoEmails = build(`<form action="%%PAGECRAFT_FORM_ENDPOINT:email-pair%%" method="post">
    <input name="primary_email" type="email"><input name="backup_email" type="email">
  </form>`);
  a.deepEqual(twoEmails.artifact.forms[0].fields, [
    { name: 'primary_email', type: 'email', required: false, privacy: 'email' },
    { name: 'backup_email', type: 'email', required: false }
  ], 'only one signed email field owns the privacy lookup contract');

  const parserSafe = build(`<form action="%%PAGECRAFT_FORM_ENDPOINT:parser-safe%%" method=post>
    <input name=email type=email required>
    <!-- <input name=ghost required><select name=ghost_select><option>Ghost</option></select> -->
    <textarea name=message>Literal </form> and <input name=ghost_textarea required></textarea>
    <script>window.example = '<input name="ghost_script" required></form>';</script>
  </form>`);
  a.deepEqual(parserSafe.artifact.forms[0].fields, [
    { name: 'email', type: 'email', required: true, privacy: 'email' },
    { name: 'message', type: 'textarea', required: false }
  ], 'comments and raw-text strings cannot add controls or truncate the signed form contract');
  a.match(parserSafe.artifact.routes[0].runtime, /ghost_script/,
    'a real authored script remains inventoried even when its string contains form-like markup');

  const external = build('<form action="https://forms.example/submit" method="post"><input name="email"></form>');
  a.deepEqual(external.artifact.forms, [], 'external handlers are never treated as WordPress-managed forms');
  document.meta.baseUrl = 'https://pagecraft.example/source';
  const sameOriginExternal = build(
    '<form action="https://pagecraft.example/source/api/submit" method="post"><input name="email"></form>'
  );
  a.match(sameOriginExternal.artifact.routes[0].bodyHtml,
    /action="https:\/\/pagecraft\.example\/source\/api\/submit"/,
    'a validated external endpoint never becomes a WordPress-relative form action');
  document.meta.baseUrl = '';
  a.throws(() => build('<form action="http://forms.example/submit"><input name="email"></form>'),
    /requires an absolute HTTPS endpoint/);
  a.throws(() => build('<form action="https://"><input name="email"></form>'),
    /requires an absolute HTTPS endpoint/);
  a.throws(() => build('<form action="/submit"><input name="email"></form>'),
    /requires an absolute HTTPS endpoint/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%"><input name="email"></form>'),
    /must use POST/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><input name="tags" multiple></form>'),
    /unsupported multi-value field/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><input name="pagecraft_nonce"></form>'),
    /unsupported field name/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><input name="1email"></form>'),
    /unsupported field name/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><input name="ACTION"></form>'),
    /unsupported field name/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:.contact%%" method="post"><input name="email"></form>'),
    /unsupported form ID/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:Contact%%" method="post"><input name="one"></form><form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><input name="two"></form>'),
    /duplicated/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><input name="Email"><input name="email"></form>'),
    /repeats field email/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><select name="topic"><option value="">Choose</option></select></form>'),
    /invalid or duplicate options/);
  a.throws(() => build('<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post"><select name="topic"><option>A</option><option>A</option></select></form>'),
    /invalid or duplicate options/);
  const tooMany = Array.from({ length: 51 }, (_, index) => `<input name="field_${index}">`).join('');
  a.throws(() => build(`<form action="%%PAGECRAFT_FORM_ENDPOINT:contact%%" method="post">${tooMany}</form>`),
    /too many fields/);
  const tooManyForms = Array.from({ length: 1001 }, (_, index) =>
    `<form action="%%PAGECRAFT_FORM_ENDPOINT:f${index}%%" method="post"><input name="email"></form>`
  ).join('');
  a.throws(() => build(tooManyForms), /more than 1000 managed forms/);
});

test('compiler-owned global boundaries preserve arbitrary section tags and bind shared forms per route', () => {
  const document = blankDoc('Shared shell');
  document.meta.font = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
  document.meta.headFont = '';
  for (const style of document.meta.tokens?.text || []) {
    for (const breakpoint of ['d', 't', 'm'] as const) delete style.css[breakpoint]['font-family'];
  }
  const wrap = (id: string, children: PcNode[]) => {
    const column = Core.N('column', {}, {}, children); column.id = `${id}-column`;
    const row = Core.N('row', {}, {}, [column]); row.id = `${id}-row`;
    const section = Core.N('section', { tag: 'section' }, {}, [row]); section.id = id;
    return section;
  };
  const heading = Core.N('heading', {
    text: 'GLOBAL HEADER MUST SURVIVE', level: 'div', ts: 'body'
  });
  heading.id = 'shared-heading';
  const nestedLandmark = Core.N('embed', {
    html: '<header class="nested-landmark">Nested landmark</header>'
  });
  nestedLandmark.id = 'shared-nested-landmark';
  document.header = [wrap('shared-header-section', [heading, nestedLandmark])];

  const form = Core.N('form', {
    mode: 'wordpress', method: 'post', submit: 'Join', aria: 'Newsletter signup',
    fields: [{ type: 'email', label: 'Email', name: 'email', required: 1, ph: 'you@example.com' }]
  });
  form.id = 'shared-newsletter';
  document.footer = [wrap('shared-footer-section', [form])];
  const second = structuredClone(document.pages[0]);
  second.id = 'shared-contact-page';
  second.name = 'Contact';
  second.slug = 'contact';
  second.tree = [];
  document.pages.push(second);

  const rendered = renderSite(document);
  a.deepEqual(rendered.findings.filter(finding => finding.level === 'error'), []);
  const built = buildReleaseArtifact({
    releaseId: 'shared-shell-release', siteId: 'shared-shell-site', sourceVersion: 1,
    document, files: rendered.files
  });
  a.match(built.artifact.shared.headerHtml, /GLOBAL HEADER MUST SURVIVE/);
  a.match(built.artifact.shared.headerHtml, /<header class="nested-landmark">Nested landmark<\/header>/);
  a.match(built.artifact.shared.footerHtml,
    /%%PAGECRAFT_FORM_ENDPOINT:shared-newsletter%%/);
  a.ok(built.artifact.routes.every(route => !route.bodyHtml.includes('GLOBAL HEADER MUST SURVIVE')),
    'shared content is not duplicated into route fragments');
  a.ok(!canonicalJson(built.artifact).includes('PAGECRAFT_SHARED_HEADER_START'),
    'compiler-only boundaries do not enter the signed WordPress artifact');
  a.deepEqual(built.artifact.forms.map(item => [item.id, item.routePath]), [
    ['shared-newsletter', '/'], ['shared-newsletter', '/contact']
  ]);
  a.deepEqual(built.placeholders.filter(item => item.kind === 'form')
    .map(item => [item.id, item.routePath]), [
    ['shared-newsletter', '/'], ['shared-newsletter', '/contact']
  ]);

  const spoofed = structuredClone(document);
  spoofed.meta.headHtml = Core.SHARED_HEADER_START;
  const spoofedRender = renderSite(spoofed);
  a.throws(() => buildReleaseArtifact({
    releaseId: 'shared-shell-spoof', siteId: 'shared-shell-site', sourceVersion: 2,
    document: spoofed, files: spoofedRender.files
  }), /reserved shared-shell boundary marker/);

  const unsafeFiles = new Map(rendered.files);
  for (const [path, html] of unsafeFiles) {
    if (path.endsWith('.html')) {
      unsafeFiles.set(path, html.replace(
        '%%PAGECRAFT_FORM_ENDPOINT:shared-newsletter%%',
        'http://forms.example/submit'
      ));
    }
  }
  a.throws(() => buildReleaseArtifact({
    releaseId: 'shared-shell-unsafe-form', siteId: 'shared-shell-site', sourceVersion: 3,
    document, files: unsafeFiles
  }), /shared site shell requires an absolute HTTPS endpoint/);
});
