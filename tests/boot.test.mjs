/* Does the built file actually start?

   Nothing asked that until now, and three regressions in one day went out through the gap.
   Each time the suite was green:

     the element bar clipped at the top of the canvas        465 passing
     preview rendering a detail template with no bindings    442 passing
     a module-level `C.TRANSITIONS` killing the UI bundle    496 passing

   The last one shipped an application that could not start. `C` is null until `install()` runs,
   so a constant that reads it is evaluated too early, throws, and takes every panel with it —
   and every test still passed, because they exercise the core and the components directly and
   nothing loads the artifact the way a browser does.

   So this loads `index.html` in jsdom and asks the questions a person asks in the first second:
   did anything throw, is there a project, did the chrome draw, does selecting something show an
   inspector. It is deliberately shallow. Depth belongs in the other two suites; what is missing
   here is breadth — one test across the whole boot rather than many across its parts.

   It reads the built file, so it is only as current as the last `node build.mjs`. That is the
   same contract `tools/pubcheck.mjs` works to, and the build is byte-deterministic, so a stale
   dist is a stale dist rather than a flaky test. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const here = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILT = join(here, 'index.html');

/* One boot, shared by every case below: it takes about a second, and nothing here mutates the
   document in a way the next case would notice. */
let booted = null;
async function boot() {
  if (booted) return booted;
  a.ok(existsSync(BUILT), 'index.html is missing — run node build.mjs');

  const errors = [];
  const vc = new VirtualConsole();
  /* jsdomError is how an uncaught exception inside the page surfaces here. Without this the
     page can throw during load and jsdom will hand back a document as though nothing happened
     — which is exactly the failure this file exists to catch. */
  vc.on('jsdomError', e => errors.push(String((e && e.message) || e)));

  const dom = new JSDOM(readFileSync(BUILT, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,           // gives requestAnimationFrame, which the canvas uses
    url: 'http://localhost/',
    virtualConsole: vc
  });
  /* the app installs the UI, loads or seeds a project and paints, across a few microtasks and
     a frame; this is long enough for all of it and short enough not to slow the suite */
  await new Promise(r => setTimeout(r, 800));
  const bootUntil = Date.now() + 2000;
  while (dom.window.document.querySelector('#savedTag')?.textContent === '—' && Date.now() < bootUntil) {
    await new Promise(r => setTimeout(r, 25));
  }
  booted = { dom, window: dom.window, doc: dom.window.document, errors };
  return booted;
}

test('the built file loads without throwing', async () => {
  const { errors } = await boot();
  a.deepEqual(errors, [], 'the page threw while loading');
});

test('the core is installed and a project exists', async () => {
  const { window: w } = await boot();
  const C = w.__CORE;
  a.equal(typeof C, 'object', 'the core did not reach the page');
  a.ok(C.state.pages.length > 0, 'no pages — the app started but never seeded or loaded one');
  a.ok(C.state.pages[0].tree.length > 0, 'the first page is empty');
  a.equal(typeof C.buildPage, 'function');
});

test('the chrome drew', async () => {
  /* the UI bundle is sealed and installed separately from the core, so it can fail on its own
     while the core looks fine — which is what happened. These are the parts a person would
     notice missing before anything else. */
  const { doc } = await boot();
  a.ok(doc.querySelectorAll('.rail button, .rail [data-p]').length >= 4, 'the tool rail is empty');
  a.ok(doc.querySelectorAll('.topbar button, #top button').length >= 5, 'the top bar is empty');
  a.ok(doc.querySelector('iframe'), 'the canvas frame is missing');
});

test('the standalone build makes Export its primary action', async () => {
  const { window: w, doc } = await boot();
  /* jsdom does not always dispatch the iframe load that the real canvas awaits, so finish
     top-bar binding directly when boot is paused at that browser boundary. */
  if (doc.querySelector('#savedTag').textContent === '—') w.bindTop();
  const primary = doc.querySelector('#exportBtn');
  a.equal(doc.querySelector('#publishLabel').textContent.trim(), 'Export');
  a.match(primary.title, /Export HTML/);
  primary.click();
  a.equal(doc.querySelector('#mTitle').textContent.trim(), 'Export static HTML');
  doc.querySelector('#mClose').click();
});

