/* Build step for the Slate page builder.
   The legacy editor source is builder.html. This produces:
     index.html     standalone page with a doctype
     dist/core.cjs  the DOM-free regions of the script, for `node --test`
   Core regions are marked in builder.html with the comment pair
   /*<core>* / … /*< /core>* / and are extracted verbatim, so the tests run
   against exactly the code that ships. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync, transformSync } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const frag = readFileSync(join(here, 'builder.html'), 'utf8');

/* ---- 0. brand fonts, embedded so the standalone editor works offline.
   Manrope carries the product UI,
   DM Sans the labels and metadata, per branding/fonts/USAGE.md. */
const face = (family, file, weight, style = 'normal') => {
  const b64 = readFileSync(join(here, 'brand', 'fonts', file)).toString('base64');
  return `@font-face{font-family:"${family}";font-style:${style};font-weight:${weight};`
    + `font-display:swap;src:url(data:font/ttf;base64,${b64}) format("truetype")}`;
};
const FONT_CSS = [
  face('Manrope', 'Manrope-VariableFont_wght.ttf', '400 700'),
  face('DM Sans', 'DMSans-Regular.ttf', '400'),
  face('DM Sans', 'DMSans-Medium.ttf', '500'),
  face('DM Sans', 'DMSans-SemiBold.ttf', '600')
].join('\n');
const withFonts = html => {
  if (!html.includes(FONT_SLOT)) throw new Error('font slot ' + FONT_SLOT + ' missing from builder.html');
  return html.replace(FONT_SLOT, `<style id="pc-fonts">\n${FONT_CSS}\n</style>`);
};
/* esbuild preserves indentation inside block comments, including indentation-only blank
   lines. Strip that generated whitespace so rebuilding does not make `git diff --check`
   report source comments as new trailing-space defects. */
const cleanGenerated = text => text.replace(/[\t ]+$/gm, '');
const FONT_SLOT = '<!--PAGECRAFT-FONTS-->';

const rawScript = frag.slice(frag.indexOf('<script>') + 8, frag.lastIndexOf('</script>'));

/* ---- 0b. the core comes from TypeScript now -----------------------------
   app/src/core/ is the source of truth. The legacy single-file build compiles it
   back in, so the port never leaves two copies of four thousand lines drifting
   apart — which is the failure mode a strangler migration is most prone to.

   The nine `/*<core>*\/` regions are replaced by one bundle hoisted to where the
   first of them was. That is sound because the core is self-contained: it calls
   nothing the UI defines, so nothing it needs can come later. The `var` bindings
   below let the remaining UI code keep referring to core symbols by bare name,
   which is what makes this a move rather than a rewrite. */
const CORE_TS = join(here, 'app', 'src', 'core', 'index.ts');
const UI_TS = join(here, 'app', 'src', 'ui', 'index.tsx');

/* Bundled as ESM, then the trailing export is cut.

   Three approaches, and the reasons the first two lost:
     - an IIFE with `var x = __PC.x` bindings died on `svg is not defined`, because
       the binding list was hand-written and covered the *test* surface rather than
       everything the UI touches.
     - a plain type-strip worked while the core was one file, but cannot follow an
       `import` — and the whole point now is to split it into modules.
   An ESM bundle concatenates every module into one scope with its declarations still
   at top level, which is exactly the shape a classic script needs. Cut the one
   trailing `export { … }` and the remaining UI code keeps referring to core symbols
   by bare name, whatever the file layout underneath. */
const { coreBundle, coreObject } = (() => {
  const out = buildSync({
    entryPoints: [CORE_TS],
    bundle: true, write: false, format: 'esm',
    target: 'es2022', platform: 'browser', legalComments: 'none'
  }).outputFiles[0].text;
  const cut = out.lastIndexOf('\nexport {');
  if (cut < 0) throw new Error('bundled core has no trailing export block to cut');

  /* The cut export block, turned into an object rather than thrown away.
     The sealed UI bundle cannot see the core by bare name — that is the whole point of
     sealing it — so it has to be handed one object. Hand-listing 265 names was the
     first idea, and a hand-written list is exactly what went stale before: a second
     copy to drift from the first. This is the first list, reshaped. `export { a, b };` becomes
     `var __CORE = { a, b };` and nothing can fall out of step.

     A rename would break the shorthand, so it fails loudly instead of silently
     emitting `{ x as y }`. esbuild only renames on a collision, which would itself be
     worth knowing about. */
  const block = out.slice(cut);
  if (/\bas\b/.test(block)) {
    throw new Error('the core export block contains a rename; __CORE cannot use shorthand');
  }
  const names = block.match(/^\s{2}([A-Za-z_$][\w$]*),?$/gm) || [];
  if (names.length < 200) throw new Error(`only parsed ${names.length} core exports — expected the whole surface`);

  return {
    coreBundle: out.slice(0, cut),
    coreObject: '\n/* The core as one object, derived from its own export list above. */\n'
      + 'var __CORE = ' + block.replace(/^\s*export\s*/, '').trim() + '\n'
  };
})();

/* The ported panels, as an IIFE.

   Not spliced into the shared scope like the core is, and the reason is concrete
   rather than stylistic: Preact's bundle declares `$` at top level, and builder.html
   has declared `$` as its DOM query helper since the first commit. One scope for both
   is `Identifier '$' has already been declared` — a SyntaxError that takes the whole
   app with it. So this stays sealed, exports one `mount`, and receives everything it
   needs as arguments.

   The guard below is the same idea as the control-parity check: assert the property
   the design depends on rather than trusting it to stay true. If a future esbuild
   emits anything at top level besides `var PC_UI`, the build says so here instead of
   the app dying at boot with a name clash. */
