/* Build step for the Slate page builder.
   Source of truth is builder.html — a bare document fragment that doubles as
   an Artifact source. This produces:
     index.html     standalone page with a doctype
     dist/core.cjs  the DOM-free regions of the script, for `node --test`
   Core regions are marked in builder.html with the comment pair
   /*<core>* / … /*< /core>* / and are extracted verbatim, so the tests run
   against exactly the code that ships. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSync, transformSync } from 'esbuild';
import { status, report } from './tools/pubcheck.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const frag = readFileSync(join(here, 'builder.html'), 'utf8');

/* ---- 0. brand fonts, embedded so the tool works offline and inside the
   Artifact CSP (which blocks font CDNs). Manrope carries the product UI,
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
const FONT_SLOT = '<!--PAGECRAFT-FONTS-->';

const rawScript = frag.slice(frag.indexOf('<script>') + 8, frag.lastIndexOf('</script>'));

const EXPORTS = [
  // primitives
  'esc', 'safeUrl', 'uid', 'clone', 'slugify', 'dbounce',
  // registry
  'DEF', 'IC', 'ICONS', 'ICON_PATHS', 'ICON_NAMES', 'iconSvg', 'COMMON_STYLE', 'GF', 'stackFor', 'familyOf', 'isGoogle', 'usedFamilies', 'gfontsHref', 'gfontsLink', 'fontGroups', 'FONT_BASE', 'LAYOUTS', 'COUNTS', 'DEFAULT_COLS', 'BASE', 'makeFor', 'labelOf', 'iconOf', 'rowRatios', 'matchLayout',
  // model + tree
  'N', 'cols', 'BOX', 'state', 'doc', 'page', 'tree', 'dk', 'DEV_KEY', 'DEV_LABEL',
  'DEV_W', 'canvasWidth', 'fitZoom', 'ZOOMS', 'zoomFor',
  'locate', 'locateAny', 'eachNode', 'nameOf', 'lvl', 'holds', 'wrap',
  'insert', 'moveNode', 'reid', 'pageMove', 'dupNode', 'delNode', 'applyCols', 'seed', 'blankProject',
  'MIN_COL', 'BP_CHAIN', 'rowRatiosAt', 'resizeCols', 'applyColsAt',
  // the selection set
  'selIds', 'selNodes', 'multiOn', 'selSet', 'selToggle', 'selOrder', 'selRange', 'topMost',
  'dupMany', 'delMany', 'moveMany', 'layerTarget', 'menuFor', 'ADV_SHARED', 'ctlKeys', 'fanTargets',
  // design tokens
  'RESERVED', 'TYPO_KEYS', 'TS_TYPES', 'tokenId', 'cvar', 'isRef', 'refId', 'colors', 'styles', 'classes', 'findColor', 'findStyle', 'findClass', 'nodeClasses',
  'classAdd', 'classApply', 'classRemove', 'classFrom', 'classUsage', 'classDelete', 'classMove', 'resolveColor', 'defaultTokens', 'tokenVars', 'tokenCss', 'stripTypo', 'grabTypo', 'tsApply', 'tsUnlink', 'tsUpdateFrom', 'tsCreateFrom', 'tsUsage', 'styleDelete', 'colorDelete', 'colorAdd', 'colorUsage',
  // clipboard + traversal
  'clip', 'copyNode', 'pasteNode', 'dropTree',
  'styleClip', 'copyStyles', 'pasteStyles', 'pasteStylesMany',
  'TEXT_SLOTS', 'SLOT_LABEL', 'PAGE_TEXT', 'textSlots', 'slotGet', 'slotSet', 'slotName',
  'outsideTags', 'searchText', 'slotHits', 'snippet', 'searchAll', 'searchCount', 'replaceAll',
  'blocks', 'findBlock', 'blockRootType', 'blockSave', 'blockInsert', 'blockDelete',
  // content collections
  'FIELD_TYPES', 'collections', 'findCollection', 'findField', 'findItem', 'uniqueId',
  'collectionAdd', 'collectionDelete', 'collectionRename',
  'fieldAdd', 'fieldDelete', 'fieldMove', 'titleField', 'itemTitle', 'itemSlug',
  'itemAdd', 'itemDelete', 'itemMove', 'itemSet', 'itemSetSlug',
  'listItems', 'pageHref', 'exportTargets', 'contentJson', 'sitePlan',
  'bindableKeys', 'COLL_CTL', 'bindGet', 'bindSet', 'srcSet', 'bindScope',
  'BIND_CTL', 'bindSlots', 'guessBindings', 'applyBindings',
  'previewIndex', 'previewItem', 'fieldValue', 'boundProps',
  'blockInstances', 'blockUsage', 'blockPush',
  'TEMPLATES', 'pageFromTemplate', 'PATTERNS', 'patternInsert', 'flatten', 'step', 'parentOf', 'firstChildOf', 'nudge', 'nudgeMany',
  // history
  'HOOKS', 'hist', 'edit', 'restore', 'undo', 'redo',
  // export review
  'LANGS', 'anchorsOf', 'parseLink', 'buildLink',
  'lint', 'lintCounts', 'sitemapXml', 'robotsTxt', 'contrast', 'hex2rgb', 'effective',
  // storage contract
  'SCHEMA', 'migrate',
  // rendering + export
  'PH', 'MQ', 'decl', 'selOf', 'PFX', 'widgetSlug', 'nodeClass', 'autoId', 'domIdOf', 'bucket', 'nodeCss', 'treeCss', 'baseCss', 'navCollapse',
  'vid', 'vidSrc', 'vidPoster', 'embedUrl', 'canFacade', 'SEC_TAGS', 'FACADE_JS', 'LB_JS', 'para', 'stripScripts', 'renderNode', 'renderList', 'tidy', 'NAV_JS', 'buildPage'
];

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

/* Types stripped, not bundled. An IIFE would scope the core's declarations and the
   remaining UI code refers to them by bare name — the first attempt bound each
   EXPORTS entry back to the global, and died on `svg is not defined` because EXPORTS
   is the *test* surface, not everything the UI touches. Transforming instead leaves
   every top-level declaration exactly where it was, so this is a move rather than a
   rewrite and the output keeps its original shape.

   The trailing `export { … }` is cut first: a classic script cannot carry one. The
   `import type` line needs no handling — esbuild erases it. */