test('server mode separates draft saving from explicit release publication', async () => {
  const base = await boot();
  const server = {
    siteId: 'site-release', version: 7, publishedVersion: 5, role: 'owner',
    user: { id: 'user-1', name: 'Braudy Pedrosa', email: 'braudy@example.test' },
    editorSessionToken: 'scoped-editor-session',
    doc: base.window.__CORE.clone(base.window.__CORE.doc())
  };
  const marker = '<script>\n/* =====================================================================';
  const injected = `<script>window.PC_SERVER=${JSON.stringify(server).replace(/</g, '\\u003c')}</script>\n${marker}`;
  const html = readFileSync(BUILT, 'utf8').replace(marker, injected);
  const calls = [];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e?.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = async (url, opts = {}) => {
        calls.push([String(url), opts.method || 'GET', opts.body, opts.headers]);
        if (String(url) === '/api/sites/site-release/assets' && !opts.method) {
          return { ok: true, status: 200, json: async () => [] };
        }
        if (String(url) === '/api/sites/site-release/publish' && opts.method === 'POST') {
          const body = JSON.parse(opts.body);
          return { ok: true, status: 200, json: async () => ({
            status: 'published', publicationId: 'publication-8', sourceVersion: body.sourceVersion,
            publishedAt: '2026-08-26T00:00:00.000Z', publicUrl: 'https://build.itspagecraft.com/site-release/'
          }) };
        }
        if (String(url) === '/api/sites/site-release/publication') {
          return { ok: true, status: 200, json: async () => ({
            publishedVersion: 5,
            publicationId: 'publication-5', status: 'draft_changes',
            publishedAt: '2026-08-25T00:00:00.000Z'
          }) };
        }
        return { ok: true, status: 200, json: async () => ({ version: 8 }) };
      };
    }
  });
  await new Promise(r => setTimeout(r, 800));
  const doc = dom.window.document;
  const bootUntil = Date.now() + 2000;
  while (doc.querySelector('#savedTag').textContent === '—' && Date.now() < bootUntil) {
    await new Promise(r => setTimeout(r, 25));
  }
  if (doc.querySelector('#savedTag').textContent === '—') dom.window.bindTop();
  a.equal(doc.querySelector('#publishLabel').textContent.trim(), 'Publish');
  a.equal(doc.querySelector('[data-act="project"] span').textContent.trim(), 'Settings');
  a.equal(doc.querySelector('#accountBtn').hidden, false);
  a.equal(doc.querySelector('#accountInitials').textContent.trim(), 'BP');
  doc.querySelector('#accountBtn').click();
  a.equal(doc.querySelector('#accountPop').hidden, false);
  a.equal(doc.querySelector('#accountEmail').textContent.trim(), 'braudy@example.test');
  a.match(doc.querySelector('#accountPop').textContent, /Sign out/);
  doc.querySelector('#exportBtn').click();
  await new Promise(r => setTimeout(r, 0));
  a.equal(doc.querySelector('#mTitle').textContent.trim(), 'Publish');
  a.ok(calls.some(([url, method]) => url === '/api/sites/site-release/publication' && method === 'GET'));
  const targetUntil = Date.now() + 1000;
  while (!doc.querySelector('.releaseLead') && Date.now() < targetUntil) {
    await new Promise(r => setTimeout(r, 20));
  }
  a.match(doc.querySelector('.releaseLead')?.textContent || '', /Published on Pagecraft/);
  a.equal(doc.querySelector('#releaseWordPress')?.textContent.trim(), 'Publish on WordPress');
  a.equal(doc.querySelector('#releasePanel')?.getAttribute('role'), 'status');
  a.equal(doc.querySelector('#releasePanel')?.getAttribute('aria-live'), 'polite');
  a.equal(doc.querySelector('#releasePanel')?.getAttribute('aria-busy'), 'false');
  a.equal(calls.some(([, method]) => method === 'POST'), false,
    'opening Publish must not create a publication');
  dom.window.askConfirm = async () => true;
  const publish = doc.querySelector('#releasePublish');
  a.ok(publish && !publish.disabled, 'an owner with no blocking findings can publish');
  publish.click();
  const publishUntil = Date.now() + 2500;
  while (!calls.some(([, method]) => method === 'POST') && Date.now() < publishUntil) {
    await new Promise(r => setTimeout(r, 25));
  }
  const post = calls.find(([url, method]) => url === '/api/sites/site-release/publish' && method === 'POST');
  a.ok(post, 'Publish promotes the saved draft through the hosted publication API');
  const body = JSON.parse(post[2]);
  a.equal(body.sourceVersion, 8, 'the publication freezes the version returned by the draft save');
  a.equal(typeof body.acknowledgeWarnings, 'boolean');
  a.equal(post[3]['X-Pagecraft-Editor-Session'], 'scoped-editor-session');
  const save = calls.find(([url, method]) => url === '/api/sites/site-release' && method === 'PUT');
  a.equal(save?.[3]['X-Pagecraft-Editor-Session'], 'scoped-editor-session');
  a.deepEqual(errors, []);
  dom.window.close();
});