const uiBundle = (() => {
  const out = buildSync({
    entryPoints: [UI_TS],
    bundle: true, write: false, format: 'iife', globalName: 'PC_UI',
    jsx: 'automatic', jsxImportSource: 'preact',
    target: 'es2022', platform: 'browser', legalComments: 'none'
  }).outputFiles[0].text;

  const top = [...out.matchAll(/^(?:var|let|const|function|class)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  const leaked = top.filter(n => n !== 'PC_UI');
  if (leaked.length) {
    throw new Error('the UI bundle leaked ' + leaked.length + ' name(s) into the shared scope: '
      + leaked.slice(0, 8).join(', ') + ' — it must stay sealed, or it will collide with builder.html');
  }
  if (!top.includes('PC_UI')) throw new Error('the UI bundle did not declare PC_UI');
  return out;
})();

const script = (() => {
  const O = '/*<core>*/', C = '/*</core>*/';
  let at = 0, first = -1, out = '', last = 0;
  for (;;) {
    const a = rawScript.indexOf(O, at);
    if (a < 0) break;
    const b = rawScript.indexOf(C, a);
    if (b < 0) throw new Error('unclosed ' + O + ' near offset ' + a);
    if (first < 0) first = out.length + (a - last);
    out += rawScript.slice(last, a);
    at = last = b + C.length;
  }
  out += rawScript.slice(last);
  if (first < 0) throw new Error('no core regions found in builder.html');
  return out.slice(0, first)
    + `\n/* ==== core: compiled from app/src/core/index.ts — do not edit here ==== */\n`
    + coreBundle
    + coreObject
    + `\n/* ==== ported panels: compiled from app/src/ui/ — sealed, see build.mjs ==== */\n`
    + uiBundle
    + out.slice(first);
})();

/* The fragment with the assembled script swapped in. The standalone output is built
   from this rather than from `frag`, which is the bug the first version of this had:
   the TypeScript compiled fine and then never reached the generated editor, leaving
   the legacy build quietly running its own copy of the core. */
const fragOut = (() => {
  const a = frag.indexOf('<script>') + 8;
  const b = frag.lastIndexOf('</script>');
  return frag.slice(0, a) + script + frag.slice(b);
})();

/* ---- 1. standalone page ------------------------------------------------ */
const cut = fragOut.indexOf('<div id="app">');
writeFileSync(join(here, 'index.html'), cleanGenerated(withFonts(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${fragOut.slice(0, cut).trim()}
</head>
<body>
${fragOut.slice(cut).trim()}
</body>
</html>
`)));

/* ---- 1b. generated support files --------------------------------------- */
mkdirSync(join(here, 'dist'), { recursive: true });

/* ---- 1c. every control kind must have a component ----------------------
   This used to compare `ctlHtml`'s cases against `bindRight`'s, because a slice-based
   edit once deleted four wiring branches while leaving their markup in place, producing
   controls that looked fine and did nothing. That failure is no longer possible: a
   control's handlers are written beside its markup and there is nothing to keep in step.

   The check that replaces it guards what *can* still go wrong. `ControlKind` is a union
   in types.ts, and a widget definition naming a kind with no component renders a silently
   blank field — the type is satisfied either way, so only this notices. */
const declaredKinds = (() => {
  const src = readFileSync(join(here, 'app', 'src', 'core', 'types.ts'), 'utf8');
  const m = src.match(/export type ControlKind =([\s\S]*?);/);
  if (!m) throw new Error('could not find the ControlKind union in types.ts');
  return new Set([...m[1].matchAll(/'([\w-]+)'/g)].map(x => x[1]));
})();
const builtKinds = (() => {
  const src = readFileSync(join(here, 'app', 'src', 'ui', 'inspector', 'Controls.tsx'), 'utf8');
  const m = src.match(/const KINDS: Record<string, \(p: P\) => any> = \{([\s\S]*?)\};/);
  if (!m) throw new Error('could not find the KINDS map in Controls.tsx');
  return new Set([...m[1].matchAll(/(\w+):/g)].map(x => x[1]));
})();
const missing = [...declaredKinds].filter(k => !builtKinds.has(k));
const extra = [...builtKinds].filter(k => !declaredKinds.has(k));
if (missing.length) throw new Error('control kind(s) declared but with no component: ' + missing.join(', '));
if (extra.length) throw new Error('component(s) for a kind that is not in ControlKind: ' + extra.join(', '));

/* ---- 2. dist/core.cjs -------------------------------------------------
   The suite reads app/src/core/index.ts directly now, so this is no longer the
   contract it used to be — it is kept because it costs one more esbuild call and
   anything outside this repo that imported it keeps working. */
const coreCjs = buildSync({
  entryPoints: [CORE_TS],
  bundle: true, write: false, format: 'cjs',
  target: 'es2022', platform: 'node', legalComments: 'none'
}).outputFiles[0].text;
writeFileSync(join(here, 'dist', 'core.cjs'),
  '/* GENERATED by build.mjs from app/src/core/index.ts — do not edit. */\n' + coreCjs);

console.log(`index.html written (fonts ${Math.round(FONT_CSS.length / 1024)} KB) · core compiled from TypeScript (${Math.round(coreBundle.length / 1024)} KB bundled)`);
