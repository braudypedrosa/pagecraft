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