test('WordPress mode boots the shared editor and saves a native fallback through the nonce adapter', async () => {
  const config = {
    restUrl: 'http://localhost/wp-json/pagecraft/v1', nonce: 'wp-rest-nonce', doc: null, version: 0,
    role: 'owner', siteName: 'Fixture WordPress',
    page: { id: 42, title: 'Native landing page', slug: 'native-landing-page' },
    user: { id: '7', name: 'Admin' },
    capabilities: ['edit_document', 'edit_structure', 'manage_pages', 'manage_settings', 'restore_revisions'],
    designSettings: { maxWidth: '1180px', size: '17px' },
    previewUrl: 'http://localhost/native-landing-page/', pagesUrl: 'http://localhost/wp-admin/edit.php?post_type=page'
  };
  const marker = '<script>\n/* =====================================================================';
  const html = readFileSync(BUILT, 'utf8').replace(marker,
    `<script>window.PC_WORDPRESS=${JSON.stringify(config).replace(/</g, '\\u003c')}</script>\n${marker}`);
  const calls = [];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e?.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/wp-admin/admin-ajax.php',
    virtualConsole: vc,
    beforeParse(win) {
      win.fetch = async (url, opts = {}) => {
        calls.push([String(url), opts.method || 'GET', opts.body, opts.headers]);
        if (String(url).endsWith('/media')) {
          return { ok: true, status: 200, json: async () => [] };
        }
        if (String(url).endsWith('/pages/42/revisions') && (opts.method || 'GET') === 'GET') {
          return { ok: true, status: 200, json: async () => [{
            id: 'revision-1', version: 1, createdAt: '2026-08-29T00:00:00Z', current: true
          }] };
        }
        if (String(url).endsWith('/pages/42/document') && opts.method === 'PUT') {
          return { ok: true, status: 200, json: async () => ({ version: 1 }) };
        }
        throw new Error(`Unexpected WordPress request: ${opts.method || 'GET'} ${url}`);
      };
    }
  });
  await new Promise(r => setTimeout(r, 800));
  const doc = dom.window.document;
  const bootUntil = Date.now() + 2000;
  while (doc.querySelector('#savedTag')?.textContent === '—' && Date.now() < bootUntil) {
    await new Promise(r => setTimeout(r, 25));
  }
  if (doc.querySelector('#savedTag')?.textContent === '—') dom.window.bindTop();
  a.equal(doc.documentElement.dataset.pagecraftHost, 'wordpress');
  for (const selector of ['#sitesBtn', '#shareBtn', '#accountBtn', '#leftRail', '#panePages', '#paneCms', '[data-act="project"]']) {
    a.equal(doc.querySelector(selector), null, `${selector} must not enter the WordPress render tree`);
  }
  a.equal(doc.querySelector('#publishLabel')?.textContent.trim(), 'Done');
  a.equal([...doc.querySelectorAll('#paneAdd .pitem')].some(item => item.textContent.trim() === 'Collection'), false,
    'the Cloud Collection widget must not enter the WordPress element library');
  a.doesNotMatch(doc.querySelector('#modebar')?.textContent || '', /Native landing page|\/native-landing-page/,
    'WordPress already owns the page title and permalink outside the canvas toolbar');
  a.equal(dom.window.__CORE.state.pages.length, 1, 'new WordPress page did not start as one local page');
  a.equal(dom.window.__CORE.state.pages[0].name, 'Native landing page');
  a.equal(dom.window.__CORE.state.pages[0].slug, 'native-landing-page');
  a.equal(dom.window.__CORE.state.pages[0].tree.length, 0, 'new WordPress page started with demo content');
  a.equal(dom.window.__CORE.state.meta.maxWidth, '1180px', 'WordPress design settings did not override page-local defaults');
  dom.window.projectModal();
  a.equal(doc.querySelector('#mTitle').textContent.trim(), 'Pagecraft design settings');
  a.ok(doc.querySelector('#mMax'), 'WordPress design settings must include layout defaults');
  a.ok(doc.querySelector('#mColors'), 'WordPress design settings must include shared colours');
  a.equal(doc.querySelector('#mBase'), null, 'WordPress owns the site URL outside Pagecraft settings');
  a.equal(doc.querySelector('#mLang'), null, 'WordPress owns the site language outside Pagecraft settings');
  a.equal(doc.querySelector('#mHeadHtml'), null, 'WordPress settings must not expose Cloud head injection');
  doc.querySelector('#mClose').click();

  await dom.window.writeNow();
  const saveUntil = Date.now() + 1500;
  while (!calls.some(([, method]) => method === 'PUT') && Date.now() < saveUntil) {
    await new Promise(r => setTimeout(r, 20));
  }
  const save = calls.find(([url, method]) => url.endsWith('/pages/42/document') && method === 'PUT');
  a.ok(save, 'WordPress draft did not save through the shared host adapter');
  const payload = JSON.parse(save[2]);
  a.equal(payload.version, 0);
  a.match(payload.compiled.html, /<main\b/);
  a.equal(typeof payload.compiled.globalCss, 'string');
  a.equal(typeof payload.compiled.pageCss, 'string');
  a.equal(new Headers(save[3]).get('X-WP-Nonce'), 'wp-rest-nonce');
  a.ok(calls.every(([url]) => String(url).startsWith('http://localhost/wp-json/pagecraft/v1/')),
    'WordPress editing must stay on its same-origin REST adapter when Cloud is unavailable');
  doc.querySelector('#reviewBtn').click();
  a.equal(doc.querySelector('#rightAux').hidden, false, 'WordPress Review opens in the inspector column');
  a.ok(doc.querySelector('#rightReview'), 'the Review component is mounted in the side panel');
  a.equal(doc.querySelector('#modal').hidden, true, 'WordPress Review must not interrupt with a modal');
  a.equal(doc.querySelector('#exZip'), null, 'WordPress Review must not mount static export controls');
  doc.querySelector('#rightSurfaceClose').click();
  a.equal(doc.querySelector('#rightAux').hidden, true, 'closing Review returns to the inspector');
  doc.querySelector('#historyBtn').click();
  await new Promise(r => setTimeout(r, 0));
  a.equal(doc.querySelector('#rightAux').hidden, false, 'WordPress History opens in the inspector column');
  a.match(doc.querySelector('#rightAux').textContent, /Version history/);
  a.equal(doc.querySelector('#modal').hidden, true, 'WordPress History must not interrupt with a modal');
  a.deepEqual(errors, []);
  dom.window.close();
});