const coreSrc = readFileSync(CORE_TS, 'utf8');
const exportAt = coreSrc.lastIndexOf('\nexport {');
if (exportAt < 0) throw new Error('app/src/core/index.ts has no trailing export block');
const coreBundle = transformSync(coreSrc.slice(0, exportAt), {
  loader: 'ts', target: 'es2022', format: 'esm', legalComments: 'none'
}).code;

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
    + out.slice(first);
})();

/* The fragment with the assembled script swapped in. Both outputs are built from
   this rather than from `frag`, which is the bug the first version of this had: the
   TypeScript compiled fine and then never reached the artifact, leaving the legacy
   build quietly running its own copy of the core. */
const fragOut = (() => {
  const a = frag.indexOf('<script>') + 8;
  const b = frag.lastIndexOf('</script>');
  return frag.slice(0, a) + script + frag.slice(b);
})();

/* ---- 1. standalone page ------------------------------------------------ */
const cut = fragOut.indexOf('<div id="app">');
writeFileSync(join(here, 'index.html'), withFonts(`<!doctype html>
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
`));

/* ---- 1b. artifact source: the same fragment with fonts inlined ---------- */
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'artifact.html'), withFonts(fragOut));

/* ---- 1c. every control must be both rendered and wired ------------------
   A slice-based edit once deleted four wiring branches while leaving their
   markup in place, producing controls that looked fine and did nothing. */
const cases = (fnName, endMarker) => {
  const from = script.indexOf(fnName);
  const to = script.indexOf(endMarker, from);
  if (from < 0 || to < 0) throw new Error('could not locate ' + fnName);
  return new Set([...script.slice(from, to).matchAll(/case '(\w+)':/g)].map(m => m[1]));
};
const rendered = cases('function ctlHtml(', 'function groupHtml(');
const wired = cases('function bindRight(', '/* advanced pseudo-props');
const unwired = [...rendered].filter(c => !wired.has(c));
const unrendered = [...wired].filter(c => !rendered.has(c));
if (unwired.length) throw new Error('control(s) rendered but never wired: ' + unwired.join(', '));
if (unrendered.length) throw new Error('control(s) wired but never rendered: ' + unrendered.join(', '));

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

console.log(`index.html + dist/artifact.html written (fonts ${Math.round(FONT_CSS.length / 1024)} KB) · core compiled from TypeScript (${Math.round(coreBundle.length / 1024)} KB bundled)`);

/* ---- 4. is the published Artifact still the copy we just built? ---------
   Publishing is an agent action with no CLI, so this cannot be automated — but the
   live copy has gone stale twice, once by six commits, on the strength of a note in
   CONTEXT.md. Reporting it on every build is the part that can be. `--check` makes
   it gateable; see tools/pubcheck.mjs. */
const pub = status();
console.log(report(pub));
if (process.argv.includes('--check') && pub.state !== 'current') process.exit(1);
