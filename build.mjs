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

const script = frag.slice(frag.indexOf('<script>') + 8, frag.lastIndexOf('</script>'));

/* ---- 1. standalone page ------------------------------------------------ */
const cut = frag.indexOf('<div id="app">');
writeFileSync(join(here, 'index.html'), withFonts(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${frag.slice(0, cut).trim()}
</head>
<body>
${frag.slice(cut).trim()}
</body>
</html>
`));

/* ---- 1b. artifact source: the same fragment with fonts inlined ---------- */
mkdirSync(join(here, 'dist'), { recursive: true });
writeFileSync(join(here, 'dist', 'artifact.html'), withFonts(frag));

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

/* ---- 2. testable core -------------------------------------------------- */
const OPEN = '/*<core>*/', CLOSE = '/*</core>*/';
const regions = [];
let at = 0;
for (;;) {
  const a = script.indexOf(OPEN, at);
  if (a < 0) break;
  const b = script.indexOf(CLOSE, a);
  if (b < 0) throw new Error('unclosed ' + OPEN + ' near offset ' + a);
  regions.push(script.slice(a + OPEN.length, b));
  at = b + CLOSE.length;
}
if (!regions.length) throw new Error('no core regions found in builder.html');

const EXPORTS = [
  // primitives
  'esc', 'safeUrl', 'uid', 'clone', 'slugify', 'dbounce',
  // registry
  'DEF', 'IC', 'COMMON_STYLE', 'GF', 'stackFor', 'familyOf', 'isGoogle', 'usedFamilies', 'gfontsHref', 'gfontsLink', 'fontGroups', 'FONT_BASE', 'LAYOUTS', 'COUNTS', 'DEFAULT_COLS', 'BASE', 'makeFor', 'labelOf', 'iconOf', 'rowRatios', 'matchLayout',
  // model + tree
  'N', 'cols', 'BOX', 'state', 'doc', 'page', 'tree', 'dk', 'DEV_KEY', 'DEV_LABEL',
  'locate', 'locateAny', 'eachNode', 'nameOf', 'lvl', 'holds', 'wrap',
  'insert', 'moveNode', 'reid', 'pageMove', 'dupNode', 'delNode', 'applyCols', 'seed',
  'MIN_COL', 'BP_CHAIN', 'rowRatiosAt', 'resizeCols', 'applyColsAt',
  // the selection set
  'selIds', 'selNodes', 'multiOn', 'selSet', 'selToggle', 'selOrder', 'selRange', 'topMost',
  'dupMany', 'delMany', 'ADV_SHARED', 'ctlKeys', 'fanTargets',
  // design tokens
  'RESERVED', 'TYPO_KEYS', 'TS_TYPES', 'tokenId', 'cvar', 'isRef', 'refId', 'colors', 'styles', 'classes', 'findColor', 'findStyle', 'findClass', 'nodeClasses',
  'classAdd', 'classApply', 'classRemove', 'classFrom', 'classUsage', 'classDelete', 'classMove', 'resolveColor', 'defaultTokens', 'tokenVars', 'tokenCss', 'stripTypo', 'grabTypo', 'tsApply', 'tsUnlink', 'tsUpdateFrom', 'tsCreateFrom', 'tsUsage', 'styleDelete', 'colorDelete', 'colorAdd', 'colorUsage',
  // clipboard + traversal
  'clip', 'copyNode', 'pasteNode', 'dropTree',
  'blocks', 'findBlock', 'blockRootType', 'blockSave', 'blockInsert', 'blockDelete',
  // content collections
  'FIELD_TYPES', 'collections', 'findCollection', 'findField', 'findItem', 'uniqueId',
  'collectionAdd', 'collectionDelete', 'collectionRename',
  'fieldAdd', 'fieldDelete', 'fieldMove', 'titleField', 'itemTitle', 'itemSlug',
  'itemAdd', 'itemDelete', 'itemMove', 'itemSet', 'itemSetSlug',
  'listItems', 'pageHref', 'exportTargets', 'contentJson', 'sitePlan',
  'bindableKeys', 'bindGet', 'bindSet', 'srcSet', 'bindScope',
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
  'vid', 'vidSrc', 'vidPoster', 'embedUrl', 'canFacade', 'SEC_TAGS', 'FACADE_JS', 'renderNode', 'renderList', 'tidy', 'NAV_JS', 'buildPage'
];

writeFileSync(join(here, 'dist', 'core.cjs'),
  `/* GENERATED by build.mjs from builder.html — do not edit.
   The DOM-free core of the page builder, extracted verbatim for testing. */
'use strict';
${regions.join('\n')}
module.exports = { ${EXPORTS.join(', ')} };
`);

console.log(`index.html + dist/artifact.html written (fonts ${Math.round(FONT_CSS.length / 1024)} KB) · dist/core.cjs written (${regions.length} core regions, ${regions.join('').split('\n').length} lines)`);