test('a content collaborator is not offered the owner-only Publish action', async () => {
  const base = await boot();
  const server = {
    siteId: 'site-content', version: 3, publishedVersion: 2, role: 'content',
    doc: base.window.__CORE.clone(base.window.__CORE.doc())
  };
  const marker = '<script>\n/* =====================================================================';
  const html = readFileSync(BUILT, 'utf8').replace(marker,
    `<script>window.PC_SERVER=${JSON.stringify(server).replace(/</g, '\\u003c')}</script>\n${marker}`);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(win) {
      win.fetch = async url => ({
        ok: true, status: 200,
        json: async () => String(url).endsWith('/assets') ? [] : ({ publishedVersion: 2, releases: [] })
      });
    }
  });
  await new Promise(r => setTimeout(r, 500));
  if (dom.window.document.querySelector('#savedTag').textContent === '—') dom.window.bindTop();
  a.equal(dom.window.document.querySelector('#exportBtn').hidden, true);
  a.equal(dom.window.document.querySelector('#reviewBtn').hidden, false);
  dom.window.close();
});

test('the editor chrome keeps navigation compact and the whole Add library reachable', async () => {
  const { window: w, doc } = await boot();
  const C = w.__CORE;
  w.renderPalette();
  const categories = [...doc.querySelectorAll('#paneAdd .addSwitcher button')];
  a.deepEqual(categories.map(x => x.textContent.trim()),
    ['Elements', 'Templates', 'Components', 'Blocks']);
  a.deepEqual(categories.map(x => x.querySelector('svg')?.getAttribute('width')),
    ['14', '14', '14', '14']);
  a.equal(categories[0].getAttribute('aria-selected'), 'true');
  categories[1].click();
  await new Promise(r => setTimeout(r, 0));
  a.equal(C.state.ui.atab, 'templates');
  a.equal(doc.querySelector('#paneAdd .addSwitcher button[aria-selected="true"]').textContent.trim(), 'Templates');
  a.match(doc.querySelector('#paneAdd .addContext').textContent, /Ready-made sections/);
  C.state.ui.atab = 'widgets';
  w.renderPalette();
  a.equal(doc.querySelector('#projBtn'), null, 'Project is duplicated in the top bar');

  const pg = C.page();
  const slug = pg.slug;
  pg.slug = 'index';
  w.renderModebar();
  a.equal(doc.querySelector('#modebar').textContent.includes('/index'), false,
    'the front page should not show its implementation path');
  pg.slug = 'about';
  w.renderModebar();
  a.match(doc.querySelector('#modebar').textContent, /\/about/);
  a.equal(doc.querySelector('#modebar').textContent.includes('.html'), false,
    'ordinary pages should use their clean route');
  pg.slug = slug;
  w.renderModebar();
});

test('selecting an element draws an inspector', async () => {
  /* the deepest thing worth asserting here: it needs the core, the seam, and the Preact panels
     all working together, which is the combination no other suite covers */
  const { window: w, doc } = await boot();
  const C = w.__CORE;
  let id = null;
  C.eachNode(C.state.pages[0].tree, n => { if (!id && n.type === 'heading') id = n.id; });
  a.ok(id, 'the demo has no heading to select');

  C.selSet([id]);
  w.renderRight();
  a.ok(doc.querySelectorAll('#right .tabs button').length >= 3, 'no Content / Style / Advanced');
  a.ok(doc.querySelectorAll('#right .group').length >= 1, 'the inspector drew no controls');

  /* and the Style tab specifically, since that is where the crash was */
  C.state.ui.stab = 'style';
  w.renderRight();
  a.ok(doc.querySelectorAll('#right .group').length >= 2, 'the Style tab drew no groups');
  a.ok(doc.querySelector('#right .statepick'), 'the state picker is missing');
});

/* Every custom property the built page reads is one the built page defines.

   The inline text toolbar painted itself with `--panel-3` and `--border-2`, which exist
   nowhere in the repo. CSS does not complain: an undefined colour makes the whole `border`
   shorthand invalid, so the toolbar had no border, no background and no separator — it
   floated over the canvas on a shadow alone, and had done for as long as it existed.

   Nothing could have caught that. A stylesheet has no compiler, and the test suite reads
   the core, not the chrome. So this reads every `var(--x)` in the built file and asks
   whether x is declared anywhere in it. */
test('no stylesheet reads a custom property that was never declared', () => {
  const html = readFileSync(BUILT, 'utf8');
  const declared = new Set([...html.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  const read = new Map();
  for (const m of html.matchAll(/var\(\s*(--[\w-]+)\s*([,)])/g)) {
    /* `var(--x, fallback)` is a deliberate default and stands on its own */
    if (m[2] === ',') continue;
    read.set(m[1], (read.get(m[1]) || 0) + 1);
  }
  /* `--c-*` is the exported page's own design tokens. The core writes `var(--c-ink)`
     into a widget's CSS and `tokenCss()` declares it from the project at render time,
     so the pair is completed in the page, not in this file. */
  const missing = [...read].filter(([k]) => !declared.has(k) && !k.startsWith('--c-'));
  a.deepEqual(missing, [], 'these are read but never declared: ' + JSON.stringify(missing));
  a.ok(read.size > 40, `only ${read.size} tokens read — the scan is not seeing the stylesheet`);
});

/* The inlined bundle may not contain `<!--` or `</script`.

   Both end the script element early, and the second one obviously. The first is the
   subtle one: a literal `<!--` anywhere inside a <script> puts the HTML tokenizer into
   its escaped state, and a later `<script` — this app ships several, in the scripts it
   emits into exported pages — puts it into the double-escaped state, where `</script>`
   no longer closes the element. Everything after it parses as script text, and the app
   is a syntax error with no line number.

   The highlighter's HTML lexer wanted `<!--` in a regex and cost an afternoon. The test
   above catches this as "the page threw"; this one says what to look for. */
test('the inlined bundle contains nothing that ends its own script element', () => {
  const html = readFileSync(BUILT, 'utf8');
  const open = html.indexOf('<script>');
  const close = html.lastIndexOf('</script>');
  a.ok(open > 0 && close > open, 'no inline script found — this test is looking at the wrong thing');
  const body = html.slice(open + 8, close);
  a.equal(body.includes('</script'), false, 'a literal </script closes the element early');
  a.equal(body.includes('<!' + '--'), false,
    'a literal <!-- puts the tokenizer in escaped state and </script> stops closing');
});

test('generic dialogs isolate shortcuts, trap focus, restore focus, and pickers return their value on Enter', async () => {
  const { window: w, doc } = await boot();
  const C = w.__CORE;
  let id = null;
  C.eachNode(C.page().tree, n => { if (!id && n.type === 'heading') id = n.id; });
  C.selSet([id]);

  const launch = doc.createElement('button');
  launch.textContent = 'Launch'; doc.body.appendChild(launch); launch.focus();
  w.openModal('Test dialog', '<button id="dialogAction">Action</button>', '<button id="dialogLast">Last</button>');
  const modal = doc.querySelector('#modalBox');
  a.equal(modal.getAttribute('role'), 'dialog');
  a.equal(modal.getAttribute('aria-modal'), 'true');
  a.equal(doc.querySelector('#app').hasAttribute('inert'), true,
    'the editor behind an open dialog is inert');

  const before = JSON.stringify(C.page().tree);
  doc.querySelector('#dialogAction').dispatchEvent(new w.KeyboardEvent('keydown', {
    key: 'Delete', bubbles: true, cancelable: true
  }));
  a.equal(JSON.stringify(C.page().tree), before, 'Delete inside a dialog never reaches the canvas');

  doc.querySelector('#mClose').focus();
  doc.querySelector('#mClose').dispatchEvent(new w.KeyboardEvent('keydown', {
    key: 'Tab', shiftKey: true, bubbles: true, cancelable: true
  }));
  a.equal(doc.activeElement?.id, 'dialogLast', 'Shift+Tab wraps to the final control');

  const action = doc.querySelector('#dialogAction'); action.focus();
  const picked = w.askPick('Choose one', [['alpha', 'Alpha'], ['beta', 'Beta']]);
  const first = doc.querySelector('#askBody [data-p]');
  a.equal(doc.querySelector('#modal').hasAttribute('inert'), true,
    'the underlying dialog is inert while a nested confirmation is open');
  a.equal(doc.querySelector('#modal').getAttribute('aria-hidden'), 'true');
  a.equal(doc.activeElement, first, 'the first choice receives focus');
  first.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  a.equal(await picked, 'alpha', 'Enter resolves the picker value, not a hidden Yes button');
  a.equal(doc.activeElement, action, 'closing the nested picker returns focus to its launcher');
  a.equal(doc.querySelector('#modal').hasAttribute('inert'), false);
  a.equal(doc.querySelector('#modal').hasAttribute('aria-hidden'), false);

  modal.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  a.equal(doc.querySelector('#modal').hidden, true);
  a.equal(C.state.ui.sel, id, 'the same Escape does not walk the canvas selection');
  a.equal(doc.activeElement, launch, 'focus returns to the control that opened the dialog');
  a.equal(doc.querySelector('#app').hasAttribute('inert'), false);
  launch.remove();
});

test('status messages and narrow-workspace controls expose accessible hooks', async () => {
  const { doc } = await boot();
  const toast = doc.querySelector('#toast');
  a.equal(toast.getAttribute('role'), 'status');
  a.equal(toast.getAttribute('aria-live'), 'polite');
  a.equal(toast.getAttribute('aria-atomic'), 'true');
  a.ok(doc.querySelector('#right .panelClose'), 'the narrow inspector has a dismiss control');

  const html = readFileSync(BUILT, 'utf8');
  a.match(html, /\.unit>\.pc-custom-select-trigger\{[\s\S]*?width:72px;flex:0 0 72px;min-width:72px/,
    'enhanced unit selects must preserve room for their numeric value');
  a.match(html, /@media\(max-width:900px\)[\s\S]*?body:not\(\.library-focus\) \.left\{display:none\}/);
  a.match(html, /@media\(max-width:600px\)[\s\S]*?\.left,\.right\{[\s\S]*?position:absolute/);
});

test('project and CMS text fields close their undo transactions on blur', async () => {
  const { window: w, doc } = await boot();
  const C = w.__CORE;
  const typeAndBlur = (el, value) => {
    el.value = value;
    el.dispatchEvent(new w.Event('input', { bubbles: true }));
    el.dispatchEvent(new w.FocusEvent('blur', { bubbles: true }));
  };

  w.projectModal();
  const projectName = doc.querySelector('#mName');
  const projectHistory = C.hist.u.length;
  typeAndBlur(projectName, 'Release candidate one');
  typeAndBlur(projectName, 'Release candidate two');
  a.equal(C.hist.u.length, projectHistory + 2,
    'each separate Project edit opens one undo step after the prior blur closes it');
  doc.querySelector('#mClose').click();

  const col = C.collectionAdd('Undo fields');
  w.cmsModal(col.id);
  doc.querySelector('#cmsTabs [data-c="fields"]').click();
  const fieldName = doc.querySelector('#mBody [data-fname]');
  const cmsHistory = C.hist.u.length;
  typeAndBlur(fieldName, 'Primary title');
  typeAndBlur(fieldName, 'Display title');
  a.equal(C.hist.u.length, cmsHistory + 2,
    'each separate CMS field-name edit opens one undo step after the prior blur closes it');
  doc.querySelector('#mClose').click();
});

test('each collection preview bar is unique and its own controls update that collection', async () => {
  const { window: w, doc } = await boot();
  const C = w.__CORE;
  const one = C.collectionAdd('Articles');
  const two = C.collectionAdd('News');
  C.itemAdd(one.id); C.itemAdd(one.id);
  C.itemAdd(two.id); C.itemAdd(two.id);
  const aList = C.N('list'); aList.src = one.id;
  const bList = C.N('list'); bList.src = two.id;
  C.page().tree = [aList, bList];
  C.state.ui.item = {};
  w.renderModebar();
  const bars = [...doc.querySelectorAll('#modebar .itemBar')];
  a.equal(bars.length, 2);
  a.equal(doc.querySelectorAll('#itemBar').length, 0, 'no duplicate id is emitted');
  bars[1].querySelector('button[title="Next item"]').click();
  a.equal(C.state.ui.item[two.id], 1);
  a.equal(C.state.ui.item[one.id] || 0, 0, 'the other collection is untouched');
});

test('Preview runs the same Tabs, Gallery, Code, Slider, Video, navigation and animation payloads as export', async () => {
  const { window: w, doc } = await boot();
  const C = w.__CORE;
  const frame = doc.querySelector('#canvas');
  /* jsdom does not navigate iframe.srcdoc on its own. Populate the same document and fire
     the load callback the browser fires, so this test exercises the real bind/paint path. */
  const initial = frame.srcdoc;
  frame.contentDocument.open();
  frame.contentDocument.write(initial);
  frame.contentDocument.close();
  frame.dispatchEvent(new w.Event('load'));
  await new Promise(r => setTimeout(r, 20));
  const cw = frame.contentWindow;

  const copied = [];
  Object.defineProperty(cw.navigator, 'clipboard', {
    configurable: true, value: { writeText: async value => { copied.push(value); } }
  });
  cw.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  cw.HTMLElement.prototype.scrollBy = function(opts) { this.__lastScroll = opts; };
  Object.defineProperty(cw.HTMLElement.prototype, 'clientWidth', {
    configurable: true, get() { return this.hasAttribute?.('data-slides') ? 100 : 0; }
  });
  Object.defineProperty(cw.HTMLElement.prototype, 'scrollWidth', {
    configurable: true, get() { return this.hasAttribute?.('data-slides') ? 300 : 0; }
  });
  if (cw.HTMLDialogElement) {
    cw.HTMLDialogElement.prototype.showModal = function() { this.open = true; };
    cw.HTMLDialogElement.prototype.close = function() { this.open = false; };
  }
  cw.IntersectionObserver = class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{ target: el, isIntersecting: true, intersectionRatio: 1 }], this); }
    unobserve() {}
    disconnect() {}
  };

  const tabs = C.N('tabs');
  const gallery = C.N('gallery');
  gallery.props.items = [
    { src: 'https://example.test/one.jpg', alt: 'One', caption: 'First' },
    { src: 'https://example.test/two.jpg', alt: 'Two', caption: 'Second' }
  ];
  const code = C.N('code');
  code.props.body = 'const preview = true;';
  const slider = C.N('slider');
  slider.children = [C.N('box'), C.N('box')];
  const video = C.N('video');
  const animated = C.N('heading');
  animated.anim = { name: 'fade-in' };
  const external = C.N('button');
  external.props.link = 'https://example.test/outside';
  C.state.header = []; C.state.footer = [];
  C.page().tree = [C.N('section', {}, {}, [C.N('row', {}, {}, [
    C.N('column', {}, {}, [tabs, gallery, code, slider, video, animated, external])
  ])])];

  if (!doc.body.classList.contains('preview')) w.togglePreview();
  const cd = frame.contentDocument;
  const tabset = cd.querySelector('[data-tabs]');
  a.ok(tabset.hasAttribute('data-tabs-ready'));
  const tabButtons = tabset.querySelectorAll('[role="tab"]');
  tabButtons[1].click();
  a.equal(tabButtons[1].getAttribute('aria-selected'), 'true');

  const copy = cd.querySelector('[data-copy]');
  a.equal(copy.hidden, false, 'the exported copy script reveals the control');
  copy.click(); await Promise.resolve();
  a.deepEqual(copied, ['const preview = true;']);

  const next = cd.querySelector('[data-slide-n]');
  a.equal(next.hidden, false, 'the exported slider script reveals its arrows');
  next.click();
  a.ok(cd.querySelector('[data-slides]').__lastScroll.left > 0);

  cd.querySelector('.pagecraft-video-play').click();
  a.ok(cd.querySelector('[data-facade] iframe'), 'the facade swaps to the real player');

  const lightboxLink = cd.querySelector('.pagecraft-gallery-frame[href]');
  lightboxLink.dispatchEvent(new cw.MouseEvent('click', { bubbles: true, cancelable: true }));
  const dialog = cd.querySelector('.pagecraft-lightbox');
  a.ok(dialog && dialog.open, 'the exported Gallery lightbox opens inside Preview');
  a.match(dialog.querySelector('img').src, /one\.jpg$/);

  a.ok(cd.querySelector('.bp-animate').classList.contains('bp-is-animating'),
    'the exported scroll-animation runtime is active');
  const before = cw.location.href;
  const out = cd.querySelector('.pagecraft-button[href^="https://example.test"]');
  const click = new cw.MouseEvent('click', { bubbles: true, cancelable: true });
  out.dispatchEvent(click);
  a.equal(click.defaultPrevented, true);
  a.equal(cw.location.href, before, 'Preview never follows an external navigation');

  w.togglePreview();
});

test('the server media picker wires trash to durable DELETE before removing the card', async () => {
  const base = await boot();
  const server = {
    siteId: 'site-1', version: 1, role: 'owner', doc: base.window.__CORE.clone(base.window.__CORE.doc())
  };
  const marker = '<script>\n/* =====================================================================';
  const injected = `<script>window.PC_SERVER=${JSON.stringify(server).replace(/</g, '\\u003c')}</script>\n${marker}`;
  const html = readFileSync(BUILT, 'utf8').replace(marker, injected);
  const calls = [];
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String(e?.message || e)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', virtualConsole: vc,
    beforeParse(win) {
      win.fetch = async (url, opts = {}) => {
        calls.push([String(url), opts.method || 'GET']);
        if (String(url) === '/api/sites/site-1/assets' && !opts.method) {
          return { ok: true, status: 200, json: async () => [
            { id: 'asset1', name: 'cover.png', type: 'image/png', w: 1200, h: 800 }
          ] };
        }
        if (String(url) === '/api/sites/site-1/assets/asset1' && opts.method === 'DELETE') {
          return { ok: true, status: 204, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({ version: 2 }) };
      };
    }
  });
  await new Promise(r => setTimeout(r, 800));
  const picker = dom.window.mediaPicker();
  const trash = dom.window.document.querySelector('#askBody [data-del="asset1"]');
  a.ok(trash, 'the picker renders its delete action');
  trash.click();
  a.equal(await picker, null, 'deleting the final card closes the empty picker');
  await new Promise(r => setTimeout(r, 0));
  a.ok(calls.some(([url, method]) => url === '/api/sites/site-1/assets/asset1' && method === 'DELETE'));
  a.equal(dom.window.document.querySelector('#askBody [data-pick="asset1"]'), null,
    'the card leaves only after the durable request succeeds');
  a.deepEqual(errors, []);
  dom.window.close();
});
