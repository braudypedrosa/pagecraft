/* The core: everything that does not touch the DOM.
   Ported from builder.html verbatim — the logic is unchanged and the same suite
   covers it, which is the only way a port of this size is safe to make.

   Two things are deliberately still to do, in this order:
     1. tighten the types. `types.ts` describes the domain properly; the code below
        still leans on inference in places, and `noImplicitAny` is off in tsconfig
        to allow that. Tighten a function at a time, with the suite green.
     2. split this file. The sections are already marked, but this is one flat scope
        with around 180 cross-references and real cycles — `menuFor` needs `clip`,
        whose module would need `DEF`. Splitting it in one move is how a working
        system breaks; do it one boundary at a time.

   builder.html no longer owns this code. `build.mjs` compiles this file back into
   the legacy single-file build, so there is one source of truth during the port. */
/* eslint-disable */
import type {
  State, Ui, Tokens, Doc, Node as PcNode, Handle, WidgetDef, WidgetType, Css, Decls, Bp,
  StateKey, States, Anim, TabPanel, Capability, Binding, Condition, CondOp, ComponentDef, ComponentProp, PropKind,
  Collection, Field, FieldType, Item, Page, StyleClass, PropBag, GalleryTile, NavItem,
  Finding, RenderOpts, MenuItem, Slot, SlotHit, Control
} from './types.ts';
import { IC, svg, ICONS, ICON_PATHS, ICON_NAMES, iconSvg } from './icons.ts';
import { ANIM_CSS, ANIM_JS, ANIM_NAMES, ANIM_PFX, ANIM_SHA } from './anim.ts';

/* ---------------------------------------------------------------- utils */
let _seq = 0;
const uid = () => (_seq++, 'n' + Date.now().toString(36).slice(-5) + _seq.toString(36) + Math.floor(Math.random() * 1296).toString(36));
const esc = (s: unknown) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/* Only link schemes that are safe to put in an exported href. Anything else
   (javascript:, vbscript:, data:text/html, …) becomes an empty link. */
const safeUrl = (u: unknown) => {
  const v = String(u == null ? '' : u).trim();
  if (!v) return '';
  if (/^(https?:\/\/|mailto:|tel:|#|\/|\.{1,2}\/)/i.test(v)) return v;
  if (/^data:image\//i.test(v) || /^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v)) return v;
  if (/^[\w.-]+(\/|\?|#|$)/.test(v)) return v;            // page.html, example.com/x
  return '';
};
/** Nav menu and manual Breadcrumb are the two widgets whose links live in `props.items`.
 * Keep every link traversal on this semantic predicate so review, page renames, rendering,
 * and Connected release migration cannot quietly disagree about one of them. */
const hasItemHrefs = (node: Pick<PcNode, 'type'>) => node.type === 'nav' || node.type === 'crumbs';

/** A WordPress-owned destination is stored in the editor as a typed, target-neutral
 * reference. It is not a browser URL: `pageHref` converts it to the exact signed
 * placeholder that the Connected compiler and connector understand. Keeping the
 * WordPress-relative route in the reference lets one release promote unchanged from a
 * subdirectory staging install to a differently hosted production install. */
export type WordPressContentReference = { objectType: 'page' | 'post'; path: string };
const WORDPRESS_CONTENT_REFERENCE_PREFIX = 'pagecraft:wordpress-content:';
const WORDPRESS_CONTENT_TOKEN_PREFIX = '%%PAGECRAFT_WP_CONTENT:';
const BASE64URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64urlUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const packed = (first << 16) | (second << 8) | third;
    result += BASE64URL_ALPHABET[(packed >> 18) & 63]
      + BASE64URL_ALPHABET[(packed >> 12) & 63]
      + (index + 1 < bytes.length ? BASE64URL_ALPHABET[(packed >> 6) & 63] : '')
      + (index + 2 < bytes.length ? BASE64URL_ALPHABET[packed & 63] : '');
  }
  return result;
}

function utf8FromBase64url(value: string): string | null {
  if (!value || /[^A-Za-z0-9_-]/.test(value)) return null;
  const bytes: number[] = [];
  let bits = 0, bitCount = 0;
  for (const character of value) {
    const digit = BASE64URL_ALPHABET.indexOf(character);
    if (digit < 0) return null;
    bits = (bits << 6) | digit;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 255);
      bits &= (1 << bitCount) - 1;
    }
  }
  if (bitCount && bits !== 0) return null;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes));
  } catch { return null; }
}

function normalizeWordPressContentPath(value: unknown): string | null {
  let path = String(value == null ? '' : value).trim();
  if (!path || path.length > 2048 || /[?#\\\u0000-\u001f\u007f]/.test(path)) return null;
  path = ('/' + path.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
  if (path !== '/' && !/\.[^/]+\/?$/.test(path) && !path.endsWith('/')) path += '/';
  return path;
}

function buildWordPressContentReference(objectType: unknown, path: unknown): string {
  if (objectType !== 'page' && objectType !== 'post') return '';
  const normalized = normalizeWordPressContentPath(path);
  return normalized
    ? `${WORDPRESS_CONTENT_REFERENCE_PREFIX}${objectType}:${base64urlUtf8(normalized)}`
    : '';
}

function parseWordPressContentReference(value: unknown): WordPressContentReference | null {
  const exact = String(value == null ? '' : value).trim();
  const match = exact.match(/^pagecraft:wordpress-content:(page|post):([A-Za-z0-9_-]+)$/);
  if (!match) return null;
  const decoded = utf8FromBase64url(match[2]);
  const path = decoded == null ? null : normalizeWordPressContentPath(decoded);
  if (!path || path !== decoded || base64urlUtf8(path) !== match[2]) return null;
  return { objectType: match[1] as 'page' | 'post', path };
}

function wordpressContentToken(reference: WordPressContentReference): string {
  const stored = buildWordPressContentReference(reference.objectType, reference.path);
  const parsed = stored ? parseWordPressContentReference(stored) : null;
  return parsed
    ? `${WORDPRESS_CONTENT_TOKEN_PREFIX}${parsed.objectType}:${base64urlUtf8(parsed.path)}%%`
    : '';
}

function parseWordPressContentToken(value: unknown): WordPressContentReference | null {
  const exact = String(value == null ? '' : value).trim();
  const match = exact.match(/^%%PAGECRAFT_WP_CONTENT:(page|post):([A-Za-z0-9_-]+)%%$/);
  if (!match) return null;
  return parseWordPressContentReference(
    `${WORDPRESS_CONTENT_REFERENCE_PREFIX}${match[1]}:${match[2]}`
  );
}
/* A hosted Pagecraft site has no submission receiver of its own. A form is therefore live
   only when its author supplies an explicit, encrypted, absolute endpoint. Relative actions
   would POST back into the published-site router; host-looking strings and protocol-relative
   URLs are ambiguous; http sends visitors' answers in clear text. Keep all of them inert. */
const safeFormAction = (u: unknown) => {
  const v = String(u == null ? '' : u).trim();
  if (!/^https:\/\//i.test(v)) return '';
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return v;
  } catch { return ''; }
};
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const slugify = (s: unknown) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';


const dbounce = (fn: (...a: any[]) => void, ms: number) => { let t: any; return (...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };


/* The one page every project has: `blankProject` makes it, and it cannot be deleted while
   it is the only one. So it is the only href a *default* can point at and still resolve —
   which is the whole reason this is a named constant rather than a string in two places. */
const HOME = 'index.html';

/* Five operators, chosen to cover what people actually build: `is` for a category page,
   `has` for a tag that lives in a comma-separated field, `set` for "only items with an
   image", and the two negatives. Anything richer wants a query language, and a page builder
   is not the place to invent one. */
const FILTER_OPS: [string, string][] = [
  ['is', 'is'], ['not', 'is not'], ['has', 'contains'],
  ['set', 'has any value'], ['unset', 'is empty']
];

/* --------------------------------------------------- element definitions
   level: 0 root · 1 section · 2 row · 3 column · 4 leaf                 */
const BOX = (t: string, r: string, b: string, l: string) => ({ 'padding-top': t, 'padding-right': r, 'padding-bottom': b, 'padding-left': l });

/* One vocabulary per kind of measurement, so the same property always offers
   the same units wherever it appears. */
const U = {
  size: ['px', 'rem', 'em', 'vw'],
  len: ['px', 'rem', '%', 'vw', 'vh'],
  space: ['px', 'rem', '%'],
  radius: ['px', 'rem', '%'],
  line: ['', 'px', 'em', '%'],
  track: ['em', 'px'],
  border: ['px', 'rem']
};

/* A column's vertical alignment is a relationship with its row, not only a literal
   `justify-content`. The marker stays in the document so each breakpoint can either
   follow the row or opt out without copying values into every child. `bucket()` resolves
   it to ordinary CSS; exported pages never need special runtime behaviour. */
const COLUMN_V_ALIGN = '--pc-column-v-align';
function columnVerticalOptions(n: PcNode): string[][] {
  return [
    ['follow', `Follow row · ${rowVerticalLabel(n)}`],
    ['flex-start', 'Top'], ['center', 'Center'], ['flex-end', 'Bottom']
  ];
}

/* Values that come from a known set belong in a picker, not a text field.
   Each list ends with Custom… for anything the list does not cover. */

/* ---- font library ------------------------------------------------------
   A curated slice of Google Fonts. Choosing one is enough: the families in use
   are collected automatically and the stylesheet link is written into every
   export, so nobody has to hand-manage a <link>. Manrope and DM Sans are also
   embedded in the builder itself, being the brand faces.                   */
const GF_FALLBACK: Record<string, string> = {
  s: "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  f: "Georgia,'Times New Roman',serif",
  d: "system-ui,-apple-system,sans-serif",
  m: 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace'
};
const GF_GROUP: Record<string, string> = { s: 'Sans serif', f: 'Serif', d: 'Display', m: 'Monospace' };
const W4 = '400;500;600;700';
const GF = [
  ['Manrope', 's', W4], ['DM Sans', 's', W4], ['Inter', 's', W4], ['Figtree', 's', W4],
  ['Plus Jakarta Sans', 's', W4], ['Work Sans', 's', W4], ['Outfit', 's', W4], ['Sora', 's', W4],
  ['Space Grotesk', 's', '400;500;600;700'], ['Epilogue', 's', W4], ['Archivo', 's', W4],
  ['Karla', 's', W4], ['Rubik', 's', W4], ['Poppins', 's', '400;500;600;700'],
  ['Montserrat', 's', W4], ['Raleway', 's', W4], ['Nunito Sans', 's', W4], ['Open Sans', 's', W4],
  ['Lato', 's', '400;700'], ['Roboto', 's', '400;500;700'], ['Source Sans 3', 's', W4],
  ['IBM Plex Sans', 's', '400;500;600;700'], ['Mulish', 's', W4], ['Public Sans', 's', W4],

  ['Playfair Display', 'f', '400;500;600;700'], ['Fraunces', 'f', W4], ['Lora', 'f', '400;500;600;700'],
  ['Merriweather', 'f', '400;700'], ['Source Serif 4', 'f', W4], ['Crimson Pro', 'f', W4],
  ['Libre Baskerville', 'f', '400;700'], ['EB Garamond', 'f', '400;500;600;700'],
  ['Cormorant Garamond', 'f', '400;500;600;700'], ['Spectral', 'f', '400;500;600;700'],
  ['Newsreader', 'f', W4], ['DM Serif Display', 'f', '400'], ['Instrument Serif', 'f', '400'],

  ['Bebas Neue', 'd', '400'], ['Anton', 'd', '400'], ['Oswald', 'd', '400;500;600;700'],
  ['Archivo Black', 'd', '400'], ['Syne', 'd', '400;500;600;700;800'], ['Chivo', 'd', W4],

  ['JetBrains Mono', 'm', '400;500;600;700'], ['IBM Plex Mono', 'm', '400;500;600;700'],
  ['Space Mono', 'm', '400;700'], ['Roboto Mono', 'm', W4], ['Fira Code', 'm', W4],
  ['DM Mono', 'm', '400;500']
];
const gfIndex = Object.fromEntries(GF.map(([fam, cat, w]) => [fam.toLowerCase(), { fam, cat, w }]));
const stackFor = (fam: string, cat: string) => `'${fam}',${GF_FALLBACK[cat] || GF_FALLBACK.s}`;

/* the first family named in a stack, unquoted */
function familyOf(stack: string) {
  const first = String(stack || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '');
  return first;
}
const isGoogle = (stack: string) => !!gfIndex[familyOf(stack).toLowerCase()];

/* every Google family the project actually uses, in a stable order */
function usedFamilies() {
  const seen = new Set<string>();
  const take = (v: string) => { const g = gfIndex[familyOf(v).toLowerCase()]; if (g) seen.add(g.fam); };
  take(state.meta.font); take(state.meta.headFont);
  const scan = (css: any) => (['d', 't', 'm'] as Bp[]).forEach(b => { const v = (css && css[b] || {})['font-family']; if (v) take(v); });
  styles().forEach(t => scan(t.css));
  classes().forEach(c => scan(c.css));
  renderedTrees().forEach(l => eachNode(l, n => scan(n.css)));
  return GF.map(([fam]) => fam).filter(f => seen.has(f));
}
/* one stylesheet request for every family in use */
function gfontsHref() {
  const fams = usedFamilies();
  if (!fams.length) return '';
  const q = fams.map(f => `family=${f.replace(/ /g, '+')}:wght@${gfIndex[f.toLowerCase()].w}`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
/* ---- self-hosting the webfonts ---------------------------------------
   An export links `fonts.googleapis.com`, which is a third-party request on every page of
   someone's site: a round trip before any text can render, and in the EU a transfer of the
   visitor's IP to Google that a cookie banner does not cover. `brand/fonts/` already proves
   the builder can carry its own faces; this does the same for what it exports.

   The split is deliberate. Parsing the stylesheet Google returns, and writing the
   `@font-face` rules that replace it, are decisions — they live here and have tests. Fetching
   the files and putting them in the archive is plumbing that needs a network and a zip, and
   stays in the export where those are. */

/** One face from a Google `css2` stylesheet. Their response is one `@font-face` per weight
    per subset, each preceded by a comment naming the subset. */
interface FontFace { family: string; weight: string; style: string; subset: string; url: string; range: string }

/* latin and latin-ext only, by default. A full response carries Cyrillic, Greek and
   Vietnamese too, which for most sites is several times the bytes of the text they will ever
   render. The set is a parameter so a site that needs one can ask for it. */
const FONT_SUBSETS = ['latin', 'latin-ext'];

function parseFontCss(css: string, subsets: string[] = FONT_SUBSETS): FontFace[] {
  const out: FontFace[] = [];
  /* the subset comment sits before its block, so the split keeps each block with its own name */
  const parts = String(css || '').split(/\/\*\s*([a-z0-9-]+)\s*\*\//i);
  for (let i = 1; i < parts.length; i += 2) {
    const subset = parts[i].toLowerCase();
    if (subsets.length && !subsets.includes(subset)) continue;
    const block = parts[i + 1] || '';
    for (const m of block.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const b = m[1];
      const pick = (k: string) => { const h = b.match(new RegExp(k + '\\s*:\\s*([^;]+)')); return h ? h[1].trim() : ''; };
      const url = (b.match(/url\(([^)]+)\)/) || [, ''])[1].replace(/['"]/g, '');
      const family = pick('font-family').replace(/['"]/g, '');
      if (!url || !family) continue;
      out.push({
        family, weight: pick('font-weight') || '400', style: pick('font-style') || 'normal',
        subset, url, range: pick('unicode-range')
      });
    }
  }
  return out;
}

/** The `@font-face` rules to ship in place of the Google stylesheet. `path` names the file
    each face was written to, so the caller decides the layout and this stays testable. */
function fontFaceCss(faces: FontFace[], path: (f: FontFace) => string) {
  return faces.map(f =>
    `@font-face{font-family:'${f.family}';font-style:${f.style};font-weight:${f.weight};`
    + `font-display:swap;src:url('${path(f)}') format('woff2')`
    + `${f.range ? `;unicode-range:${f.range}` : ''}}`
  ).join('\n');
}

/** A stable filename for one face: family, weight, style and subset are what make it unique. */
const fontFile = (f: FontFace) =>
  `fonts/${slugify(f.family)}-${f.weight}${f.style === 'italic' ? 'i' : ''}-${f.subset}.woff2`;

function gfontsLink() {
  const href = gfontsHref();
  if (!href) return '';
  return `<link rel="preconnect" href="https://fonts.googleapis.com">\n`
    + `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n`
    + `<link rel="stylesheet" href="${esc(href)}">\n`;
}
/* picker options, grouped by category, with the non-Google defaults first */
const FONT_BASE = [
  ['', 'Inherit'],
  ["system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif", 'System sans'],
  ["Georgia,'Times New Roman',serif", 'System serif'],
  ['ui-monospace,SFMono-Regular,Menlo,Consolas,monospace', 'System monospace']
];
/* A label and its [stack, name] pairs. Annotated because the inferred type was
   `(string | string[][])[][]`, which makes the label and the list indistinguishable —
   a picker cannot use that without a cast at every point. */
function fontGroups(): [string, string[][]][] {
  const groups: [string, string[][]][] = [['Standard', FONT_BASE]];
  (['s', 'f', 'd', 'm'] as const).forEach(cat => {
    groups.push([GF_GROUP[cat] + ' — Google Fonts',
      GF.filter(([, c]) => c === cat).map(([fam, c]) => [stackFor(fam, c), fam])]);
  });
  return groups;
}
const SHADOWS = [
  ['', 'None'],
  ['0 1px 2px rgba(17,19,17,.07)', 'Hairline'],
  ['0 8px 20px -8px rgba(17,19,17,.18)', 'Soft'],
  ['0 20px 44px -14px rgba(17,19,17,.28)', 'Elevated'],
  ['0 34px 70px -22px rgba(17,19,17,.38)', 'Deep']
];
const TRANSITIONS = [
  ['', 'None'],
  ['all .15s ease', 'Fast'],
  ['all .25s ease', 'Standard'],
  ['all .4s cubic-bezier(.4,0,.2,1)', 'Smooth']
];
const FILTERS = [
  ['', 'None'],
  ['grayscale(1)', 'Greyscale'],
  ['saturate(1.25)', 'Richer'],
  ['contrast(1.1)', 'More contrast'],
  ['blur(6px)', 'Blurred'],
  ['brightness(.85)', 'Darker']
];

/* Grid tracks as a count, not a template. `minmax(0, 1fr)` rather than `1fr` on purpose: a
   grid child with a long word overflows a `1fr` track, which is the most common CSS grid
   surprise and not one an author should have to know about. The `auto-fit` entry is the one
   that needs no breakpoint work — it reflows on its own. */
const GRID_COLS: [string, string][] = [
  ['repeat(2, minmax(0, 1fr))', '2 across'],
  ['repeat(3, minmax(0, 1fr))', '3 across'],
  ['repeat(4, minmax(0, 1fr))', '4 across'],
  ['repeat(6, minmax(0, 1fr))', '6 across'],
  ['repeat(auto-fit, minmax(240px, 1fr))', 'As many as fit'],
  ['2fr 1fr', 'Wide then narrow'],
  ['1fr 2fr', 'Narrow then wide']
];

/** How many tracks a `grid-template-columns` value declares, or 0 when it cannot be counted.
    `auto-fit` and `auto-fill` answer 0 on purpose: they reflow, so they are never the problem
    the review is looking for. */
function gridTracks(v: string): number {
  const raw = String(v || '').trim();
  if (!raw || /auto-fi(t|ll)/.test(raw)) return 0;
  const rep = /^repeat\(\s*(\d+)\s*,/.exec(raw);
  if (rep) return Number(rep[1]);
  /* a written-out template: count the tracks, ignoring what is inside brackets */
  return raw.replace(/\([^()]*\)/g, 'x').split(/\s+/).filter(Boolean).length;
}

const DEF: Record<string, WidgetDef> = {

  section: {
    label: 'Section', icon: 'section', level: 1,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: { tag: 'section', width: 'boxed', inner: '' }, css: { d: { ...BOX('72px', '24px', '72px', '24px') }, t: {}, m: { ...BOX('48px', '20px', '48px', '20px') } } }),
    controls: {
      content: [
        { t: 'pick', k: 'width', label: 'Content width', opts: [['boxed', 'Boxed'], ['full', 'Full width']], text: 1 },
        { t: 'unit', c: 'min-height', label: 'Min height', r: 1, units: U.len },
        { t: 'select', k: 'tag', label: 'HTML tag', opts: [['section', 'section'], ['div', 'div'], ['header', 'header'], ['footer', 'footer'], ['main', 'main'], ['article', 'article'], ['aside', 'aside']] }
      ],
      style: []
    }
  },

  row: {
    label: 'Row', icon: 'row', level: 2,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: {}, css: { d: { gap: '24px', 'align-items': 'stretch', 'justify-content': 'flex-start' }, t: {}, m: { gap: '20px' } } }),
    controls: {
      content: [
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space },
        /* Baseline is here because the header templates use it — text beside text in a bar
           is read on the baseline, not on the box. Without the option the control had no
           button lit for a row it was looking at, and touching any other one threw the
           value away with no way back through the UI. Same defect as a unit control whose
           list omits the stored unit. */
        { t: 'pick', c: 'align-items', label: 'Vertical align', r: 1, opts: [['flex-start', 'vTop'], ['center', 'vMid'], ['flex-end', 'vBot'], ['baseline', 'Base'], ['stretch', 'Fill']] },
        { t: 'select', c: 'justify-content', label: 'Horizontal distribute', r: 1, opts: [['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around']] },
        { t: 'select', c: 'flex-wrap', label: 'Wrap', r: 1, opts: [['wrap', 'Wrap'], ['nowrap', 'No wrap']] },
        { t: 'cols', label: 'Columns' }
      ],
      style: []
    }
  },

  /* A Slider is a Row that scrolls and snaps. Not to be confused with the `slider` control
     kind, which is a range input — one is a widget type, the other a control type, and the two
     never meet., so a slide is a Column and anything can
     go in one. The scrolling, the snapping and the sizing are CSS — a page ships no
     script for it and still swipes on a phone, scrolls with a trackpad and reaches every
     slide from the keyboard. Only the arrow buttons need JavaScript, which is why they
     are optional and why they arrive hidden.

     Slides do not carry flex-grow the way a row's columns do: their width comes from
     `--sl-w`, so "three per view" is one declaration rather than a ratio per slide. */
  slider: {
    label: 'Slider', icon: 'slider', level: 2,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: { arrows: 1, aria: 'Slides' },
      css: {
        d: { '--sl-gap': '24px', '--sl-w': 'calc((100% - 2 * var(--sl-gap,24px)) / 3)' },
        t: { '--sl-w': 'calc((100% - var(--sl-gap,24px)) / 2)' },
        m: { '--sl-gap': '16px', '--sl-w': '86%' }
      }
    }),
    controls: {
      content: [
        {
          t: 'select', c: '--sl-w', label: 'Slides in view', r: 1, opts: [
            ['100%', 'One'],
            ['calc((100% - var(--sl-gap,24px)) / 2)', 'Two'],
            ['calc((100% - 2 * var(--sl-gap,24px)) / 3)', 'Three'],
            ['calc((100% - 3 * var(--sl-gap,24px)) / 4)', 'Four'],
            ['86%', 'One and a peek'],
            ['auto', 'As wide as their contents']
          ]
        },
        { t: 'unit', c: '--sl-gap', label: 'Gap', r: 1, units: U.space },
        { t: 'toggle', k: 'arrows', label: 'Arrow buttons',
          note: 'Hidden without JavaScript, where swiping and scrolling still work' },
        { t: 'text', k: 'aria', label: 'Region name', ph: 'Slides',
          note: 'What a screen reader calls the scrollable area' }
      ],
      style: []
    }
  },

  /* A Collection List is a Row whose contents repeat — put one Column inside and
     you get a grid of cards. The collection lives on `node.src`, the same field
     phase 2 uses, so anything inside binds with no extra plumbing. */
  list: {
    label: 'Collection list', icon: 'cms', level: 2,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: { sort: '', dir: 'asc', limit: '' },
      css: { d: { gap: '24px', 'align-items': 'stretch', 'flex-wrap': 'wrap' }, t: {}, m: { gap: '20px' } }
    }),
    controls: {
      content: [
        { t: 'source', label: 'Collection' },
        {
          t: 'select', k: 'sort', label: 'Sort by',
          opts: n => [['', 'The order in the CMS'],
            ...((n.src && findCollection(n.src) ? findCollection(n.src)!.fields : []).map((f: Field) => [f.id, f.name]))]
        },
        { t: 'pick', k: 'dir', label: 'Direction', opts: [['asc', 'A–Z'], ['desc', 'Z–A']] },
        {
          t: 'select', k: 'where', label: 'Only show items where',
          opts: n => [['', 'Every item'],
            ...((n.src && findCollection(n.src) ? findCollection(n.src)!.fields : []).map((f: Field) => [f.id, f.name]))]
        },
        /* Both hidden until a field is chosen: an operator and a value with nothing to
           test are two controls that cannot do anything, and a panel that shows every
           control it has regardless is how the inspector got long in the first place. */
        { t: 'select', k: 'op', label: 'Test', opts: FILTER_OPS, when: n => !!(n.props as PropBag).where },
        {
          t: 'text', k: 'val', label: 'Value', ph: 'e.g. Journal', set: 1,
          when: n => {
            const p = n.props as PropBag;
            return !!p.where && p.op !== 'set' && p.op !== 'unset';
          }
        },
        {
          t: 'unit', k: 'per', label: 'Items per page', units: [''], ph: 'all on one page',
          note: 'Turns this page into one file per page of results.'
        },
        {
          t: 'unit', k: 'limit', label: 'Show at most', units: [''], ph: 'all',
          note: 'Items per page wins where both are set.',
          when: n => !(parseInt(String((n.props as PropBag).per || ''), 10) > 0)
        },
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space },
        /* Baseline is here because the header templates use it — text beside text in a bar
           is read on the baseline, not on the box. Without the option the control had no
           button lit for a row it was looking at, and touching any other one threw the
           value away with no way back through the UI. Same defect as a unit control whose
           list omits the stored unit. */
        { t: 'pick', c: 'align-items', label: 'Vertical align', r: 1, opts: [['flex-start', 'vTop'], ['center', 'vMid'], ['flex-end', 'vBot'], ['baseline', 'Base'], ['stretch', 'Fill']] },
        { t: 'select', c: 'flex-wrap', label: 'Wrap', r: 1, opts: [['wrap', 'Wrap'], ['nowrap', 'No wrap']] }
      ],
      style: []
    }
  },

  column: {
    label: 'Column', icon: 'column', level: 3, alsoHolds: ['row', 'slider', 'box'],
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: {}, css: { d: { 'flex-grow': '100', [COLUMN_V_ALIGN]: 'follow', 'align-items': 'stretch', gap: '16px' }, t: {}, m: { 'flex-basis': '100%' } } }),
    controls: {
      content: [
        /* Neither of these is a slide's business. Inside a slider a column's width comes from
           the slider's own "Slides in view" — the strip sets `flex` on its children with two
           classes, so a share or a basis set here is a control that does nothing. */
        { t: 'slider', c: 'flex-grow', label: 'Width (share)', r: 1, min: 5, max: 100, step: .01, raw: 1, when: notASlide },
        { t: 'unit', c: 'flex-basis', label: 'Min basis', r: 1, units: ['%', 'px', 'rem'], note: 'Set 100% to force a full-width stack.', when: notASlide },
        { t: 'select', c: COLUMN_V_ALIGN, label: 'Vertical align', r: 1, opts: columnVerticalOptions,
          note: 'Follows the parent row unless this column overrides it.' },
        { t: 'pick', c: 'align-items', label: 'Horizontal align', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR'], ['stretch', 'Fill']] },
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space }
      ],
      style: []
    }
  },

  /* ---- Box: the general container ------------------------------------------
     The layout this editor could express was `section > row > column` and nothing else. A
     three-across grid of cards that reflows to two, a toolbar whose items push apart, a whole
     card that is one link — none of them were sayable. This is the primitive the plan called
     load-bearing, and it is one widget rather than four because Div, Flex and Grid differ by a
     single declaration. Three palette entries build it with a different `layout`, the way
     `columns` builds a row; the panel then offers the controls that layout actually has.

     Level 2, so it sits where a row sits: a section holds one, a column holds one, and it
     holds rows, columns, boxes and anything else. That is what `alsoHolds` is for.

     `link` makes the whole box an anchor — the Link Block. Nothing else in the widget set could
     do it: a link lived on a heading, a button or an image, so a clickable card meant a
     transparent button stretched over it. */
  box: {
    label: 'Box', icon: 'section', level: 2, takes: 4, alsoHolds: ['box', 'row', 'slider', 'column'],
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: { layout: 'block', tag: 'div', link: '', target: '' }, css: { d: {}, t: {}, m: {} } }),
    controls: {
      content: [
        { t: 'select', k: 'layout', label: 'Layout', opts: [['block', 'Stacked'], ['flex', 'Flex'], ['grid', 'Grid']] },
        /* Flex. The same four controls a row has, because they are the four questions flexbox
           asks — and named the way the row names them, so learning one teaches the other. */
        { t: 'pick', c: 'flex-direction', label: 'Direction', r: 1, when: n => n.props.layout === 'flex', opts: [['row', 'Row'], ['column', 'Column']] },
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space, when: n => n.props.layout !== 'block' },
        { t: 'select', c: 'justify-content', label: 'Distribute', r: 1, when: n => n.props.layout !== 'block', opts: [['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around']] },
        { t: 'pick', c: 'align-items', label: 'Align', r: 1, when: n => n.props.layout !== 'block', opts: [['flex-start', 'vTop'], ['center', 'vMid'], ['flex-end', 'vBot'], ['stretch', 'Fill']] },
        { t: 'select', c: 'flex-wrap', label: 'Wrap', r: 1, when: n => n.props.layout === 'flex', opts: [['wrap', 'Wrap'], ['nowrap', 'No wrap']] },
        /* Grid. A count rather than a template string: `repeat(3, minmax(0, 1fr))` is the
           answer to "three across" every time, and `minmax(0, 1fr)` rather than `1fr` because
           a grid child with long content overflows its track otherwise — the single most
           common CSS grid surprise, and not one an author should have to know. */
        { t: 'select', c: 'grid-template-columns', label: 'Columns', r: 1, when: n => n.props.layout === 'grid', opts: GRID_COLS },
        { t: 'select', k: 'tag', label: 'HTML tag', when: n => !String(n.props.link || '').trim(), opts: [['div', 'div'], ['article', 'article'], ['aside', 'aside'], ['nav', 'nav'], ['header', 'header'], ['footer', 'footer'], ['main', 'main'], ['section', 'section'], ['ul', 'ul'], ['ol', 'ol'], ['li', 'li']] },
        { t: 'link', k: 'link', label: 'Link', note: 'A whole box that is one link.' }
      ],
      style: []
    }
  },

  heading: {
    label: 'Heading', icon: 'heading', level: 4, edit: 'text', styleLabel: 'Typography & fill',
    caps: ['spacing', 'effects', 'typography', 'animation'],
    make: () => ({
      props: { text: 'A headline that carries weight', level: 'h2', link: '', target: '', ts: 'title' },
      css: { d: { 'text-align': 'left', 'margin-bottom': '0px' }, t: {}, m: {} }
    }),
    controls: {
      content: [
        { t: 'area', k: 'text', label: 'Heading text', rows: 2, mono: 0 },
        { t: 'tstyle', k: 'ts', label: 'Text style' },
        { t: 'select', k: 'level', label: 'HTML tag', opts: [['h1', 'H1'], ['h2', 'H2'], ['h3', 'H3'], ['h4', 'H4'], ['h5', 'H5'], ['h6', 'H6'], ['p', 'p'], ['div', 'div']] },
        { t: 'pick', c: 'text-align', label: 'Alignment', r: 1, opts: [['left', 'alignL'], ['center', 'alignC'], ['right', 'alignR']] },
        { t: 'link', k: 'link', label: 'Link' }
      ],
      style: [
        { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: U.size },
        { t: 'color', c: 'color', label: 'Colour' },
        { t: 'select', c: 'font-weight', label: 'Weight', r: 1, opts: [['', 'Default'], ['300', 'Light 300'], ['400', 'Regular 400'], ['500', 'Medium 500'], ['600', 'Semibold 600'], ['700', 'Bold 700'], ['800', 'Extrabold 800'], ['900', 'Black 900']] },
        { t: 'unit', c: 'line-height', label: 'Line height', r: 1, units: U.line },
        { t: 'unit', c: 'letter-spacing', label: 'Letter spacing', r: 1, units: U.track },
        { t: 'opt', c: 'font-family', label: 'Font', og: fontGroups, ph: "'Family',sans-serif" },
        { t: 'select', c: 'text-transform', label: 'Transform', opts: [['', 'None'], ['uppercase', 'UPPERCASE'], ['lowercase', 'lowercase'], ['capitalize', 'Capitalize']] }
      ]
    }
  },

  text: {
    label: 'WYSIWYG', icon: 'text', level: 4, edit: 'rich', styleLabel: 'Typography & fill',
    caps: ['spacing', 'effects', 'typography', 'animation'],
    make: () => ({
      props: { html: '<p>Double-click to edit this block. A floating toolbar gives you <strong>bold</strong>, <em>italic</em>, links, lists and headings — everything exports as clean semantic HTML.</p>', ts: 'body' },
      css: { d: { 'text-align': 'left' }, t: {}, m: {} }
    }),
    controls: {
      content: [
        { t: 'rich', k: 'html', label: 'Rich text' },
        { t: 'tstyle', k: 'ts', label: 'Text style' },
        { t: 'pick', c: 'text-align', label: 'Alignment', r: 1, opts: [['left', 'alignL'], ['center', 'alignC'], ['right', 'alignR'], ['justify', 'alignJ']] }
      ],
      style: [
        { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: U.size },
        { t: 'color', c: 'color', label: 'Colour' },
        { t: 'unit', c: 'line-height', label: 'Line height', r: 1, units: U.line },
        { t: 'opt', c: 'font-family', label: 'Font', og: fontGroups, ph: "'Family',sans-serif" },
        { t: 'color', c: '--link', label: 'Link colour' }
      ]
    }
  },

  /* A quotation, as a quotation. Both testimonial patterns used to build this out of
     two WYSIWYG blocks holding `<p>&ldquo;…&rdquo;</p>`, so the most quotable thing on
     a marketing page exported as an anonymous paragraph with decorative curly braces
     in the text. A reader on a screen reader heard prose; a search engine saw prose.

     The shape follows the image widget's figure rule, for the same reason: an
     attribution is a caption, and a caption is what makes an element a `<figure>`.
     Unattributed, a bare `<blockquote>` says everything there is to say — wrapping it
     in a figure with an empty figcaption would say less, not more.

     The attribution is sized in rem rather than the em the image caption uses. A quote's
     own size lands on the figure and ranges from 16px in a card to 40px in a pull quote,
     so an em attribution rendered at 10px in the first and 25px in the second; an
     attribution should read the same wherever the quote appears. */
  quote: {
    label: 'Quote', icon: 'quote', level: 4, edit: 'text', styleLabel: 'Typography & fill',
    caps: ['spacing', 'decoration', 'effects', 'typography', 'animation'],
    make: () => ({
      props: {
        text: 'A sentence in their words that a prospect would recognise as their own problem, solved.',
        by: 'Name, Role at Company', source: '', ts: 'lead'
      },
      css: {
        d: {
          'font-size': '24px', 'line-height': '1.45', color: cvar('ink'),
          'max-width': '34ch', 'align-self': 'flex-start'
        },
        t: {}, m: { 'font-size': '20px' }
      }
    }),
    controls: {
      content: [
        { t: 'area', k: 'text', label: 'Quotation', rows: 3, mono: 0,
          note: 'No quotation marks — the style draws them.' },
        { t: 'text', k: 'by', label: 'Attribution', ph: 'Name, Role at Company',
          note: 'Empty exports a bare blockquote; named adds a caption.' },
        { t: 'text', k: 'source', label: 'Source URL', ph: 'https://…',
          note: 'Links the attribution, and records the source.' },
        { t: 'tstyle', k: 'ts', label: 'Text style' },
        { t: 'pick', c: 'align-self', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR']] }
      ],
      style: [
        { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: U.size },
        { t: 'color', c: 'color', label: 'Colour' },
        { t: 'unit', c: 'line-height', label: 'Line height', r: 1, units: U.line },
        { t: 'opt', c: 'font-family', label: 'Font', og: fontGroups, ph: "'Family',sans-serif" },
        /* ch first, and not U.len: the default measure is in ch, and a unit control
           whose list omits the stored unit falls back to its first entry — which would
           quietly rewrite 34ch as 34px the moment anyone touched the field. */
        { t: 'unit', c: 'max-width', label: 'Measure', r: 1, units: ['ch', 'px', 'rem', '%'],
          note: 'How wide the lines may run. 34ch reads well.' },
        { t: 'pick', c: 'text-align', label: 'Text alignment', r: 1, opts: [['left', 'alignL'], ['center', 'alignC'], ['right', 'alignR']] },
        { t: 'color', c: 'border-left-color', label: 'Rule colour' },
        { t: 'unit', c: 'border-left-width', label: 'Rule width', r: 1, units: U.border },
        { t: 'box', c: 'padding', label: 'Padding', r: 1 }
      ]
    }
  },

  image: {
    label: 'Image', icon: 'image', level: 4,
    caps: ['spacing', 'effects', 'animation'],
    make: () => ({
      /* alt starts empty on purpose. It used to default to the literal string
         'Descriptive alt text', which satisfied the review's alt check — so a
         hand-placed image exported meaningless alt text and nothing ever said so.
         The guidance belongs in the field's placeholder, which already carries it. */
      props: { src: '', alt: '', link: '', target: '', caption: '', lazy: 1, w: '', h: '', decorative: 0 },
      css: { d: { width: '100%', 'max-width': '100%', 'border-radius': '10px', 'object-fit': 'cover', 'align-self': 'flex-start' }, t: {}, m: {} }
    }),
    controls: {
      content: [
        { t: 'img', k: 'src', label: 'Image source' },
        { t: 'text', k: 'alt', label: 'Alt text', ph: 'Describe the image' },
        { t: 'toggle', k: 'decorative', label: 'Decorative — export an empty alt' },
        { t: 'dims', label: 'Intrinsic size', note: 'Stops the page shifting as it loads.' },
        { t: 'text', k: 'caption', label: 'Caption', ph: 'Optional' },
        { t: 'link', k: 'link', label: 'Link' },
        { t: 'pick', c: 'align-self', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR'], ['stretch', 'Fill']] },
        { t: 'toggle', k: 'lazy', label: 'Lazy load' }
      ],
      style: [
        { t: 'unit', c: 'width', label: 'Width', r: 1, units: U.len },
        { t: 'unit', c: 'height', label: 'Height', r: 1, units: U.len },
        { t: 'select', c: 'object-fit', label: 'Fit', opts: [['cover', 'Cover'], ['contain', 'Contain'], ['fill', 'Fill'], ['none', 'None']] },
        { t: 'unit', c: 'border-radius', label: 'Radius', r: 1, units: U.radius },
        { t: 'slider', c: 'opacity', label: 'Opacity', min: 0, max: 1, step: .01, raw: 1 },
        { t: 'opt', c: 'filter', label: 'Filter', opts: FILTERS, ph: 'grayscale(1) blur(2px)' }
      ]
    }
  },

  video: {
    label: 'Video', icon: 'video', level: 4,
    caps: ['spacing', 'effects', 'animation'],
    make: () => ({
      props: { src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', ratio: '16 / 9', autoplay: 0, loop: 0, muted: 1, controls: 1, poster: '', facade: 1 },
      css: { d: { width: '100%', 'border-radius': '10px', overflow: 'hidden' }, t: {}, m: {} }
    }),
    controls: {
      content: [
        { t: 'text', k: 'src', label: 'Video URL', ph: 'YouTube, Vimeo or .mp4' },
        { t: 'select', k: 'ratio', label: 'Aspect ratio', opts: [['16 / 9', '16:9'], ['4 / 3', '4:3'], ['1 / 1', '1:1'], ['21 / 9', '21:9'], ['9 / 16', '9:16 vertical']] },
        { t: 'img', k: 'poster', label: 'Poster image' },
        { t: 'toggle', k: 'facade', label: 'Load player on click' },
        { t: 'toggle', k: 'controls', label: 'Show controls' },
        { t: 'toggle', k: 'autoplay', label: 'Autoplay' },
        { t: 'toggle', k: 'muted', label: 'Muted' },
        { t: 'toggle', k: 'loop', label: 'Loop' }
      ],
      style: [
        { t: 'unit', c: 'width', label: 'Width', r: 1, units: U.len },
        { t: 'unit', c: 'border-radius', label: 'Radius', r: 1, units: U.radius }
      ]
    }
  },

  button: {
    label: 'Button', icon: 'button', level: 4, edit: 'text',
    caps: ['spacing', 'decoration', 'effects', 'typography', 'animation'],
    make: () => ({
      props: { text: 'Get started', link: '', target: '', variant: 'solid', icon: 'none', align: 'flex-start', wrap: 'inline-flex', ts: 'btn' },
      css: {
        d: {
          'padding-top': '13px', 'padding-right': '26px', 'padding-bottom': '13px', 'padding-left': '26px',
          'border-radius': '8px', 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'flex-start'
        }, t: {}, m: {}
      }
    }),
    controls: {
      content: [
        { t: 'text', k: 'text', label: 'Label' },
        { t: 'tstyle', k: 'ts', label: 'Text style' },
        { t: 'link', k: 'link', label: 'Link' },
        { t: 'select', k: 'variant', label: 'Variant', opts: [['solid', 'Solid'], ['outline', 'Outline'], ['ghost', 'Ghost'], ['link', 'Text link']] },
        { t: 'select', k: 'icon', label: 'Trailing icon', opts: [['none', 'None'], ['arrow', 'Arrow'], ['check', 'Check'], ['plus', 'Plus']] },
        { t: 'pick', c: 'align-self', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR'], ['stretch', 'Fill']] },
        {
          t: 'select', c: 'margin-top', label: 'Position in column', r: 1,
          opts: [['', 'In the normal flow'], ['auto', 'Push to column bottom']],
          note: 'Uses the column’s remaining height above this button.',
          when: n => !!locate(n.id)?.parent && locate(n.id)!.parent!.type === 'column'
        }
      ],
      style: [
        { t: 'color', c: 'background-color', label: 'Background' },
        { t: 'color', c: 'color', label: 'Text colour' },
        { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: U.space },
        { t: 'select', c: 'font-weight', label: 'Weight', opts: [['400', '400'], ['500', '500'], ['600', '600'], ['700', '700']] },
        { t: 'unit', c: 'border-radius', label: 'Radius', r: 1, units: U.radius },
        { t: 'unit', c: 'letter-spacing', label: 'Letter spacing', r: 1, units: U.track },
        { t: 'select', c: 'text-transform', label: 'Transform', opts: [['', 'None'], ['uppercase', 'UPPERCASE']] }
      ]
    }
  },

  nav: {
    label: 'Nav menu', icon: 'nav', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'typography', 'animation'],
    make: () => ({
      props: {
        /* All three point at the home page, and none of them used to resolve: `#work` and
           `#contact` are anchors nothing defines and `pricing.html` is a page a new project
           does not have, so dropping a Nav into a fresh site opened the review on three
           errors the author had not caused. Repeated destinations read as placeholders; a
           dead link reads as working markup. */
        items: [{ label: 'Work', href: HOME }, { label: 'About', href: HOME }, { label: 'Contact', href: HOME }],
        collapse: 'mobile', aria: 'Main'
      },
      css: {
        d: {
          'font-size': '15px', 'font-weight': '500', color: cvar('muted'), 'align-self': 'center',
          'justify-content': 'flex-end', width: '100%',
          '--nav-hover': cvar('ink'), '--nav-gap': '26px', '--nav-panel': cvar('bg')
        }, t: {}, m: {}
      }
    }),
    controls: {
      content: [
        { t: 'items', k: 'items', label: 'Menu links' },
        { t: 'select', k: 'collapse', label: 'Collapse to a burger', opts: [['mobile', 'On mobile (≤767px)'], ['tablet', 'On tablet and below (≤1024px)'], ['never', 'Never — always inline']] },
        { t: 'pick', c: 'justify-content', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR']] },
        { t: 'text', k: 'aria', label: 'Accessible name', ph: 'Main', note: 'Read by screen readers as “<name> menu”.' }
      ],
      style: [
        { t: 'unit', c: '--nav-gap', label: 'Link spacing', r: 1, units: U.space },
        { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: U.space },
        { t: 'select', c: 'font-weight', label: 'Weight', opts: [['400', '400'], ['500', '500'], ['600', '600'], ['700', '700']] },
        { t: 'color', c: 'color', label: 'Link colour' },
        { t: 'color', c: '--nav-hover', label: 'Hover colour' },
        { t: 'color', c: '--nav-panel', label: 'Burger panel background' },
        { t: 'unit', c: 'letter-spacing', label: 'Letter spacing', r: 1, units: U.track },
        { t: 'select', c: 'text-transform', label: 'Transform', opts: [['', 'None'], ['uppercase', 'UPPERCASE']] }
      ]
    }
  },

  form: {
    label: 'Form', icon: 'form', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'typography', 'animation'],
    make: () => ({
      props: {
        mode: 'external', action: '', method: 'post', submit: 'Send', aria: 'Contact form',
        fields: [
          { type: 'text', label: 'Name', name: 'name', required: 1, ph: '' },
          { type: 'email', label: 'Email', name: 'email', required: 1, ph: '' },
          { type: 'textarea', label: 'Message', name: 'message', required: 0, ph: '' }
        ]
      },
      css: {
        d: {
          width: '100%', '--f-gap': '16px', '--f-radius': '8px', '--f-pad': '11px 13px',
          '--f-bg': cvar('surface'), '--f-border': cvar('line'), '--f-text': cvar('text'),
          '--f-label': cvar('muted'), '--f-btn-bg': cvar('brand'), '--f-btn-fg': cvar('ink'),
          'font-size': '15px'
        }, t: {}, m: {}
      }
    }),
    controls: {
      content: [
        { t: 'fields', k: 'fields', label: 'Fields' },
        { t: 'text', k: 'submit', label: 'Submit button label' },
        { t: 'select', k: 'mode', label: 'Submission handling', opts: [['external', 'External HTTPS endpoint'], ['wordpress', 'WordPress managed']] },
        { t: 'text', k: 'action', label: 'Where submissions go', ph: 'https://formspree.io/f/…', note: 'Paste the complete https:// endpoint for the form service.', when: n => (n.props as PropBag).mode !== 'wordpress' },
        { t: 'select', k: 'method', label: 'Method', opts: [['post', 'POST'], ['get', 'GET']], when: n => (n.props as PropBag).mode !== 'wordpress' },
        { t: 'text', k: 'aria', label: 'Accessible name', ph: 'Contact form' }
      ],
      style: [
        { t: 'unit', c: '--f-gap', label: 'Field spacing', r: 1, units: U.space },
        { t: 'unit', c: 'font-size', label: 'Size', r: 1, units: U.size },
        { t: 'color', c: '--f-bg', label: 'Field background' },
        { t: 'color', c: '--f-border', label: 'Field border' },
        { t: 'color', c: '--f-text', label: 'Field text' },
        { t: 'color', c: '--f-label', label: 'Label colour' },
        { t: 'unit', c: '--f-radius', label: 'Field radius', r: 1, units: U.radius },
        { t: 'color', c: '--f-btn-bg', label: 'Button background' },
        { t: 'color', c: '--f-btn-fg', label: 'Button text' }
      ]
    }
  },

  spacer: {
    label: 'Spacer', icon: 'spacer', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: {}, css: { d: { height: '48px' }, t: {}, m: { height: '32px' } } }),
    controls: { content: [{ t: 'unit', c: 'height', label: 'Height', r: 1, units: U.len }], style: [] }
  },

  divider: {
    label: 'Divider', icon: 'divider', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: {}, css: { d: { 'border-top-width': '1px', 'border-top-style': 'solid', 'border-top-color': cvar('line'), width: '100%', 'margin-top': '20px', 'margin-bottom': '20px' }, t: {}, m: {} } }),
    controls: {
      content: [
        { t: 'unit', c: 'border-top-width', label: 'Thickness', r: 1, units: U.border },
        { t: 'select', c: 'border-top-style', label: 'Style', opts: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted']] },
        { t: 'color', c: 'border-top-color', label: 'Colour' },
        { t: 'unit', c: 'width', label: 'Width', r: 1, units: U.len }
      ], style: []
    }
  },

  /* Native `<details>`, so an accordion needs no JavaScript at all and arrives
     keyboard-operable and screen-reader-announced for free. `single` sets the
     shared `name` attribute, which is what makes one-open-at-a-time native too;
     where a browser has not caught up the panels stay independent, which is a
     lesser accordion rather than a broken one. */
  /* Panels one at a time. The accordion's shape, with one difference that decides everything
     else: an accordion works without JavaScript because `<details>` does, and tabs do not. So
     the markup renders every panel visible and the script hides all but one — a reader with no
     script gets the whole content stacked, which is the honest failure. Hiding them in CSS and
     revealing with script fails the other way, into a page with the content missing. */
  crumbs: {
    label: 'Breadcrumb', icon: 'crumbs', level: 4,
    caps: ['spacing', 'effects', 'typography', 'animation'],
    make: () => ({
      props: { mode: 'auto', home: 'Home', sep: 'chevron' },
      css: {
        d: {
          '--cb-size': '13px', '--cb-color': cvar('muted'), '--cb-current': cvar('text'),
          '--cb-gap': '8px', '--cb-weight': '500'
        }, t: {}, m: {}
      }
    }),
    controls: {
      content: [
        { t: 'pick', k: 'mode', label: 'Trail', set: 1, r: 0,
          opts: [['auto', 'From the page'], ['manual', 'Written here']] },
        { t: 'text', k: 'home', label: 'Front page is called', ph: 'Home',
          when: n => (n.props as PropBag).mode !== 'manual' },
        { t: 'items', k: 'items', label: 'Crumbs', when: n => (n.props as PropBag).mode === 'manual' },
        { t: 'select', k: 'sep', label: 'Separator', set: 1,
          opts: [['chevron', '\u203a'], ['slash', '/'], ['dot', '\u00b7'], ['dash', '\u2014']] }
      ],
      style: [
        { t: 'unit', c: '--cb-size', label: 'Text size', r: 1, units: U.size },
        { t: 'color', c: '--cb-color', label: 'Link colour' },
        { t: 'color', c: '--cb-current', label: 'Current page colour' },
        { t: 'unit', c: '--cb-gap', label: 'Spacing', r: 1, units: U.space }
      ]
    }
  },
  code: {
    label: 'Code', icon: 'codeblock', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: {
        body: 'const site = build({\n  pages: 12,\n  scripts: 0   // nothing to run\n});',
        lang: 'js', numbers: 0, softwrap: 0, copy: 1
      },
      css: {
        d: {
          width: '100%', '--cd-bg': cvar('bg'), '--cd-text': cvar('text'),
          '--cd-size': '14px', '--cd-pad': '16px 18px', '--cd-radius': '10px',
          '--cd-line': cvar('line'), '--cd-com': cvar('muted'),
          '--cd-str': '#2f6f5e', '--cd-kw': '#8a4b2a', '--cd-num': '#3a5a9a', '--cd-key': '#5b4a8a'
        }, t: {}, m: { '--cd-size': '13px', '--cd-pad': '12px 13px' }
      }
    }),
    controls: {
      content: [
        { t: 'area', k: 'body', label: 'Code', rows: 9, mono: 1, ph: 'const x = 1;' },
        { t: 'select', k: 'lang', label: 'Language', set: 1,
          opts: () => Object.keys(CODE_LANGS).map(k => [k, CODE_LANGS[k].label]) },
        { t: 'text', k: 'title', label: 'File name', ph: 'index.js' },
        { t: 'toggle', k: 'numbers', label: 'Number the lines' },
        { t: 'toggle', k: 'softwrap', label: 'Wrap long lines' },
        { t: 'toggle', k: 'copy', label: 'Copy button',
          note: 'Hidden unless the browser can copy, so it is never a button that does nothing' }
      ],
      style: [
        { t: 'color', c: '--cd-bg', label: 'Background' },
        { t: 'color', c: '--cd-text', label: 'Text colour' },
        { t: 'unit', c: '--cd-size', label: 'Text size', r: 1, units: U.size },
        { t: 'unit', c: '--cd-pad', label: 'Padding', r: 1, units: U.space },
        { t: 'unit', c: '--cd-radius', label: 'Radius', r: 1, units: U.radius },
        { t: 'color', c: '--cd-com', label: 'Comments', when: n => (n.props as PropBag).lang !== 'text' },
        { t: 'color', c: '--cd-str', label: 'Strings', when: n => (n.props as PropBag).lang !== 'text' },
        { t: 'color', c: '--cd-kw', label: 'Keywords', when: n => (n.props as PropBag).lang !== 'text' },
        { t: 'color', c: '--cd-num', label: 'Numbers', when: n => (n.props as PropBag).lang !== 'text' },
        { t: 'color', c: '--cd-key', label: 'Names', when: n => (n.props as PropBag).lang !== 'text' }
      ]
    }
  },
  table: {
    label: 'Table', icon: 'table', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: {
        body: 'Plan|Monthly|Seats\nStarter|£9|1\nStudio|£29|5\nHouse|£79|20',
        head: 1, rules: 'rows', zebra: 0
      },
      css: {
        d: {
          width: '100%', '--tbl-size': '15px', '--tbl-pad': '10px 12px',
          '--tbl-line': cvar('line'), '--tbl-text': cvar('text'),
          '--tbl-head-bg': 'transparent', '--tbl-head-text': cvar('ink'),
          '--tbl-head-weight': '600', '--tbl-zebra': cvar('bg'),
          '--tbl-caption-size': '13px', '--tbl-caption-color': cvar('muted')
        }, t: {}, m: { '--tbl-size': '14px', '--tbl-pad': '8px 10px' }
      }
    }),
    controls: {
      content: [
        {
          t: 'area', k: 'body', label: 'Rows', rows: 7, mono: 1,
          ph: 'Plan|Monthly|Seats\nStarter|£9|1',
          note: 'One row per line. Paste from a spreadsheet, or separate cells with |'
        },
        { t: 'text', k: 'caption', label: 'Caption', ph: 'What this table shows' },
        { t: 'toggle', k: 'head', label: 'First row is a heading' },
        { t: 'toggle', k: 'rowhead', label: 'First column is a heading' },
        { t: 'select', k: 'rules', label: 'Lines', set: 1,
          opts: [['rows', 'Between rows'], ['all', 'Full grid'], ['none', 'None']] },
        { t: 'toggle', k: 'zebra', label: 'Shade alternate rows' }
      ],
      style: [
        { t: 'unit', c: '--tbl-size', label: 'Text size', r: 1, units: U.size },
        { t: 'color', c: '--tbl-text', label: 'Text colour' },
        { t: 'unit', c: '--tbl-pad', label: 'Cell padding', r: 1, units: U.space },
        { t: 'color', c: '--tbl-line', label: 'Line colour' },
        { t: 'color', c: '--tbl-head-bg', label: 'Heading background' },
        { t: 'color', c: '--tbl-head-text', label: 'Heading colour' },
        { t: 'color', c: '--tbl-zebra', label: 'Shading', when: n => !!(n.props as PropBag).zebra },
        { t: 'color', c: '--tbl-caption-color', label: 'Caption colour', when: n => !!String((n.props as PropBag).caption || '').trim() }
      ]
    }
  },
  tabs: {
    label: 'Tabs', icon: 'tabs', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: {
        items: [
          { label: 'Overview', panel: 'What this is, in a sentence or two.' },
          { label: 'Details', panel: 'The part someone came looking for.' },
          { label: 'Pricing', panel: 'The number, plainly.' }
        ]
      },
      css: {
        d: {
          width: '100%', '--tb-align': 'flex-start', '--tb-line': cvar('line'), '--tb-on': cvar('ink'),
          '--tb-off': cvar('muted'), '--tb-size': '15px', '--tb-weight': '500',
          '--tb-pad': '10px 2px', '--tb-gap': '22px',
          '--tb-body-size': '16px', '--tb-body-color': cvar('text'), '--tb-body-pad': '20px'
        }, t: {}, m: { '--tb-gap': '16px', '--tb-size': '14px' }
      }
    }),
    controls: {
      content: [
        {
          t: 'qa', k: 'items', label: 'Tabs',
          rowKeys: ['label', 'panel'], rowPhs: ['Tab label', 'What this tab says'],
          rowNew: ['New tab', ''], addLabel: 'Add tab'
        },
        { t: 'pick', c: '--tb-align', label: 'Tabs sit', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR']] }
      ],
      style: [
        { t: 'color', c: '--tb-on', label: 'Selected label' },
        { t: 'color', c: '--tb-off', label: 'Other labels' },
        { t: 'color', c: '--tb-line', label: 'Rule' },
        { t: 'unit', c: '--tb-size', label: 'Label size', r: 1, units: U.size },
        { t: 'unit', c: '--tb-gap', label: 'Label spacing', r: 1, units: U.space },
        { t: 'unit', c: '--tb-body-size', label: 'Body size', r: 1, units: U.size },
        { t: 'color', c: '--tb-body-color', label: 'Body colour' },
        { t: 'unit', c: '--tb-body-pad', label: 'Body padding', r: 1, units: U.space }
      ]
    }
  },

  accordion: {
    label: 'Accordion', icon: 'accordion', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: {
        items: [
          { q: 'What do I get?', a: 'One paragraph that answers the question plainly.' },
          { q: 'How long does it take?', a: 'Say the real number. A range is fine; a dodge is not.' },
          { q: 'What does it cost?', a: 'The answer people scrolled this far to find.' }
        ],
        open: 'first', single: 0, marker: 'plus'
      },
      css: {
        d: {
          width: '100%', '--ac-line': cvar('line'), '--ac-pad': '18px', '--ac-gap': '0px',
          '--ac-q-size': '17px', '--ac-q-weight': '600', '--ac-q-color': cvar('ink'),
          '--ac-a-size': '16px', '--ac-a-color': cvar('muted'), '--ac-mark': cvar('slate'),
          '--ac-radius': '0px'
        }, t: {}, m: { '--ac-pad': '15px', '--ac-q-size': '16px' }
      }
    }),
    controls: {
      content: [
        { t: 'qa', k: 'items', label: 'Questions', rowNew: ['A new question', ''] },
        { t: 'select', k: 'open', label: 'Open on load', opts: [['none', 'All closed'], ['first', 'The first one'], ['all', 'All open']] },
        { t: 'toggle', k: 'single', label: 'One open at a time' },
        { t: 'select', k: 'marker', label: 'Marker', opts: [['plus', 'Plus / minus'], ['caret', 'Caret'], ['none', 'None']] }
      ],
      style: [
        { t: 'color', c: '--ac-line', label: 'Divider colour' },
        { t: 'unit', c: '--ac-pad', label: 'Row padding', r: 1, units: U.space },
        { t: 'unit', c: '--ac-gap', label: 'Gap between rows', r: 1, units: U.space },
        { t: 'unit', c: '--ac-q-size', label: 'Question size', r: 1, units: U.size },
        { t: 'select', c: '--ac-q-weight', label: 'Question weight', opts: [['400', '400'], ['500', '500'], ['600', '600'], ['700', '700']] },
        { t: 'color', c: '--ac-q-color', label: 'Question colour' },
        { t: 'unit', c: '--ac-a-size', label: 'Answer size', r: 1, units: U.size },
        { t: 'color', c: '--ac-a-color', label: 'Answer colour' },
        { t: 'color', c: '--ac-mark', label: 'Marker colour' },
        { t: 'unit', c: '--ac-radius', label: 'Row radius', r: 1, units: U.radius }
      ]
    }
  },

  /* The escape hatch. Everything else in this builder is a described shape it
     knows how to style; this one is markup it agrees not to understand — a map,
     a booking widget, a payment button, an SVG the icon set does not carry. */
  embed: {
    label: 'Embed', icon: 'code', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({ props: { html: '', ratio: '' }, css: { d: { width: '100%' }, t: {}, m: {} } }),
    controls: {
      content: [
        {
          t: 'area', k: 'html', label: 'HTML', rows: 8, mono: 1, ph: '<iframe src="…" …></iframe>',
          note: 'Runs on the exported site, not in this canvas.'
        },
        {
          t: 'select', k: 'ratio', label: 'Aspect ratio',
          opts: [['', 'Whatever the markup is'], ['16 / 9', '16:9'], ['4 / 3', '4:3'], ['1 / 1', '1:1'], ['21 / 9', '21:9'], ['9 / 16', '9:16 vertical']],
          note: 'Pick one for an iframe with no height of its own.'
        }
      ],
      style: []
    }
  },

  /* Stroke-only glyphs on `currentColor`, sized by one variable, so an icon
     inherits colour the way text does and scales with a single control. */
  icon: {
    label: 'Icon', icon: 'icon', level: 4,
    caps: ['spacing', 'effects', 'animation'],
    make: () => ({
      props: { name: 'check', label: '', link: '', target: '' },
      css: {
        d: { '--icon-size': '30px', '--icon-stroke': '1.75', color: cvar('ink'), 'align-self': 'flex-start' },
        t: {}, m: {}
      }
    }),
    controls: {
      content: [
        { t: 'icon', k: 'name', label: 'Icon' },
        {
          t: 'text', k: 'label', label: 'Accessible label', ph: 'Leave empty if decorative',
          note: 'Empty is hidden from screen readers.'
        },
        { t: 'link', k: 'link', label: 'Link' },
        { t: 'pick', c: 'align-self', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR']] }
      ],
      style: [
        { t: 'unit', c: '--icon-size', label: 'Glyph size', r: 1, units: U.size },
        { t: 'color', c: 'color', label: 'Colour' },
        { t: 'slider', c: '--icon-stroke', label: 'Stroke weight', min: 1, max: 3, step: .05, raw: 1 },
        { t: 'color', c: 'background-color', label: 'Badge background' },
        { t: 'box', c: 'padding', label: 'Badge padding', r: 1 },
        { t: 'unit', c: 'border-radius', label: 'Badge radius', r: 1, units: U.radius }
      ]
    }
  },

  /* A grid of stored images. With the lightbox on, each tile is a real link to
     the full image — so it works with JavaScript off, and the script that ships
     only intercepts a click that would already have gone somewhere useful. */
  gallery: {
    label: 'Gallery', icon: 'gallery', level: 4,
    caps: ['spacing', 'decoration', 'effects', 'animation'],
    make: () => ({
      props: { items: [], ratio: '4 / 3', fit: 'cover', lightbox: 1, lazy: 1, captions: 0 },
      css: {
        d: { width: '100%', '--g-cols': '3', '--g-gap': '12px', '--g-radius': '10px' },
        t: {}, m: { '--g-cols': '2', '--g-gap': '8px' }
      }
    }),
    controls: {
      content: [
        { t: 'imgs', k: 'items', label: 'Images' },
        { t: 'unit', c: '--g-cols', label: 'Columns', r: 1, units: [''], note: 'Responsive — set fewer on Tablet and Mobile.' },
        { t: 'select', k: 'ratio', label: 'Tile shape', opts: [['4 / 3', '4:3'], ['1 / 1', 'Square'], ['3 / 2', '3:2'], ['16 / 9', '16:9'], ['3 / 4', '3:4 portrait'], ['', 'Whatever each image is']] },
        { t: 'select', k: 'fit', label: 'Fit', opts: [['cover', 'Cover — fill and crop'], ['contain', 'Contain — fit inside']] },
        { t: 'toggle', k: 'lightbox', label: 'Open full size on click' },
        { t: 'toggle', k: 'captions', label: 'Show captions under each tile' },
        { t: 'toggle', k: 'lazy', label: 'Lazy load' }
      ],
      style: [
        { t: 'unit', c: '--g-gap', label: 'Gap', r: 1, units: U.space },
        { t: 'unit', c: '--g-radius', label: 'Tile radius', r: 1, units: U.radius }
      ]
    }
  }
};

/* style controls shared by every element */
/* Annotated rather than inferred: without it every `t` widens to `string`, so the
   inspector could not tell these apart from any other object and a typo in a kind name
   would reach the panel as a silently blank field. */
/* -------------------------------------------------------------- breadcrumbs

   Derived, not typed. A trail you write by hand is a nav menu with a different
   separator; the point of the widget is that it knows where the page sits.

   The last crumb carries no href, because a link to the page you are already on is a
   link that does nothing — it is marked `aria-current="page"` instead. */

/** The page that lists a collection: the first ordinary page holding a Collection List
    bound to it. That is the page a reader would expect the item's parent crumb to reach,
    and nothing else in the project claims to be a collection's index. */
function collectionIndex(colId: string): Page | null {
  for (const pg of state.pages) {
    if (pg.collection) continue;
    let hit = false;
    eachNode(pg.tree, n => { if (n.type === 'list' && n.src === colId) hit = true; });
    if (hit) return pg;
  }
  return null;
}

function crumbTrail(
  pg: Page | null | undefined,
  o: { col?: Collection | null; item?: Item | null; pageNo?: number } = {},
  home = 'Home'
): { label: string; href: string }[] {
  if (!pg) return [];
  const front = state.pages.find(isFront) || null;
  const out: { label: string; href: string }[] = [];
  if (front && !isFront(pg)) out.push({ label: home || front.name, href: FRONT + '.html' });

  /* a detail page: the collection's index sits between the front page and the item */
  if (o.col && o.item) {
    const idx = collectionIndex(o.col.id);
    if (idx) out.push({ label: idx.name, href: idx.slug + '.html' });
    out.push({ label: itemTitle(o.col, o.item) || o.item.slug, href: '' });
    return out;
  }

  /* a later slice of a paginated list: the page itself becomes a link back to slice one */
  const no = o.pageNo || 1;
  if (no > 1) {
    out.push({ label: pg.name, href: pg.slug + '.html' });
    out.push({ label: `Page ${no}`, href: '' });
    return out;
  }

  if (!isFront(pg)) out.push({ label: pg.name, href: '' });
  else out.push({ label: home || pg.name, href: '' });
  return out;
}

/** Does anything in these trees show a breadcrumb? The BreadcrumbList in the page's
    structured data has to describe a trail the page actually displays — claiming one that
    is not there is the kind of mismatch a search engine is entitled to distrust. */
function crumbsShown(lists: PcNode[][]): boolean {
  let hit = false;
  lists.forEach(l => eachNode(l, n => { if (n.type === 'crumbs' && (n.props as PropBag).mode !== 'manual') hit = true; }));
  return hit;
}

/* ------------------------------------------------------------- code blocks

   Highlighting happens here, while you edit, and ships as spans.

   Every other way of colouring code is a script the reader downloads and runs before
   the code they came for looks like code. This project's output has nothing to install
   and nothing to run, so the tokens are found in the builder and the page gets its
   colour from CSS alone.

   It is a lexer, not a parser: comments, strings, numbers, a keyword list, a word
   before a colon, a word before a bracket. It will colour a variable named `class` as a
   keyword, it does not know a type from a value, and a bare `https://x` outside a
   string reads as a line comment. That is the deal a 90-line highlighter strikes.

   What it must never do is lose a character, which is why `codeSpans` is tested for
   exactly that: strip the tags it adds and you get the input back, escaped. A
   highlighter that eats a bracket is worse than no highlighter.

   Tokens also never straddle a newline — a token carrying one is emitted as a span per
   line. That is what makes numbering the lines a safe split on `\n` afterwards. */
const CODE_LANGS: Record<string, {
  label: string; line?: string; block?: [string, string];
  words?: string; keys?: 1; calls?: 1; markup?: 1;
}> = {
  text: { label: 'Plain text' },
  html: { label: 'HTML', markup: 1 },
  css: { label: 'CSS', block: ['/*', '*/'], keys: 1, calls: 1 },
  js: {
    label: 'JavaScript', line: '//', block: ['/*', '*/'], calls: 1,
    words: 'const let var function return if else for while of in new class extends super import export from default await async try catch finally throw typeof instanceof delete void yield switch case break continue do this null undefined true false'
  },
  ts: {
    label: 'TypeScript', line: '//', block: ['/*', '*/'], calls: 1,
    words: 'const let var function return if else for while of in new class extends super import export from default await async try catch finally throw typeof instanceof delete void yield switch case break continue do this null undefined true false interface type enum implements readonly public private protected as satisfies keyof namespace declare'
  },
  json: { label: 'JSON', keys: 1, words: 'true false null' },
  sh: {
    label: 'Shell', line: '#',
    words: 'if then elif else fi for in do done while until case esac function return export local readonly cd echo printf set unset source exit sudo'
  },
  py: {
    label: 'Python', line: '#', calls: 1,
    words: 'def class return if elif else for while in not and or is None True False import from as with try except finally raise lambda yield pass break continue global nonlocal assert del await async match'
  }
};

/** One span per line for a token, so nothing straddles a newline. */
function codeTok(cls: string, text: string): string {
  return text.split('\n').map(part => part === '' ? '' : `<span class="pc-c-${cls}">${esc(part)}</span>`).join('\n');
}

/** A tag: the name, then attribute names and their quoted values. A bare attribute with
    no `=` falls through as plain text, which is the right way for it to fail. */
function codeTag(t: string): string {
  const m = /^(<\/?)([A-Za-z][\w:-]*)([\s\S]*?)(\/?>)$/.exec(t);
  if (!m) return esc(t);
  const body = m[3];
  let inner = '', last = 0, a: RegExpExecArray | null;
  const re = /([A-Za-z_:][\w:.-]*)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;
  while ((a = re.exec(body))) {
    if (a.index > last) inner += esc(body.slice(last, a.index));
    inner += codeTok('key', a[1]) + esc(a[2] || '');
    if (a[3]) inner += codeTok('str', a[3]);
    last = a.index + a[0].length;
  }
  return esc(m[1]) + codeTok('kw', m[2]) + inner + esc(body.slice(last)) + esc(m[4]);
}

function codeMarkup(src: string): string {
  const out: string[] = [];
  /* The comment delimiters are written \x2D rather than `-` on purpose. A literal `<!--`
     anywhere inside a <script> element puts the HTML tokenizer into its escaped state, and
     a later `<script` — this file has several, in the scripts it emits — puts it into the
     double-escaped one, where `</script>` stops closing the element. The whole rest of the
     document then parses as script text. The boot test caught exactly that. */
  const re = /<!\x2D\x2D[\s\S]*?\x2D\x2D>|<![A-Za-z][^>]*>|<\/?[A-Za-z][\w:-]*(?:"[^"]*"|'[^']*'|[^>"'])*\/?>/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(esc(src.slice(last, m.index)));
    const t = m[0];
    out.push(t.startsWith('<!\x2D') ? codeTok('com', t) : t.startsWith('<!') ? codeTok('kw', t) : codeTag(t));
    last = m.index + t.length;
  }
  out.push(esc(src.slice(last)));
  return out.join('');
}

function codeSpans(src: unknown, lang?: string): string {
  const text = String(src == null ? '' : src).replace(/\r/g, '');
  const L = CODE_LANGS[String(lang || 'text')] || CODE_LANGS.text;
  if (L.markup) return codeMarkup(text);
  if (!L.line && !L.block && !L.words && !L.keys) return esc(text);
  const kw = new Set((L.words || '').split(/\s+/).filter(Boolean));
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (L.block && rest.startsWith(L.block[0])) {
      const end = text.indexOf(L.block[1], i + L.block[0].length);
      const stop = end < 0 ? text.length : end + L.block[1].length;
      out.push(codeTok('com', text.slice(i, stop))); i = stop; continue;
    }
    if (L.line && rest.startsWith(L.line)) {
      const nl = text.indexOf('\n', i);
      const stop = nl < 0 ? text.length : nl;
      out.push(codeTok('com', text.slice(i, stop))); i = stop; continue;
    }
    const q = rest[0];
    if (q === '"' || q === "'" || q === '`') {
      let j = i + 1;
      while (j < text.length) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === q) { j++; break; }
        j++;
      }
      const stop = Math.min(j, text.length);
      /* A JSON key is a string until you look at what follows it. Same rule as the bare
         word before a colon, just quoted — which is the only shape JSON has. */
      const isKey = L.keys && /^\s*:/.test(text.slice(stop));
      out.push(codeTok(isKey ? 'key' : 'str', text.slice(i, stop))); i = stop; continue;
    }
    const num = /^\d[\w.]*/.exec(rest);
    if (num) { out.push(codeTok('num', num[0])); i += num[0].length; continue; }
    const word = /^[A-Za-z_$@][\w$-]*/.exec(rest);
    if (word) {
      const w = word[0], after = rest.slice(w.length);
      if (kw.has(w)) out.push(codeTok('kw', w));
      else if (L.keys && /^\s*:/.test(after)) out.push(codeTok('key', w));
      else if (L.calls && /^\s*\(/.test(after)) out.push(codeTok('fn', w));
      else out.push(esc(w));
      i += w.length; continue;
    }
    /* everything else in one bite, stopping before anything that starts a token */
    const run = /^[^\w$@'"`]+/.exec(rest);
    let take = run ? run[0] : rest[0];
    if (run && L.block) { const c = take.indexOf(L.block[0]); if (c > 0) take = take.slice(0, c); }
    if (run && L.line) { const c = take.indexOf(L.line); if (c > 0) take = take.slice(0, c); }
    out.push(esc(take)); i += take.length;
  }
  return out.join('');
}

/** The copy button is rendered hidden and the script reveals it: a button that cannot
    copy is worse than no button, and a reader with no JavaScript should not see one. */
/* The arrows and pagination dots arrive hidden so a reader without JavaScript never sees
   controls that cannot work — swiping and scrolling still do.
   A scroll of 90% of the visible width leaves a sliver of the old view on screen, which
   is what tells you the strip moved rather than jumped. */
const SLIDE_JS = `<script>
(function(){var rm=matchMedia('(prefers-reduced-motion: reduce)');
Array.prototype.forEach.call(document.querySelectorAll('[data-slider]'),function(box){
var t=box.querySelector('[data-slides]'),p=box.querySelector('[data-slide-p]'),n=box.querySelector('[data-slide-n]'),d=box.querySelector('[data-slide-dots]');
if(!t||!p||!n||!d)return;p.removeAttribute('hidden');n.removeAttribute('hidden');d.removeAttribute('hidden');
function go(d){t.scrollBy({left:d*t.clientWidth*0.9,behavior:rm.matches?'auto':'smooth'});}
p.addEventListener('click',function(){go(-1);});n.addEventListener('click',function(){go(1);});
var slides=[].slice.call(t.children),targets=[],dots=[];
function positions(){var max=Math.max(0,t.scrollWidth-t.clientWidth),next=[];
slides.forEach(function(slide){var target=Math.min(max,Math.max(0,slide.offsetLeft-t.offsetLeft));
if(!next.some(function(value){return Math.abs(value-target)<3;}))next.push(target);});return next;}
function active(){if(!targets.length)return;var current=0,distance=Infinity;
targets.forEach(function(target,index){var delta=Math.abs(t.scrollLeft-target);if(delta<distance){distance=delta;current=index;}});
dots.forEach(function(dot,index){if(index===current)dot.setAttribute('aria-current','true');else dot.removeAttribute('aria-current');});}
function rebuild(){targets=positions();d.replaceChildren();dots=targets.map(function(target,index){
var dot=document.createElement('button');function seek(){t.scrollTo({left:target,behavior:rm.matches?'auto':'smooth'});}
dot.type='button';dot.className='pagecraft-slider-dot';dot.setAttribute('aria-label','Go to carousel position '+(index+1)+' of '+targets.length);
if(t.id)dot.setAttribute('aria-controls',t.id);dot.addEventListener('click',seek);dot.addEventListener('keydown',function(event){
if(event.key!=='Enter'&&event.key!==' ')return;event.preventDefault();seek();});d.appendChild(dot);return dot;});active();}
function update(){var max=t.scrollWidth-t.clientWidth-2;p.disabled=t.scrollLeft<=2;n.disabled=t.scrollLeft>=max;active();}
var queued=false;t.addEventListener('scroll',function(){if(queued)return;queued=true;requestAnimationFrame(function(){queued=false;update();});},{passive:true});
addEventListener('resize',function(){rebuild();update();});addEventListener('load',function(){rebuild();update();},{once:true});rebuild();update();});})();
<\/script>
`;

const CODE_JS = `<script>
(function(){var c=navigator.clipboard;if(!c)return;
Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'),function(b){
var box=b.closest('.pagecraft-code');if(!box)return;var pre=box.querySelector('code');if(!pre)return;
b.removeAttribute('hidden');
b.addEventListener('click',function(){var was=b.textContent;
function say(t){b.textContent=t;b.disabled=true;
setTimeout(function(){b.textContent=was;b.disabled=false;},1400);}
c.writeText(pre.textContent||'').then(function(){say('Copied');},function(){
/* refused — a sandboxed frame, no permission. Select it so the reader can copy it. */
try{var r=document.createRange();r.selectNodeContents(pre);var sel=getSelection();
sel.removeAllRanges();sel.addRange(r);say('Selected');}catch(e){say('Press \u2318C');}});});});})();
<\/script>
`;

/** A table body as a grid of cells.

    Tabular data arrives by paste, and a spreadsheet pastes tab-separated — so tabs win
    when the body has any. Otherwise the separator is `|`, which is what a person types
    by hand. Never a comma: prose is full of them, and splitting on one would cut a
    sentence in half. The choice is made once for the whole body rather than per line,
    so a table cannot split two ways down its own height.

    Rows are padded to the widest one. A short row would otherwise leave the grid a cell
    short and the rest of that row would slide left under the wrong headings; `lint`
    reports the ragged row so the author knows why an empty cell appeared. */
function tableGrid(body: unknown): string[][] {
  const text = String(body == null ? '' : body).replace(/\r/g, '');
  const lines = text.split('\n').filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const sep = text.includes('\t') ? '\t' : '|';
  const rows = lines.map(l => l.split(sep).map(c => c.trim()));
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map(r => r.concat(Array(w - r.length).fill('')));
}

/* ------------------------------------------------------- which controls apply

   COMMON_STYLE is offered on every widget, which is how a heading came to carry the
   same five background controls a section does. Two kinds of rule narrow it, and
   `when` on the control is where both live.

   Relevance — a background image belongs on the thing other things sit on, not on the
   ones that are the content. Behind an image, a video or a glyph it sits behind an
   opaque thing; behind a run of text it belongs on the box around the text, which is
   the column that text is already in.

   Dependency — where a background sits, whether it repeats and how it is sized say
   nothing until there is one. A border's width and colour say nothing until it has a
   style, because CSS defaults `border-style` to `none`: a width on its own renders
   exactly nothing and gives no hint why. So the style comes first in the group now,
   and the other two follow it.

   Both hide a control, never a capability. The Advanced tab still takes any
   declaration by hand, and a class can carry whatever it likes. */

/** The first declared value for `prop` on the thing being styled — any breakpoint, any
    state, then any class the node wears. Deliberately broad: a background set on
    desktop still needs its position editable while the mobile breakpoint is showing,
    and a border that only appears on hover still needs a width to appear with. */
function styleSeen(n: PcNode, prop: string): string {
  const bags: (Decls | undefined)[] = [];
  const push = (o?: { css?: Css; st?: States }) => {
    if (!o) return;
    (['d', 't', 'm'] as Bp[]).forEach(b => bags.push(o.css && o.css[b]));
    const st = o.st || {};
    (Object.keys(st) as StateKey[]).forEach(k =>
      (['d', 't', 'm'] as Bp[]).forEach(b => bags.push(st[k] && st[k]![b])));
  };
  push(tgtObj(n) as { css?: Css; st?: States });
  nodeClasses(n).forEach(c => push(c as { css?: Css; st?: States }));
  for (const bag of bags) if (bag && bag[prop]) return String(bag[prop]);
  return '';
}

/** Does this widget have this capability? The registry answers, and it is the only answer.

    This replaced `CONTENT_TYPES`, a list of nine names with a backdrop for everything not on
    it. The list worked and was the wrong shape: an exclusion list grants by default, so the
    next widget got a background image by not having been considered. `caps` on each widget
    grants by declaration instead, and `every widget declares caps` is a test. */
const canDo = (n: PcNode, cap: Capability) => (DEF[n.type].caps || []).includes(cap);

/** A gradient counts: it is a background image as far as size and position are concerned. */
const hasBackdrop = (n: PcNode) => !!(styleSeen(n, 'background-image') || styleSeen(n, 'background'));
const hasBorder = (n: PcNode) => { const v = styleSeen(n, 'border-style'); return !!v && v !== 'none'; };

/** Is this column an ordinary one rather than a slide? A slider sizes its children itself,
    so the controls that would compete with it are not offered inside one.

    A declaration rather than a const: `DEF` is built above this line and reads it, and a
    const would still be in its temporal dead zone there. */
function notASlide(n: PcNode): boolean {
  const pid = parentOf(n.id);
  const h = pid ? locate(pid) : null;
  return !h || h.node.type !== 'slider';
}

const COMMON_STYLE: { g: string; cap: Capability; items: Control[] }[] = [
  { g: 'Spacing', cap: 'spacing', items: [{ t: 'box', c: 'padding', label: 'Padding', r: 1 }, { t: 'box', c: 'margin', label: 'Margin', r: 1, neg: 1 }] },
  {
    g: 'Background', cap: 'decoration', items: [
      { t: 'color', c: 'background-color', label: 'Colour' },
      { t: 'img', c: 'background-image', label: 'Image', bg: 1 },
      { t: 'select', c: 'background-size', label: 'Size', when: hasBackdrop, opts: [['cover', 'Cover'], ['contain', 'Contain'], ['auto', 'Auto']] },
      /* A pick, not a select: where an image sits is a spatial choice, and five words in a
         dropdown make you read to find the one you could have pointed at. The glyphs are the
         alignment ones already in the set, which is what the same question looks like
         everywhere else in this panel. */
      { t: 'pick', c: 'background-position', label: 'Position', when: hasBackdrop, opts: [['left center', 'alignL'], ['center center', 'alignC'], ['right center', 'alignR'], ['top center', 'vTop'], ['bottom center', 'vBot']] },
      { t: 'select', c: 'background-repeat', label: 'Repeat', when: hasBackdrop, opts: [['no-repeat', 'No repeat'], ['repeat', 'Repeat']] },
      { t: 'text', c: 'background', label: 'Gradient / shorthand', ph: 'linear-gradient(...)' }
    ]
  },
  {
    g: 'Border & shadow', cap: 'decoration', items: [
      { t: 'select', c: 'border-style', label: 'Border style', opts: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['none', 'None']] },
      { t: 'unit', c: 'border-width', label: 'Border width', units: U.border, when: hasBorder },
      { t: 'color', c: 'border-color', label: 'Border colour', when: hasBorder },
      { t: 'unit', c: 'border-radius', label: 'Radius', r: 1, units: U.radius },
      { t: 'opt', c: 'box-shadow', label: 'Shadow', opts: SHADOWS, ph: '0 20px 40px -12px rgba(17,19,17,.2)' }
    ]
  },
  {
    /* Opacity and Transform are how a thing looks, which is what this group is for — and both
       are what a hover usually changes. Transition moved to Motion: its only job is to animate
       a change, so it belongs with the other motion rather than beside the properties it
       happens to animate. */
    g: 'Effects', cap: 'effects', items: [
      { t: 'slider', c: 'opacity', label: 'Opacity', min: 0, max: 1, step: .01, raw: 1 },
      { t: 'text', c: 'transform', label: 'Transform', ph: 'translateY(-4px) rotate(2deg)' }
    ]
  }
];

/* ================================================================ model */
const N = (type: string, props: any = {}, css: any = {}, children: any[] = []): PcNode => {
  const base = DEF[type].make();
  return {
    id: uid(), type: type as any,
    props: { ...base.props, ...props },
    css: { d: { ...base.css.d, ...(css.d || {}) }, t: { ...base.css.t, ...(css.t || {}) }, m: { ...base.css.m, ...(css.m || {}) } },
    hide: {}, cls: [], adv: { htmlId: '', cls: '', css: '' },
    children: DEF[type].level < 4 ? children : []
  };
};
const cols = (n: number, kids?: any, css?: any) => N('row', {}, css, Array.from({ length: n }, (_, i) =>
  N('column', {}, { d: { 'flex-grow': String(+(100 / n).toFixed(4)) } }, kids[i] || [])));

const DEV_KEY: Record<string, Bp> = { desktop: 'd', tablet: 't', mobile: 'm' };
const DEV_LABEL: Record<string, string> = { d: 'Desktop', t: 'Tablet', m: 'Mobile' };

/* ---- how wide the canvas renders, and how much it is scaled to fit -------
   The canvas used to be whatever width the panels left over, which meant the
   breakpoint it rendered at was an accident of the window and of whether the
   inspector happened to be open. At a 1440px window with a selection made it was
   741px — so it drew the *mobile* layout, at 27px type instead of 38px, while the
   chip read "Desktop base". Two different things were being conflated: the width a
   breakpoint means, and the room available to show it.

   They are separate now. The frame is always `canvasWidth()` wide and is scaled
   down to fit; what you see is the breakpoint you are editing, at any window size. */
const DEV_W: Record<string, number> = { mobile: 414, tablet: 834 };
function canvasWidth(dev: string, maxWidth: string) {
  if (DEV_W[dev]) return DEV_W[dev];
  /* Desktop has to clear the 1024px tablet query with room to spare, and it has to
     be at least the project's own container — otherwise the container, not the
     breakpoint, is what the preview is showing you. A non-px max-width (%, vw)
     parses to 0 and falls back to the floor. */
  const px = /^[\d.]+px$/.test(String(maxWidth || '').trim()) ? parseFloat(maxWidth) : 0;
  return Math.max(1280, Math.round(px) + 120);
}
/* Fit never magnifies. A 414px mobile frame in a wide window belongs at 100%,
   not blown up to fill the space. */
const fitZoom = (target: number, avail: number) => (!target || !(avail > 0) ? 1 : Math.min(1, avail / target));
const ZOOMS = [['fit', 'Fit'], ['1', '100%'], ['0.75', '75%'], ['0.5', '50%'], ['0.25', '25%']];
const zoomFor = (z: string | null | undefined, target: number, avail: number) =>
  (z == null || z === 'fit' ? fitZoom(target, avail) : (parseFloat(z) || 1));

/* The initial editor state, in one place. The tests used to rebuild this literal by
   hand and had drifted five fields behind it — so every test ran against a `ui` shape
   the app never actually has. One definition, and there is nothing to drift from. */
function initUi(): Ui {
  return {
    mode: 'page', dev: 'desktop', sel: null, multi: [], tab: 'add', atab: 'widgets', stab: 'content', target: '', lmode: null,
    open: {}, collapsed: {}, custom: {}, zoom: 'fit', pno: 1, st: ''
  };
}
const state: State = {
  v: 1,
  meta: {
    name: 'Untitled project', maxWidth: '1200px',
    font: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    headFont: '', size: '16px',
    css: '', headHtml: '', lang: 'en', baseUrl: '', ogImage: '', favicon: '', blocks: [],
    tokens: null      // filled by defaultTokens() at boot
  },
  header: [], footer: [], pages: [], cur: 0,
  ui: initUi()
};

const doc = (): Doc => ({
  schemaVersion: SCHEMA,
  meta: state.meta,
  header: state.header,
  footer: state.footer,
  pages: state.pages
});
const page = () => state.pages[state.cur] || state.pages[0];
/* Which tree is being edited. A component definition is one of them, and that single line is
   most of what makes editing a component work: `locate`, `insert`, the drag targets, the
   layer list and the inspector all read `tree()`, so none of them needed to learn what a
   component is. The same trick the global header and footer have always used. */
const tree = (): PcNode[] => {
  if (state.ui.mode === 'component') {
    const cd = findComponent(state.ui.cedit);
    return cd ? [cd.node] : [];
  }
  return state.ui.mode === 'header' ? state.header : state.ui.mode === 'footer' ? state.footer : page().tree;
};
const dk = () => DEV_KEY[state.ui.dev];

/* ---- tree traversal ------------------------------------------------- */
function locate(id: string, list: any = tree(), parent: any = null): Handle | null {
  for (let i = 0; i < list.length; i++) {
    if (list[i].id === id) return { node: list[i], list, parent, i };
    const hit = locate(id, list[i].children || [], list[i]);
    if (hit) return hit;
  }
  return null;
}
function locateAny(id: string): any {
  for (const [m, list] of [['header', state.header], ['footer', state.footer]]) {
    const h = locate(id, list, null); if (h) return { ...h, mode: m };
  }
  for (let p = 0; p < state.pages.length; p++) {
    const h = locate(id, state.pages[p].tree, null); if (h) return { ...h, mode: 'page', page: p };
  }
  return null;
}
function eachNode(list: PcNode[], fn: (n: PcNode, parent: PcNode | null, i: number, depth: number) => void, parent: PcNode | null = null, depth = 0) {
  list.forEach((n, i) => { fn(n, parent, i, depth); eachNode(n.children || [], fn, n, depth + 1); });
}
const nameOf = (n: PcNode) => {
  /* An instance is called by what it is an instance of. Reading "Section" in the layer tree for
     something the author named "Pricing card" is the panel disagreeing with the page. */
  if (n.use) {
    const cd = findComponent(n.use);
    if (cd) return cd.name;
  }
  const d = DEF[n.type];
  /* A Box is called by what it does. Three palette entries build one type, so a layer list of
     five things all called "Box" would be the panel refusing to say which is the grid. */
  if (n.type === 'box') {
    if (String(n.props.link || '').trim()) return 'Link block';
    return n.props.layout === 'grid' ? 'Grid' : n.props.layout === 'flex' ? 'Flex' : 'Box';
  }
  if (n.type === 'heading') return (n.props.text || '').slice(0, 26) || d.label;
  if (n.type === 'button') return n.props.text || d.label;
  if (n.type === 'text') return (n.props.html || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 24) || d.label;
  if (n.type === 'quote') return (n.props.text || '').trim().slice(0, 24) || d.label;
  if (n.type === 'row') return `Row · ${n.children.length} col`;
  if (n.type === 'slider') return `Slider · ${n.children.length} slide${n.children.length === 1 ? '' : 's'}`;
  if (n.type === 'image') return n.props.alt ? 'Image · ' + n.props.alt.slice(0, 18) : 'Image';
  return d.label;
};

/* ---- the selection set ------------------------------------------------
   `state.ui.sel` stays the one primary — the key object whose controls the
   inspector draws — and `multi` holds the rest. Keeping the primary separate
   is what lets every single-selection path in the app go on reading
   `state.ui.sel` untouched; only the places that fan out consult `selIds`. */
function selIds() {
  const out: any[] = [];
  if (state.ui.sel) out.push(state.ui.sel);
  for (const id of state.ui.multi || []) if (!out.includes(id)) out.push(id);
  return out.filter(id => locate(id));            // undo can retire a member
}
/* selSet drops ids with no node, so every id here resolves; filter anyway rather
   than assert, since a stale id would otherwise throw inside a render */
const selNodes = () => selIds().map(id => locate(id)).filter(Boolean).map(h => h!.node);
const multiOn = () => selIds().length > 1;
function selSet(ids: string[]) {
  const live = ids.filter(id => locate(id));
  const was = state.ui.sel;
  state.ui.sel = live.length ? live[0] : null;
  state.ui.multi = live.slice(1);
  /* A new selection starts from the resting state. Carrying the hover state across would be
     a mode you cannot see from the canvas: every field in the Style tab would be showing and
     writing hover values for an element you just clicked. Keeping the class target is
     different — that one is listed in the panel with the element's own classes. */
  if (state.ui.sel !== was) state.ui.st = '';
}
/* Add or remove one member. Dropping the primary promotes the next in line,
   so the inspector always has a key object while anything is selected. */
function selToggle(id: string) {
  if (!id || !locate(id)) return;
  const ids = selIds();
  if (ids.includes(id)) selSet(ids.filter(x => x !== id));
  else selSet([...ids, id]);
}
/* document order — deterministic fan-out, and the order a range select means */
function selOrder(ids: string[]) {
  const rank = new Map();
  let i = 0;
  eachNode(tree(), n => rank.set(n.id, i++));
  return ids.slice().sort((a, b) => (rank.has(a) ? rank.get(a) : 1e9) - (rank.has(b) ? rank.get(b) : 1e9));
}
/* Every node between two ids, in the order the Navigator lists them — which
   means skipping the children of a collapsed row, so a range can never reach
   something the user cannot see on screen. */
function selRange(a: string, b: string) {
  const flat: any[] = [];
  const walk = (list: PcNode[]): void => list.forEach((n: PcNode) => {
    flat.push(n.id);
    if (!state.ui.collapsed[n.id]) walk(n.children || []);
  });
  walk(tree());
  const i = flat.indexOf(a), j = flat.indexOf(b);
  if (i < 0 || j < 0) return [b];
  return flat.slice(Math.min(i, j), Math.max(i, j) + 1);
}
/* Drop any id that already has an ancestor in the set. Deleting or duplicating
   a parent takes its children with it, so acting on both would act twice — and
   for delete, the second act would be on a node that is already gone. */
function topMost(ids: string[]) {
  const set = new Set(ids);
  return ids.filter(id => {
    let h = locate(id);
    if (!h) return false;
    for (let p = h.parent; p; p = (locate(p.id) || { parent: null }).parent) if (set.has(p.id)) return false;
    return true;
  });
}

/* ---- fan-out ----------------------------------------------------------
   Which nodes one control edit reaches. A CSS property is universal, so it
   reaches every member of the set. A content prop reaches only members whose
   own type declares that control, so a mixed selection cannot collect props it
   has no field for. `_id` never fans out: N elements sharing one HTML id is
   invalid markup, and the id is the thing a link anchor points at — so it stays
   on the primary, which `selIds` guarantees is first. */
const ADV_SHARED = new Set(['_cls', '_css']);
const ctlKeys = (type: string) => {
  const c = (DEF[type] || {}).controls || {};
  const out = new Set();
  for (const g of ['content', 'style'] as ('content' | 'style')[]) for (const x of (c[g] || [])) if (x.k) out.add(x.k);
  return out;
};
function fanTargets(c: Pick<Control, 'k' | 'c'>, ids: string[]) {
  const nodes = ids.map(id => locate(id)).filter(Boolean).map(h => h!.node);
  if (c.k === '_id') return nodes.slice(0, 1);
  if (c.c || ADV_SHARED.has(c.k as string)) return nodes;
  return nodes.filter(n => ctlKeys(n.type).has(c.k));
}

/* ---- history --------------------------------------------------------- */
/* HOOKS is how the DOM-free core notifies the UI layer; tests leave it inert. */
/* the UI assigns real implementations over these no-ops at boot */
const HOOKS: { change(): void; save(): void; note(m?: string): void } =
  { change() { }, save() { }, note() { } };
const hist: { u: Doc[]; r: Doc[]; max: number } = { u: [], r: [], max: 80 };
function edit(fn: () => void) {
  hist.u.push(clone(doc())); if (hist.u.length > hist.max) hist.u.shift();
  hist.r.length = 0;
  fn();
  HOOKS.change();
  HOOKS.save();
}
function restore(snap: Doc) {
  state.meta = snap.meta; state.header = snap.header; state.footer = snap.footer; state.pages = snap.pages;
  if (state.cur >= state.pages.length) state.cur = 0;
  selSet(selIds());                        // drop members this snapshot has no node for
  HOOKS.change(); HOOKS.save();
}
function undo() { if (!hist.u.length) return; hist.r.push(clone(doc())); restore(hist.u.pop()!); HOOKS.note('Undo'); }
function redo() { if (!hist.r.length) return; hist.u.push(clone(doc())); restore(hist.r.pop()!); HOOKS.note('Redo'); }

/* ---- insertion rules ------------------------------------------------- */
const lvl = (t: string) => DEF[BASE[t] || t].level;
const CHAIN: Record<number, string> = { 1: 'section', 2: 'row', 3: 'column' };

/* The level a parent's children arrive at. Declared by the parent, defaulting to one deeper
   than the parent is — which is what `wrap` inferred before anything declared it, and is right
   for a section, a row and a column. A Box declares 4, because its children are whatever you
   put in it. `null` is the root, whose children are sections. */
const takes = (pt: string | null) => {
  if (pt === null) return 1;
  const d = DEF[BASE[pt] || pt];
  return d && d.takes !== undefined ? d.takes : (lvl(pt) + 1);
};

/* Builds the wrapper chain needed to place `type` inside a parent that takes children at level
   `t`, e.g. a Heading (4) dropped on the root (1) becomes Section > Row > Column > Heading.
   Dropped into a Box, which takes 4, it goes in as it is. */
function wrap(type: string, t: number, node: any): any {
  let out = node;
  for (let l = lvl(type) - 1; l >= t; l--) out = N(CHAIN[l], {}, {}, [out]);
  return out;
}
/* Can a node of type `t` live inside a parent of type `pt`? Anything deeper in the hierarchy
   can, plus whatever the parent declares it `accepts`. `t` may be a palette key (e.g.
   `columns`), so normalise it first.

   `accepts?: Level[]` existed on four widgets and nothing read it, while the one exception it
   was describing — a row nested in a column — was hardcoded here by name. A declaration
   nothing reads is a wish, and this one had already drifted from the rule: it said a column
   takes any level 2, which would let a card contain the Collection List that repeats it.

   `alsoHolds` names types and this reads it. It adds to the level rule rather than replacing
   it, so a heading dropped on a section still lands, wrapped in the chain it needs. */
const holds = (pt: any, t: string) => {
  const b = BASE[t] || t;
  return (lvl(b) > lvl(pt)) || (DEF[pt] || {}).alsoHolds?.includes(b as WidgetType) === true;
};
/* Can `t` be *placed* inside `pt` — wrappers allowed? `null` is the document root, which takes
   anything: a heading dropped there becomes Section > Row > Column > Heading, and `wrap` builds
   that chain.

   Distinct from `holds`, which is direct containment, and the distinction is the whole reason
   this exists. Four places asked this question by comparing levels instead —
   `lvl(fresh.type) <= lvl(parent.type)` — which was the same answer for as long as the
   hierarchy was strictly by level, and stopped being so the moment anything declared
   `alsoHolds`. A Box holds a Box: `holds` says yes and the level comparison says no. Six cards
   placed into a grid ended up with one in it and five scattered above it, in reverse order.

   A place that re-derives an answer somebody already declared is the shape of bug this file
   keeps finding. */
const fitsIn = (pt: string | null, t: string) => pt === null || holds(pt, t);

function insert(type: string, parentNode: any, index: number) {
  const leaf = makeFor(type);
  /* `takes`, not the parent's own level: a Box takes children at level 4, so a heading dropped
     into a Grid goes in as it is rather than arriving inside a Column nothing asked for. The
     row-in-a-column case needs no exception any more — a column takes 4, so `wrap` returns the
     row untouched. */
  const packed = wrap(type, takes(parentNode ? parentNode.type : null), leaf);
  const list = parentNode ? parentNode.children : tree();
  list.splice(Math.max(0, Math.min(index, list.length)), 0, packed);
  return leaf;
}
function moveNode(id: string, parentNode: any, index: number) {
  const h = locate(id); if (!h) return;
  if (parentNode && (parentNode.id === id || locate(parentNode.id, [h.node]))) return; // no self-nesting
  h.list.splice(h.i, 1);
  const list = parentNode ? parentNode.children : tree();
  let k = Math.max(0, Math.min(index, list.length));
  const packed = wrap(h.node.type, takes(parentNode ? parentNode.type : null), h.node);
  list.splice(k, 0, packed);
}
/* ---- what can be done to the selection --------------------------------
   Three places grew their own copy of "duplicate this, delete this": the canvas HUD
   bar, the Navigator row, and the inspector footer. Each offered a different subset
   of the same verbs, and none of them offered copy/paste styles — which is how a
   style clipboard ended up at the bottom of a targeting group with nowhere better
   to go. There was also no context menu anywhere, which is where a paste verb
   belongs.

   `menuFor` is the single answer to "what applies here". Pure, so the menu, the HUD
   and anything else read the same list; `sep` marks a group boundary. */
function menuFor(ids: string[] | null) {
  const list = (ids || []).filter(id => locate(id));
  if (!list.length) return [];
  const many = list.length > 1;
  const h = locate(list[0])!;                 // list was filtered to live ids above
  const n = h.node;
  const d = DEF[n.type];
  const dev = DEV_LABEL[dk()];
  const hidden = !!(n.hide && n.hide[dk()]);
  const out: MenuItem[] = [];

  if (!many && d.edit) out.push({ act: 'edit', label: 'Edit content', key: '↵' });
  if (!many && h.parent) out.push({ act: 'up', label: 'Select parent', key: 'esc' });
  if (out.length) out[out.length - 1].sep = true;

  out.push({ act: 'copy', label: many ? 'Copy the first' : 'Copy', key: '⌘C' });
  out.push({ act: 'cut', label: many ? 'Cut the first' : 'Cut', key: '⌘X' });
  if (clip.node) out.push({ act: 'paste', label: 'Paste ' + DEF[clip.node.type].label, key: '⌘V' });
  out.push({ act: 'dup', label: many ? 'Duplicate all ' + list.length : 'Duplicate', key: '⌘D', sep: true });

  out.push({ act: 'stcopy', label: 'Copy styles', key: '⌘⇧C' });
  /* offered only when there is something to paste — a permanently dead row reads as
     a broken menu, and this is the same reason the clipboard strip comes and goes */
  if (styleClip.css) out.push({ act: 'stpaste', label: many ? 'Paste styles to ' + list.length : 'Paste styles', key: '⌘⇧V' });
  out[out.length - 1].sep = true;

  /* Offered only where there is somewhere to go: a lone child has no list to be at the top
     of, and a row of dead entries reads as a broken menu. */
  const sibs = h.parent ? h.parent.children : tree();
  if (sibs.length > 1) {
    out.push({ act: 'first', label: many ? 'Move all to the top' : 'Move to the top', key: '⌘⇧↑' });
    out.push({ act: 'last', label: many ? 'Move all to the bottom' : 'Move to the bottom', key: '⌘⇧↓', sep: true });
  }
  out.push({ act: 'hide', label: (hidden ? 'Show on ' : 'Hide on ') + dev });
  if (!many) out.push({ act: 'block', label: 'Save as a block' });
  out[out.length - 1].sep = true;

  out.push({ act: 'del', label: many ? 'Delete all ' + list.length : 'Delete', key: '⌫', danger: true });
  return out;
}

/* Move a whole set as a group, keeping their document order and landing them
   together. Dragging with several selected used to be impossible — the HUD simply
   hid its handle, because moving a set was left out of the multi-select pass.

   Two things make this more than a loop. `topMost` first, or a parent and its own
   child both move and the second acts on a node that is no longer where it was. And
   the insertion point is re-read from the container on every step, because a member
   that was already ahead of the target in the same list leaves a hole behind it when
   it goes — assuming the index is stable puts the set in the wrong order. */
function moveMany(ids: string[], parentNode: PcNode | null, index: number) {
  const order = topMost(selOrder(ids));
  let at = Math.max(0, index), moved = 0;
  order.forEach(id => {
    const h = locate(id);
    if (!h) return;
    const pid = h.parent ? h.parent.id : null;
    const tid = parentNode ? parentNode.id : null;
    if (pid === tid) {
      const list = parentNode ? parentNode.children : tree();
      const from = list.findIndex(c => c.id === id);
      if (from >= 0 && from < at) at--;
    }
    moveNode(id, parentNode, at);
    /* moveNode refuses a self-nesting move and leaves the tree alone, so only count
       the ones that actually landed */
    const now = locate(id);
    if (now && (now.parent ? now.parent.id : null) === tid) { at++; moved++; }
  });
  return moved;
}

/* Where a Navigator drop lands. `before`/`after` make the dragged thing a sibling of
   the row; `inside` puts it first inside, which is the only way the list can reach an
   empty container — it has no geometry to aim at the way the canvas does.

   A row that *is* one of the dragged nodes, or sits under one, is refused outright:
   dropping something inside itself detaches the tree. The canvas path guards this by
   trimming the ancestor chain; a flat list has no chain, so it is checked directly. */
function layerTarget(rowId: string, zone: string, type: string, movingIds: string[] = []) {
  const h = locate(rowId);
  if (!h) return null;
  for (const mid of movingIds) {
    const mh = locate(mid);
    if (!mh) continue;
    let inside = false;
    eachNode([mh.node], x => { if (x.id === rowId) inside = true; });
    if (inside) return null;
  }
  /* A stricter question than `fitsIn`: the Navigator drops a row *at* a position, so at the
     root only a section belongs there. `fitsIn` would say yes to a heading and the list would
     grow a wrapper chain from a click on a flat list, which is not what the row you aimed at
     said would happen. */
  const canHold = (pt: string | null, t: string) =>
    (pt === null ? lvl(BASE[t] || t) === 1 : holds(pt, t));
  if (zone === 'inside') {
    if (!canHold(h.node.type, type)) return null;
    return { container: h.node, index: 0 };
  }
  const parent = h.parent || null;
  if (!canHold(parent ? parent.type : null, type)) return null;
  const list = parent ? parent.children : tree();
  const i = list.findIndex(c => c.id === rowId);
  if (i < 0) return null;
  return { container: parent, index: zone === 'after' ? i + 1 : i };
}

/* A fresh copy gets fresh node ids — and loses any hand-set anchor, because two
   elements cannot share an HTML id. Duplicate, paste, and placing a block all run
   through here, and all three used to produce a `duplicate-id` error the moment the
   source carried an anchor. Auto ids are derived per node so they stay unique on
   their own; only `adv.htmlId` has to be surrendered. Originals never pass here. */
function reid(n: PcNode) {
  n.id = uid();
  if (n.adv) n.adv.htmlId = '';
  (n.children || []).forEach(reid);
  return n;
}
/* page order drives the sitemap and the nav a user authors by hand */
function pageMove(i: number, dir: number) {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= state.pages.length) return false;
  const cur = state.pages[state.cur];
  [state.pages[i], state.pages[j]] = [state.pages[j], state.pages[i]];
  state.cur = state.pages.indexOf(cur);
  return true;
}
/** Copy a page, its whole tree included, and make the copy current. Every node gets a
    fresh id — two pages sharing node ids would make `locate` return whichever it
    reached first, so a copy that skipped this would break selection on both. */
function pageDup(i: number) {
  const src = state.pages[i];
  if (!src) return null;
  const c = clone(src);
  c.id = uid();
  c.tree.forEach(reid);
  c.name += ' copy';
  c.slug = slugify(c.slug + '-copy');
  state.pages.splice(i + 1, 0, c);
  state.cur = i + 1;
  selSet([]);
  return c;
}

/** Remove a page. Refuses the last one — a project with no pages has nothing to show
    and no way back. `cur` is clamped rather than adjusted, because deleting the page
    before the current one shifts it and deleting the last one leaves it past the end;
    both used to be the same off-by-one waiting to happen. */
function pageDelete(i: number) {
  if (state.pages.length < 2 || !state.pages[i]) return false;
  state.pages.splice(i, 1);
  state.cur = Math.max(0, Math.min(state.cur, state.pages.length - 1));
  selSet([]);
  return true;
}

function dupNode(id: string) {
  const h = locate(id); if (!h) return;
  const c = reid(clone(h.node));
  h.list.splice(h.i + 1, 0, c);
  selSet([c.id]);
}
function delNode(id: string) {
  const h = locate(id); if (!h) return;
  h.list.splice(h.i, 1);
  selSet(h.parent ? [h.parent.id] : []);
}
/* The set versions of the two. Both work on `topMost` so a parent and its own
   child in one selection count once, and delete runs back to front so the
   splices cannot shift an index still to come. */
function dupMany(ids: string[]) {
  const made: any[] = [];
  for (const id of selOrder(topMost(ids))) {
    const h = locate(id); if (!h) continue;
    const c = reid(clone(h.node));
    h.list.splice(h.i + 1, 0, c);
    made.push(c.id);
  }
  if (made.length) selSet(made);
  return made.length;
}
function delMany(ids: string[]) {
  const top = selOrder(topMost(ids));
  let fallback = null;
  for (const id of top.slice().reverse()) {
    const h = locate(id); if (!h) continue;
    h.list.splice(h.i, 1);
    fallback = (h.parent ? h.parent.id : null) as any;      // the shallowest survivor wins
  }
  selSet(fallback ? [fallback] : []);
  return top.length;
}

function applyCols(row: PcNode, ws: number[]) {
  const kids = row.children;
  while (kids.length < ws.length) kids.push(N('column'));
  if (kids.length > ws.length) {
    const dropped = kids.splice(ws.length);
    dropped.forEach(d => { kids[kids.length - 1].children.push(...d.children); });
  }
  kids.forEach((k, i) => { k.css.d = k.css.d || {}; k.css.d['flex-grow'] = String(+ws[i].toFixed(4)); });
}

/* ---- column proportions -------------------------------------------------
   Dragging a gutter moves width between two neighbours and leaves every other
   column alone, so the row's total never drifts. A column stops at MIN_COL
   percent of the row — below that its gutter is too small to grab back. */
const MIN_COL = 4;
/* The proportions in force at a breakpoint, following the same fall-through the
   stylesheet does (mobile → tablet → desktop). `rowRatios` stays the desktop-only
   reader its existing callers expect. */
const BP_CHAIN = { d: ['d'], t: ['t', 'd'], m: ['m', 't', 'd'] };
/** A responsive declaration as the stylesheet sees it at one breakpoint. Node rules
    follow class rules in the generated sheet, so the node wins at each step. */
function cssAt(n: PcNode, b: Bp, prop: string) {
  for (const k of (BP_CHAIN[b] || ['d']) as Bp[]) {
    const own = ((n.css || {})[k] || {})[prop];
    if (own !== undefined && own !== '') return own;
    const applied = nodeClasses(n);
    for (let i = applied.length - 1; i >= 0; i--) {
      const v = ((applied[i].css || {})[k] || {})[prop];
      if (v !== undefined && v !== '') return v;
    }
  }
  return '';
}

/** Row alignment names the position of its column boxes. A following column uses the
    same top/middle/bottom value for its contents. Baseline and Fill do not describe a
    vertical content position, so their honest content default is Top. */
function rowVerticalValue(row: PcNode | null, b: Bp) {
  if (!row || row.type !== 'row') return 'flex-start';
  const v = cssAt(row, b, 'align-items');
  return v === 'center' || v === 'flex-end' ? v : 'flex-start';
}
function rowVerticalLabel(n: PcNode) {
  const h = locateAny(n.id);
  const v = rowVerticalValue(h && h.parent ? h.parent : null, dk());
  return v === 'center' ? 'Center' : v === 'flex-end' ? 'Bottom' : 'Top';
}
function rowRatiosAt(row: PcNode, b: Bp) {
  return (row.children || []).map(c => {
    for (const k of (BP_CHAIN[b] || ['d'])) {
      const v = ((c.css as any)[k] || {})['flex-grow'];
      if (v !== undefined && v !== '') return parseFloat(v) || 0;
    }
    return 0;
  });
}
/* `pct` is a share of the whole row, signed: positive grows column `i`. */
function resizeCols(row: PcNode, i: number, pct: number, b: Bp = 'd') {
  const ws = rowRatiosAt(row, b);
  if (i < 0 || i + 1 >= ws.length) return null;
  const total = ws.reduce((a, x) => a + x, 0);
  if (!total) return null;
  const min = total * (MIN_COL / 100), pair = ws[i] + ws[i + 1];
  if (pair < min * 2) return null;                  // no room to move either way
  let a = ws[i] + (pct / 100) * total;
  a = Math.max(min, Math.min(pair - min, a));
  const out = ws.slice();
  out[i] = a; out[i + 1] = pair - a;
  return out;
}
/* Writes proportions at one breakpoint without touching the column count —
   `applyCols` is the one that adds and removes columns. */
function applyColsAt(row: PcNode, ws: number[], b: Bp = 'd') {
  (row.children || []).forEach((k, i) => {
    if (ws[i] === undefined) return;
    k.css[b] = k.css[b] || {};
    k.css[b]['flex-grow'] = String(+ws[i].toFixed(4));
  });
}

/* ================================================== design tokens
   Colours and text styles are defined once on the project and referenced by
   elements — a colour as `var(--c-<id>)`, a text style as a `ts-<id>` class.
   Restyling a brand is then one edit, not one edit per element.            */
const RESERVED = ['text', 'bg', 'brand'];          // wired into the base stylesheet
const TYPO_KEYS = ['font-family', 'font-size', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-transform', 'color'];
const TS_TYPES = ['heading', 'text', 'quote', 'button'];    // elements that can carry a text style

/* An identifier from a name: lowercase, hyphenated, and capped at 24 characters.

   The cap backs up to a word boundary rather than cutting through a word, which matters because
   this makes **item slugs** and an item slug is a URL somebody reads. A release called "One way
   to author a hover" became `one-way-to-author-a-hove`, and a URL ending in "hove" reads as a
   typo forever. It backs up only when the cut landed mid-word, and not below eight characters —
   one very long word still gets truncated, because the alternative is an empty id. */
const TOKEN_MAX = 24;
const tokenId = (s: unknown) => {
  const full = String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (full.length <= TOKEN_MAX) return full;
  const cut = full.slice(0, TOKEN_MAX);
  if (full[TOKEN_MAX] === '-') return cut.replace(/-$/, '');   // the cut fell on a boundary
  const at = cut.lastIndexOf('-');
  return at >= 8 ? cut.slice(0, at) : cut;
};
const cvar = (id: string) => `var(--c-${id})`;
const isRef = (v: unknown) => /^var\(--c-[\w-]+\)$/.test(String(v || '').trim());
const refId = (v: unknown) => { const m = String(v || '').trim().match(/^var\(--c-([\w-]+)\)$/); return m ? m[1] : null; };

const colors = () => (state.meta.tokens && state.meta.tokens.colors) || [];
const styles = () => (state.meta.tokens && state.meta.tokens.text) || [];

/* `tokens` is null until boot fills it, and six mutators below dereferenced it with
   no check — a throw waiting for any path that reached them before load() ran. The
   readers above already handle null by returning []; this handles it once for the
   writers instead of six times, and lazily rather than by asserting, so a path that
   used to throw now works. TypeScript found all six; nothing else ever had. */
const ensureTokens = (): Tokens => (state.meta.tokens ||= defaultTokens(state.meta));
const classes = () => (state.meta.tokens && state.meta.tokens.classes) || [];
const findColor = (id?: string) => colors().find(c => c.id === id) || null;
const findStyle = (id?: string) => styles().find(t => t.id === id) || null;
const findClass = (id?: string) => classes().find(c => c.id === id) || null;
/* applied classes, dangling ids filtered, in project order — because CSS source
   order decides precedence and the project list is that order */
const nodeClasses = (n: PcNode) => {
  const ids = Array.isArray(n.cls) ? n.cls : [];
  return classes().filter(c => ids.includes(c.id));
};
/* the literal behind a value, following one level of token reference */
const resolveColor = (v: unknown) => {
  const id = refId(v);
  if (!id) return String(v || '');
  const t = findColor(id);
  return t ? t.value : '';
};

function defaultTokens(meta: any = {}): Tokens {
  return {
    classes: [],
    colors: [
      { id: 'text', name: 'Body text', value: meta.color || '#111311' },
      { id: 'bg', name: 'Page background', value: meta.bg || '#f8f6ef' },
      { id: 'brand', name: 'Craft Green', value: meta.accent || '#b7f34a' },
      { id: 'ink', name: 'Ink', value: '#111311' },
      { id: 'muted', name: 'Slate (on Paper)', value: '#5f6660' },
      { id: 'muted-i', name: 'Slate (on Ink)', value: '#b0b7b1' },
      { id: 'slate', name: 'Slate (brand)', value: '#6f7771' },
      { id: 'line', name: 'Hairline', value: '#e5e1d6' },
      { id: 'surface', name: 'White', value: '#ffffff' }
    ],
    text: [
      { id: 'display', name: 'Display', tag: 'h1', css: { d: { 'font-size': '58px', 'font-weight': '600', 'line-height': '.96', 'letter-spacing': '-.04em', color: cvar('ink') }, t: { 'font-size': '44px' }, m: { 'font-size': '33px' } } },
      { id: 'title', name: 'Section title', tag: 'h2', css: { d: { 'font-size': '38px', 'font-weight': '600', 'line-height': '1.05', 'letter-spacing': '-.035em', color: cvar('ink') }, t: { 'font-size': '32px' }, m: { 'font-size': '27px' } } },
      { id: 'subtitle', name: 'Card title', tag: 'h3', css: { d: { 'font-size': '19px', 'font-weight': '700', 'line-height': '1.3', color: cvar('ink') }, t: {}, m: { 'font-size': '18px' } } },
      { id: 'lead', name: 'Lead paragraph', tag: 'p', css: { d: { 'font-size': '18px', 'line-height': '1.65', color: cvar('muted') }, t: {}, m: { 'font-size': '16px' } } },
      { id: 'body', name: 'Body', tag: 'p', css: { d: { 'font-size': '16px', 'line-height': '1.7', color: cvar('text') }, t: {}, m: { 'font-size': '15px' } } },
      { id: 'small', name: 'Small', tag: 'p', css: { d: { 'font-size': '14px', 'line-height': '1.65', color: cvar('muted') }, t: {}, m: {} } },
      { id: 'eyebrow', name: 'Eyebrow', tag: 'div', css: { d: { 'font-family': "'DM Sans',system-ui,sans-serif", 'font-size': '12px', 'font-weight': '500', 'letter-spacing': '.04em', 'text-transform': 'uppercase', color: cvar('muted') }, t: {}, m: {} } },
      { id: 'btn', name: 'Button label', css: { d: { 'font-size': '15px', 'font-weight': '600', 'letter-spacing': '0em' }, t: {}, m: {} } }
    ]
  };
}

/* ---- token CSS: emitted ahead of element rules so elements still win ---- */
function tokenVars() {
  const body = colors().map(c => `--c-${c.id}:${c.value}`).join(';');
  return body ? `:root{${body}}` : '';
}
function tokenCss() {
  const acc = { d: '', t: '', m: '' };
  styles().forEach(t => (['d', 't', 'm'] as Bp[]).forEach(b => {
    const decls = decl((t.css && t.css[b]) || {});
    if (decls) acc[b] += `.ts-${t.id}{${decls}}`;
  }));
  /* classes come after text styles and before element rules, so the order of
     precedence reads: text style < class < this element */
  classes().forEach(c => (['d', 't', 'm'] as Bp[]).forEach(b => {
    const decls = decl((c.css && c.css[b]) || {});
    if (decls) acc[b] += `.c-${c.id}{${decls}}`;
    /* a class hover is the one people actually want — restyle every card's hover once. It
       still loses to an element's own hover, which has the same specificity and comes later. */
    STATES.forEach(([k, , sel]) => {
      const d = decl((c.st && c.st[k] && c.st[k]![b]) || {});
      if (d) acc[b] += `.c-${c.id}${sel}{${d}}`;
    });
  }));
  return acc;
}

/* ---- applying and detaching text styles -------------------------------- */
const stripTypo = (n: PcNode) => (['d', 't', 'm'] as Bp[]).forEach(b => TYPO_KEYS.forEach(k => { if (n.css[b]) delete n.css[b][k]; }));
const grabTypo = (n: PcNode) => {
  const out: Css = { d: {}, t: {}, m: {} };
  (['d', 't', 'm'] as Bp[]).forEach(b => TYPO_KEYS.forEach(k => {
    const v = n.css[b] && n.css[b][k];
    if (v !== undefined && v !== '') out[b][k] = v;
  }));
  return out;
};
/* use a style: the element's own typography steps aside so the style shows */
function tsApply(n: PcNode, id: string) {
  const t = findStyle(id);
  if (!t) return false;
  stripTypo(n);
  n.props.ts = id;
  /* a text style knows which element it belongs on — picking Display should not
     also mean remembering to change H2 to H1 */
  if (t.tag && n.type === 'heading') n.props.level = t.tag;
  return true;
}
/* detach: bake the style's values in so nothing moves visually */
function tsUnlink(n: PcNode) {
  const t = findStyle(n.props.ts);
  if (t) (['d', 't', 'm'] as Bp[]).forEach(b => {
    n.css[b] = { ...((t.css && t.css[b]) || {}), ...(n.css[b] || {}) };
  });
  n.props.ts = '';
  return !!t;
}
/* push this element's typography up into the style it is using */
function tsUpdateFrom(n: PcNode) {
  const t = findStyle(n.props.ts);
  if (!t) return false;
  const got = grabTypo(n);
  (['d', 't', 'm'] as Bp[]).forEach(b => { t.css[b] = { ...(t.css[b] || {}), ...got[b] }; });
  stripTypo(n);
  return true;
}
/** A style id derived from its name, made unique. There were two copies of this: this
    one and another in the project dialog's Add button, which also pushed straight into
    `tokens.text` rather than through `ensureTokens()` — so it would have thrown on a
    project whose tokens had not been built yet. */
const styleId = (name: string) => {
  const base = tokenId(name) || 'style';
  let id = base, k = 2;
  while (findStyle(id)) id = base + '-' + k++;
  return id;
};

/** A new text style with defaults, for "Add text style". Values rather than an empty
    object, because a style with nothing set looks broken and reads as a bug. */
function styleAdd(name: string) {
  const id = styleId(name);
  ensureTokens().text.push({
    id, name: String(name || 'New style').slice(0, 40),
    css: { d: { 'font-size': '16px', 'font-weight': '400', 'line-height': '1.5' }, t: {}, m: {} }
  });
  return id;
}

function tsCreateFrom(n: PcNode, name: string) {
  const id = styleId(name);
  ensureTokens().text.push({ id, name: String(name || 'New style').slice(0, 40), css: grabTypo(n) });
  stripTypo(n);
  n.props.ts = id;
  return id;
}
/* Every tree whose content reaches a page. Component definitions are in here because an
   instance renders one: a colour token, a text style, a class or a font used only inside a
   definition is used on the page, and a walk that missed it would delete the token, ship no
   font, or report the style as unused.

   Saved blocks are not, and that is the pre-existing behaviour rather than a decision made
   here — a block is not rendered until it is placed, and placing it copies the tree in. It
   does mean `classDelete` leaves a dangling class id inside a saved block; noted in
   PLAN-SERVER.md rather than fixed in a commit about components. */
/* What reaches a page. Component definitions are in here because an instance renders one, so a
   colour token, a text style, a class or a font used only inside a definition is used on the
   page — a walk that missed it would delete the token or ship no font. */
function renderedTrees(): PcNode[][] {
  return [
    state.header, state.footer, ...state.pages.map(p => p.tree),
    ...components().map(c => [c.node])
  ];
}
/* Every tree the project *stores*, which adds saved blocks.

   Blocks were left out for a long time on the reasoning that a block is not rendered until it
   is placed — true, and the wrong line for seven of the eight walks that read this. A class, a
   colour token or a text style referenced inside a block is a reference: deleting the thing
   without cleaning the block leaves an id pointing at nothing, and the element quietly loses
   its styling the next time somebody places it. Nobody would connect the two.

   `usedFamilies` is the eighth and reads `renderedTrees` instead, because it decides which
   webfonts an exported page links — and a font requested on every page for a block nobody has
   placed is a real cost for no one's benefit. Declarations rather than consts: this is called
   from `usedFamilies`, a thousand lines above. */
function allTrees(): PcNode[][] {
  return [...renderedTrees(), ...blocks().map(b => [b.node])];
}

/* ---- structured values -------------------------------------------------
   A link is a destination, not a string. Picking a page and an anchor from what
   exists is what makes a dead link impossible to author by hand. */
const LANGS = [
  ['en', 'English'], ['en-GB', 'English (UK)'], ['en-US', 'English (US)'], ['ar', 'Arabic'],
  ['zh', 'Chinese'], ['nl', 'Dutch'], ['fr', 'French'], ['de', 'German'], ['he', 'Hebrew'],
  ['hi', 'Hindi'], ['id', 'Indonesian'], ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'],
  ['pl', 'Polish'], ['pt', 'Portuguese'], ['pt-BR', 'Portuguese (Brazil)'], ['ru', 'Russian'],
  ['es', 'Spanish'], ['sv', 'Swedish'], ['tr', 'Turkish'], ['uk', 'Ukrainian'], ['vi', 'Vietnamese']
];

function anchorsOf(slug: string) {
  const pg = state.pages.find(p => p.slug === slug) || page();
  const out: any[] = [];
  [state.header, pg.tree, state.footer].forEach(l => eachNode(l, n => {
    if (n.adv && n.adv.htmlId) out.push(n.adv.htmlId);
  }));
  return [...new Set(out)];
}
/* A bare "#anchor" is read as belonging to its own page, which is what lets it
   survive being placed in a global header or footer. */
function parseLink(href: unknown, hereSlug: string) {
  const v = String(href == null ? '' : href).trim();
  if (!v) return { mode: 'none' };
  if (/^mailto:/i.test(v)) return { mode: 'email', value: v.replace(/^mailto:/i, '') };
  if (/^tel:/i.test(v)) return { mode: 'phone', value: v.replace(/^tel:/i, '') };
  if (v === 'cms:item') return { mode: 'item' };     // resolved per item at render
  if (v === '#') return { mode: 'none' };          // a bare hash is not a destination
  if (v.startsWith('#')) return { mode: 'page', page: hereSlug, frag: v.slice(1) };
  const m = v.match(/^([\w-]+)\.html(?:#([\w-]+))?$/);
  if (m && state.pages.some(p => p.slug === m[1])) return { mode: 'page', page: m[1], frag: m[2] || '' };
  return { mode: 'url', value: v };
}
function buildLink(o: any) {
  if (!o || o.mode === 'none') return '';
  if (o.mode === 'email') return o.value ? 'mailto:' + o.value : '';
  if (o.mode === 'phone') return o.value ? 'tel:' + o.value : '';
  if (o.mode === 'item') return 'cms:item';
  if (o.mode === 'page') return o.page ? o.page + '.html' + (o.frag ? '#' + o.frag : '') : '';
  return o.value || '';
}

/* ---- reusable style classes -------------------------------------------
   A class is any set of CSS declarations, per breakpoint, shared by any number
   of elements. Text styles are the typography-only special case of the same
   idea, kept separate because applying one has its own semantics.          */
function classAdd(name: string, css?: Partial<Css>) {
  const base = tokenId(name) || 'class';
  let id = base, k = 2;
  while (findClass(id)) id = base + '-' + k++;
  ensureTokens().classes = classes().concat([{
    id, name: String(name || 'New class').slice(0, 40),
    css: { d: { ...((css && css.d) || {}) }, t: { ...((css && css.t) || {}) }, m: { ...((css && css.m) || {}) } }
  }]);
  return id;
}
function classApply(n: PcNode, id: string) {
  if (!findClass(id)) return false;
  n.cls = Array.isArray(n.cls) ? n.cls : [];
  if (!n.cls.includes(id)) n.cls.push(id);
  return true;
}
function classRemove(n: PcNode, id: string) {
  n.cls = (Array.isArray(n.cls) ? n.cls : []).filter(x => x !== id);
}
/* take this element's own styling and turn it into a class others can share */
function classFrom(n: PcNode, name: string) {
  const id = classAdd(name, n.css);
  n.css = { d: {}, t: {}, m: {} };
  classApply(n, id);
  return id;
}
const classUsage = (id: string) => {
  let k = 0;
  allTrees().forEach(l => eachNode(l, x => { if ((x.cls || []).includes(id)) k++; }));
  return k;
};
/* deleting a class bakes its declarations into every user, so nothing moves */
function classDelete(id: string) {
  const c = findClass(id);
  if (!c) return false;
  allTrees().forEach(l => eachNode(l, x => {
    if (!(x.cls || []).includes(id)) return;
    (['d', 't', 'm'] as Bp[]).forEach(b => { x.css[b] = { ...((c.css && c.css[b]) || {}), ...(x.css[b] || {}) }; });
    classRemove(x, id);
  }));
  ensureTokens().classes = classes().filter(x => x.id !== id);
  return true;
}
/* precedence follows list order, so moving a class changes which one wins */
function classMove(id: string, dir: number) {
  const list = classes(), i = list.findIndex(c => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}
/* ---- what the inspector is editing -------------------------------------
   These eight were stranded in the UI half, which meant none of them had a test —
   including `cssVal`, whose fallback chain *is* the responsive cascade. They touch
   no DOM: they read `state` and return plain data. Moving them here shrinks the seam
   the inspector has to reach across, and puts the cascade under test. */

/** Split "24px" into its number and unit. A value it cannot parse yields empty
    strings rather than NaN, because the inspector shows this straight to the user. */
function parseU(v: unknown): { n: string; u: string } {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(-?[\d.]+)\s*(px|rem|em|%|vw|vh|ch|s|ms)?$/);
  return m ? { n: m[1], u: m[2] || '' } : { n: '', u: '' };
}

/**
 * What the inspector should show for one CSS property, and whether this breakpoint
 * owns it. `own` drives the override badge, so it has to mean "set *here*", not
 * "has a value" — a mobile field inheriting the desktop value is not an override.
 *
 * The fallback is mobile → tablet → desktop, matching how the exported media queries
 * actually cascade. Getting this wrong is what made the canvas show desktop styling
 * at a mobile width.
 */
/* ---- interactive states ----------------------------------------------
   A second axis over the breakpoints. Hover used to exist on buttons alone, as two custom
   properties read by a branch in the stylesheet writer, and `:focus` could not be authored
   anywhere — so a card could not lift, a link
   could not change, and the Transform and Transition controls on the Advanced tab had nothing
   to trigger them.

   `st` sits beside `css` rather than nesting inside it, which keeps `Css` the shape every
   existing reader expects and means a project carries no state block until something is in
   one. Two states, deliberately: what a pointer does, and what a keyboard does. `:focus-visible`
   rather than `:focus`, so a mouse click does not leave a ring behind — the same reason
   `baseCss` uses it for the built-in rings. */
const STATES: [StateKey, string, string][] = [
  ['hover', 'Hover', ':hover'],
  ['focus', 'Focus', ':focus-visible']
];
const EMPTY_CSS: Css = { d: {}, t: {}, m: {} };

/** The block a control reads right now. A state with nothing set reads empty rather than
    reading the resting value — showing the base there would say hover already had it. */
function stRead(o: { css: Css; st?: States }): Css {
  const k = state.ui.st;
  if (!k) return o.css;
  return (o.st && o.st[k]) || EMPTY_CSS;
}
/** The same block, made on demand, for writing. */
function stWrite(o: { css: Css; st?: States }): Css {
  const k = state.ui.st;
  if (!k) return o.css;
  o.st = o.st || {};
  return (o.st[k] = o.st[k] || { d: {}, t: {}, m: {} });
}

function cssVal(n: { css: Css; st?: States }, c: string, resp?: boolean): { v: string; own: boolean } {
  const src = stRead(n);
  const b: Bp = resp ? dk() : 'd';
  const own = src[b] ? src[b][c] : undefined;
  if (own !== undefined && own !== '') return { v: own, own: true };
  if (b === 'm' && src.t && src.t[c]) return { v: src.t[c], own: false };
  const d = src.d ? src.d[c] : '';
  return { v: d == null ? '' : d, own: false };
}

/** Write one CSS property at the breakpoint being edited. An empty value deletes the
    declaration rather than storing `""`, so the value below it in the cascade shows
    through — which is what clearing a field is supposed to do. */
function setCss(n: { css: Css; st?: States }, c: string, val: string | null | undefined, resp?: boolean) {
  const dest = stWrite(n);
  const b: Bp = resp ? dk() : 'd';
  dest[b] = dest[b] || {};
  if (val === '' || val == null) delete dest[b][c]; else dest[b][c] = val;
}

/** What styling edits land on: the selected class if this node carries it, else the
    node itself. The `cls` check matters — a class can stay targeted after being
    removed, and without it the edit would silently restyle every other user of it. */
function tgtObj(n: PcNode): PcNode | StyleClass {
  const id = state.ui.target;
  const c = id ? findClass(id) : null;
  return (c && (n.cls || []).includes(id)) ? c : n;
}
const tgtIsClass = (n: PcNode) => tgtObj(n) !== n;

/* A control's key is a prop key, except on an instance, where `val:<property>` is a value the
   instance holds rather than a prop the widget has. Two functions know how a control reads and
   writes — this one and `applyOne` — and both understand the prefix, which is the whole of what
   makes a property editable by controls that were written years before components existed. */
const VAL = 'val:';
const propVal = (n: PcNode, k?: string) => {
  if (k == null) return undefined;
  if (k.startsWith(VAL)) return instValue(n, findComponent(n.use), k.slice(VAL.length));
  return (n.props as PropBag)[k];
};

/** A link's mode is derived from the href it holds, so a mode picked but not yet
    filled in has nothing to derive from. `ui.lmode` remembers the choice for exactly
    that gap, which is why the picker does not snap back to "none" as you type. */
function linkOf(n: PcNode, propKey: string, here: string) {
  const L = parseLink(propVal(n, propKey), here);
  if (L.mode === 'none' && state.ui.lmode && state.ui.lmode.key === n.id + '|' + propKey) L.mode = state.ui.lmode.mode;
  return L;
}

const kb = (n: number) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

const tsUsage = (id: string) => {
  let k = 0;
  allTrees().forEach(l => eachNode(l, x => { if (x.props.ts === id) k++; }));
  return k;
};
function styleDelete(id: string) {
  allTrees().forEach(l => eachNode(l, x => { if (x.props.ts === id) tsUnlink(x); }));
  ensureTokens().text = styles().filter(t => t.id !== id);
}
/* deleting a colour inlines its literal everywhere, so nothing silently breaks */
function colorDelete(id: string) {
  if (RESERVED.includes(id)) return false;
  const lit = resolveColor(cvar(id)) || 'transparent';
  const swap = (o: Decls) => { for (const k in o) if (refId(o[k]) === id) o[k] = lit; };
  allTrees().forEach(l => eachNode(l, x => (['d', 't', 'm'] as Bp[]).forEach(b => swap(x.css[b] || {}))));
  styles().forEach(t => (['d', 't', 'm'] as Bp[]).forEach(b => swap((t.css && t.css[b]) || {})));
  ensureTokens().colors = colors().filter(c => c.id !== id);
  return true;
}
function colorAdd(name: string, value: string) {
  const base = tokenId(name) || 'colour';
  let id = base, k = 2;
  while (findColor(id)) id = base + '-' + k++;
  ensureTokens().colors.push({ id, name: String(name || 'New colour').slice(0, 40), value: value || '#888888' });
  return id;
}
const colorUsage = (id: string) => {
  let k = 0;
  const hits = (o: Decls) => { for (const p in o) if (refId(o[p]) === id) k++; };
  allTrees().forEach(l => eachNode(l, x => (['d', 't', 'm'] as Bp[]).forEach(b => hits(x.css[b] || {}))));
  styles().forEach(t => (['d', 't', 'm'] as Bp[]).forEach(b => hits((t.css && t.css[b]) || {})));
  return k;
};

/* ================================================== export review (lint)
   The exported file is the product, and its failures are silent: a dead link,
   a missing alt, an unreadable colour pair. This walks the whole project and
   reports them before anyone publishes.                                     */
/* ---- responsive images ------------------------------------------------
   A page shipped whatever was uploaded. A 3000px photo went to a phone at 3000px, which is
   most of the weight of a typical page and the one export-quality gap worth closing first.

   The decision lives here, in core, and the pixel-pushing lives in the export where the
   canvas is. Both read `imageWidths`, so the ladder the markup promises and the files the
   export writes cannot disagree — the alternative was two lists, which is how the publish
   record went stale twice.

   Only in the separate-files export. Inlining means one self-contained file, and inlining
   five variants of every image to save bandwidth on one of them is worse than not trying. */
/* ---- assets, as far as the core is concerned ------------------------------

   The core holds no bytes — the editor keeps them in IndexedDB and the server keeps them on
   a volume. What it holds is the two rules both of those have to agree on: how an `asset:`
   token is written, and what filename it turns into.

   That agreement is the whole reason they are here. The naming rule used to live only in
   builder.html, so a page served from the server and the same page exported to a zip could
   have named an image differently, and nothing would have noticed until a link broke. */

/** `asset:<id>`, optionally `@<width>` for a downscaled variant the separate-files export
    writes. Several consumers read this and only the path rewriter cares about the width. */
const A_RE = /asset:([A-Za-z0-9][A-Za-z0-9._:-]*)(?:@(\d+))?/g;

/** The path an asset takes in an export, and on the server. It keeps the recognisable upload
    name and adds the stable id before the extension, so two `photo.png` uploads cannot overwrite
    each other or share an immutable-cache URL. */
const assetFile = (a: { id: string; name?: string }) => {
  const id = String(a.id || 'asset').replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'asset';
  if (!a.name) return 'assets/' + id;
  const cleaned = String(a.name).replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'image';
  const dot = cleaned.lastIndexOf('.');
  const hasExtension = dot > 0 && dot < cleaned.length - 1;
  const extension = hasExtension ? cleaned.slice(dot).slice(0, 17) : '';
  const rawStem = hasExtension ? cleaned.slice(0, dot) : cleaned;
  const stem = rawStem.endsWith(`-${id}`) ? rawStem : `${rawStem.slice(0, 180)}-${id}`;
  return `assets/${stem}${extension}`;
};

/** Rewrite every token in `str` to a path, given a way to look an id up. `rel` is how deep
    the file sits — the same `rel` `pageHref` takes. A token whose asset has gone becomes the
    placeholder rather than a broken `src`. */
function assetPaths(str: string, get: (id: string) => { id: string; name?: string } | null, rel = '') {
  return String(str).replace(A_RE, (_m, id: string, _width: string | undefined,
    offset: number, source: string) => {
    const a = get(id);
    if (!a) return PH;
    /* SEO image URLs are made absolute before assets are materialized. Prefixing `../` there
       creates `https://site/base/../assets/...`, which escapes a configured subdirectory and
       cannot be frozen target-neutrally. A standalone asset token in HTML/CSS still needs the
       generated file's relative climb. */
    const absoluteUrlPrefix = /(?:https?:)?\/\/[^\s"'<>]*$/i.test(source.slice(0, offset));
    return (absoluteUrlPrefix ? '' : rel) + assetFile(a);
  });
}

const SRCSET_W = [480, 768, 1024, 1440, 1920];

/** The widths to write for an image whose natural width is `natural`. Ladder entries that
    are genuinely smaller, then the original — never an upscale, and nothing at all when the
    image is already small enough that a second copy would not pay for itself. */
function imageWidths(natural: unknown): number[] {
  const w = Math.round(parseFloat(String(natural || '')) || 0);
  if (!(w > 0)) return [];
  const under = SRCSET_W.filter(x => x <= w - MIN_STEP);
  return under.length ? [...under, w] : [];
}
/* Below this, a variant is not worth a request: the smallest ladder step is 480, so an
   image only just above it would gain a few kilobytes and cost a round trip. */
const MIN_STEP = 160;

/** The `sizes` attribute for one image, from the layout it actually sits in.

    Without this the browser assumes the image fills the viewport and picks the largest
    candidate, which throws away most of the benefit in any multi-column layout. The chain
    gives the real answer: the container's max width, less the section's padding, times this
    column's share of the row, less the gaps it does not get.

    Two stops, because there are two things worth saying: below the mobile breakpoint the
    columns go full width, and above it the image is capped at a computed pixel width.
    `min()` keeps that honest on a viewport narrower than the container. */
function sizesFor(id: string): string {
  const chain = chainTo(id);
  const sec = chain.find(n => n.type === 'section');
  const row = [...chain].reverse().find(n => n.type === 'row' || n.type === 'list');
  const col = [...chain].reverse().find(n => n.type === 'column');

  const full = sec && (sec.props as PropBag).width === 'full';
  let box = full ? 0 : parseFloat(String(state.meta.maxWidth || '1200')) || 1200;
  if (box && sec) {
    box -= (parseFloat(String((sec.css.d || {})['padding-left'] || '0')) || 0)
         + (parseFloat(String((sec.css.d || {})['padding-right'] || '0')) || 0);
  }
  if (!box) return '100vw';                      // a full-bleed section is the viewport

  if (row && col) {
    const kids = row.children || [];
    const share = (n: PcNode) => parseFloat(String((n.css.d || {})['flex-grow'] || '')) || 0;
    const total = kids.reduce((t, k) => t + share(k), 0);
    const mine = share(col);
    if (total > 0 && mine > 0) {
      const gap = parseFloat(String((row.css.d || {})['gap'] || '0')) || 0;
      box = (box - gap * Math.max(0, kids.length - 1)) * (mine / total);
    }
  }
  const px = Math.max(1, Math.round(box));
  return `(max-width: 767px) 100vw, min(100vw, ${px}px)`;
}

/* ---- colour, as numbers ----------------------------------------------
   One parser. `hex2rgb` was the only one for a long time and it drops alpha on the
   floor, which is right for a contrast ratio and useless for a picker — so a picker
   would have meant a second parser, and two parsers that disagree about `#abcd` is
   exactly the kind of drift that is impossible to notice.

   `transparent` is deliberately not accepted. Adding it would make
   `contrast('transparent', x)` return a ratio computed as if it were black instead of
   the `null` that means "cannot say", and alpha 0 is already reachable by dragging the
   slider to the end. The accepted set here is exactly what `hex2rgb` accepted before. */
interface Rgba { r: number; g: number; b: number; a: number }
const clamp = (n: number, lo: number, hi: number) => n < lo ? lo : n > hi ? hi : n;
const parseColor = (v: unknown): Rgba | null => {
  const h = String(v == null ? '' : v).trim();
  const hex = h.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const d = hex[1];
    /* 3 and 4 digits are shorthand: each nibble doubles. 5, 7 and anything over 8 is
       not a colour, so it falls through to null rather than being padded into one. */
    const full = (d.length === 3 || d.length === 4) ? d.split('').map(x => x + x).join('') : d;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = parseInt(full.slice(0, 6), 16);
    const a = full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1;
    return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255, a };
  }
  const f = h.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)?/i);
  if (!f) return null;
  const al = f[4] === undefined ? 1
    : f[4].endsWith('%') ? parseFloat(f[4]) / 100 : parseFloat(f[4]);
  return {
    r: clamp(Math.round(+f[1]), 0, 255), g: clamp(Math.round(+f[2]), 0, 255),
    b: clamp(Math.round(+f[3]), 0, 255), a: clamp(isNaN(al) ? 1 : al, 0, 1)
  };
};
/* Hex while it is opaque, because that is what a designer reads and what the token
   swatches hold; rgba() only once alpha earns it. Two decimals is enough for a slider
   and keeps the exported stylesheet from carrying float noise. */
const fmtColor = (c: Rgba) => {
  const hx = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  if (c.a >= 1) return '#' + hx(c.r) + hx(c.g) + hx(c.b);
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${+c.a.toFixed(2)})`;
};
/* HSV, not HSL: the saturation/value square every picker draws is HSV, and going
   through HSL to reach it costs a conversion and a rounding step each way. */
const rgb2hsv = (c: { r: number; g: number; b: number }) => {
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (mx === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
};
const hsv2rgb = (c: { h: number; s: number; v: number }) => {
  const h = ((c.h % 360) + 360) % 360 / 60, s = clamp(c.s, 0, 1), v = clamp(c.v, 0, 1);
  const i = Math.floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};
/* Kept as the array-shaped, alpha-free view the contrast ratio wants. It is now a
   caller rather than a second implementation. */
const hex2rgb = (v: string) => {
  const c = parseColor(v);
  return c ? [c.r, c.g, c.b] : null;
};
const lum = (c: number[]) => {
  const f = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * f[0] + .7152 * f[1] + .0722 * f[2];
};
/* WCAG 2.1 contrast ratio, 1–21 */
function contrast(fg: string, bg: string) {
  const a = hex2rgb(resolveColor(fg)), b = hex2rgb(resolveColor(bg));
  if (!a || !b) return null;
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
}
/* `effective` needs an ancestor chain, which the review already has because it walks the
   tree building one. Anything asking about a single node by id does not, and rebuilding the
   walk at each call site is how two answers to the same question start to disagree — so the
   chain is assembled here once. Root first, the node's own parent last, which is the order
   `effective` reads it in. */
function chainTo(id: string): PcNode[] {
  const up: PcNode[] = [];
  for (let pid = parentOf(id); pid; pid = parentOf(pid)) {
    const h = locate(pid);
    if (!h) break;
    up.push(h.node);
  }
  return up.reverse();
}
/** What a property actually resolves to for one node: its own value, then its classes, its
    text style, then inherited from above. Empty when nothing in the chain says. */
const effectiveAt = (id: string, prop: string) => {
  const h = locate(id);
  return h ? effective(h.node, prop, chainTo(id)) : '';
};

/* the effective value of a css prop, following text styles then ancestors */
function effective(node: PcNode, prop: string, chain: PcNode[]) {
  const own = (node.css.d || {})[prop];
  if (own) return own;
  const applied = nodeClasses(node);
  for (let i = applied.length - 1; i >= 0; i--) {
    const v = (applied[i].css.d || {})[prop];
    if (v) return v;
  }
  const t = findStyle(node.props.ts);
  if (t && (t.css.d || {})[prop]) return t.css.d[prop];
  for (let i = chain.length - 1; i >= 0; i--) {
    const v = (chain[i].css.d || {})[prop];
    if (v) return v;
  }
  return '';
}
const TEXTY = ['heading', 'text', 'button', 'nav'];
const HEADING_TAGS = /^h([1-6])$/;

/* ---- CRC-32, for the zip export ---------------------------------------
   The zip builder itself needs Blob and CompressionStream, so it stays in the UI.
   This part is arithmetic, and a wrong checksum does not fail loudly — it produces an
   archive that simply will not open. Tested against the published CRC-32 vectors, so
   the test checks the standard rather than checking this implementation against
   itself. */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();
function crc32(u8: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function lint() {
  const out: Finding[] = [];
  const add = (level: 'error' | 'warn', code: string, msg: string, where: any, nodeId?: string) => out.push({ level, code, msg, where, nodeId });

  /* ids available on each page, so links can be resolved across the site */
  const idsBySlug: Record<string, Set<string>> = {};
  state.pages.forEach(pg => {
    const ids = new Set<string>();
    [state.header, pg.tree, state.footer].forEach(l => eachNode(l, n => ids.add(domIdOf(n))));
    idsBySlug[pg.slug + '.html'] = ids;
  });
  const pageOf = (slug: string) => idsBySlug[slug];

  /* ---- per page: links, headings, images, contrast ---- */
  state.pages.forEach(pg => {
    const here = pg.slug + '.html';
    const scope = { page: pg.name, slug: pg.slug };
    if (!pg.title) add('warn', 'no-title', `“${pg.name}” has no browser title, so the tab falls back to the page name.`, scope);
    if (!pg.desc) add('warn', 'no-desc', `“${pg.name}” has no meta description, so search results pick their own snippet.`, scope);

    const seenIds = new Set(), dupIds = new Set();
    let headings: any[] = [];
    let heroImageReviewed = false;
    /* the components being walked into, so one that contains itself is a finding-free stop
       rather than a stack overflow in the review */
    const stack: string[] = [];

    const visit = (list: PcNode[], chain: PcNode[], region: string): void => list.forEach((n: PcNode) => {
      const w = { ...scope, region, node: DEF[n.type].label };
      const anchor = n.adv && n.adv.htmlId;
      if (anchor) { if (seenIds.has(anchor)) dupIds.add(anchor); seenIds.add(anchor); }

      /* A grid that is still three across on a phone.
         ---------------------------------------------------------------------------------
         Found by building a real page: a three-column card grid, no mobile override, and
         three 106-pixel columns on a 359-pixel screen. `minmax(0, 1fr)` stops it overflowing,
         which is why nothing looked broken — it is merely unreadable, and unreadable is not
         something a stylesheet can notice.

         This is what the review is for. It already reports things that are valid and wrong:
         contrast that passes as CSS, a heading order that parses, a link that resolves to
         nothing. A fixed three-track grid at mobile width is the same kind of fact, and the
         fix is one click at the mobile breakpoint — which the message says. `auto-fit` is
         never reported, because it is the answer. */
      if (n.type === 'box' && n.props.layout === 'grid') {
        const m = (n.css.m || {})['grid-template-columns'];
        const t = (n.css.t || {})['grid-template-columns'];
        const val = m || t || (n.css.d || {})['grid-template-columns'] || '';
        const tracks = gridTracks(val);
        if (tracks >= 3) {
          add('warn', 'grid-mobile',
            `A grid in the ${region} is ${tracks} columns wide on a phone, which leaves about `
            + `${Math.floor(320 / tracks)}px a column. Switch to Mobile and set Columns to `
            + `“As many as fit”, or to fewer.`, w, n.id);
        }
      }

      /* An anchor inside an anchor. A Link block makes a whole card clickable, and a button
         or a link inside one is invalid markup that browsers silently unnest — so the card
         stops being one link and nobody can tell why from looking at the panel. Reported
         rather than prevented, because the fix is a decision: drop the inner link, or drop
         the outer one. */
      const inLink = chain.some(x => x.type === 'box' && String(x.props.link || '').trim());
      if (inLink) {
        const own = n.type === 'box' ? String(n.props.link || '').trim()
          : (n.type === 'button' || n.type === 'heading' || n.type === 'image' || n.type === 'icon')
            ? String(n.props.link || '').trim() : '';
        if (own || hasItemHrefs(n) || (n.type === 'text' && /<a\s/i.test(String(n.props.html || '')))) {
          add('error', 'nested-link',
            `A ${DEF[n.type].label.toLowerCase()} inside a Link block is a link inside a link — browsers drop one of them, and it is not the one you would choose.`,
            w, n.id);
        }
      }

      /* links */
      if (n.type === 'nav') {
        const labels = new Set([slugify(pg.name), slugify(pg.title), slugify(pg.slug)]);
        if (isFront(pg)) labels.add('home');
        ((n.props.items as NavItem[]) || []).forEach(it => {
          const h = String(it && it.href || '').trim();
          const [path, frag = ''] = h.split('#');
          const target = path === '' ? here : path;
          /* A menu label promises a destination. “Work” pointing to the top of Home is a
             working URL and still a broken journey, so the ordinary dead-link check cannot
             catch it. A genuine Home item is intentionally allowed. */
          if (h && target === here && !frag && !labels.has(slugify(it && it.label || ''))) {
            add('warn', 'nav-page-top', `“${String(it && it.label || 'A menu item')}” in the ${region} links to the top of “${pg.name}”. Choose a section or a page that matches the label.`, w, n.id);
          }
        });
      }
      const links: any[] = [];
      if (hasItemHrefs(n)) ((n.props.items as any[]) || []).forEach((it: any) => links.push(it.href));
      if (n.props.link !== undefined) links.push(n.props.link);
      if (n.type === 'text') [...String(n.props.html || '').matchAll(/href="([^"]*)"/g)].forEach(m => links.push(m[1]));
      links.filter(h => h !== undefined && h !== null).forEach(href => {
        const h = String(href).trim();
        if (!h) return;
        if (h === '#') { add('warn', 'empty-anchor', `A link in the ${region} points at “#”, which goes nowhere.`, w, n.id); return; }
        if (parseWordPressContentReference(h)) return;
        if (h.startsWith(WORDPRESS_CONTENT_REFERENCE_PREFIX)) {
          add('error', 'wordpress-link-invalid', `A WordPress content link in the ${region} has an invalid target-neutral reference. Choose the WordPress destination again.`, w, n.id);
          return;
        }
        if (/^(https?:|mailto:|tel:|data:)/i.test(h)) return;
        /* `cms:item` resolves per item at export, so it cannot be checked as a path.
           What can go wrong is that nothing templates the collection — then it
           resolves to nothing at all. */
        if (h === 'cms:item') {
          const isc = n.src ? findCollection(n.src) : null;
          const owner = isc || (() => {
            let f: Collection | null = null;
            eachNode(pg.tree, x => { if (!f && x.src && findCollection(x.src)) { let d = false; eachNode([x], y => { if (y.id === n.id) d = true; }); if (d) f = findCollection(x.src); } });
            return (f || (pg.collection ? findCollection(pg.collection) : null)) as any;
          })();
          if (!owner) add('error', 'item-link-no-scope', `A link in the ${region} points at “this item’s page”, but nothing around it says which collection.`, w, n.id);
          else if (!state.pages.some(x => x.collection === owner.id)) add('error', 'item-link-no-template', `A link in the ${region} points at an item’s own page, but no page is a detail template for “${owner.name}”.`, w, n.id);
          return;
        }
        const [path, frag] = h.split('#');
        const target = path === '' ? here : path;
        /* A bare `#anchor` in a global region resolves only on the page that has it — unless
           there is one page, where "every page" and "this page" are the same thing and the
           warning is noise. A one-pager with an anchor nav is a normal site, and this fired
           three times on one built with this very builder.

           Not just quieter: the early return meant a single-page project never had the anchor
           checked at all. Falling through sends it to the same `dead-anchor` check a page-local
           link gets, so `#nope` in a one-pager is now an error rather than a shrug. */
        if (path === '' && region !== 'page' && state.pages.length > 1) {
          add('warn', 'global-fragment', `The ${region} links to “${h}”. Because the ${region} is on every page, that only resolves on pages that happen to have this anchor — name the page instead.`, w, n.id);
          return;
        }
        if (!pageOf(target)) { add('error', 'dead-link', `“${h}” in the ${region} points at ${target}, which is not a page in this project.`, w, n.id); return; }
        if (frag && !pageOf(target).has(frag)) add('error', 'dead-anchor', `“${h}” in the ${region} has no matching element id on ${target}.`, w, n.id);
      });

      /* images */
      if (n.type === 'image') {
        if (!n.props.src) add('warn', 'no-image', `An image in the ${region} has no source and will export a placeholder.`, w, n.id);
        /* Demand alt text once there is an image to describe. Until a source is
           set the element is a placeholder — `no-image` already reports that,
           and raising an error too made every template with a photo slot open
           on a wall of problems the user cannot yet act on. */
        if (n.props.src && !n.props.decorative && !String(n.props.alt || '').trim())
          add('error', 'no-alt', `An image in the ${region} has no alt text. Describe it, or mark it decorative.`, w, n.id);
        if (n.props.src && !(n.props.w && n.props.h))
          add('warn', 'no-dimensions', `An image in the ${region} has no width/height, so the page will shift as it loads.`, w, n.id);
        /* The first image in the first body section is the only position the review can call
           above-the-fold without guessing at authored heights. Later images should stay lazy. */
        const inFirstSection = region === 'page' && (n === pg.tree[0] || chain[0] === pg.tree[0]);
        if (!heroImageReviewed && inFirstSection && n.props.src) {
          heroImageReviewed = true;
          if (n.props.lazy) add('warn', 'hero-image-lazy', `The first image in “${pg.name}” is lazy-loaded even though it appears in the opening section. Turn off Lazy load so the hero can start sooner.`, w, n.id);
        }
      }
      /* video */
      if (n.type === 'video' && !canFacade(n.props) && ['youtube', 'vimeo'].includes(vidSrc(n.props).kind) && !n.props.autoplay)
        add('warn', 'eager-video', `A video in the ${region} loads its player on page load. Turn on “Load on click” to defer it.`, w, n.id);

      if (n.type === 'slider' && (n.children || []).length < 2)
        add('warn', 'slider-thin', `A slider in the ${region} holds ${(n.children || []).length} slide${(n.children || []).length === 1 ? '' : 's'}, so there is nothing to scroll to.`, w, n.id);

      if (n.type === 'crumbs' && n.props.mode === 'manual'
        && !(Array.isArray(n.props.items) ? n.props.items : []).length)
        add('warn', 'crumbs-empty', `A breadcrumb in the ${region} is set to a written trail but has no crumbs.`, w, n.id);

      if (n.type === 'code' && !String(n.props.body || '').trim())
        add('warn', 'code-empty', `A code block in the ${region} is empty, so it exports nothing.`, w, n.id);

      if (n.type === 'table') {
        const grid = tableGrid(n.props.body);
        if (!grid.length) add('warn', 'table-empty', `A table in the ${region} has no rows, so it exports nothing.`, w, n.id);
        /* the grid is padded, so raggedness has to be counted before that happens */
        const raw = String(n.props.body == null ? '' : n.props.body).replace(/\r/g, '');
        const lines = raw.split('\n').filter(l => l.trim() !== '');
        const sep = raw.includes('\t') ? '\t' : '|';
        const widths = lines.map(l => l.split(sep).length);
        const wide = widths.length ? Math.max(...widths) : 0;
        const short = widths.filter(x => x < wide).length;
        if (short) add('warn', 'table-ragged', `${short} row${short === 1 ? '' : 's'} of a table in the ${region} have fewer cells than the widest, so they export padded with blanks.`, w, n.id);
        if (grid.length > 1 && !n.props.head && !n.props.rowhead)
          add('warn', 'table-no-heading', `A table in the ${region} marks no heading row or column, so a screen reader cannot say what a cell means.`, w, n.id);
      }

      if (n.type === 'tabs') {
        const rows = (Array.isArray(n.props.items) ? n.props.items : []) as TabPanel[];
        if (!rows.length) add('warn', 'tabs-empty', `A tab strip in the ${region} has no tabs, so it exports nothing.`, w, n.id);
        const noL = rows.filter(r => !String(r && r.label || '').trim()).length;
        const noP = rows.filter(r => String(r && r.label || '').trim() && !String(r && r.panel || '').trim()).length;
        if (noL) add('error', 'tabs-no-label', `${noL} tab${noL === 1 ? '' : 's'} in the ${region} have no label, so there is nothing to click.`, w, n.id);
        if (noP) add('warn', 'tabs-no-panel', `${noP} tab${noP === 1 ? '' : 's'} in the ${region} open onto an empty panel.`, w, n.id);
      }

      /* accordion — the two ways a row can be a dead end */
      if (n.type === 'accordion') {
        const rows = Array.isArray(n.props.items) ? n.props.items : [];
        if (!rows.length) add('warn', 'accordion-empty', `An accordion in the ${region} has no questions, so it exports nothing.`, w, n.id);
        /* counted rather than listed: twelve rows would otherwise be twelve findings */
        const noQ = rows.filter(r => !String(r && r.q || '').trim()).length;
        const noA = rows.filter(r => String(r && r.q || '').trim() && !String(r && r.a || '').trim()).length;
        if (noQ) add('error', 'accordion-no-question', `${noQ} row${noQ === 1 ? '' : 's'} of an accordion in the ${region} have no question, so there is nothing to click.`, w, n.id);
        if (noA) add('warn', 'accordion-no-answer', `${noA} row${noA === 1 ? '' : 's'} of an accordion in the ${region} open onto an empty answer.`, w, n.id);
      }

      /* embed — markup this builder does not read, so it says what it cannot check */
      if (n.type === 'embed') {
        const raw = String(n.props.html || '');
        if (!raw.trim()) add('warn', 'embed-empty', `An embed in the ${region} has no markup, so it exports an empty box.`, w, n.id);
        else if (/<script\b/i.test(raw)) add('warn', 'embed-script', `An embed in the ${region} carries a script. It ships to the exported page but never runs in this editor, so open the real file before you publish.`, w, n.id);
      }

      /* icon — a link whose only content is a glyph has no name without a label */
      if (n.type === 'icon' && String(n.props.link || '').trim() && !String(n.props.label || '').trim())
        add('error', 'icon-link-no-label', `A linked icon in the ${region} has no accessible label, so the link has no name at all for anyone using a screen reader.`, w, n.id);

      /* gallery — same demands as the Image widget, counted per gallery */
      if (n.type === 'gallery') {
        /* `items` is gallery tiles here, nav links on a nav and questions on an
           accordion, so the branch that knows which says so. */
        const slots = (Array.isArray(n.props.items) ? n.props.items as GalleryTile[] : []).filter(Boolean);
        if (!slots.length) add('warn', 'gallery-empty', `A gallery in the ${region} has no images, so it exports nothing.`, w, n.id);
        /* An empty slot is reported as a slot. Demanding alt text for an image
           that is not there yet is what made a fresh template open on a wall of
           errors nobody could act on — the same split the Image widget uses. */
        const empty = slots.filter(t => !String(t.src || '').trim()).length;
        if (empty) add('warn', 'gallery-no-image', `${empty} tile${empty === 1 ? '' : 's'} in a gallery in the ${region} have no image yet and will export a placeholder.`, w, n.id);
        const tiles = slots.filter(t => String(t.src || '').trim());
        const noAlt = tiles.filter(t => !String(t.alt || '').trim()).length;
        const noDim = tiles.filter(t => !(t.w && t.h)).length;
        if (noAlt) add('error', 'gallery-no-alt', `${noAlt} of ${tiles.length} image${tiles.length === 1 ? '' : 's'} in a gallery in the ${region} have no alt text. Describe each one.`, w, n.id);
        if (noDim) add('warn', 'gallery-no-dimensions', `${noDim} image${noDim === 1 ? '' : 's'} in a gallery in the ${region} have no width/height, so the grid will shift as it loads.`, w, n.id);
      }

      /* headings, in document order */
      if (n.type === 'heading' && HEADING_TAGS.test(String(n.props.level || '')))
        headings.push({ level: +String(n.props.level)[1], node: n, region });

      /* forms */
      if (n.type === 'form') {
        const fields = Array.isArray(n.props.fields) ? n.props.fields : [];
        const rawAction = String(n.props.action || '').trim();
        const wordpressManaged = n.props.mode === 'wordpress';
        if (!wordpressManaged && !rawAction)
          add('error', 'form-no-action', `A form in the ${region} has nowhere to send submissions. Pagecraft does not receive form posts, so its fields and button stay disabled when published until you paste a complete https:// endpoint.`, w, n.id);
        else if (!wordpressManaged && !safeFormAction(rawAction))
          add('error', 'unsafe-form-action', `A form in the ${region} does not use an explicit, secure endpoint, so submission is disabled when published. Paste a complete https:// URL for the form service that will receive it.`, w, n.id);
        if (!fields.length)
          add('warn', 'form-no-fields', `A form in the ${region} has no fields.`, w, n.id);
        fields.forEach((fl, fi) => {
          if (!String(fl.label || '').trim())
            add('error', 'field-no-label', `Field ${fi + 1} of a form in the ${region} has no label, so nobody using a screen reader can tell what it wants.`, w, n.id);
        });
        /* a form dropped onto a dark section keeps light-section defaults, so
           its own colours need the same contrast check as any other text */
        let behind = '';
        for (let i = chain.length - 1; i >= 0 && !behind; i--) behind = (chain[i].css.d || {})['background-color'] || '';
        if (!behind) behind = (findColor('bg') || {}).value || '';
        const pairs = [
          ['--f-label', behind, 'Field labels'],
          ['--f-text', (n.css.d || {})['--f-bg'] || behind, 'Text typed into the fields'],
          ['--f-btn-fg', (n.css.d || {})['--f-btn-bg'] || behind, 'The submit button label']
        ];
        pairs.forEach(([prop, bg, what]) => {
          const fg = (n.css.d || {})[prop];
          const r = fg && bg ? contrast(fg, bg) : null;
          if (r && r < 4.5) add('warn', 'form-contrast',
            `${what} in a form in the ${region} sit at ${r.toFixed(2)}:1 against their background — WCAG AA wants 4.5:1.`, w, n.id);
        });

        const names = fields.map((fl, fi) => String(fl.name || '').trim() || slugify(fl.label) || 'field-' + (fi + 1));
        names.forEach((nm, fi) => {
          if (names.indexOf(nm) !== fi)
            add('warn', 'field-dup-name', `Two fields in a form in the ${region} both submit as “${nm}”, so one value will overwrite the other.`, w, n.id);
        });
      }

      /* empty labels */
      if (n.type === 'button' && !String(n.props.text || '').trim())
        add('error', 'empty-button', `A button in the ${region} has no label.`, w, n.id);
      else if (n.type === 'button' && !String(n.props.link || '').trim())
        add('warn', 'button-no-link', `“${String(n.props.text || 'Button')}” in the ${region} has no destination, so it is inert on the published page. Add a link or remove the button.`, w, n.id);

      /* contrast of text against the nearest background behind it */
      if (TEXTY.includes(n.type)) {
        const fg = effective(n, 'color', chain);
        let bg = (n.css.d || {})['background-color'] || '';
        const ts = findStyle(n.props.ts);
        if (!bg && ts) bg = (ts.css.d || {})['background-color'] || '';
        for (let i = chain.length - 1; i >= 0 && !bg; i--) bg = (chain[i].css.d || {})['background-color'] || '';
        if (!bg) bg = (findColor('bg') || {}).value || '';
        const ratio = fg && bg ? contrast(fg, bg) : null;
        if (ratio) {
          const size = parseFloat(effective(n, 'font-size', chain)) || 16;
          const weight = parseInt(effective(n, 'font-weight', chain), 10) || 400;
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          const need = large ? 3 : 4.5;
          if (ratio < need) add('warn', 'contrast',
            `Text in the ${region} sits at ${ratio.toFixed(2)}:1 against its background — WCAG AA wants ${need}:1 for this size.`, w, n.id);
        }
      }
      /* An instance renders its definition, so the definition's content is on this page and the
         review has to see it: an image with no alt text inside a component is a finding on every
         page that places one. The region says which component, and the finding still carries the
         *instance's* node id, because that is the thing on this page somebody can click.

         Reported once per instance rather than once per definition. A component used four times
         with a missing alt is four places a screen reader says nothing, and collapsing that to
         one line would be the review deciding how much the author should care. */
      if (n.use) {
        const cd = findComponent(n.use);
        if (cd && !stack.includes(n.use)) {
          stack.push(n.use);
          visit([cd.node], chain.concat(n), `${region}, in “${cd.name}”`);
          stack.pop();
        }
      }
      visit(n.children || [], chain.concat(n), region);
    });

    visit(state.header, [], 'global header');
    visit(pg.tree, [], 'page');
    visit(state.footer, [], 'global footer');

    dupIds.forEach(id => add('error', 'duplicate-id', `The anchor id “${id}” is used more than once on “${pg.name}”.`, scope));

    const h1s = headings.filter(h => h.level === 1);
    /* A page with nothing on it has no heading structure to get wrong, and saying so
       is the first thing a brand-new empty site would hear. */
    if (!h1s.length && pg.tree.length) add('warn', 'no-h1', `“${pg.name}” has no H1, so its main subject is unstated.`, scope);
    if (h1s.length > 1) add('warn', 'many-h1', `“${pg.name}” has ${h1s.length} H1 headings. Use one, then H2s beneath it.`, scope);
    /* Two paginated lists on one page have no coherent answer: each would want to decide
       how many files the page becomes. The first in document order does, and this says so
       rather than leaving the others looking broken for no visible reason. */
    const pgn = paginatorOf(pg);
    if (pgn && pgn.extra) add('warn', 'many-paginators',
      `“${pg.name}” has ${pgn.extra + 1} lists set to paginate. The first one decides how many pages there are; the ${pgn.extra === 1 ? 'other shows' : 'others show'} every item.`, scope);
    for (let i = 1; i < headings.length; i++) {
      const jump = headings[i].level - headings[i - 1].level;
      if (jump > 1) add('warn', 'heading-skip',
        `Heading order jumps from H${headings[i - 1].level} to H${headings[i].level} on “${pg.name}”, which breaks screen-reader navigation.`,
        { ...scope, region: headings[i].region }, headings[i].node.id);
    }
  });

  const rank = { error: 0, warn: 1 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}
const lintCounts = (findings: Finding[]) => ({
  error: findings.filter(f => f.level === 'error').length,
  warn: findings.filter(f => f.level === 'warn').length
});

/* ---- the style clipboard ---------------------------------------------
   Deliberately a second clipboard rather than a mode on `clip`: copying a look must
   not throw away an element you copied earlier, and copying an element must not
   throw away a look. They are different jobs and people interleave them.

   A text style saves the reusable case; this is the one-off. Before it, the only way
   to make one element look like another was to rebuild it control by control. */
const styleClip: { css: Css | null; st: States | null; cls: string[] | null; ts: string; adv: string; from: string } =
  { css: null, st: null, cls: null, ts: '', adv: '', from: '' };

function copyStyles(id: string) {
  const h = locate(id);
  if (!h) return false;
  const n = h.node;
  styleClip.css = clone(n.css);
  /* the states travel with the styling. "Make this look like that" that drops the hover is
     not what anyone means, and the omission would only show up on the live site. */
  styleClip.st = n.st ? clone(n.st) : null;
  styleClip.cls = [...(Array.isArray(n.cls) ? n.cls : [])];
  styleClip.ts = String((n.props && n.props.ts) || '');
  styleClip.adv = (n.adv && n.adv.css) || '';
  styleClip.from = String(nameOf(n));
  return true;
}

/* Replace, not merge. "Paste styles" means make this look like that, and a merge
   leaves behind whatever the target had that the source happened not to mention —
   which is the one outcome nobody asks for.

   All three breakpoints travel: a look is not a look if it falls apart on mobile.

   What crosses widget types follows the rule fanTargets already set for
   multi-select — a CSS property goes everywhere, a content prop only where the
   target declares that control. So `ts` reaches a Heading from a WYSIWYG and stops
   at an Image, which has no text style to set. */
function pasteStyles(id: string) {
  if (!styleClip.css) return false;
  const h = locate(id);
  if (!h) return false;
  const n = h.node;
  n.css = clone(styleClip.css) as Css;
  /* replaced, not merged, like `css` — and deleted outright when the source had none, so a
     paste cannot leave a hover behind that the thing being copied did not have */
  if (styleClip.st) n.st = clone(styleClip.st) as States; else delete n.st;
  /* a class deleted between the copy and the paste is dropped rather than carried
     as a dangling id */
  n.cls = (styleClip.cls || []).filter(findClass);
  if (n.adv) n.adv.css = styleClip.adv;
  if (ctlKeys(n.type).has('ts')) n.props.ts = styleClip.ts;
  return true;
}
const pasteStylesMany = (ids: string[]) => ids.filter(pasteStyles).length;

/* ---- finding things -------------------------------------------------
   Nothing could find a word across a project. With twelve pages, two global regions
   and a CMS, "where did I write that" had no answer and renaming anything meant
   opening every page and looking.

   One walker underpins all of it, so the count in the results, the jump and the
   replace can never disagree — and a new widget joins in by naming its text props
   in TEXT_SLOTS and nothing else. A bare string is a prop; an array names the prop
   and then the keys inside each row. */
const TEXT_SLOTS = {
  heading: ['text'], button: ['text'], icon: ['label'],
  text: ['html'], embed: ['html'],
  quote: ['text', 'by'],
  code: ['body', 'title'],
  crumbs: ['home', ['items', 'label']],
  table: ['body', 'caption'],
  tabs: [['items', 'label', 'panel']],
  image: ['alt', 'caption'],
  accordion: [['items', 'q', 'a']],
  gallery: [['items', 'alt', 'caption']],
  nav: [['items', 'label']],
  form: [['fields', 'label', 'ph']]
};
/* Embed HTML remains searchable, but it is executable on the published page and therefore only
   an owner may edit it. Shared by the inspector and the server-side content boundary. */
const OWNER_ONLY_CONTENT = new Set(['embed']);
/* the fields on a page itself, rather than on anything in it */
const PAGE_TEXT = [['title', 'Browser title'], ['desc', 'Meta description'], ['name', 'Page name']];
const SLOT_LABEL = {
  text: 'Text', html: 'Rich text', label: 'Label', alt: 'Alt text', caption: 'Caption',
  q: 'Question', a: 'Answer', ph: 'Placeholder', by: 'Attribution', panel: 'Panel',
  body: 'Rows', title: 'File name', home: 'Front page name'
};

/* Where an asset reference can sit. Same shape as `TEXT_SLOTS`: a bare string is a prop, an
   array is a prop and the keys inside its rows.

   Here rather than in the server for the reason `assetFile` is here — two readers, one list.
   The server decides whether a save that moves an image is content; the inspector decides
   whether to offer the control that moves it. Those answers have to agree, and the only way
   they keep agreeing is by coming from the same declaration.

   Short, deliberately: a background image is CSS and refused on that ground, and a
   project-wide favicon is not one page's content. */
const ASSET_SLOTS: Record<string, (string | string[])[]> = {
  image: ['src'],
  video: ['src', 'poster'],
  gallery: [['items', 'src']]
};

/** Which prop keys, for this widget type, hold words rather than settings.

    `TEXT_SLOTS` already answers that per node; this answers it per *type*, which is what a
    panel needs before it has a node in hand — and what tells a control that edits content
    from one that edits the site. Both readers of that distinction now read the same list:
    the inspector, to decide what to offer a content account, and the server, to decide what
    a content account may save. A widget whose slots change is covered in both places at
    once, which is the only way that stays true. */
function contentKeys(type: string): Set<string> {
  const out = new Set<string>();
  if (OWNER_ONLY_CONTENT.has(type)) return out;
  const add = (specs: (string | string[])[]) => specs.forEach(spec =>
    out.add(typeof spec === 'string' ? spec : spec[0]));
  add((TEXT_SLOTS as Record<string, any[]>)[type] || []);
  /* An image is content when it is one of the site's own uploads — the server checks the
     value, this only decides whether the control is offered. A field that can hold a URL is
     therefore offered to a content account, and a URL typed into it is refused on save. That
     is the honest split: the editor cannot know the site's assets, and the server can. */
  add(ASSET_SLOTS[type] || []);
  return out;
}

function textSlots(n: PcNode) {
  const out: any[] = [];
  for (const spec of ((TEXT_SLOTS as Record<string, any[]>)[n.type] || [])) {
    if (typeof spec === 'string') {
      if (typeof (n.props as PropBag)[spec] === 'string') out.push({ prop: spec, i: -1, sub: '' });
    } else {
      const [arr, ...subs] = spec;
      const list = Array.isArray((n.props as PropBag)[arr]) ? (n.props as PropBag)[arr] as any[] : [];
      list.forEach((row: any, i: number) => subs.forEach((sub: string) => {
        if (row && typeof row[sub] === 'string') out.push({ prop: arr, i, sub });
      }));
    }
  }
  return out;
}
const slotGet = (n: PcNode, s: Slot): any => {
  const bag = n.props as PropBag;
  return s.i < 0 ? bag[s.prop] : (bag[s.prop] as any[])[s.i][s.sub];
};
const slotSet = (n: PcNode, s: Slot, v: string) => {
  const bag = n.props as PropBag;
  if (s.i < 0) bag[s.prop] = v; else (bag[s.prop] as any[])[s.i][s.sub] = v;
};
const slotName = (s: Slot) => (SLOT_LABEL as Record<string, string>)[s.sub || s.prop] || (s.sub || s.prop);

/* Rich text is markup, so neither the search nor the replace may wander into a tag:
   looking for "div" must not report or rewrite every <div>. Split on tags and touch
   only what sits between them. Entities are left as written — searching for "&" will
   match an &amp; and that is a known edge rather than a handled one. */
const outsideTags = (str: unknown, fn: (t: string) => string) =>
  String(str == null ? '' : str).split(/(<[^>]*>)/)
    .map(part => (part.startsWith('<') ? part : fn(part))).join('');
const isHtmlSlot = (s: Slot) => s.prop === 'html';

/* One string that both the count and the snippet read. A tag becomes a space rather
   than nothing, so a match can never form across a tag boundary — which is what keeps
   this count identical to what `replaceAll` will actually change. */
const searchText = (value: unknown, html: boolean) => {
  const v = String(value == null ? '' : value);
  return html ? v.replace(/<[^>]*>/g, ' ') : v;
};

/* How many times the needle appears, and where the first one is. Both offsets index
   the returned `text`, so the snippet can slice it — the earlier version handed back
   an offset into the *raw* value and the snippet re-found the match with `indexOf`,
   which returns the earliest occurrence rather than the one that was counted. A second
   hit was therefore shown with the first one's context. */
function slotHits(value: unknown, needle: string, ci: boolean, html: boolean): SlotHit {
  const text = searchText(value, html);
  const nq = ci ? needle.toLowerCase() : needle;
  if (!nq) return { n: 0, at: -1, text };
  const hay = ci ? text.toLowerCase() : text;
  let n = 0, at = -1, from = 0, i;
  while ((i = hay.indexOf(nq, from)) >= 0) { if (at < 0) at = i; n++; from = i + nq.length; }
  return { n, at, text };
}

/* A readable piece of `text` around the match. Whitespace is collapsed *after*
   slicing, never before — collapsing first would move the offset, which is the whole
   family of bug this replaced. */
function snippet(text: unknown, at: number, len: number, pad = 26) {
  const t = String(text == null ? '' : text);
  const from = Math.max(0, at - pad);
  const to = Math.min(t.length, at + len + pad);
  return (from ? '…' : '') + t.slice(from, to).replace(/\s+/g, ' ').trim() + (to < t.length ? '…' : '');
}

/* Every hit in the project, in reading order: the header, then each page, then the
   footer, then the CMS. `where` is what the results list groups by. */
function searchAll(q: string | null, o: { caseSensitive?: boolean; cms?: boolean } = {}) {
  const needle = String(q || '');
  if (!needle) return [];
  const ci = !o.caseSensitive;
  const out: any[] = [];
  const scan = (list: PcNode[], where: string, page: number, pageName: string) => eachNode(list, (n: PcNode) => {
    textSlots(n).forEach(s => {
      const val = slotGet(n, s);
      const { n: hits, at, text } = slotHits(val, needle, ci, isHtmlSlot(s));
      if (hits) out.push({
        where, page, pageName, nodeId: n.id, type: n.type, element: nameOf(n),
        field: slotName(s), slot: s, hits, snippet: snippet(text, at, needle.length)
      });
    });
  });
  scan(state.header, 'header', -1, 'Global header');
  state.pages.forEach((p, i) => {
    PAGE_TEXT.forEach(([k, lb]) => {
      const { n: hits, at, text } = slotHits((p as any)[k], needle, ci, false);
      if (hits) out.push({
        where: 'page', page: i, pageName: p.name, nodeId: '', type: 'meta',
        element: 'Page settings', field: lb, meta: k, hits, snippet: snippet(text, at, needle.length)
      });
    });
    scan(p.tree, 'page', i, p.name);
  });
  scan(state.footer, 'footer', -1, 'Global footer');
  {
    const { n: hits, at, text } = slotHits(state.meta.name, needle, ci, false);
    if (hits) out.push({
      where: 'project', page: -1, pageName: 'Project', nodeId: '', type: 'meta',
      element: 'Project settings', field: 'Project name', meta: 'name', hits,
      snippet: snippet(text, at, needle.length)
    });
  }
  if (o.cms !== false) collections().forEach(col => col.items.forEach(it => {
    col.fields.forEach(f => {
      const val = it.values[f.id];
      if (typeof val !== 'string') return;
      const { n: hits, at, text } = slotHits(val, needle, ci, f.type === 'rich');
      if (hits) out.push({
        where: 'cms', page: -1, pageName: col.name, colId: col.id, itemId: it.id,
        element: itemTitle(col, it), type: 'cms', field: f.name, hits,
        snippet: snippet(text, at, needle.length)
      });
    });
  }));
  return out;
}
const searchCount = (hits: { hits: number }[]) => hits.reduce((t, h) => t + h.hits, 0);

/* Its own walk rather than a replay of a hit list: a list held across an edit is
   stale, and this is the one operation that must not act on a stale one. */
function replaceAll(q: string | null, to: string | null, o: { caseSensitive?: boolean; cms?: boolean } = {}) {
  const needle = String(q || '');
  if (!needle) return 0;
  const ci = !o.caseSensitive;
  const rep = String(to == null ? '' : to);
  let done = 0;
  const swap = (text: string) => {
    const h = ci ? text.toLowerCase() : text;
    const nq = ci ? needle.toLowerCase() : needle;
    let outStr = '', from = 0, i;
    while ((i = h.indexOf(nq, from)) >= 0) { outStr += text.slice(from, i) + rep; from = i + nq.length; done++; }
    return outStr + text.slice(from);
  };
  const scan = (list: PcNode[]) => eachNode(list, (n: PcNode) => textSlots(n).forEach((s: Slot) => {
    const val = String(slotGet(n, s));
    slotSet(n, s, isHtmlSlot(s) ? outsideTags(val, swap) : swap(val));
  }));
  scan(state.header);
  state.pages.forEach(p => {
    /* a page's slug is deliberately left alone: it is a published URL, and moving one
       silently because a word changed is how links break */
    PAGE_TEXT.forEach(([k]) => { const q = p as any; if (typeof q[k] === 'string') q[k] = swap(q[k]); });
    scan(p.tree);
  });
  scan(state.footer);
  if (typeof state.meta.name === 'string') state.meta.name = swap(state.meta.name);
  if (o.cms !== false) collections().forEach(col => col.items.forEach(it => {
    col.fields.forEach(f => {
      const val = it.values[f.id];
      if (typeof val !== 'string') return;
      it.values[f.id] = f.type === 'rich' ? outsideTags(val, swap) : swap(val);
    });
  }));
  return done;
}

/* ================================================== clipboard + traversal */
/* The clipboard holds a detached copy, so pasting works across pages and
   regions. Classes and text styles travel as references — they are project
   level, so the pasted copy keeps following them. */
const clip: { node: PcNode | null } = { node: null };
function copyNode(id: string) {
  const h = locate(id);
  if (!h) return false;
  clip.node = clone(h.node);
  return true;
}
/* Paste inside the selection when it can hold one, else as its sibling, else
   wherever above it fits. Wrappers are created exactly as a drag would. */
function pasteNode(intoId: string | null) {
  if (!clip.node) return null;
  return dropTree(reid(clone(clip.node)), intoId);
}
/* Place a detached subtree: inside the target when it can hold one, else as its
   sibling, else wherever above it fits — building wrappers as a drag would. */
function dropTree(fresh: PcNode, intoId: string | null): PcNode | null {
  /* A predicate: did it fit here? Every call site below reads it as one, and dropTree
     returns `fresh` rather than anything place() hands back. Annotated as boolean
     because that is what it means — the first pass typed it `PcNode | null` and then
     changed the code to suit the annotation, which is backwards. */
  const place = (list: PcNode[], index: number, parentType: string | null): boolean => {
    if (!fitsIn(parentType, fresh.type)) return false;
    list.splice(index, 0, wrap(fresh.type, takes(parentType), fresh));
    return true;
  };
  const h = intoId ? locate(intoId) : null;
  if (!h) return place(tree(), tree().length, null) ? fresh : null;
  if (place(h.node.children, h.node.children.length, h.node.type)) return fresh;
  if (place(h.list, h.i + 1, h.parent ? h.parent.type : null)) return fresh;
  let up = h.parent, top: PcNode = h.node;
  while (up) {
    const uh = locate(up.id);
    if (place(up.children, up.children.length, up.type)) return fresh;
    top = up;
    up = uh ? uh.parent : null;
  }
  /* The document root is the last ancestor, and the only thing that holds a section.
     Skipping it meant clicking a template with a heading selected did nothing and said
     "That does not fit there" — while the same click with a section selected, or with
     nothing selected, worked. It goes after the top-level node the selection sat
     inside, which is where smartTarget puts one too. */
  const list = tree();
  const at = list.indexOf(top);
  return place(list, at < 0 ? list.length : at + 1, null) ? fresh : null;
}

/* Where a new `key` should land given the current selection: inside it when it can
   hold one, otherwise beside the nearest ancestor that can. Shared by the Add panel
   and the media library, which both place elements without a drag — so "add" lands
   next to what you were looking at rather than at the end of the page.
   Returns the container (null meaning the page root) and the index within it. */
function smartTarget(key: WidgetType): [PcNode | null, number] {
  let container: PcNode | null = null, index: number | null = null;
  const s = state.ui.sel ? locate(state.ui.sel) : null;
  if (s) {
    let node = s.node, parent = s.parent;
    if (holds(node.type, key)) { container = node; index = node.children.length; }
    else {
      while (parent && !holds(parent.type, key)) {
        node = parent;
        const up = locate(parent.id);
        parent = up ? up.parent : null;
      }
      if (parent) { container = parent; index = parent.children.findIndex(c => c.id === node.id) + 1; }
      else { container = null; index = tree().findIndex(c => c.id === node.id) + 1; }
    }
  }
  if (index === null) index = tree().length;
  return [container, index];
}

/* ---- a control's value becoming state ---------------------------------
   The single point where editing a field mutates the document. It was in the UI half
   only because that is where the fields are; it touches no DOM, and every rule below
   was previously untested. */

/** Write one control's value onto one node. `_id`, `_cls` and `_css` are the Advanced
    escape hatches and land on `adv` rather than on props; everything else is either a
    CSS declaration or a prop. */
function applyOne(n: PcNode, c: Pick<Control, 'k' | 'c' | 'r'>, v: any) {
  /* this becomes an id attribute in the exported HTML, so anything that is not a
     word character or a dash comes straight out — including the space and the '#'
     that a person naturally types when writing an anchor */
  if (c.k === '_id') { n.adv.htmlId = String(v == null ? '' : v).replace(/[^\w-]/g, ''); return; }
  if (c.k === '_cls') { n.adv.cls = v; return; }
  if (c.k === '_css') { n.adv.css = v; return; }
  if (c.c) setCss(tgtObj(n), c.c, v, !!c.r);
  else if (c.k && c.k.startsWith(VAL)) instSet(n, c.k.slice(VAL.length), v == null ? '' : String(v));
  else if (c.k) (n.props as PropBag)[c.k] = v;
}

/** One edit reaches every selected element. The exception is a class target: its
    members already share the one object, so it takes a single write — fanning out
    would rewrite the same value once per selected element. */
function applyC(n: PcNode, c: Pick<Control, 'k' | 'c' | 'r'>, v: any) {
  const ids = selIds();
  if (ids.length > 1 && ids.includes(n.id) && !(c.c && tgtIsClass(n))) {
    fanTargets(c, ids).forEach(t => applyOne(t, c, v));
    return;
  }
  applyOne(n, c, v);
}

/* ---- saved blocks -------------------------------------------------------
   A block is a detached subtree kept on the project, so it travels with the
   project JSON and keeps following the classes and text styles it references. */
const blocks = () => (state.meta.blocks || (state.meta.blocks = []));
const findBlock = (id: string) => blocks().find(b => b.id === id) || null;

/* ---- content collections ------------------------------------------------
   A collection is a content type: a field schema plus the items that fill it.
   Widgets bind to a field, a Collection List repeats over the items, and a page
   marked with a collection becomes the template for one static file per item.
   Everything resolves at export — the site that ships is plain HTML. */
const FIELD_TYPES = [
  ['text', 'Text'], ['rich', 'Rich text'], ['image', 'Image'], ['link', 'Link'],
  ['number', 'Number'], ['date', 'Date'], ['option', 'Option'], ['bool', 'Yes / no'],
  ['ref', 'Reference']
];
const collections = () => (state.meta.collections || (state.meta.collections = []));
const findCollection = (id: string) => collections().find(c => c.id === id) || null;
const findField = (col: Collection | null, fid: string) => (col ? (col.fields || []).find(f => f.id === fid) || null : null);
const findItem = (col: Collection | null, iid: string) => (col ? (col.items || []).find(i => i.id === iid) || null : null);

/* ids are slugs so they read in the binding UI and in exported paths; both are
   made unique against their own list rather than globally */
const uniqueId = (base: unknown, taken: string[]) => {
  const b = tokenId(base) || 'x';
  let id = b, k = 2;
  while (taken.includes(id)) id = b + '-' + k++;
  return id;
};
function collectionAdd(name: string): any {
  const id = uniqueId(name || 'collection', collections().map(c => c.id));
  const col = {
    id, name: String(name || 'Collection').slice(0, 40), slug: id,
    fields: [{ id: 'title', name: 'Title', type: 'text', required: 1 }] as Field[],
    items: [], detail: ''
  };
  collections().push(col);
  return col;
}
const collectionDelete = (id: string) => { state.meta.collections = collections().filter(c => c.id !== id); };
function collectionRename(id: string, name: string) {
  const col = findCollection(id); if (!col) return;
  col.name = String(name || col.name).slice(0, 40);
}

function fieldAdd(colId: string, name: string, type: string): any {
  const col = findCollection(colId); if (!col) return null;
  const f = {
    id: uniqueId(name || 'field', col.fields.map(x => x.id)),
    name: String(name || 'Field').slice(0, 40),
    type: (FIELD_TYPES.some(([t]: any) => t === type) ? type : 'text') as FieldType,
    required: 0
  };
  col.fields.push(f as Field);
  return f;
}
/* Deleting a field drops its values too — an item cannot carry a value for a
   field the schema no longer has, or the next export would emit orphans. */
function fieldDelete(colId: string, fid: string) {
  const col = findCollection(colId); if (!col) return 0;
  if (col.fields.length <= 1) return 0;              // a collection needs one field
  col.fields = col.fields.filter(f => f.id !== fid);
  let cleared = 0;
  col.items.forEach(it => { if (fid in it.values) { delete it.values[fid]; cleared++; } });
  return cleared;
}
const swap = (list: any[], i: number, dir: number) => {
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
};
function fieldMove(colId: string, fid: string, dir: number) {
  const col = findCollection(colId); if (!col) return false;
  return swap(col.fields, col.fields.findIndex(f => f.id === fid), dir);
}

/* The first text field is what names an item in lists and what its slug derives
   from — it is the closest thing a collection has to a title. */
const titleField = (col: Collection | null) => (col && (col.fields || []).find(f => f.type === 'text')) || null;
const itemTitle = (col: Collection, it: Item) => {
  const tf = titleField(col);
  return String((tf && it.values[tf.id]) || '').trim() || 'Untitled';
};
function itemSlug(col: Collection, it: Item) {
  const base = tokenId(itemTitle(col, it)) || 'item';
  const taken = col.items.filter(x => x.id !== it.id).map(x => x.slug);
  return uniqueId(base, taken);
}
function itemAdd(colId: string) {
  const col = findCollection(colId); if (!col) return null;
  /* annotated, so the return type is `Item | null` rather than the shape of this literal —
     without it every caller got `values: {}` and could not read a field off a new item */
  const it: Item = { id: uid(), slug: '', values: {} };
  col.items.push(it);
  it.slug = itemSlug(col, it);
  return it;
}
const itemDelete = (colId: string, iid: string) => {
  const col = findCollection(colId); if (!col) return;
  col.items = col.items.filter(i => i.id !== iid);
};
function itemMove(colId: string, iid: string, dir: number) {
  const col = findCollection(colId); if (!col) return false;
  return swap(col.items, col.items.findIndex(i => i.id === iid), dir);
}
/* Writing the title re-derives the slug, but only while the author has not set
   one by hand — an item that is already published should not move on a typo fix. */
function itemSet(colId: string, iid: string, fid: string, value: string) {
  const col = findCollection(colId); if (!col) return;
  const it = findItem(col, iid); if (!it) return;
  it.values[fid] = value;
  const tf = titleField(col);
  if (tf && fid === tf.id && !it.slugLocked) it.slug = itemSlug(col, it);
}
/* The items a Collection List renders, in order. Sorting on a number field
   compares numerically — sorting a year as text puts 100 before 99. */
/* ---- drafts and filters ----------------------------------------------
   The two verbs a Collection List was missing. Sorting, directing and limiting were there,
   which is enough for "the five newest" and nothing else: a category page needs to ask for
   a subset, and a blog needs somewhere to keep a post that is not ready.

   A draft is a property of the item rather than a field the author has to add, because
   "is this published" is not content — every collection needs it and none should have to
   model it. One place decides, and everything that describes the public site reads it. */
const published = (col: Collection | null) => (col && col.items || []).filter(i => !i.draft);

/** Does one item pass a list's filter? A list with no `where` passes everything. */
function matches(col: Collection, item: Item, where?: string, op?: string, val?: string) {
  const f = where ? findField(col, where) : null;
  if (!f) return true;                                  // no field, or a field since deleted
  const raw = String(item.values[f.id] ?? '').trim();
  const want = String(val ?? '').trim();
  if (op === 'set') return raw !== '';
  if (op === 'unset') return raw === '';
  /* a comparison against nothing is not a filter — it would hide everything on the way to
     being typed, so it passes until there is something to compare */
  if (want === '') return true;
  if (op === 'has') return raw.toLowerCase().includes(want.toLowerCase());
  /* numbers numerically, so 9 does not sort or compare above 10 */
  const same = f.type === 'number'
    ? parseFloat(raw) === parseFloat(want)
    : raw.toLowerCase() === want.toLowerCase();
  return op === 'not' ? !same : same;
}

function listItems(n: PcNode, col: Collection) {
  const p = n.props as PropBag;
  let out = published(col).filter(i => matches(col, i, p.where as string, p.op as string, p.val as string));
  const f = n.props.sort ? findField(col, n.props.sort) : null;
  if (f) out.sort((a, b) => {
    const av = a.values[f.id] ?? '', bv = b.values[f.id] ?? '';
    return f.type === 'number'
      ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
      : String(av).localeCompare(String(bv));
  });
  if (n.props.dir === 'desc') out.reverse();
  const lim = parseInt(n.props.limit || '', 10);
  return lim > 0 ? out.slice(0, lim) : out;
}

/* Every link a page emits goes through here. Two jobs: `cms:item` becomes the
   detail page of whichever item is being rendered, and a page that sits in a
   folder has to climb back out to reach a sibling. Anything already absolute —
   a scheme, a protocol-relative or rooted path, a bare fragment — is left alone. */
function pageHref(link: unknown, o: Pick<RenderOpts, 'col' | 'item' | 'rel'>) {
  let v = String(link || '');
  if (v === 'cms:item') {
    if (!o || !o.col || !o.item) return '';
    v = o.col.slug + '/' + o.item.slug + '.html';
  }
  const wordpress = parseWordPressContentReference(v);
  if (wordpress) return wordpressContentToken(wordpress);
  /* A malformed reserved reference never degrades into a raw custom scheme. */
  if (v.startsWith(WORDPRESS_CONTENT_REFERENCE_PREFIX)) return '';
  v = safeUrl(v);
  if (!v || !o || !o.rel || /^([a-z][\w+.-]*:|\/\/|\/|#)/i.test(v)) return v;
  return o.rel + v;
}

/* ---- scroll-triggered motion ------------------------------------------
   bp-animate, vendored. The library's contract is a class and four attributes, which is why it
   fits: a widget already has somewhere to put classes and attributes, and nothing here needs to
   know how an animation works.

   It ships only on a page that uses one, the way `NAV_JS` and `LB_JS` already do — 34 KB is
   most of a page's weight, and a page with nothing moving should carry nothing. Which is also
   why `animUsed` walks the tree rather than checking a project-wide flag: two pages of a site
   can differ.

   Reduced motion is handled here rather than left to the trailing block in `baseCss`. That
   block flattens every animation to .01ms and would neutralise these too, but by way of an
   `!important` that happens to come last — for motion this deliberate, saying so outright is
   worth four lines. The library has no reduced-motion handling of its own; I checked. */
const animOf = (n: PcNode): Anim | null => {
  const a = n.anim;
  return (a && a.name && ANIM_NAMES.includes(a.name)) ? a : null;
};
/** The class and attributes one element needs, or ''. */
function animAttrs(n: PcNode) {
  const a = animOf(n);
  if (!a) return { cls: '', at: '' };
  const bit = (k: string, v?: string) => (v ? ` ${k}="${esc(v)}"` : '');
  return {
    cls: ` bp-animate ${ANIM_PFX}${a.name}`,
    at: bit('bp-duration', a.dur) + bit('bp-delay', a.delay) + bit('bp-easing', a.ease)
      + (a.once ? ' bp-animation-once="true"' : '')
  };
}
const animUsed = (lists: PcNode[][]) => {
  let hit = false;
  lists.forEach(l => eachNode(l, n => { if (!hit && animOf(n)) hit = true; }));
  return hit;
};
/* `bp-animate` starts its elements hidden, so a visitor who has asked for less motion would be
   left with a blank page if the library were simply neutralised. Shown outright, unanimated. */
const ANIM_CALM = `@media (prefers-reduced-motion:reduce){`
  + `.bp-animate,.bp-animate.bp-is-hidden{opacity:1 !important;transform:none !important;animation:none !important}}`;

/* ---- renaming a page, and choosing the front one --------------------
   A host serves `index.html` at the root, so the front page is not a flag — it is whichever
   page is slugged `index`. Setting one therefore moves two slugs: this page takes `index` and
   the page that had it takes one derived from its name.

   Which means renaming has to carry the links with it. Editing the Slug field by hand has
   always broken every href pointing at the old name and left the review to report it
   afterwards; a one-click action that renames two pages at once would be twice as bad. The
   three places a link can live are the three the review already walks — a `link` prop, a nav
   item's `href`, and an `href` inside rich text — so this rewrites exactly what that reads. */
function relink(from: string, to: string) {
  if (!from || from === to) return 0;
  let n = 0;
  const swap = (h: unknown) => {
    const v = String(h == null ? '' : h);
    const m = v.match(/^([\w-]+)\.html(#.*)?$/);
    if (!m || m[1] !== from) return v;
    n++;
    return `${to}.html${m[2] || ''}`;
  };
  allTrees().forEach(list => eachNode(list, node => {
    const p = node.props as PropBag;
    if (p.link !== undefined) p.link = swap(p.link);
    if (hasItemHrefs(node) && Array.isArray(p.items)) {
      (p.items as NavItem[]).forEach(it => { it.href = swap(it.href); });
    }
    if (node.type === 'text' && typeof p.html === 'string') {
      p.html = p.html.replace(/href="([^"]*)"/g, (whole, h) => {
        const next = swap(h);
        return next === h ? whole : `href="${next}"`;
      });
    }
  }));
  return n;
}

/** Rename a page and follow every link that pointed at it. Returns how many it moved, or
    null when the slug was refused — taken by another page, or empty. */
function pageSlugSet(i: number, slug: string): number | null {
  const pg = state.pages[i];
  if (!pg) return null;
  /* the raw input, before `slugify` — it falls back to 'page' for anything with no letters in
     it, so clearing the field would otherwise rename the page to "page" without being asked */
  if (!String(slug == null ? '' : slug).trim()) return null;
  const want = slugify(slug);
  if (!want) return null;
  if (want === pg.slug) return 0;
  if (state.pages.some((p, k) => k !== i && p.slug === want)) return null;
  const was = pg.slug;
  pg.slug = want;
  return relink(was, want);
}

/** Make this the page a host serves at the root. The one that was there takes a slug from its
    own name, because two pages cannot both be `index` and the alternative is refusing. */
const FRONT = 'index';
const isFront = (pg: Page) => pg.slug === FRONT;
function pageFront(i: number) {
  const pg = state.pages[i];
  if (!pg || isFront(pg)) return false;
  const old = state.pages.findIndex(p => isFront(p));
  if (old >= 0) {
    /* out of the way first, or the new one cannot take the name. From its own name, and
       de-duplicated against every other page including the one about to be renamed. */
    const base = slugify(state.pages[old].name) || 'page';
    const taken = state.pages.filter((_, k) => k !== old).map(p => p.slug);
    const to = uniqueId(base === FRONT ? 'page' : base, taken);
    const was = state.pages[old].slug;
    state.pages[old].slug = to;
    relink(was, to);
  }
  const was = pg.slug;
  pg.slug = FRONT;
  relink(was, FRONT);
  return true;
}

/* ---- the not-found page ----------------------------------------------
   A convention rather than a feature: a page slugged `404` already exports as `404.html`,
   which is what every static host looks for. What was missing is the page then behaving like
   one. It must stay out of the sitemap — offering a crawler a list that includes the error
   page is asking it to index the error page — and it must not claim a canonical URL or
   permission to be indexed, because a 404 is not a destination. */
const NOT_FOUND = '404';
const isNotFound = (pg: Page) => pg.slug === NOT_FOUND;

/* ---- content back in -------------------------------------------------
   `contentJson` went out and nothing came back. Which meant the obvious workflow — export,
   edit forty rows in a spreadsheet, bring them back — had no second half, and the only import
   that existed replaced the whole project.

   This is an upsert and never a delete. An item in the project but not in the file is left
   exactly where it is: a file that is a subset of the project, or one row pasted from another
   export, must not be able to remove content. Deleting is a thing you do in the CMS, where you
   are asked to confirm it, and not a side effect of opening a file.

   Matching is by id and then by slug or name, because a hand-edited file loses ids first. The
   `site` block is read and ignored on purpose: it describes the project rather than its
   content, and quietly rewriting someone's site name and base URL from a data file is not what
   "import content" says on the button. */
interface ImportReport {
  collections: { added: number; matched: number };
  fields: { added: number };
  items: { added: number; updated: number };
  notes: string[];
}
function contentImport(raw: unknown): ImportReport | null {
  const d = raw as any;
  if (!d || typeof d !== 'object' || !Array.isArray(d.collections)) return null;
  const rep: ImportReport = {
    collections: { added: 0, matched: 0 }, fields: { added: 0 },
    items: { added: 0, updated: 0 }, notes: []
  };

  for (const fc of d.collections) {
    if (!fc || typeof fc !== 'object') continue;
    const fid = String(fc.id || ''), fslug = String(fc.slug || '');
    let col = (fid && collections().find(c => c.id === fid))
      || (fslug && collections().find(c => c.slug === fslug)) || null;
    if (col) rep.collections.matched++;
    else { col = collectionAdd(String(fc.name || fslug || fid || 'Collection')); rep.collections.added++; }
    if (!col) continue;                 // collectionAdd does not fail; this is what says so

    /* field id in the file → field id here. They differ the moment a collection is created
       locally, since ids are made unique against what is already there. */
    const map: Record<string, string> = {};
    for (const ff of (Array.isArray(fc.fields) ? fc.fields : [])) {
      if (!ff) continue;
      const key = String(ff.id || ff.name || '');
      if (!key) continue;
      const hit = col.fields.find((x: Field) => x.id === key)
        || col.fields.find((x: Field) => x.name === String(ff.name || ''));
      if (hit) { map[key] = hit.id; continue; }
      const made = fieldAdd(col.id, String(ff.name || key), String(ff.type || 'text'));
      if (!made) continue;
      map[key] = made.id;
      rep.fields.added++;
      /* `fieldAdd` falls back to text for a type it does not know, which is right — but
         silently would leave someone wondering why their dates are strings */
      if (ff.type && made.type !== ff.type) {
        rep.notes.push(`“${made.name}” came in as text: this build has no “${ff.type}” field type.`);
      }
    }

    const unknown = new Set<string>();
    for (const fi of (Array.isArray(fc.items) ? fc.items : [])) {
      if (!fi || typeof fi !== 'object') continue;
      const iid = String(fi.id || ''), islug = String(fi.slug || '');
      let it = (iid && findItem(col, iid))
        || (islug && col.items.find((x: Item) => x.slug === islug)) || null;
      if (it) rep.items.updated++;
      else { it = itemAdd(col.id); if (!it) continue; rep.items.added++; }

      const vals = (fi.values && typeof fi.values === 'object') ? fi.values : {};
      for (const k of Object.keys(vals)) {
        const to = map[k] || (findField(col, k) ? k : '');
        if (!to) { unknown.add(k); continue; }
        const v = (vals as any)[k];
        itemSet(col.id, it.id, to, v == null ? '' : String(v));
      }
      /* after the values, because setting the title field re-slugs an unlocked item and
         would otherwise overwrite the slug the file asked for */
      if (islug) itemSetSlug(col.id, it.id, islug);
    }
    if (unknown.size) {
      rep.notes.push(`${col.name}: ${[...unknown].join(', ')} ${unknown.size === 1 ? 'is not a field' : 'are not fields'} in this collection, so ${unknown.size === 1 ? 'it was' : 'they were'} skipped.`);
    }
  }
  return rep;
}

/* ---- pagination ------------------------------------------------------
   A Collection List could show everything it matched or, with a limit, the first few. Forty
   posts meant forty cards on one page, and the only way out was a limit that hid the rest
   for good. Pagination is the missing verb.

   Page one keeps the page's own address so nothing that links to it has to change; the rest
   sit in a folder beside it. That is the shape detail pages already use, so `rel` and every
   link that climbs out of a folder already work — and `page-2` inside the folder keeps clear
   of an item slug, which a bare `2` would not.

   One paginator per page. A second paginated list on the same page has no coherent answer:
   two lists cannot each drive the file count. `paginatorOf` picks the first in document
   order, and the review says so rather than letting the second one quietly not paginate. */
const pagedPath = (slug: string, n: number) => n <= 1 ? slug + '.html' : `${slug}/page-${n}.html`;
const pagedRel = (n: number) => n <= 1 ? '' : '../';
/** How a generated file climbs back to the project root. Page slugs may contain folders, so
    page number alone is not enough: `nested/about.html` needs `../`, while its page two at
    `nested/about/page-2.html` needs `../../`. */
const pathRel = (path: string) => '../'.repeat(Math.max(0,
  String(path || '').replace(/^\/+|\/+$/g, '').split('/').length - 1));

/** How many exported pages a list needs. One when it does not paginate, so callers can
    multiply by it without asking whether it does. */
function listPageCount(n: PcNode, col: Collection) {
  const per = parseInt(String((n.props as PropBag).per || ''), 10);
  if (!(per > 0)) return 1;
  return Math.max(1, Math.ceil(listItems(n, col).length / per));
}

/** The list that decides how many files a page becomes, and the collection it draws from.
    First in document order; `extra` counts the paginated lists it passed over, which is what
    the review reports. */
function paginatorOf(pg: Page): { node: PcNode; col: Collection; extra: number } | null {
  let hit: { node: PcNode; col: Collection; extra: number } | null = null;
  eachNode(pg.tree, n => {
    if (n.type !== 'list') return;
    const per = parseInt(String((n.props as PropBag).per || ''), 10);
    const col = n.src ? findCollection(n.src) : null;
    if (!(per > 0) || !col) return;
    if (hit) hit.extra++; else hit = { node: n, col, extra: 0 };
  });
  return hit;
}

/* ---- where a link points, inside this project -------------------------
   `parseLink` answers "what kind of link is this" for the inspector, in slugs. This answers
   a different question — "which page of this project does it land on" — and it has to cope
   with the shape `parseLink` cannot: a detail page is `<collection>/<item>.html`, and a link
   from one climbs back out with `../`.

   `.html` lives in the stored href because that is what an HTML export needs. It is not the
   identity of a page; the slug is. So this is the one place that knows the extension is a
   file-naming detail, which is what lets Preview follow a link the way a browser would. */
function pageAt(href: unknown): { at: number; col: Collection | null; item: Item | null; frag: string; pageNo: number } | null {
  let v = String(href == null ? '' : href).trim();
  if (!v || /^([a-z][\w+.-]*:|\/\/)/i.test(v)) return null;     // a scheme, or protocol-relative
  const hash = v.indexOf('#');
  const frag = hash >= 0 ? v.slice(hash + 1) : '';
  v = (hash >= 0 ? v.slice(0, hash) : v).replace(/^(\.\.?\/)+/, '').replace(/^\//, '');
  if (!v) return frag ? { at: state.cur, col: null, item: null, frag, pageNo: 1 } : null;   // a bare fragment

  const bits = v.replace(/\.html?$/i, '').split('/');
  if (bits.length === 1) {
    const at = state.pages.findIndex(p => p.slug === bits[0]);
    return at < 0 ? null : { at, col: null, item: null, frag, pageNo: 1 };
  }
  if (bits.length !== 2) return null;

  /* `<slug>/page-2` before the collection reading, and deliberately: a page slugged
     `journal` and a collection slugged `journal` are both plausible at the same time, so
     without this a pager link went looking for an item called `page-2`. Anchoring on a real
     page slug makes it unambiguous. */
  const pn = bits[1].match(/^page-(\d+)$/);
  if (pn) {
    const at = state.pages.findIndex(p => p.slug === bits[0]);
    if (at >= 0) return { at, col: null, item: null, frag, pageNo: Math.max(1, +pn[1]) };
  }

  const col = collections().find(c => c.slug === bits[0]) || null;
  if (!col) return null;
  const item = published(col).find(i => i.slug === bits[1]) || null;
  const at = state.pages.findIndex(p => p.collection === col.id);
  return (item && at >= 0) ? { at, col, item, frag, pageNo: 1 } : null;
}

/* Every file the project exports: one per ordinary page, and one per item for a
   page marked as a collection's detail template. `rel` is how far that file sits
   from the root, which is what every internal link and asset path needs. */
function exportTargets() {
  const out: any[] = [];
  for (const pg of state.pages) {
    const col = pg.collection ? findCollection(pg.collection) : null;
    if (!col) {
      /* a paginated list turns one page into several, each carrying which slice it is */
      const pgn = paginatorOf(pg);
      const n = pgn ? listPageCount(pgn.node, pgn.col) : 1;
      for (let i = 1; i <= n; i++) {
        const path = pagedPath(pg.slug, i);
        out.push({
          pg: i > 1 ? { ...pg, title: `${pg.title || pg.name} — page ${i}` } : pg,
          path, rel: pathRel(path),
          col: null, item: null, pageNo: i, pages: n
        });
      }
      continue;
    }
    for (const it of published(col)) {
      const t = pg.bindTitle ? String(fieldValue(col, it, pg.bindTitle) || '').trim() : '';
      const d = pg.bindDesc ? String(fieldValue(col, it, pg.bindDesc) || '').trim() : '';
      const path = col.slug + '/' + it.slug + '.html';
      out.push({
        pg: { ...pg, slug: col.slug + '/' + it.slug, title: t || pg.title, desc: d || pg.desc },
        path, rel: pathRel(path), col, item: it
      });
    }
  }
  return out;
}

/* The content that shipped, as data. Deliberately has no timestamp: the same
   project exports the same bytes, so it diffs cleanly and re-imports predictably.
   Image values resolve to the `assets/…` path the HTML uses, and every item that
   has a detail page carries its URL, so a consumer needs nothing but this file. */
function contentJson(imgPath: (v: unknown) => string = v => (v == null ? '' : String(v))) {
  const urlOf: Record<string, string> = {};
  for (const t of exportTargets()) if (t.item) urlOf[t.col.id + '|' + t.item.id] = t.path;
  return JSON.stringify({
    site: { name: state.meta.name, lang: state.meta.lang || 'en', baseUrl: state.meta.baseUrl || '' },
    collections: collections().map(c => ({
      id: c.id, name: c.name, slug: c.slug,
      fields: c.fields.map(f => ({ id: f.id, name: f.name, type: f.type, required: !!f.required })),
      items: published(c).map(it => {
        const values: Record<string, string> = {};
        for (const f of c.fields) {
          const v = it.values[f.id];
          values[f.id] = f.type === 'image' ? imgPath(v) : (v == null ? '' : v);
        }
        const url = urlOf[c.id + '|' + it.id];
        return url ? { id: it.id, slug: it.slug, url, values } : { id: it.id, slug: it.slug, values };
      })
    }))
  }, null, 2) + '\n';
}

/* Everything a finished site needs, in the order it should be written. The paths
   are the real ones — folders included — which is what a zip can honour and a
   one-file-at-a-time download cannot. Images are appended by the caller, since
   only the UI knows the asset store. */
function sitePlan(): any[] {
  const out = exportTargets().map(t => ({ kind: 'page', path: t.path, target: t }));
  if (collections().length) out.push({ kind: 'content', path: 'content.json' } as any);
  if (state.meta.baseUrl) out.push({ kind: 'sitemap', path: 'sitemap.xml' } as any, { kind: 'robots', path: 'robots.txt' } as any);
  return out;
}

/* ---- binding -------------------------------------------------------------
   A binding names a field and nothing else. The collection comes from the nearest
   ancestor that declares a source (`node.src`), so one card carries no collection
   id of its own and the same card works wherever it is placed — inside a
   Collection List, or on a detail page. */
/* Controls that edit a list of their own. There is no single field a CMS item
   could supply for one, so they are not offered — before this, Nav links and
   form fields wore a bind badge that could only ever write a string over an array. */
const COLL_CTL = ['items', 'fields', 'qa', 'imgs'];
const bindableKeys = (type: string) => {
  const c = (DEF[type] || {}).controls || {};
  /* content props only. A text style is a design choice and a filter value configures the
     list rather than appearing in it — `ts` was excluded by name, which worked until a
     second setting arrived, so both go through the `set` flag now. */
  return (c.content || []).filter(x => x.k && !x.set && x.k !== 'ts' && !COLL_CTL.includes(x.t)).map(x => x.k);
};
/* ---- binding a whole card at once -----------------------------------
   Binding was one control at a time: select the element, open Content, click the
   badge, pick a field, repeat. A five-field card was about fifteen interactions and
   there was nowhere to see the mapping as a whole.

   `bindSlots` lists every bindable control inside a scope in document order, which is
   both what the sheet draws and what its commit writes back. */
/* Controls that hold content rather than settings. A sheet listing every bindable
   key showed sixteen rows for a four-element card, thirteen of them things nobody
   binds — the sort order of a list, a heading's HTML tag, an image's lazy flag. The
   per-control badge still reaches those; the sheet stays on what content means. */
const BIND_CTL = ['text', 'area', 'rich', 'img', 'link'];

function bindSlots(rootId: string) {
  const h = locate(rootId);
  if (!h) return [];
  const out: any[] = [];
  eachNode([h.node], n => {
    const keys = bindableKeys(n.type);
    (DEF[n.type].controls.content || []).forEach(c => {
      if (!c.k || !keys.includes(c.k) || !BIND_CTL.includes(c.t)) return;
      out.push({
        nodeId: n.id, type: n.type, key: c.k, ctl: c.t,
        element: nameOf(n), label: c.label || c.k, current: boundField(n, c.k)
      });
    });
  });
  return out;
}

/* A first guess, so the sheet opens mostly filled in rather than empty.
   It runs by *confidence*, not in document order — which matters: walking the tree,
   a card's heading reached the "Read more" link field before the button did, and the
   button is obviously what that field is for. A field is consumed once used, or two
   headings both take the title and the second one is wrong. */
function guessBindings(slots: any[], col: Collection | null) {
  if (!col) return {};
  const out: Record<string, string> = {};
  const left = col.fields.slice();
  const key = (s: any) => s.nodeId + '|' + s.key;
  const take = (s: any, f: Field) => { out[key(s)] = f.id; left.splice(left.indexOf(f), 1); };
  const free = (s: any) => !(key(s) in out);
  const byType = (t: string) => left.find((f: Field) => f.type === t);
  const title = titleField(col);

  /* an existing binding is a decision already made, and is never guessed over */
  slots.forEach(s => { if (s.current) out[key(s)] = s.current; });

  /* 1. a control whose label or key reads like a field's name */
  slots.filter(free).forEach(s => {
    const f = left.find(x => slugify(x.name) === slugify(s.label) || slugify(x.name) === slugify(s.key));
    if (f) take(s, f);
  });
  /* 2. the shape of the control, most-certain first, one slot each */
  const first = (pred: any) => slots.filter(free).find(pred);
  const rules: [(s: any) => boolean, () => Field | undefined | null][] = [
    [s => s.key === 'src', () => byType('image')],
    [s => s.key === 'text' && s.type === 'heading', () => (title && left.includes(title) ? title : null)],
    [s => s.key === 'html', () => byType('rich') || left.find(f => f.type === 'text' && f !== title)],
    [s => s.key === 'link' && s.type === 'button', () => byType('link')],
    [s => s.key === 'text' && s.type === 'button', () => left.find(f => f.type === 'text' && f !== title)]
  ];
  rules.forEach(([pick, field]: any) => {
    const s = first(pick);
    if (!s) return;
    const f = field();
    if (f) take(s, f);
  });
  /* 3. anything left is left alone — an unbound slot beats a wrong guess */
  slots.forEach(s => { if (free(s)) out[key(s)] = ''; });
  return out;
}

/* Write a whole map back. Returns how many bindings changed, so the toast can say. */
function applyBindings(map: Record<string, string> | null) {
  let n = 0;
  Object.entries(map || {}).forEach(([k, fieldId]) => {
    const i = k.lastIndexOf('|');
    const h = locate(k.slice(0, i));
    if (!h) return;
    const prop = k.slice(i + 1);
    /* the sheet is the CMS's, so every binding it writes is a field binding */
    if (boundField(h.node, prop) === (fieldId || '')) return;
    bindSet(h.node, prop, bindField(fieldId));
    n++;
  });
  return n;
}

/** The binding on one prop, or null. Null and "bound to nothing" are the same state: a
    binding is present only while it points at something. */
const bindGet = (n: PcNode, key: string): Binding | null => (n.bind || {})[key] || null;
function bindSet(n: PcNode, key: string, b: Binding | null) {
  if (!b || !b.path) {
    if (n.bind) { delete n.bind[key]; if (!Object.keys(n.bind).length) delete n.bind; }
    return;
  }
  n.bind = n.bind || {};
  n.bind[key] = { src: b.src, path: b.path };
}
/** The CMS's own binding, spelled once. Every caller that binds to a collection field says
    this instead of the object literal, so the source is named at the point it is chosen. */
const bindField = (path: string): Binding | null => (path ? { src: 'field', path } : null);
/** The field path a prop is bound to, or `''` — what a CMS control needs, and what the old
    `bindGet` returned. A prop-sourced binding is not a field and answers empty here. */
const boundField = (n: PcNode, key: string): string => {
  const b = bindGet(n, key);
  return b && b.src === 'field' ? b.path : '';
};
function srcSet(n: PcNode, colId: string) {
  if (colId && findCollection(colId)) n.src = colId; else delete n.src;
}
/* the nearest source above this node, itself included */
function bindScope(id: string): { node: PcNode | null; col: Collection } | null {
  let h = locate(id);
  while (h) {
    const col = h.node.src ? findCollection(h.node.src) : null;
    if (col) return { node: h.node, col };
    h = h.parent ? locate(h.parent.id) : null;
  }
  /* a detail template makes the whole page the scope, with no `src` node at all */
  const pc = page().collection ? findCollection(page().collection as string) : null;
  return pc ? { node: null, col: pc } : null;
}
/* which item the canvas is previewing, per collection */
const previewIndex = (colId: string) => ((state.ui.item || (state.ui.item = {}))[colId] || 0);
/* The canvas stands in for the published page, so it previews a published item. A project
   whose every item is a draft falls back to the first one rather than rendering an empty
   template — there is nothing else to show, and showing nothing looks like a bug. */
function previewItem(col: Collection | null) {
  if (!col || !col.items.length) return null;
  const live = published(col);
  const pool = live.length ? live : col.items;
  return pool[Math.min(previewIndex(col.id), pool.length - 1)];
}
/* ---- reading a field, and following a reference ----------------------
   A reference field holds an item id in another collection, so displaying anything from it
   takes two hops: the reference, then a field of what it points at. Every binding before this
   was one hop, and a reference you cannot read through relates two things without letting you
   say anything about the relation.

   The path is dotted — `author.name` — which needs no new storage, because a binding was
   already a string. One hop or three is the same code, and the depth cap is what stops a
   cycle: an author whose editor is the author would otherwise recurse until the stack gave
   out, and a schema is allowed to have one. */
const REF_DEPTH = 4;
const fieldValue = (col: Collection | null, item: Item | null, path: string, depth = 0): string => {
  if (!col || !item) return '';
  const bits = String(path || '').split('.');
  const f = findField(col, bits[0]);
  if (!f) return '';
  const raw = item.values[f.id];
  const v = raw == null ? '' : raw;
  if (bits.length === 1) return v;
  /* only a reference can be followed, and only so far */
  if (f.type !== 'ref' || !f.ref || depth >= REF_DEPTH) return '';
  const to = findCollection(f.ref);
  const hit = to ? findItem(to, v) : null;
  return hit ? fieldValue(to, hit, bits.slice(1).join('.'), depth + 1) : '';
};

/** Every path a binding can offer for this collection: its own fields, and one hop through
    each reference. One hop rather than every depth on purpose — the paths are a list someone
    reads, and two hops through three references is forty rows nobody wants to scan. */
function fieldPaths(col: Collection | null): { path: string; label: string; type: FieldType }[] {
  if (!col) return [];
  const out: { path: string; label: string; type: FieldType }[] = [];
  for (const f of (col.fields || [])) {
    out.push({ path: f.id, label: f.name, type: f.type });
    if (f.type !== 'ref' || !f.ref) continue;
    const to = findCollection(f.ref);
    if (!to) continue;
    for (const g of (to.fields || [])) {
      if (g.type === 'ref') continue;              // the second hop stops here
      out.push({ path: `${f.id}.${g.id}`, label: `${f.name} → ${g.name}`, type: g.type });
    }
  }
  return out;
}
/* Props with bindings resolved. A bound value always wins, even when it is
   empty — the canvas should show what the export will, not a placeholder that
   quietly disappears at build time. Returns the identity object when nothing is
   bound, so an unbound tree costs nothing to render. */
function boundProps(n: PcNode, col: Collection | null, item: Item | null,
  inst?: PcNode | null, def?: ComponentDef | null) {
  if (!n.bind) return n.props;
  const out = { ...n.props };
  for (const [k, b] of Object.entries(n.bind)) {
    /* A property, when this node is being rendered inside an instance. Outside one there is no
       instance to ask, and the value authored in the definition is exactly what belongs on
       screen — not an empty string, and not a field lookup that would find nothing. */
    if (b.src === 'prop') {
      if (inst) (out as PropBag)[k] = instValue(inst, def || null, b.path);
      continue;
    }
    if (b.src !== 'field' || !col || !item) continue;
    (out as PropBag)[k] = fieldValue(col, item, b.path);
  }
  return out;
}

/* ---- conditions -------------------------------------------------------
   Whether an element is on the page. One shape covers a CMS field and a component property,
   because a binding says which it is — the reason the source had to exist first. */
const COND_OPS: [CondOp, string][] = [
  ['set', 'has a value'],
  ['empty', 'is empty'],
  ['eq', 'is'],
  ['ne', 'is not']
];
/** The value a condition tests, as a string. Unresolvable — no item in scope, no instance —
    reads as empty, which is the honest answer and the one that makes `set` mean what it says. */
function condValue(c: Condition, col: Collection | null, item: Item | null,
  inst?: PcNode | null, def?: ComponentDef | null): string {
  if (c.bind.src === 'prop') return inst ? instValue(inst, def || null, c.bind.path) : '';
  if (!col || !item) return '';
  const v = fieldValue(col, item, c.bind.path);
  return v == null ? '' : String(v);
}
/** Does this element show? Absent condition means yes, which is every element until somebody
    decides otherwise. */
function showsNode(n: PcNode, col: Collection | null, item: Item | null,
  inst?: PcNode | null, def?: ComponentDef | null): boolean {
  const c = n.showIf;
  if (!c || !c.bind || !c.bind.path) return true;
  const v = condValue(c, col, item, inst, def).trim();
  const want = String(c.value == null ? '' : c.value).trim();
  if (c.op === 'set') return v !== '';
  if (c.op === 'empty') return v === '';
  if (c.op === 'eq') return v === want;
  if (c.op === 'ne') return v !== want;
  return true;
}
/** Set or clear a condition. Clearing removes the key, so a document carries none until one is
    written — the same rule `st` and `vals` follow. */
function condSet(n: PcNode, c: Condition | null) {
  if (!c || !c.bind || !c.bind.path) { delete n.showIf; return; }
  n.showIf = { bind: { src: c.bind.src, path: c.bind.path }, op: c.op,
    ...(c.op === 'eq' || c.op === 'ne' ? { value: String(c.value == null ? '' : c.value) } : {}) };
}

function itemSetSlug(colId: string, iid: string, slug: string) {
  const col = findCollection(colId); if (!col) return;
  const it = findItem(col, iid); if (!it) return;
  it.slugLocked = 1;
  it.slug = uniqueId(slug || itemTitle(col, it), col.items.filter(x => x.id !== it.id).map(x => x.slug));
}

/** Hold an item back from the published site, or let it out. A separate verb rather than a
    field write because `draft` is not one of the item's values — it decides whether those
    values are published at all. */
function itemDraft(colId: string, iid: string, on: boolean) {
  const it = findItem(findCollection(colId), iid);
  if (!it) return false;
  if (on) it.draft = 1; else delete it.draft;
  return true;
}
const blockRootType = (id: string) => { const b = findBlock(id); return b ? b.node.type : null; };
/* A block is a saved starting point: paste it and it is yours, with no link back. There used
   to be a second kind — a *global* block, which tagged every copy so one copy could push its
   content over the others — and that is what components replaced. An instance keeps the link
   and declares what varies, instead of destroying local edits on the next push. Migration
   v10 -> v11 turned every global block into a component. */
function blockSave(nodeId: string, name: string) {
  const h = locate(nodeId);
  if (!h) return null;
  const base = tokenId(name) || 'block';
  let id = base, k = 2;
  while (findBlock(id)) id = base + '-' + k++;
  const node = clone(h.node);
  blocks().push({ id, name: String(name || nameOf(h.node)).slice(0, 40), node });
  return id;
}
function blockInsert(id: string, parentNode?: PcNode | null, index = 0) {
  const b = findBlock(id);
  if (!b) return null;
  const fresh = reid(clone(b.node));
  if (parentNode === undefined) return dropTree(fresh, state.ui.sel);
  const pt = parentNode ? parentNode.type : null;
  if (!fitsIn(pt, fresh.type)) return dropTree(fresh, parentNode ? parentNode.id : null);
  const list = parentNode ? parentNode.children : tree();
  list.splice(Math.max(0, Math.min(index, list.length)), 0, wrap(fresh.type, takes(pt), fresh));
  return fresh;
}
const blockDelete = (id: string) => { state.meta.blocks = blocks().filter(b => b.id !== id); };

/* ---- components -------------------------------------------------------
   A definition, and instances that hold values rather than markup.

   The global block is what this replaced, and it is gone: it placed copies and pushed one
   copy's content over the others, so an edit to any copy was destroyed by the next push from
   somewhere else, and there was nowhere to say that a card's heading varies while its layout
   does not. An instance says exactly that: the definition owns the tree, declared properties
   own what varies, and slots own what the page puts inside. Migration v10 -> v11 converted
   every global block that existed; what is still called a block is the other thing it was, a
   saved starting point with no link back.

   An instance is a node with `use` set — not a widget type of its own. Every level rule in the
   editor reads a type string, so a new type would have needed a level, and a component's level
   is whatever its definition's root is. A node that already *is* that type, carrying a
   component id, changes none of it. */
/* Declarations, not consts: `tree()` is defined a thousand lines above this and calls
   `findComponent`. A const would be in its temporal dead zone for any call made while the
   module is still evaluating — which is the exact bug `notASlide` has a comment about. */
function components(): ComponentDef[] {
  return (state.meta.components || (state.meta.components = []));
}
function findComponent(id?: string | null): ComponentDef | null {
  return id ? components().find(c => c.id === id) || null : null;
}

/** The declared property, or null. */
const findProp = (def: ComponentDef | null, k: string) =>
  (def && (def.props || []).find((x: ComponentProp) => x.k === k)) || null;

/** The variants a definition declares. */
const variantsOf = (def: ComponentDef | null) => (def && def.variants) || [];
const findVariant = (def: ComponentDef | null, id?: string | null) =>
  (id ? variantsOf(def).find(v => v.id === id) || null : null);

/** What an instance shows for one property, and the only place that question is answered.
    Its own value, then its variant's, then the definition's default — so changing a default
    moves every instance that never set its own, and an empty string is a value somebody chose
    rather than an absence. */
function instValue(inst: PcNode, def: ComponentDef | null, k: string): string {
  const own = inst.vals ? inst.vals[k] : undefined;
  if (own !== undefined) return own;
  const v = findVariant(def, inst.variant);
  if (v && v.values[k] !== undefined) return v.values[k];
  const p = findProp(def, k);
  return p ? p.def : '';
}
/** Which values this instance decides for itself, rather than taking from its variant or the
    definition. What the panel's "back to the variant" affordance needs to know. */
const instOwn = (inst: PcNode) => Object.keys(inst.vals || {});

/** Put an instance on a variant, or take it off one. */
function variantSet(inst: PcNode, vid: string | null) {
  const def = findComponent(inst.use);
  if (vid && findVariant(def, vid)) inst.variant = vid; else delete inst.variant;
}
/** Save what one instance is showing as a named variant, and put that instance on it.

    From an instance rather than from an empty form, for the same reason a text style is made
    from an element: the values are already in front of somebody who has just got them right,
    and retyping them into a dialog is how a variant ends up subtly different from the thing
    it was meant to capture. Only the values this instance decided for itself are captured —
    the rest are the definition's defaults, and freezing today's default into a variant would
    stop the default from ever moving it. */
function variantFromInstance(inst: PcNode, name: string) {
  const def = findComponent(inst.use);
  if (!def) return null;
  const base = tokenId(name) || 'variant';
  let id = base, k = 2;
  while (findVariant(def, id)) id = base + '-' + k++;
  const values: Record<string, string> = {};
  /* the variant it is on, then its own — so saving a tweak of "Primary" keeps what Primary
     decided and adds what this instance changed */
  const from = findVariant(def, inst.variant);
  if (from) Object.assign(values, from.values);
  Object.assign(values, inst.vals || {});
  def.variants = def.variants || [];
  def.variants.push({ id, name: String(name || 'Variant').slice(0, 40), values });
  /* and this instance becomes an instance *of* it: its own values are the variant's now, so
     keeping both would mean an override of itself that nothing could clear */
  delete inst.vals;
  inst.variant = id;
  return id;
}
/** Every instance on a variant, so deleting one can say what it changes. */
const variantUsage = (cid: string, vid: string) =>
  instances(cid).filter(x => x.node.variant === vid).length;
/** Delete a variant. Instances on it keep what they were showing, as their own values — the
    alternative is a page silently reverting to defaults because somebody tidied up a list. */
function variantDelete(cid: string, vid: string) {
  const def = findComponent(cid);
  const v = findVariant(def, vid);
  if (!def || !v) return 0;
  let n = 0;
  for (const { node } of instances(cid)) {
    if (node.variant !== vid) continue;
    node.vals = { ...v.values, ...(node.vals || {}) };
    delete node.variant;
    n++;
  }
  def.variants = variantsOf(def).filter(x => x.id !== vid);
  if (!def.variants.length) delete def.variants;
  return n;
}
const variantRename = (cid: string, vid: string, name: string) => {
  const v = findVariant(findComponent(cid), vid);
  if (v) v.name = String(name || v.name).slice(0, 40);
};
/** Set one property on an instance. `undefined` clears it back to the definition's default,
    which is a different state from an empty string and reads differently on the panel. */
function instSet(inst: PcNode, k: string, v: string | undefined) {
  if (v === undefined) {
    if (inst.vals) { delete inst.vals[k]; if (!Object.keys(inst.vals).length) delete inst.vals; }
    return;
  }
  inst.vals = inst.vals || {};
  inst.vals[k] = v;
}

/** Every slot a definition declares, in document order. */
function slotsOf(def: ComponentDef | null): { k: string; node: PcNode }[] {
  if (!def) return [];
  const out: { k: string; node: PcNode }[] = [];
  /* Containers only. A slot is a place children render, and a leaf's markup has nowhere to put
     them — marking a heading as a slot would make a slot the panel offers and nothing fills. */
  eachNode([def.node], n => { if (n.slot && DEF[n.type].level < 4) out.push({ k: n.slot, node: n }); });
  return out;
}
/** Mark a node inside a definition as a slot, or clear it. Refuses a leaf, for the reason
    above, and refuses a key another slot already has. */
function slotMark(cid: string, nodeId: string, key: string) {
  const def = findComponent(cid);
  if (!def) return false;
  let hit: PcNode | null = null;
  eachNode([def.node], n => { if (n.id === nodeId) hit = n; });
  const n = hit as PcNode | null;
  if (!n) return false;
  if (!key) { delete n.slot; return true; }
  if (DEF[n.type].level >= 4) return false;
  if (slotsOf(def).some(s => s.k === key && s.node.id !== nodeId)) return false;
  n.slot = key;
  return true;
}
/** An instance's children for one slot. Absent `slot` on a child means the first one, which is
    the whole story for a component with a single slot — and typing a key nobody has to type is
    how a feature reads as bureaucracy. */
function slotKids(inst: PcNode, def: ComponentDef | null, k: string): PcNode[] {
  const slots = slotsOf(def);
  const first = slots.length ? slots[0].k : '';
  return (inst.children || []).filter(c => (c.slot || first) === k);
}

/** The controls for an instance's properties, built from the declaration. A property is edited
    by the control its kind names, so nothing here draws anything the panel could not already
    draw. `set` marks these as writing values rather than props — see `propVal`. */
const PROP_CTL: Record<string, string> = {
  text: 'text', rich: 'rich', img: 'img', link: 'link', color: 'color', select: 'select',
  bool: 'toggle', icon: 'icon'
};
function instControls(n: PcNode): Control[] {
  const def = findComponent(n.use);
  if (!def) return [];
  return (def.props || []).map(pr => ({
    t: PROP_CTL[pr.t] as Control['t'], k: VAL + pr.k, label: pr.label,
    opts: pr.t === 'select' ? (pr.opts || []) : undefined
  })) as Control[];
}
/** The content controls for a node: an instance's properties, or the widget's own. One reader
    so the panel, the content role and the search cannot disagree about what a node holds. */
const contentControls = (n: PcNode): Control[] =>
  (n.use ? instControls(n) : (DEF[n.type].controls.content || []));

/** Which of a control's keys hold words rather than settings, for this node. The per-type
    answer for an ordinary widget; for an instance, the properties whose kind is content. A
    `select` or a `bool` property switches what the component does, which is the same kind of
    decision as a heading's HTML tag — a setting, and not a content account's to make. */
const CONTENT_PROP: PropKind[] = ['text', 'rich', 'img', 'link'];
function contentKeysOf(n: PcNode): Set<string> {
  if (!n.use) return contentKeys(n.type);
  const out = new Set<string>();
  (findComponent(n.use)?.props || []).forEach(pr => {
    if (CONTENT_PROP.includes(pr.t)) out.add(VAL + pr.k);
  });
  return out;
}

/** Which property kind a control of this kind edits. The controls came first, so this reads
    from them rather than the other way round. */
/* Which property kind a control of this kind edits. The controls came first, so this reads
   from them rather than the other way round.

   `icon` is here because the first real component built with this was a feature card, and a
   feature card whose instances cannot each have their own glyph is not the component anybody
   wanted. It costs one entry, because the control that picks an icon already exists — which is
   the whole point of deriving property kinds from control kinds. */
const PROP_KIND: Record<string, PropKind> = {
  text: 'text', area: 'text', rich: 'rich', img: 'img', link: 'link',
  color: 'color', select: 'select', toggle: 'bool', icon: 'icon'
};
/** Turn what a node holds into a property of the component being edited, and bind it. One
    verb, because it is one decision — "this varies" — and doing it in three steps (declare,
    default, bind) is three chances to end up with a property nothing reads. */
function propFromControl(cid: string, nodeId: string, c: Control) {
  const def = findComponent(cid);
  if (!def || !c.k || c.k.startsWith(VAL)) return null;
  const kind = PROP_KIND[c.t];
  if (!kind) return null;
  let hit: PcNode | null = null;
  eachNode([def.node], x => { if (x.id === nodeId) hit = x; });
  const n = hit as PcNode | null;
  if (!n) return null;
  const cur = propVal(n, c.k);
  const k = propAdd(cid, c.label || c.k, kind, cur == null ? '' : String(cur));
  if (!k) return null;
  if (kind === 'select') {
    /* the control's own options become the property's, so an instance picking a variant is
       choosing from what the widget actually accepts rather than typing a string */
    const pr = findProp(def, k);
    /* `opts` may be a function of the node — a link's page list is — and a property's options
       are fixed once declared, so only a literal list carries over. */
    const opts = typeof c.opts === 'function' ? null : c.opts;
    if (pr && opts) pr.opts = opts.map(o => [String(o[0]), String(o[1])] as [string, string]);
  }
  bindSet(n, c.k, { src: 'prop', path: k });
  return k;
}

/** Make a definition out of a node, and turn that node into the first instance. Saving a
    component that leaves the page unchanged is the point: nothing on screen moves, and what
    was one tree is now a definition with one instance pointing at it. */
function componentFromNode(nodeId: string, name: string) {
  const h = locate(nodeId);
  if (!h) return null;
  const base = tokenId(name) || 'component';
  let id = base, k = 2;
  while (findComponent(id)) id = base + '-' + k++;
  /* `reid`, not a bare clone: a definition's node ids become class names in the stylesheet, and
     a clone keeps the ids it copied — so the definition and the instance it was made from would
     have shared a selector, and every rule either of them owned would have been written twice
     under the same name. */
  const node = reid(clone(h.node));
  delete node.use; delete node.vals; delete node.variant; delete node.slot;
  components().push({ id, name: String(name || nameOf(h.node)).slice(0, 40), node, props: [] });
  /* The node stays where it is and becomes an instance of what it just defined. Its styling
     goes with the tree: the definition carries it now, it reaches the page through the
     definition's class, and leaving a copy on the instance would freeze today's definition into
     this one element — the same reason `instanceInsert` starts an instance unstyled. */
  h.node.use = id;
  h.node.children = [];
  h.node.css = { d: {}, t: {}, m: {} };
  h.node.cls = [];
  h.node.hide = {};
  h.node.adv = { htmlId: '', cls: '', css: '' };
  delete h.node.st; delete h.node.anim; delete h.node.bind; delete h.node.src;
  return id;
}
/** Place an instance. Levels come from the definition's root, the way a block's do. */
function instanceInsert(cid: string, parentNode?: PcNode | null, index = 0) {
  const def = findComponent(cid);
  if (!def) return null;
  const root = def.node;
  const fresh: PcNode = {
    ...clone(root), id: uid(), use: cid, children: [],
    /* an instance starts unstyled: the definition's own css is already on the element through
       the definition's class, and copying it here would freeze today's definition into every
       instance placed today */
    css: { d: {}, t: {}, m: {} }, cls: [], adv: { htmlId: '', cls: '', css: '' }
  };
  delete fresh.vals; delete fresh.variant; delete fresh.slot; delete fresh.st; delete fresh.anim;
  if (parentNode === undefined) return dropTree(fresh, state.ui.sel);
  const pt = parentNode ? parentNode.type : null;
  if (!fitsIn(pt, fresh.type)) return dropTree(fresh, parentNode ? parentNode.id : null);
  const list = parentNode ? parentNode.children : tree();
  list.splice(Math.max(0, Math.min(index, list.length)), 0, wrap(fresh.type, takes(pt), fresh));
  return fresh;
}
/** Every instance of a definition, across every page and both global regions. */
function instances(cid: string) {
  const out: { node: PcNode; where: string }[] = [];
  const scan = (list: PcNode[], where: string) => eachNode(list, n => {
    if (n.use === cid) out.push({ node: n, where });
  });
  scan(state.header, 'header');
  scan(state.footer, 'footer');
  state.pages.forEach((p, i) => scan(p.tree, 'page:' + i));
  return out;
}
const componentUsage = (cid: string) => instances(cid).length;

/** Declare a property. The key is derived from the label and made unique, so nobody types an
    identifier — the binding picker offers labels and stores keys. */
function propAdd(cid: string, label: string, t: PropKind, def = '') {
  const c = findComponent(cid);
  if (!c) return null;
  const base = tokenId(label) || 'prop';
  let k = base, i = 2;
  while (findProp(c, k)) k = base + '-' + i++;
  c.props = c.props || [];
  c.props.push({ k, label: String(label || 'Property').slice(0, 40), t, def });
  return k;
}
/** Rename a property. The label is what every instance's panel shows, and the one derived from
    a control's label — "Heading text" for what a person would call "Title" — is a guess made at
    the moment of declaring, when nobody was asked. */
function propRename(cid: string, k: string, label: string) {
  const pr = findProp(findComponent(cid), k);
  if (!pr) return false;
  pr.label = String(label || pr.label).slice(0, 40);
  return true;
}
/** Move a property up or down. The order is the order of the controls on every instance's
    panel, so it is a real decision and not bookkeeping. */
function propMove(cid: string, k: string, dir: number) {
  const c = findComponent(cid);
  if (!c) return false;
  const list = c.props || [];
  const i = list.findIndex(x => x.k === k);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}
/** Undeclare it, and unbind everything that read it — a binding pointing at a property that no
    longer exists would render the value authored in the definition, which looks like the
    property still works. */
function propDelete(cid: string, k: string) {
  const c = findComponent(cid);
  if (!c) return 0;
  c.props = (c.props || []).filter(x => x.k !== k);
  let n = 0;
  eachNode([c.node], x => {
    Object.entries(x.bind || {}).forEach(([key, b]) => {
      if (b.src === 'prop' && b.path === k) { bindSet(x, key, null); n++; }
    });
  });
  instances(cid).forEach(({ node }) => instSet(node, k, undefined));
  return n;
}
/** Delete a definition, and put every instance back to being an ordinary node — its own tree,
    copied from the definition as it stood. Leaving instances pointing at nothing would empty
    them, and a delete that silently blanks nine pages is not a delete anybody meant. */
function componentDelete(cid: string) {
  const def = findComponent(cid);
  if (!def) return 0;
  let n = 0;
  for (const { node } of instances(cid)) {
    const copy = reid(clone(def.node));
    const kept = node.children || [];                 // slot content stays with the page
    node.type = copy.type;
    node.props = copy.props;
    node.children = copy.children;
    node.bind = copy.bind;
    delete node.use; delete node.vals; delete node.variant;
    /* the slot's own content, appended where it can be: an instance's children were the page's
       nodes and dropping them is the one thing worse than a flattened component */
    if (kept.length) (node.children = node.children || []).push(...kept.map(c => { delete c.slot; return c; }));
    n++;
  }
  state.meta.components = components().filter(c => c.id !== cid);
  return n;
}
/** Edit a definition: the canvas, the layer list and the inspector all point at its tree.
    Returns false for a component that is not there, so a stale id leaves the editor where it
    is rather than showing an empty canvas with no way back. */
function componentOpen(cid: string) {
  if (!findComponent(cid)) return false;
  state.ui.mode = 'component';
  state.ui.cedit = cid;
  state.ui.sel = null;
  state.ui.multi = [];
  return true;
}
/** Back to the page. */
function componentClose() {
  state.ui.mode = 'page';
  state.ui.cedit = null;
  state.ui.sel = null;
  state.ui.multi = [];
}
const componentRename = (cid: string, name: string) => {
  const c = findComponent(cid);
  if (c) c.name = String(name || c.name).slice(0, 40);
};

/* Arrow-key traversal of the tree as it reads on screen */
const flatten = (list: any[], out: any[] = []): any[] => { list.forEach(n => { out.push(n); flatten(n.children || [], out); }); return out; };
function step(id: string | null, dir: number) {
  const flat = flatten(tree());
  if (!flat.length) return null;
  if (!id) return flat[0].id;
  const i = flat.findIndex(n => n.id === id);
  if (i < 0) return flat[0].id;
  const j = Math.max(0, Math.min(flat.length - 1, i + dir));
  return flat[j].id;
}
const parentOf = (id: string) => { const h = locate(id); return h && h.parent ? h.parent.id : null; };
const firstChildOf = (id: string) => { const h = locate(id); return h && h.node.children && h.node.children.length ? h.node.children[0].id : null; };
/* move a node among its siblings */
function nudge(id: string, dir: number) {
  const h = locate(id);
  if (!h) return false;
  const j = h.i + dir;
  if (j < 0 || j >= h.list.length) return false;
  [h.list[h.i], h.list[j]] = [h.list[j], h.list[h.i]];
  return true;
}
/** Move a selection to the start or end of the list it is already in. `nudge` walks one step;
    this is the end of that walk, which is what is actually wanted when a section belongs at the
    top of a page and is currently seventh.

    Every member has to share a parent, or "the start of its list" names more than one list and
    the result depends on which one you meant. Returns false when the selection is already
    flush, so a caller does not open an undo step for a move that did not happen. */
/* The geometry, worked out once. `atEdge` asks whether there is anything to do and `sendEdge`
   does it — and the caller needs the question separately, because `edit()` pushes an undo
   snapshot and clears the redo stack before its body runs. A move that turns out to be a
   no-op would leave a junk entry to undo and a redo that could no longer be reached. */
function edgeState(ids: string[], dir: number) {
  const order = topMost(selOrder(ids));
  if (!order.length) return null;
  const first = locate(order[0]);
  if (!first) return null;
  const pid = first.parent ? first.parent.id : null;
  /* every member must share a parent, or "the start of its list" names more than one list
     and the answer depends on which was meant */
  if (!order.every(id => {
    const g = locate(id);
    return !!g && (g.parent ? g.parent.id : null) === pid;
  })) return null;

  const list = first.parent ? first.parent.children : tree();
  const idx = order.map(id => list.findIndex(c => c.id === id));
  const flush = dir < 0
    ? idx.every((v, k) => v === k)
    : idx.every((v, k) => v === list.length - order.length + k);
  return { order, parent: first.parent, list, flush };
}
/** Nothing to do: already flush against that end, or a selection spanning two lists. */
const atEdge = (ids: string[], dir: number) => { const st = edgeState(ids, dir); return !st || st.flush; };

function sendEdge(ids: string[], dir: number) {
  const st = edgeState(ids, dir);
  if (!st || st.flush) return false;
  /* moveMany already re-reads the index on every step and adjusts for a member that was
     ahead of the target, which is exactly what moving several to one end needs. */
  return moveMany(st.order, st.parent, dir < 0 ? 0 : st.list.length) > 0;
}

/* Nudging a set: each member swaps with its neighbour, taking the members
   nearest the destination first so a swap cannot land on one that has yet to
   move. A neighbour already in the set is skipped — those two would only trade
   places, leaving the set exactly where it started. */
function nudgeMany(ids: string[], dir: number) {
  const set = new Set(ids);
  const order = selOrder(topMost(ids));
  let moved = 0;
  for (const id of (dir < 0 ? order : order.slice().reverse())) {
    const h = locate(id); if (!h) continue;
    const j = h.i + dir;
    if (j < 0 || j >= h.list.length) continue;
    if (set.has(h.list[j].id)) continue;
    [h.list[h.i], h.list[j]] = [h.list[j], h.list[h.i]];
    moved++;
  }
  return moved > 0;
}



/* ---- schema migration ------------------------------------------------ */
const SCHEMA = 13;                       // bump when the stored shape changes
function migrate(d: any) {
  if (!d || !d.pages || !d.pages.length) return null;
  /* `v` was the editor-backup marker before the document schema became an explicit part of
     the persisted contract. Accept it for old projects, but never guess when both markers
     disagree: that is corruption (or an incomplete writer), not a migration opportunity. */
  const schemaVersion = d.schemaVersion;
  const legacyVersion = d.v;
  if (schemaVersion !== undefined && (!Number.isInteger(schemaVersion) || schemaVersion < 1)) {
    throw new Error('invalid document schemaVersion');
  }
  if (legacyVersion !== undefined && (!Number.isInteger(legacyVersion) || legacyVersion < 1)) {
    throw new Error('invalid legacy document version');
  }
  if (schemaVersion !== undefined && legacyVersion !== undefined && schemaVersion !== legacyVersion) {
    throw new Error('conflicting document schema versions');
  }
  const v = schemaVersion ?? legacyVersion ?? 1;
  if (v > SCHEMA) return null;          // written by a newer build — refuse rather than corrupt
  /* Every node the document owns, for the steps that rewrite nodes rather than meta. Saved
     blocks are in here on purpose: a block is a detached tree, and a step that skips them
     leaves a node that renders one way on the page and another way out of the Blocks list. */
  const everyNode = (fn: (n: any) => void) => {
    const walk = (n: any) => { fn(n); (n.children || []).forEach(walk); };
    (d.header || []).forEach(walk);
    (d.footer || []).forEach(walk);
    (d.pages || []).forEach((pg: any) => (pg.tree || []).forEach(walk));
    (((d.meta || {}).blocks) || []).forEach((bl: any) => { if (bl.node) walk(bl.node); });
    (((d.meta || {}).components) || []).forEach((cd: any) => { if (cd.node) walk(cd.node); });
  };
  /* v1 → v2: images were inline data URIs. They still render as-is, so that
     step is a stamp only; new uploads go to the asset store as asset:<id>. */
  /* v2 → v3: design tokens arrive. The three colours that used to live loose on
     meta become the reserved text/bg/brand tokens; element colours stay literal
     until the author links them. */
  if (v < 3) {
    d.meta = d.meta || {};
    if (!d.meta.tokens) d.meta.tokens = defaultTokens(d.meta);
    delete d.meta.color; delete d.meta.bg; delete d.meta.accent;
  }
  /* v3 → v4: reusable style classes. Elements without a `cls` array simply have
     none, so only the project-level list needs creating. */
  if (v < 4) {
    d.meta = d.meta || {};
    d.meta.tokens = d.meta.tokens || defaultTokens(d.meta);
    if (!Array.isArray(d.meta.tokens.classes)) d.meta.tokens.classes = [];
  }
  /* v4 → v5: text styles gained a default HTML tag. Backfill the ones that
     shipped with the defaults; anything else simply has none. */
  if (v < 5) {
    const TAGS = { display: 'h1', title: 'h2', subtitle: 'h3', lead: 'p', body: 'p', small: 'p', eyebrow: 'div' };
    (((d.meta.tokens || {}).text as any[]) || []).forEach((t: any) => { const tg = TAGS as Record<string, string>; if (!t.tag && tg[t.id]) t.tag = tg[t.id]; });
  }
  /* v5 → v6: saved blocks live on the project */
  if (v < 6) {
    d.meta = d.meta || {};
    if (!Array.isArray(d.meta.blocks)) d.meta.blocks = [];
  }
  /* v6 → v7: content collections. Nothing existing binds to one, so an empty
     list is the whole migration. */
  if (v < 7) {
    d.meta = d.meta || {};
    if (!Array.isArray(d.meta.collections)) d.meta.collections = [];
  }
  /* v7 -> v8: a button's hover stops being a special case. Two custom properties on the
     resting block, `--hover-bg` and `--hover-fg`, were read by one `if (n.type === 'button')`
     in the stylesheet writer. That is how a button got a hover and nothing else could, and it
     survived the arrival of states as a real axis, so there were two ways to author the same
     rule on the one widget that had both.

     `--hover-fg` wrote colour *and* border-colour together, so an outline button's edge
     followed its text. The migration writes both, because that is what the page looked like
     yesterday. For the same reason it overwrites whatever `st.hover` already holds for those
     three properties: the old branch was emitted after the state rules and won on order, so
     the custom property is what the author actually saw. Migrating to the value that was not
     on screen would be a redesign wearing a migration's clothes. */
  if (v < 8) {
    everyNode(n => (['d', 't', 'm'] as const).forEach(b => {
      const map = n.css && n.css[b];
      if (!map) return;
      const bg = map['--hover-bg'], fg = map['--hover-fg'];
      delete map['--hover-bg']; delete map['--hover-fg'];
      if (!bg && !fg) return;
      n.st = n.st || {};
      const h = n.st.hover = n.st.hover || { d: {}, t: {}, m: {} };
      h[b] = h[b] || {};
      if (bg) h[b]['background-color'] = bg;
      if (fg) { h[b].color = fg; h[b]['border-color'] = fg; }
    }));
  }
  /* v8 -> v9: a binding names where its value comes from. It was a bare field id, because a
     CMS field was the only answer there could be; a component property is a second answer, and
     a second map beside `bind` would have been the same mistake as a hover that lived in two
     places. Every existing binding is a field binding — there was nothing else to be. */
  if (v < 9) {
    everyNode(n => {
      if (!n.bind) return;
      for (const [k, val] of Object.entries(n.bind)) {
        if (typeof val === 'string') n.bind[k] = { src: 'field', path: val };
      }
    });
  }
  /* v9 -> v10: component definitions live on the project. Nothing existing is an instance, so
     an empty list is the whole step — the same shape as the one that introduced collections. */
  if (v < 10) {
    d.meta = d.meta || {};
    if (!Array.isArray(d.meta.components)) d.meta.components = [];
  }
  /* v10 -> v11: a global block becomes a component.
     ---------------------------------------------------------------------------------------
     A global block placed copies and tagged each one so any copy could push its content over
     the others. An instance is that idea done properly: the definition owns the tree, and what
     varies between placements is declared rather than destroyed by the next push. Keeping both
     would be a second way to do one thing, which is the mistake this project keeps finding in
     its own past.

     A block's copies could diverge — that is the flaw, not an edge case — so a copy is only
     turned into an instance when its tree still matches the block's. A copy that had been
     edited locally keeps exactly what it shows and simply stops being linked, which it
     effectively already was. That way no page moves, which is the rule a migration lives by.

     Blocks that were never global are untouched. They are a different idea and a useful one:
     a saved starting point you paste and then own. */
  if (v < 11) {
    const bl = ((d.meta || {}).blocks || []) as any[];
    const global = bl.filter(b => b && b.sync && b.node);
    if (global.length) {
      d.meta.components = Array.isArray(d.meta.components) ? d.meta.components : [];
      /* the same tree, ignoring the things a copy is allowed to differ in: its node ids and
         the tag that linked it back */
      const shape = (n: any): string => JSON.stringify(n, (key, val) => {
        if (key === 'id') return undefined;
        if (key === 'adv' && val) { const { block, ...rest } = val; return rest; }
        return val;
      });
      for (const b of global) {
        const def = { id: b.id, name: b.name, node: reid(clone(b.node)), props: [] };
        const want = shape(b.node);
        /* Convert placements before registering this definition. `everyNode` intentionally
           includes component definitions so later migrations reach them; registering the new
           definition first would also make a legacy source tagged with its own block id turn
           into an instance of itself and discard its children. Existing definitions remain in
           the walk, so a global block nested in one is still upgraded. */
        everyNode(n => {
          if (!n.adv || n.adv.block !== b.id) return;
          delete n.adv.block;
          if (shape(n) !== want) return;              // diverged: it keeps what it shows
          n.use = b.id;
          n.children = [];
          n.css = { d: {}, t: {}, m: {} };
          n.cls = [];
          n.hide = {};
          n.adv = { htmlId: '', cls: '', css: '' };
          delete n.st; delete n.anim; delete n.bind; delete n.src;
        });
        eachNode([def.node], n => {
          const adv = n.adv as any;
          if (adv && adv.block === b.id) delete adv.block;
        });
        d.meta.components.push(def);
      }
      /* the global ones are components now; a document holding both lists would be holding the
         same tree twice under two names */
      d.meta.blocks = bl.filter(b => !(b && b.sync));
    }
    /* and nothing is a global block any more, including the ones that never were */
    ((d.meta || {}).blocks || []).forEach((b: any) => { if (b) delete b.sync; });
  }
  /* v11 -> v12: columns follow their row's vertical alignment by default.
     Previously every new column stored `justify-content:flex-start`, so there was no
     distinction between the untouched default and an intentional Top override. Treating
     that old default as Follow row makes existing layouts gain the expected behaviour;
     non-default Center and Bottom values remain explicit at the same breakpoint. */
  if (v < 12) {
    /* A class declaration was live CSS before this migration, even when the column had no
       declaration of its own. The new node marker is emitted after classes, so blindly
       defaulting that column to Follow row would override a class-provided Center or Bottom
       and move the page. Read the old class cascade without mutating the class itself: the
       same class may also dress a Box, where `justify-content` means something different. */
    const styleClasses = ((((d.meta || {}).tokens || {}).classes) || []) as any[];
    const classValue = (n: any, b: string, prop: string) => {
      const ids = Array.isArray(n.cls) ? n.cls : [];
      let value = '';
      for (const cls of styleClasses) {
        if (!cls || !ids.includes(cls.id)) continue;
        const next = cls.css && cls.css[b] && cls.css[b][prop];
        if (next !== undefined && next !== '') value = next;
      }
      return value;
    };
    everyNode(n => {
      if (!n || n.type !== 'column') return;
      n.css = n.css || { d: {}, t: {}, m: {} };
      for (const b of ['d', 't', 'm']) {
        const map = n.css[b] = n.css[b] || {};
        const old = map['justify-content'];
        if (old !== undefined && old !== '') {
          map[COLUMN_V_ALIGN] = (b === 'd' && old === 'flex-start') ? 'follow' : old;
          delete map['justify-content'];
        } else if (!map[COLUMN_V_ALIGN]) {
          const fromClass = classValue(n, b, 'justify-content');
          if (fromClass) map[COLUMN_V_ALIGN] = fromClass;
        }
      }
      if (!n.css.d[COLUMN_V_ALIGN]) n.css.d[COLUMN_V_ALIGN] = 'follow';
    });
  }
  /* v12 -> v13: a form states who receives it. Every existing form used the external HTTPS
     contract, so migration records that explicitly; WordPress-managed handling is opt-in. */
  if (v < 13) everyNode(n => {
    if (!n || n.type !== 'form') return;
    n.props = n.props || {};
    if (n.props.mode !== 'wordpress') n.props.mode = 'external';
  });
  d.v = SCHEMA;
  d.schemaVersion = SCHEMA;
  return d;
}



/* ---- section patterns -------------------------------------------------
   Pre-made designs for the Templates tab. Each is built from this project's own
   colour tokens and text styles, so a pattern arrives already on-brand.      */
/* Previews are drawn, not shipped: an inline wireframe stays self-contained,
   scales, and reads in either theme. */
const PV = (body: string) => `<svg class="pvw" viewBox="0 0 96 58" aria-hidden="true">${body}</svg>`;
const pb = (x: number, y: number, w: number, h: number, r?: number) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r || 1.5}" class="pv-b"/>`;
const pl = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" class="pv-l"/>`;
const pg = (x: number, y: number, w?: number) => `<rect x="${x}" y="${y}" width="${w || 20}" height="7" rx="3.5" class="pv-g"/>`;
const ph = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="5" rx="2" class="pv-h"/>`;

/* `scope` is what keeps a header template out of a page body. The regions are already a
   first-class idea — `tree()` switches on `state.ui.mode` and the Add panel writes to
   whichever list that returns — so a header pattern needs no new plumbing, only a filter.
   Without one, the Templates tab would happily drop a `<header>` landmark into the middle
   of an article. Absent means the page body, which is all 26 of the original patterns. */
interface Pattern {
  id: string; cat: string; name: string; desc: string;
  scope?: 'header' | 'footer';
  preview: () => string;
  build: () => PcNode;
}
const PATTERNS: Pattern[] = [
  {
    id: 'hero-split', cat: 'Hero', preview: () => PV(ph(8,12,34)+ph(8,20,26)+pl(8,30,32)+pl(8,36,24)+pg(8,44)+pb(54,10,34,38,2)),
    name: 'Split hero', desc: 'Headline and copy beside an image.',
    build: () => T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px' }, [
      cols(2, [
        [T_H('A headline with weight', 'display', { d: { 'margin-bottom': '16px' } }),
        T_T('<p>One sentence on what this is and who it is for.</p>', 'lead'),
        N('button', { text: 'Get started', ts: 'btn' }, { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'flex-start' } })],
        [N('image', { src: '', alt: '', lazy: 0 }, { d: { 'border-radius': '16px', height: '380px' }, m: { height: '220px' } })]
      ], { d: { gap: '56px', 'align-items': 'center' } })
    ])
  },
  {
    id: 'hero-centre', cat: 'Hero', preview: () => PV(ph(26,11,44)+ph(33,19,30)+pl(28,29,40)+pl(34,35,28)+pg(38,44)),
    name: 'Centred hero', desc: 'One column, centred, with a call to action.',
    build: () => T_SEC({ 'background-color': cvar('bg'), 'padding-top': '112px' }, [
      cols(1, [[
        T_H('Say it plainly', 'eyebrow', { d: { 'text-align': 'center', 'margin-bottom': '16px' } }),
        T_H('A headline that carries the page', 'display', { d: { 'text-align': 'center', 'margin-bottom': '18px' } }),
        T_T('<p>A supporting line that earns the click.</p>', 'lead', { d: { 'text-align': 'center', 'margin-bottom': '8px' } }),
        N('button', { text: 'Get started', ts: 'btn' }, { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'center' } })
      ]])
    ])
  },
  {
    id: 'features-3', cat: 'Features', preview: () => PV(ph(34,9,28)+pb(8,22,24,4,2)+pl(8,30,20)+pl(8,36,16)+pb(36,22,24,4,2)+pl(36,30,20)+pl(36,36,16)+pb(64,22,24,4,2)+pl(64,30,20)+pl(64,36,16)),
    name: 'Three features', desc: 'Title over three explained columns.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      cols(1, [[T_H('What you get', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '44px' } }),
      cols(3, [1, 2, 3].map(i => [
        T_H('Feature ' + i, 'subtitle'),
        T_T('<p>A sentence on why this matters to the reader.</p>', 'small')
      ]), { d: { gap: '24px' } })
    ])
  },
  {
    id: 'cards-3', cat: 'Features', preview: () => PV(pb(8,14,24,30,3)+pb(36,14,24,30,3)+pb(64,14,24,30,3)+pl(12,20,16)+pl(40,20,16)+pl(68,20,16)+pl(12,28,14)+pl(40,28,14)+pl(68,28,14)),
    name: 'Three cards', desc: 'Three bordered cards on a shared class.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      carded(cols(3, [1, 2, 3].map(i => [
        T_H('Card ' + i, 'subtitle', {}, 'h2'),
        T_T('<p>A short line of supporting copy.</p>', 'small')
      ]), { d: { gap: '24px' } }))
    ])
  },
  {
    id: 'faq-accordion', cat: 'FAQ', preview: () => PV(ph(8,7,38)+pb(8,17,80,1,0.5)+ph(8,22,32)+pl(8,30,66)+pl(8,36,54)+pb(8,44,80,1,0.5)+ph(8,49,36)+pb(84,21,4,4,2)+pb(84,48,4,4,2)),
    name: 'Questions that fold', desc: 'The same list, but each answer opens on click.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[T_H('Common questions', 'title', { d: { 'margin-bottom': '32px' } })]]),
      cols(1, [[N('accordion', {
        items: [
          { q: 'What does this cost?', a: 'Say the real number. A range is fine; a dodge is not.' },
          { q: 'How long does it take?', a: 'Two sentences. The first answers it, the second says what it depends on.' },
          { q: 'What do you need from me?', a: 'List it plainly, so nobody has to ask twice.' },
          { q: 'What if it is not right?', a: 'Describe what happens next, in the words you would use out loud.' }
        ],
        open: 'first'
      })]], { d: { 'max-width': '72ch' } })
    ])
  },
  {
    id: 'features-icons', cat: 'Features', preview: () => PV(ph(34,7,28)+pb(8,17,9,9,4.5)+pl(8,31,20)+pl(8,37,16)+pb(36,17,9,9,4.5)+pl(36,31,20)+pl(36,37,16)+pb(64,17,9,9,4.5)+pl(64,31,20)+pl(64,37,16)),
    name: 'Three features with icons', desc: 'A glyph over each of three explained columns.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[T_H('Built to be lived in', 'title', { d: { 'text-align': 'center', 'margin-bottom': '44px' } })]]),
      cols(3, [
        ['zap', 'Fast where it counts', 'One sentence on what this saves them.'],
        ['shield', 'Safe by default', 'One sentence on what it protects.'],
        ['layers', 'Yours to shape', 'One sentence on what it lets them change.']
      ].map(([ico, title, body]) => [
        N('icon', { name: ico }, { d: { '--icon-size': '26px', color: cvar('ink'), 'background-color': cvar('brand'), ...BOX('11px', '11px', '11px', '11px'), 'border-radius': '10px', 'margin-bottom': '18px' } }),
        T_H(title, 'subtitle', { d: { 'margin-bottom': '8px' } }),
        T_T('<p>' + body + '</p>', 'body')
      ]), { d: { gap: '32px' } })
    ])
  },
  {
    id: 'gallery-grid', cat: 'Media', preview: () => PV(ph(8,7,30)+pb(8,17,26,17,2)+pb(36,17,26,17,2)+pb(64,17,26,17,2)+pb(8,37,26,17,2)+pb(36,37,26,17,2)+pb(64,37,26,17,2)),
    name: 'Image grid', desc: 'Six slots in three columns, each opening full size.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[T_H('Selected work', 'title', { d: { 'margin-bottom': '28px' } })]]),
      cols(1, [[N('gallery', {
        /* six empty slots: a gallery arrives as somewhere to put images, the way
           the hero arrives with an image placeholder rather than with no image */
        items: Array.from({ length: 6 }, () => ({ src: '', alt: '', caption: '' })),
        ratio: '4 / 3'
      })]])
    ])
  },
  {
    id: 'media', cat: 'Media', preview: () => PV(pb(8,10,80,38,3)+'<path d="M44 24l8 5-8 5z" class="pv-g" stroke="none"/>'),
    name: 'Full-width media', desc: 'A single video or image, edge to edge.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      cols(1, [[N('video', {}, { d: { 'border-radius': '16px' } })]])
    ])
  },
  {
    id: 'cta', cat: 'Call to action', preview: () => PV(pb(4,8,88,42,3)+ph(30,20,36)+pg(38,32)),
    name: 'Closing call to action', desc: 'Ink band with one green action.',
    build: () => T_SEC({ 'background-color': cvar('ink') }, [
      cols(1, [[
        T_H('Ready when you are', 'title', { d: { color: cvar('bg'), 'text-align': 'center', 'margin-bottom': '20px' } }),
        N('button', { text: 'Get started', ts: 'btn' }, { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'center' } })
      ]])
    ])
  },
  {
    id: 'about-split', cat: 'About', preview: () => PV(pb(8,10,34,38,2)+ph(50,14,32)+pl(50,24,36)+pl(50,30,30)+pl(50,36,34)),
    name: 'About, image left', desc: 'A portrait or photo beside the story.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(2, [
        [N('image', { src: '', alt: '' }, { d: { 'border-radius': '16px', height: '340px' }, m: { height: '220px' } })],
        [T_H('Who we are', 'eyebrow', { d: { 'margin-bottom': '12px' } }),
        T_H('A short history', 'title', { d: { 'margin-bottom': '14px' } }),
        T_T('<p>Two or three sentences on how this started.</p>', 'lead')]
      ], { d: { gap: '48px', 'align-items': 'center' } })
    ])
  },
  {
    id: 'stats', cat: 'About', preview: () => PV(ph(10,20,18)+pl(10,30,14)+ph(40,20,18)+pl(40,30,14)+ph(70,20,18)+pl(70,30,14)),
    name: 'Statistics row', desc: 'Three numbers with captions.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      cols(3, [['120+', 'Projects shipped'], ['14 yrs', 'In practice'], ['98%', 'Would recommend']].map(([n, l]) => [
        T_H(n, 'display', sized('44px', { 'margin-bottom': '6px' }, '34px'), 'div'),
        T_T('<p>' + l + '</p>', 'small')
      ]), { d: { gap: '24px' } })
    ])
  },
  {
    id: 'quote', cat: 'Testimonial', preview: () => PV(pl(20,18,56)+pl(20,26,50)+pl(20,34,58)+pl(34,46,28)),
    name: 'Pull quote', desc: 'A single testimonial, given room.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[
        T_Q('A sentence in their words that a prospect would recognise as their own problem, solved.',
          'Name, Role at Company',
          sized('26px', { 'line-height': '1.4', color: cvar('ink'), 'text-align': 'center', 'max-width': '34ch', 'align-self': 'center' }, '20px'))
      ]])
    ])
  },
  {
    id: 'logos', cat: 'Media', preview: () => PV(pl(30,12,36)+pb(8,26,16,8,2)+pb(30,26,16,8,2)+pb(52,26,16,8,2)+pb(74,26,14,8,2)),
    name: 'Logo strip', desc: 'A quiet row of client marks.',
    build: () => T_SEC({ 'background-color': cvar('surface'), 'padding-top': '56px', 'padding-bottom': '56px' }, [
      cols(1, [[T_H('Trusted by', 'eyebrow', { d: { 'text-align': 'center', 'margin-bottom': '24px' } })]]),
      cols(4, [1, 2, 3, 4].map(() => [
        N('image', { src: '', alt: '' }, { d: { height: '40px', 'object-fit': 'contain', opacity: '.7' } })
      ]), { d: { gap: '32px', 'align-items': 'center' } })
    ])
  },
  {
    id: 'contact', cat: 'Contact', preview: () => PV(ph(8,12,30)+pl(8,22,32)+pl(8,28,26)+pb(50,10,38,7,2)+pb(50,21,38,7,2)+pb(50,32,38,14,2)+pg(50,50,18)),
    name: 'Contact with form', desc: 'Short intro beside a working form.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(2, [
        [T_H('Get in touch', 'title', { d: { 'margin-bottom': '14px' } }),
        T_T('<p>Tell people who replies, and how quickly.</p>', 'lead')],
        [N('form', {}, {})]
      ], { d: { gap: '56px', 'align-items': 'flex-start' } })
    ])
  },
  {
    id: 'hero-form', cat: 'Hero', preview: () => PV(ph(8,12,40)+ph(8,20,28)+pl(8,31,36)+pb(8,41,42,9,2)+pg(54,41,20)),
    name: 'Hero with signup', desc: 'Headline, one line of copy, and a form.',
    build: () => T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px' }, [
      cols(2, [
        [T_H('Launching soon', 'eyebrow', { d: { 'margin-bottom': '14px' } }),
        T_H('Be first to see it', 'display', { d: { 'margin-bottom': '16px' } }),
        T_T('<p>Say what people are signing up for, and how often.</p>', 'lead')],
        [N('form', {}, {})]
      ], { d: { gap: '56px', 'align-items': 'center' } })
    ])
  },
  {
    id: 'feature-rows', cat: 'Features', preview: () => PV(pb(6,7,26,20,2)+pl(38,12,32)+pl(38,18,26)+pb(64,31,26,20,2)+pl(6,36,32)+pl(6,42,26)),
    name: 'Alternating rows', desc: 'Two feature rows with the image sides swapped.',
    build: () => {
      const shot = () => N('image', { src: '', alt: '' }, { d: { 'border-radius': '16px', height: '260px', 'object-fit': 'cover' }, m: { height: '200px' } });
      const copy = (i: number) => [
        T_H('Feature ' + i, 'title', { d: { 'margin-bottom': '12px' } }),
        T_T('<p>Two sentences on what this does.</p>', 'lead')
      ];
      return T_SEC({ 'background-color': cvar('bg') }, [
        cols(2, [[shot()], copy(1)], { d: { gap: '48px', 'align-items': 'center', 'margin-bottom': '64px' } }),
        cols(2, [copy(2), [shot()]], { d: { gap: '48px', 'align-items': 'center' } })
      ]);
    }
  },
  {
    id: 'features-2', cat: 'Features', preview: () => PV(pb(6,11,40,36,3)+pb(50,11,40,36,3)+ph(11,19,26)+ph(55,19,26)+pl(11,29,30)+pl(55,29,30)+pl(11,36,24)+pl(55,36,24)),
    name: 'Two cards', desc: 'Two cards with room to explain.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      carded(cols(2, [1, 2].map(i => [
        T_H('Card ' + i, 'subtitle', { d: { 'margin-bottom': '8px' } }, 'h2'),
        T_T('<p>Three or four sentences fit at this width.</p>', 'body')
      ]), { d: { gap: '24px' } }))
    ])
  },
  {
    id: 'quotes-3', cat: 'Testimonial', preview: () => PV(pl(30,9,36)+pb(6,17,26,32,3)+pb(35,17,26,32,3)+pb(64,17,26,32,3)+pl(10,25,18)+pl(39,25,18)+pl(68,25,18)+pl(10,39,12)+pl(39,39,12)+pl(68,39,12)),
    name: 'Three testimonials', desc: 'Short quotes in a row of cards.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      cols(1, [[T_H('In their words', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '40px' } }),
      carded(cols(3, [1, 2, 3].map(() => [
        T_Q('One sentence a prospect would recognise as their own problem, solved.', 'Name, Role at Company',
          { d: { 'font-size': '16px', 'line-height': '1.7', color: cvar('text'), 'max-width': 'none' }, t: {}, m: {} })
      ]), { d: { gap: '24px' } }))
    ])
  },
  {
    id: 'pricing-3', cat: 'Pricing', preview: () => PV(pb(6,7,26,44,3)+pb(35,7,26,44,3)+pb(64,7,26,44,3)+ph(10,13,14)+ph(39,13,14)+ph(68,13,14)+pl(10,24,18)+pl(39,24,18)+pl(68,24,18)+pb(10,38,18,7,2)+pg(39,38,18)+pb(68,38,18,7,2)),
    name: 'Three plans', desc: 'Three tiers, with the action on the middle one.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[
        T_H('Simple pricing', 'title', { d: { 'text-align': 'center', 'margin-bottom': '10px' } }),
        T_T('<p>One line on how the pricing works.</p>', 'lead', { d: { 'text-align': 'center' } })
      ]], { d: { 'margin-bottom': '44px' } }),
      carded(cols(3, [['Starter', '$19'], ['Studio', '$49'], ['Team', '$99']].map(([plan, price], i) => [
        T_H(plan, 'subtitle'),
        T_H(price, 'display', sized('40px', { 'margin-bottom': '8px' }, '34px'), 'div'),
        T_T('<p>What a buyer gets at this level.</p>', 'small', { d: { 'margin-bottom': '20px' } }),
        (i === 1 ? T_B : T_BG)('Choose ' + plan, { 'align-self': 'stretch' })
      ]), { d: { gap: '24px' } }))
    ])
  },
  {
    id: 'pricing-2', cat: 'Pricing', preview: () => PV(pb(6,7,40,44,3)+pb(50,7,40,44,3)+ph(11,13,20)+ph(55,13,20)+pl(11,25,28)+pl(55,25,28)+pb(11,38,28,7,2)+pg(55,38,28)),
    name: 'Two plans', desc: 'Monthly and yearly, side by side.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      cols(1, [[T_H('Pick a plan', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '40px' } }),
      carded(cols(2, [['Monthly', '$29 / month'], ['Yearly', '$290 / year']].map(([plan, price], i) => [
        T_H(plan, 'subtitle'),
        T_H(price, 'title', { d: { 'margin-bottom': '10px' } }, 'div'),
        T_T('<p>Say what is included, and what is not.</p>', 'small', { d: { 'margin-bottom': '20px' } }),
        (i === 1 ? T_B : T_BG)('Choose ' + plan, { 'align-self': 'stretch' })
      ]), { d: { gap: '24px' } }))
    ])
  },
  {
    id: 'steps', cat: 'Process', preview: () => PV(pl(34,9,28)+pb(8,18,9,9,4.5)+pl(8,32,20)+pl(8,38,16)+pb(36,18,9,9,4.5)+pl(36,32,20)+pl(36,38,16)+pb(64,18,9,9,4.5)+pl(64,32,20)+pl(64,38,16)),
    name: 'Numbered steps', desc: 'Three numbered steps.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[T_H('How it works', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '44px' } }),
      cols(3, ['Talk it through', 'Make the thing', 'Hand it over'].map((step, i) => [
        T_H(String(i + 1), 'display', sized('19px', {
          width: '42px', height: '42px', 'border-radius': '999px',
          'background-color': cvar('surface'), 'border-width': '1px', 'border-style': 'solid',
          'border-color': cvar('line'), 'text-align': 'center', 'line-height': '40px', 'margin-bottom': '18px'
        }), 'div'),
        T_H(step, 'subtitle', { d: { 'margin-bottom': '8px' } }),
        T_T('<p>What happens at this stage, and what you need.</p>', 'small')
      ]), { d: { gap: '28px', 'align-items': 'flex-start' } })
    ])
  },
  {
    id: 'team', cat: 'Team', preview: () => PV(pl(34,7,28)+pb(10,15,20,20,10)+pl(10,39,20)+pl(10,46,14)+pb(38,15,20,20,10)+pl(38,39,20)+pl(38,46,14)+pb(66,15,20,20,10)+pl(66,39,20)+pl(66,46,14)),
    name: 'Team grid', desc: 'Three faces with names and roles.',
    build: () => T_SEC({ 'background-color': cvar('surface') }, [
      cols(1, [[T_H('Who you will work with', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '44px' } }),
      cols(3, [1, 2, 3].map(() => [
        N('image', { src: '', alt: '' }, { d: { height: '220px', 'border-radius': '16px', 'object-fit': 'cover', 'margin-bottom': '16px' }, m: { height: '180px' } }),
        T_H('Full name', 'subtitle', { d: { 'margin-bottom': '4px' } }),
        T_T('<p>Role or discipline</p>', 'small')
      ]), { d: { gap: '24px' } })
    ])
  },
  {
    id: 'faq-list', cat: 'FAQ', preview: () => PV(ph(8,8,40)+pl(8,17,72)+pb(8,25,80,1,0.5)+ph(8,30,34)+pl(8,39,72)+pb(8,47,80,1,0.5)+ph(8,52,38)),
    name: 'Question list', desc: 'Four questions and answers.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[T_H('Common questions', 'title', { d: { 'margin-bottom': '36px' } })]]),
      cols(1, [[
        'What does this cost?', 'How long does it take?',
        'What do you need from me?', 'What if it is not right?'
      ].flatMap((q, i, all) => [
        T_H(q, 'subtitle', { d: { 'margin-bottom': '8px' } }),
        T_T('<p>Answer in two sentences.</p>', 'body',
          { d: divider(i === all.length - 1, '26px') })
      ])], { d: { 'max-width': '68ch' } })
    ])
  },
  {
    id: 'prose-2', cat: 'Content', preview: () => PV(ph(8,9,34)+pl(8,22,36)+pl(8,28,36)+pl(8,34,30)+pl(52,22,36)+pl(52,28,36)+pl(52,34,32)),
    name: 'Two-column prose', desc: 'A heading and body copy in two columns.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(1, [[T_H('A section heading', 'title', { d: { 'margin-bottom': '28px', 'max-width': '28ch' } })]]),
      cols(2, [1, 2].map(() => [
        T_T('<p>A paragraph of real copy, at a width that reads faster than one wide measure.</p>', 'body')
      ]), { d: { gap: '48px', 'align-items': 'flex-start' } })
    ])
  },
  {
    id: 'cta-inline', cat: 'Call to action', preview: () => PV(pb(4,15,88,28,3)+ph(10,24,34)+pg(64,25,22)),
    name: 'Inline call to action', desc: 'A bordered band with one action.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      N('row', {}, {
        d: {
          ...BOX('32px', '32px', '32px', '32px'), gap: '24px', 'align-items': 'center',
          'background-color': cvar('surface'), 'border-radius': '16px',
          'border-width': '1px', 'border-style': 'solid', 'border-color': cvar('line')
        },
        m: { ...BOX('24px', '22px', '24px', '22px') }
      }, [
        N('column', {}, { d: { 'flex-grow': '70' } }, [
          T_H('Start when you are ready', 'subtitle', { d: { 'margin-bottom': '6px' } }, 'h2'),
          T_T('<p>One line on what happens after the click.</p>', 'small')
        ]),
        N('column', {}, { d: { 'flex-grow': '30' } }, [T_B('Get started', { 'align-self': 'flex-end' })])
      ])
    ])
  },
  {
    id: 'media-pair', cat: 'Media', preview: () => PV(pb(6,9,40,40,3)+pb(50,9,40,40,3)),
    name: 'Image pair', desc: 'Two images at equal weight.',
    build: () => T_SEC({ 'background-color': cvar('bg') }, [
      cols(2, [1, 2].map(() => [
        N('image', { src: '', alt: '' }, { d: { 'border-radius': '16px', height: '320px', 'object-fit': 'cover' }, m: { height: '220px' } })
      ]), { d: { gap: '24px' } })
    ])
  },

  /* ---- headers ------------------------------------------------------------
     All four are one row that does not wrap, because a header that reflows to two
     lines at 900px is the failure everybody has seen. The nav widget's own burger
     handles narrow instead. */
  {
    id: 'header-bar', cat: 'Header', scope: 'header',
    preview: () => PV(ph(8,9,20)+pl(52,10,10)+pl(66,10,10)+pl(80,10,8)+pRule(20)+pPage(21,37)),
    name: 'Logo and links', desc: 'A wordmark left, menu right, hairline under. The default.',
    build: () => T_BAR('header', '18px', {
      'background-color': cvar('bg'), ...HAIRLINE('bottom'), ...STICKY
    }, [
      cols(2, [[T_MARK('Your name')], [T_NAV()]],
        { d: { gap: '16px', 'flex-wrap': 'nowrap', ...BASELINE }, m: { gap: '20px', ...BURGER } })
    ])
  },
  {
    id: 'header-cta', cat: 'Header', scope: 'header',
    preview: () => PV(ph(8,9,18)+pl(38,10,9)+pl(50,10,9)+pl(62,10,7)+pg(74,8,14)+pRule(20)+pPage(21,37)),
    name: 'Links and a button', desc: 'Wordmark, centred menu, one action on the right.',
    build: () => T_BAR('header', '16px', {
      'background-color': cvar('bg'), ...HAIRLINE('bottom'), ...STICKY
    }, [
      /* The row is baseline-aligned for the wordmark and the menu, and the button's column
         opts back out to centre — a padded box wants its box centred, while text beside
         text wants a shared baseline. Both in one flex line, because `align-self` on an
         item beats the container's `align-items`. */
      btnCentred(cols(3, [
        [T_MARK('Your name')],
        /* Centred on desktop, but pushed right below the burger threshold so the collapsed
           menu and the action read as one group at the right edge rather than leaving the
           burger stranded in the middle of the bar. */
        [T_NAV({ d: { 'justify-content': 'center' }, m: { 'justify-content': 'flex-end' } })],
        /* nowrap and a tighter mobile box: three equal columns give this one about 110px at
           414px, which broke “Get started” across two lines and made the bar 79px tall. */
        [N('button', { text: 'Get started', ts: 'btn' }, {
          d: {
            'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'flex-end',
            'white-space': 'nowrap', 'border-radius': '8px', ...BOX('9px', '16px', '9px', '16px')
          },
          m: { ...BOX('8px', '12px', '8px', '12px'), 'font-size': '14px' }
        })]
      ], { d: { gap: '16px', 'flex-wrap': 'nowrap', ...BASELINE }, m: { gap: '14px', ...BURGER } }))
    ])
  },
  {
    id: 'header-centred', cat: 'Header', scope: 'header',
    preview: () => PV(ph(36,7,24)+pl(28,18,12)+pl(43,18,12)+pl(58,18,10)+pRule(26)+pPage(27,31)),
    name: 'Centred wordmark', desc: 'Name over the menu, both centred. Reads as editorial.',
    build: () => T_BAR('header', '22px', {
      'background-color': cvar('bg'), ...HAIRLINE('bottom')
    }, [
      cols(1, [[T_MARK('Your name')]], { d: { 'margin-bottom': '12px' } }),
      cols(1, [[T_NAV({ d: { 'justify-content': 'center' } })]])
    ])
  },
  {
    id: 'header-ink', cat: 'Header', scope: 'header',
    preview: () => PV(pInk(0,20)+pil(8,9,20)+pil(52,10,10)+pil(66,10,10)+pil(80,10,8)+pPage(21,37)),
    name: 'Dark bar', desc: 'The same row on ink, for a light page that wants a strong top.',
    build: () => T_BAR('header', '18px', {
      'background-color': cvar('ink'), ...STICKY
    }, [
      cols(2, [
        [T_MARK('Your name', cvar('surface'))],
        [T_NAV({ d: { color: cvar('muted-i'), '--nav-hover': cvar('surface'), '--nav-panel': cvar('ink') } })]
      ], { d: { gap: '16px', 'flex-wrap': 'nowrap', ...BASELINE }, m: { gap: '20px', ...BURGER } })
    ])
  },

  /* ---- footers ------------------------------------------------------------
     The link lists are WYSIWYG rather than a nav widget on purpose: a footer sitemap is
     prose-with-links, it does not collapse to a burger, and it is the one place a project
     wants a dozen links without a menu's alignment and gap machinery. */
  {
    id: 'footer-columns', cat: 'Footer', scope: 'footer',
    preview: () => PV(pPage(0,5)+pRule(6)+ph(8,12,20)+pl(8,20,24)+pl(40,12,14)+pl(40,18,12)+pl(40,24,12)+pl(64,12,14)+pl(64,18,12)+pl(64,24,12)+pRule(38)+pl(8,44,20)),
    name: 'Sitemap columns', desc: 'A line about the site, two link lists, then fine print.',
    build: () => T_BAR('footer', '64px', {
      'background-color': cvar('bg'), ...HAIRLINE('top')
    }, [
      cols(3, [
        [T_MARK('Your name'), T_T('<p>One line on what the site is for.</p>', 'small', { d: { 'margin-top': '10px' } })],
        [T_H('Sitemap', 'eyebrow', { d: { 'margin-bottom': '12px' } }),
         T_LINKS([['Home', HOME], ['Work', HOME], ['Contact', HOME]])],
        [T_H('Elsewhere', 'eyebrow', { d: { 'margin-bottom': '12px' } }),
         T_LINKS([['Instagram', 'https://instagram.com'], ['LinkedIn', 'https://linkedin.com'], ['Email', 'mailto:hello@example.com']])]
      ], { d: { gap: '32px' }, m: { gap: '28px' } }),
      N('divider', {}, { d: { 'margin-top': '40px', 'margin-bottom': '20px', 'border-top-color': cvar('line') } }),
      cols(1, [[T_T('<p>&copy; 2026 Your name. All rights reserved.</p>', 'small')]])
    ])
  },
  {
    id: 'footer-slim', cat: 'Footer', scope: 'footer',
    preview: () => PV(pPage(0,23)+pRule(24)+ph(8,32,18)+pl(58,33,30)),
    name: 'One line', desc: 'Name and copyright on a single row. Nothing else.',
    build: () => T_BAR('footer', '28px', {
      'background-color': cvar('bg'), ...HAIRLINE('top')
    }, [
      cols(2, [
        [T_MARK('Your name')],
        [T_T('<p>&copy; 2026 Your name</p>', 'small', { d: { 'text-align': 'right' }, m: { 'text-align': 'left' } })]
      ], { d: { gap: '16px', ...BASELINE } })
    ])
  },
  {
    id: 'footer-signup', cat: 'Footer', scope: 'footer',
    preview: () => PV(pPage(0,3)+pRule(4)+ph(8,10,26)+pb(8,19,44,8,2)+pg(56,19,16)+pRule(33)+pl(8,40,14)+pl(30,40,14)+pl(52,40,14)+pl(74,40,12)),
    name: 'Signup and links', desc: 'An email capture above the links, for a list that matters.',
    build: () => T_BAR('footer', '56px', {
      'background-color': cvar('surface'), ...HAIRLINE('top')
    }, [
      cols(2, [
        /* h2, not the h3 the subtitle style implies: this is the only real heading in the
           footer, so after a page's h1 an h3 is an outline skip. The look and the tag are
           independent, which is what T_H's level argument is for. */
        [T_H('Occasional letters, no noise.', 'subtitle', { d: { 'margin-bottom': '8px' } }, 'h2'),
         T_T('<p>One email a month. Unsubscribe whenever.</p>', 'small')],
        [N('form', {
          submit: 'Subscribe', aria: 'Newsletter signup',
          fields: [{ type: 'email', label: 'Email', name: 'email', required: 1, ph: 'you@example.com' }]
        }, { d: { 'align-self': 'center' } })]
      ], { d: { gap: '40px', 'align-items': 'center' }, m: { gap: '24px' } }),
      N('divider', {}, { d: { 'margin-top': '40px', 'margin-bottom': '24px', 'border-top-color': cvar('line') } }),
      cols(2, [
        [T_LINKS([['Home', HOME], ['Work', HOME], ['Contact', HOME]])],
        [T_T('<p>&copy; 2026 Your name</p>', 'small', { d: { 'text-align': 'right' }, m: { 'text-align': 'left' } })]
      ], { d: { gap: '24px', 'align-items': 'flex-end' } })
    ])
  },
  {
    id: 'footer-ink', cat: 'Footer', scope: 'footer',
    preview: () => PV(pPage(0,5)+pInk(6,52)+pil(8,14,20)+pil(8,22,24)+pil(44,14,14)+pil(44,20,12)+pil(44,26,12)+pil(70,14,14)+pil(70,20,12)+pil(70,26,12)+pil(8,46,22)),
    name: 'Dark sitemap', desc: 'The columns on ink, to close a light page firmly.',
    build: () => T_BAR('footer', '64px', { 'background-color': cvar('ink') }, [
      cols(3, [
        [T_MARK('Your name', cvar('surface')),
         T_T('<p>One line on what the site is for.</p>', 'small', { d: { color: cvar('muted-i'), 'margin-top': '10px' } })],
        [T_H('Sitemap', 'eyebrow', { d: { color: cvar('muted-i'), 'margin-bottom': '12px' } }),
         T_LINKS([['Home', HOME], ['Work', HOME], ['Contact', HOME]],
           { d: { color: cvar('muted-i'), '--link': cvar('surface') } })],
        [T_H('Elsewhere', 'eyebrow', { d: { color: cvar('muted-i'), 'margin-bottom': '12px' } }),
         T_LINKS([['Instagram', 'https://instagram.com'], ['LinkedIn', 'https://linkedin.com'], ['Email', 'mailto:hello@example.com']],
           { d: { color: cvar('muted-i'), '--link': cvar('surface') } })]
      ], { d: { gap: '32px' }, m: { gap: '28px' } }),
      N('divider', {}, { d: { 'margin-top': '40px', 'margin-bottom': '20px', 'border-top-color': cvar('slate') } }),
      cols(1, [[T_T('<p>&copy; 2026 Your name. All rights reserved.</p>', 'small', { d: { color: cvar('muted-i') } })]])
    ])
  }
];
/* `parentNode` omitted means "drop at the current selection", which the body below
   tests for explicitly — so the signature declaring it required made its own branch
   unreachable, and the Add panel's call an error. `index` is only read once a parent
   is given, and every caller that gives one gives both; the default just keeps the
   arithmetic total. */
function patternInsert(pid: string, parentNode?: PcNode | null, index = 0) {
  const p = PATTERNS.find(x => x.id === pid);
  if (!p) return null;
  const node = p.build();
  if (parentNode === undefined) return dropTree(node, state.ui.sel);
  const pt = parentNode ? parentNode.type : null;
  if (!fitsIn(pt, node.type)) return dropTree(node, parentNode ? parentNode.id : null);
  const list = parentNode ? parentNode.children : tree();
  list.splice(Math.max(0, Math.min(index, list.length)), 0, wrap(node.type, takes(pt), node));
  return node;
}

/* ---- page templates ---------------------------------------------------
   Each builds real structure from the project's own tokens and text styles, so
   a template inherits the brand instead of importing someone else's. */
/* A heading carries two independent things: a look (the text style) and a place
   in the document outline (the tag). `N` fills the tag from the widget default,
   which is H2 — so every template used to render a flat run of H2s with no H1 at
   all. Deriving the tag from the text style fixes the whole library at once;
   pass `level` where a particular outline needs something else. */
const TS_LEVEL: Record<string, string> = { display: 'h1', title: 'h2', subtitle: 'h3', eyebrow: 'div' };
const T_H = (text: string, ts: string, css?: any, level?: string) => N('heading', { text, ts, level: level || TS_LEVEL[ts] || 'h3' }, css);
const T_T = (html: string, ts: string, css?: any) => N('text', { html, ts }, css);
/* A header or footer is a bar, not a section: `T_SEC`'s 88px of breathing room is wrong
   for it, and its mobile padding is set on `m` where a caller cannot reach it. The tag is
   the point — `<header>` and `<footer>` are what make a region a landmark, and a template
   that left it as `<section>` would look right and export wrong. */
const T_BAR = (tag: string, pad: string, css?: any, kids?: any) => N('section', { tag },
  { d: { ...BOX(pad, '28px', pad, '28px'), ...(css || {}) },
    m: { ...BOX(String(Math.round(parseInt(pad, 10) * 0.78)) + 'px', '20px', String(Math.round(parseInt(pad, 10) * 0.78)) + 'px', '20px') } },
  kids);
/* A wordmark, not a heading: a site name in a header is not a section title, so it takes
   the `div` tag and stays out of the document outline. Every page would otherwise open
   with the same stray heading above its real one. */
const T_MARK = (text: string, ink?: string) => T_H(text, '', sized('19px', {
  'font-weight': '600', 'letter-spacing': '-.03em', color: ink || cvar('ink'), 'margin-bottom': '0px'
}), 'div');
/* Every link in a region template points at HOME for the same reason the Nav widget's own
   default does, and an empty href is worse than a repeated one: the export silently becomes
   `href="#"` while the review stays quiet about it.

   No items here any more. This used to restate the menu because the widget's default was
   three dead links; now that the default resolves, restating it would be a second copy to
   drift from the first. */
const T_NAV = (css?: any) => N('nav', {}, css || {});
const T_LINKS = (rows: [string, string][], css?: any) =>
  T_T('<p>' + rows.map(([label, href]) => `<a href="${href}">${label}</a>`).join('<br>') + '</p>', 'small', css);
/* Sticky is what a header is for, and the z-index has to clear the canvas overlays. */
const STICKY = { position: 'sticky', top: '0px', 'z-index': '50' };
/* Text beside text in a bar aligns on the baseline, not on the box.
   `align-items:center` centres the line boxes exactly — measured, both at 33.2px — and
   still reads as wrong, because a 19px wordmark and a 15px menu centred in their own boxes
   end up with baselines 2px apart and the eye follows the baseline. Equal line-heights do
   not fix it: the offset comes from the ascent scaling with the font size, not from the
   leading, and setting both to line-height 1 leaves the same 2px. Baseline alignment brings
   it to 0.2px.

   A box among the text still wants its box centred — see the button in header-cta, which
   overrides this on its own column.

   And it only holds while the menu *is* text. Once it collapses to a burger there is no
   baseline worth sharing and an icon reads as centred or not: baseline alignment left the
   burger 4.3px low at 414px. `BURGER` goes on `m`, which is the same `max-width:767px` the
   default `collapse:'mobile'` emits into — so the switch happens exactly where the menu
   stops being words. A nav set to collapse at tablet would want this on `t` as well. */
const BASELINE = { 'align-items': 'baseline' };
const BURGER = { 'align-items': 'center' };
/* Opt one column back out of the row's baseline alignment. `cols()` only gives each
   column its flex-grow, so reaching in afterwards is how a per-column value gets set —
   the same move `carded()` makes. */
const btnCentred = (row: any) => {
  const last = row.children[row.children.length - 1];
  if (last) last.css.d['align-self'] = 'center';
  return row;
};
const HAIRLINE = (side: string, colour?: string) => ({
  [`border-${side}-width`]: '1px', [`border-${side}-style`]: 'solid',
  [`border-${side}-color`]: colour || cvar('line')
});
/* Header and footer previews draw the bar and then a hint of the page it sits against,
   so a thumbnail reads as a top or a bottom rather than as a floating row. */
const pRule = (y: number) => `<rect x="0" y="${y}" width="96" height="1" class="pv-l"/>`;
const pPage = (y: number, h: number) => `<rect x="0" y="${y}" width="96" height="${h}" class="pv-b" opacity=".45"/>`;
const pInk = (y: number, h: number) => `<rect x="0" y="${y}" width="96" height="${h}" class="pv-i"/>`;
const pil = (x: number, y: number, w: number) => `<rect x="${x}" y="${y}" width="${w}" height="3" rx="1.5" class="pv-b"/>`;
const T_Q = (text: string, by: string, css?: any) => N('quote', { text, by, source: '', ts: 'lead' }, css);
const T_SEC = (css?: any, kids?: any) => N('section', {}, { d: { ...BOX('88px', '28px', '88px', '28px'), ...(css || {}) }, m: { ...BOX('56px', '20px', '56px', '20px') } }, kids);
/* Green is for action, so it belongs on the primary button and nowhere else in
   a pattern; anything secondary takes the outline treatment. */
const T_B = (text: string, css?: any) => N('button', { text, ts: 'btn' },
  { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'flex-start', ...(css || {}) } });
const T_BG = (text: string, css?: any) => N('button', { text, ts: 'btn' },
  { d: {
    'background-color': 'transparent', color: cvar('ink'), 'border-width': '1px',
    'border-style': 'solid', 'border-color': cvar('line'), 'align-self': 'flex-start', ...(css || {})
  } });
/* A text style sets its own size at every breakpoint, and `treeCss` emits the
   breakpoint blocks after the desktop element rules — so overriding a size on
   the desktop base alone is silently beaten below 1024px, which is most of the
   editor canvas and every tablet. Anything that resizes a styled heading pins
   all three. */
const sized = (px: string, d?: any, mob?: string) => ({ d: { 'font-size': px, ...(d || {}) }, t: { 'font-size': px }, m: { 'font-size': mob || px } });
/* A hairline between stacked items, suppressed on the last so a list does not
   end in a rule with nothing under it. */
const divider = (last: boolean, gap?: string) => last ? { 'margin-bottom': '0px' } : {
  'margin-bottom': gap, 'padding-bottom': gap,
  'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': cvar('line')
};
/* One shared Card class, made on first use. Several patterns land on it, so
   restyling a card restyles every card the project has placed. */
function cardClass() {
  let c = classes().find(x => x.id === 'card');
  if (!c) {
    classAdd('Card', {
      d: {
        ...BOX('28px', '28px', '28px', '28px'), 'background-color': cvar('bg'),
        'border-radius': '16px', 'border-width': '1px', 'border-style': 'solid', 'border-color': cvar('line')
      },
      m: { ...BOX('22px', '22px', '22px', '22px') }
    });
    c = findClass('card') || undefined;
  }
  return c;
}
const carded = (row: any) => { row.children.forEach((col: any) => classApply(col, cardClass()!.id)); return row; };

/* The catalog belongs to the shared editor contract, not to either host. Cloud and
   WordPress both render these exact labels, categories and previews, while `build`
   remains the canonical document factory. The preview is deliberately geometric:
   it communicates page rhythm without inventing customer copy or imagery. */
const templatePreview = (id: string): string => {
  const header = '<rect class="tp-line" x="22" y="18" width="46" height="6" rx="3"/><rect class="tp-line" x="246" y="18" width="28" height="5" rx="2.5"/><rect class="tp-line" x="282" y="18" width="28" height="5" rx="2.5"/><rect class="tp-accent" x="318" y="14" width="24" height="13" rx="3"/>';
  const art: Record<string, string> = {
    blank: '<rect class="tp-outline" x="22" y="48" width="320" height="148" rx="5"/>',
    landing: '<rect class="tp-ink" x="22" y="54" width="130" height="12" rx="3"/><rect class="tp-ink" x="22" y="72" width="104" height="12" rx="3"/><rect class="tp-line" x="22" y="96" width="112" height="6" rx="3"/><rect class="tp-accent" x="22" y="116" width="46" height="16" rx="4"/><rect class="tp-media" x="186" y="48" width="156" height="88" rx="6"/><rect class="tp-line" x="22" y="160" width="92" height="30" rx="5"/><rect class="tp-line" x="136" y="160" width="92" height="30" rx="5"/><rect class="tp-line" x="250" y="160" width="92" height="30" rx="5"/>',
    pricing: '<rect class="tp-ink" x="127" y="48" width="110" height="12" rx="3"/><rect class="tp-line" x="144" y="68" width="76" height="6" rx="3"/><rect class="tp-card" x="22" y="94" width="96" height="96" rx="6"/><rect class="tp-card" x="134" y="86" width="96" height="104" rx="6"/><rect class="tp-card" x="246" y="94" width="96" height="96" rx="6"/><rect class="tp-accent" x="154" y="160" width="56" height="14" rx="4"/>',
    contact: '<rect class="tp-ink" x="22" y="56" width="106" height="14" rx="3"/><rect class="tp-line" x="22" y="82" width="120" height="6" rx="3"/><rect class="tp-line" x="22" y="94" width="92" height="6" rx="3"/><rect class="tp-card" x="184" y="48" width="158" height="142" rx="6"/><rect class="tp-outline" x="198" y="68" width="130" height="20" rx="3"/><rect class="tp-outline" x="198" y="98" width="130" height="44" rx="3"/><rect class="tp-accent" x="198" y="154" width="54" height="16" rx="4"/>',
    about: '<rect class="tp-ink" x="22" y="50" width="124" height="12" rx="3"/><rect class="tp-line" x="22" y="72" width="116" height="6" rx="3"/><rect class="tp-media" x="22" y="102" width="126" height="68" rx="5"/><rect class="tp-ink" x="176" y="108" width="78" height="9" rx="3"/><rect class="tp-line" x="176" y="128" width="150" height="6" rx="3"/><rect class="tp-line" x="176" y="140" width="126" height="6" rx="3"/><rect class="tp-accent" x="176" y="158" width="44" height="14" rx="4"/>',
    services: '<rect class="tp-ink" x="122" y="48" width="120" height="12" rx="3"/><rect class="tp-line" x="140" y="68" width="84" height="6" rx="3"/><rect class="tp-card" x="22" y="98" width="96" height="74" rx="6"/><rect class="tp-card" x="134" y="98" width="96" height="74" rx="6"/><rect class="tp-card" x="246" y="98" width="96" height="74" rx="6"/><circle class="tp-accent" cx="48" cy="120" r="8"/><circle class="tp-accent" cx="160" cy="120" r="8"/><circle class="tp-accent" cx="272" cy="120" r="8"/>',
    work: '<rect class="tp-ink" x="22" y="48" width="116" height="12" rx="3"/><rect class="tp-line" x="22" y="68" width="138" height="6" rx="3"/><rect class="tp-media" x="22" y="96" width="96" height="44" rx="5"/><rect class="tp-media" x="134" y="96" width="96" height="44" rx="5"/><rect class="tp-media" x="246" y="96" width="96" height="44" rx="5"/><rect class="tp-media" x="22" y="152" width="96" height="38" rx="5"/><rect class="tp-media" x="134" y="152" width="96" height="38" rx="5"/><rect class="tp-media" x="246" y="152" width="96" height="38" rx="5"/>',
    case: '<rect class="tp-ink" x="22" y="46" width="150" height="12" rx="3"/><rect class="tp-line" x="22" y="66" width="112" height="6" rx="3"/><rect class="tp-media" x="22" y="88" width="320" height="68" rx="6"/><rect class="tp-line" x="22" y="174" width="84" height="16" rx="4"/><rect class="tp-line" x="140" y="174" width="84" height="16" rx="4"/><rect class="tp-accent" x="258" y="174" width="84" height="16" rx="4"/>',
    faq: '<rect class="tp-ink" x="22" y="48" width="100" height="12" rx="3"/><rect class="tp-line" x="22" y="70" width="136" height="6" rx="3"/><rect class="tp-card" x="22" y="96" width="320" height="22" rx="4"/><rect class="tp-card" x="22" y="128" width="320" height="22" rx="4"/><rect class="tp-card" x="22" y="160" width="320" height="22" rx="4"/>',
    blog: '<rect class="tp-ink" x="22" y="48" width="104" height="12" rx="3"/><rect class="tp-line" x="22" y="68" width="124" height="6" rx="3"/><rect class="tp-media" x="22" y="98" width="88" height="38" rx="5"/><rect class="tp-line" x="128" y="102" width="116" height="8" rx="3"/><rect class="tp-line" x="128" y="118" width="190" height="6" rx="3"/><rect class="tp-media" x="22" y="150" width="88" height="38" rx="5"/><rect class="tp-line" x="128" y="154" width="98" height="8" rx="3"/><rect class="tp-line" x="128" y="170" width="174" height="6" rx="3"/>',
    article: '<rect class="tp-line" x="128" y="48" width="64" height="5" rx="2.5"/><rect class="tp-ink" x="92" y="66" width="180" height="13" rx="3"/><rect class="tp-line" x="118" y="88" width="128" height="6" rx="3"/><rect class="tp-media" x="70" y="108" width="224" height="46" rx="5"/><rect class="tp-line" x="96" y="170" width="172" height="5" rx="2.5"/><rect class="tp-line" x="96" y="182" width="146" height="5" rx="2.5"/>',
    soon: '<rect class="tp-ink" x="97" y="62" width="170" height="13" rx="3"/><rect class="tp-line" x="122" y="86" width="120" height="6" rx="3"/><rect class="tp-outline" x="88" y="116" width="134" height="24" rx="4"/><rect class="tp-accent" x="230" y="116" width="48" height="24" rx="4"/><rect class="tp-line" x="136" y="158" width="92" height="5" rx="2.5"/>'
  };
  return `<svg class="templatePreview" viewBox="0 0 364 214" role="img" aria-label="${id} page layout preview"><rect class="tp-paper" width="364" height="214" rx="8"/>${header}${art[id] || art.blank}</svg>`;
};

const TEMPLATES = [
  {
    id: 'blank', name: 'Blank', desc: 'An empty page.', category: 'Start', keywords: ['empty', 'canvas'],
    build: () => []
  },
  {
    id: 'landing', name: 'Landing page', desc: 'Hero, three features, closing call to action.', category: 'Marketing', keywords: ['home', 'hero', 'features', 'cta'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px' }, [
        cols(1, [[
          T_H('Your headline here', 'display', { d: { 'margin-bottom': '18px', 'max-width': '20ch' } }),
          T_T('<p>One sentence that says what this is and who it is for.</p>', 'lead', { d: { 'max-width': '46ch' } }),
          N('button', { text: 'Get started', ts: 'btn' }, { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'flex-start' } })
        ]])
      ]),
      T_SEC({ 'background-color': cvar('surface') }, [
        cols(1, [[T_H('What you get', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '44px' } }),
        cols(3, [1, 2, 3].map(i => [
          T_H('Feature ' + i, 'subtitle'),
          T_T('<p>A sentence on why this matters to the reader.</p>', 'small')
        ]), { d: { gap: '24px' } })
      ]),
      T_SEC({ 'background-color': cvar('ink') }, [
        cols(1, [[
          T_H('Ready when you are', 'title', { d: { color: cvar('bg'), 'text-align': 'center', 'margin-bottom': '20px' } }),
          N('button', { text: 'Get started', ts: 'btn' }, { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'center' } })
        ]])
      ])
    ]
  },
  {
    id: 'pricing', name: 'Pricing', desc: 'Intro and three plan columns.', category: 'Marketing', keywords: ['plans', 'packages', 'subscriptions'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg') }, [
        cols(1, [[
          T_H('Pricing', 'display', { d: { 'text-align': 'center', 'margin-bottom': '14px' } }),
          T_T('<p>One line on how the pricing works.</p>', 'lead', { d: { 'text-align': 'center' } })
        ]], { d: { 'margin-bottom': '48px' } }),
        cols(3, ['Starter', 'Studio', 'Team'].map(plan => [
          T_H(plan, 'subtitle', {}, 'h2'),
          T_H('$00', 'title', { d: { 'margin-bottom': '10px' } }, 'h3'),
          T_T('<p>What is included at this level.</p>', 'small', { d: { 'margin-bottom': '18px' } }),
          N('button', { text: 'Choose ' + plan, ts: 'btn' }, { d: { 'background-color': 'transparent', color: cvar('ink'), 'border-width': '1px', 'border-style': 'solid', 'border-color': cvar('line'), 'align-self': 'flex-start' } })
        ]), { d: { gap: '24px' } })
      ])
    ]
  },
  {
    id: 'contact', name: 'Contact', desc: 'Short intro beside a working form.', category: 'Company', keywords: ['form', 'inquiry', 'lead'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg') }, [
        cols(2, [
          [T_H('Get in touch', 'display', { d: { 'margin-bottom': '16px' } }),
          T_T('<p>Tell people what to expect — who replies, and how quickly.</p>', 'lead')],
          [N('form', {}, {})]
        ], { d: { gap: '56px', 'align-items': 'flex-start' } })
      ])
    ]
  }
,
  {
    id: 'about', name: 'About', desc: 'The story, a stats row and a closing action.', category: 'Company', keywords: ['story', 'team', 'company'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px' }, [
        cols(1, [[
          T_H('About', 'eyebrow', { d: { 'margin-bottom': '14px' } }),
          T_H('Why this exists', 'display', { d: { 'margin-bottom': '18px', 'max-width': '24ch' } }),
          T_T('<p>One paragraph on what you do and who you do it for.</p>', 'lead', { d: { 'max-width': '52ch' } })
        ]])
      ]),
      T_SEC({ 'background-color': cvar('surface') }, [
        cols(2, [
          [N('image', { src: '', alt: '' }, { d: { 'border-radius': '16px', height: '360px', 'object-fit': 'cover' }, m: { height: '240px' } })],
          [T_H('How it started', 'title', { d: { 'margin-bottom': '14px' } }),
          T_T('<p>Two or three sentences on the origin. What was missing, and what you did about it.</p>', 'body')]
        ], { d: { gap: '48px', 'align-items': 'center' } })
      ]),
      T_SEC({ 'background-color': cvar('bg') }, [
        cols(3, [['120+', 'Projects shipped'], ['14 yrs', 'In practice'], ['98%', 'Would recommend']].map(([n, l]) => [
          T_H(n, 'display', sized('44px', { 'margin-bottom': '6px' }, '34px'), 'div'),
          T_T('<p>' + l + '</p>', 'small')
        ]), { d: { gap: '24px' } })
      ]),
      T_SEC({ 'background-color': cvar('ink') }, [
        cols(1, [[
          T_H('Work with us', 'title', { d: { color: cvar('bg'), 'text-align': 'center', 'margin-bottom': '20px' } }),
          T_B('Get in touch', { 'align-self': 'center' })
        ]])
      ])
    ]
  },
  {
    id: 'services', name: 'Services', desc: 'What you offer, how it works, then an action.', category: 'Company', keywords: ['offer', 'process', 'business'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px' }, [
        cols(1, [[
          T_H('What we do', 'display', { d: { 'text-align': 'center', 'margin-bottom': '14px' } }),
          T_T('<p>One line that frames the whole offer.</p>', 'lead', { d: { 'text-align': 'center' } })
        ]])
      ]),
      T_SEC({ 'background-color': cvar('surface') }, [
        carded(cols(3, ['Strategy', 'Design', 'Build'].map(svc => [
          T_H(svc, 'subtitle', { d: { 'margin-bottom': '8px' } }, 'h2'),
          T_T('<p>What this includes, and what a client walks away with.</p>', 'small')
        ]), { d: { gap: '24px' } }))
      ]),
      T_SEC({ 'background-color': cvar('bg') }, [
        cols(1, [[T_H('How it works', 'title', { d: { 'text-align': 'center' } })]], { d: { 'margin-bottom': '44px' } }),
        cols(3, ['Talk it through', 'Make the thing', 'Hand it over'].map((step, i) => [
          T_H(String(i + 1), 'display', sized('19px', { 'margin-bottom': '10px', color: cvar('muted') }), 'div'),
          T_H(step, 'subtitle', { d: { 'margin-bottom': '8px' } }),
          T_T('<p>A sentence on what happens at this stage.</p>', 'small')
        ]), { d: { gap: '28px', 'align-items': 'flex-start' } })
      ]),
      T_SEC({ 'background-color': cvar('ink') }, [
        cols(1, [[
          T_H('Tell us about the project', 'title', { d: { color: cvar('bg'), 'text-align': 'center', 'margin-bottom': '20px' } }),
          T_B('Get in touch', { 'align-self': 'center' })
        ]])
      ])
    ]
  },
  {
    id: 'work', name: 'Work', desc: 'A grid of projects with room for captions.', category: 'Portfolio', keywords: ['projects', 'gallery', 'portfolio'],
    build: () => {
      const card = (i: number) => [
        N('image', { src: '', alt: '' }, { d: { 'border-radius': '14px', height: '220px', 'object-fit': 'cover', 'margin-bottom': '14px' }, m: { height: '180px' } }),
        T_H('Project ' + i, 'subtitle', { d: { 'margin-bottom': '6px' } }, 'h2'),
        T_T('<p>Client · what you did · the year</p>', 'small')
      ];
      return [
        T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px', 'padding-bottom': '48px' }, [
          cols(1, [[
            T_H('Selected work', 'display', { d: { 'margin-bottom': '14px' } }),
            T_T('<p>A line on the kind of work you take, and what you leave out.</p>', 'lead', { d: { 'max-width': '48ch' } })
          ]])
        ]),
        T_SEC({ 'background-color': cvar('bg'), 'padding-top': '0px' }, [
          cols(3, [1, 2, 3].map(card), { d: { gap: '28px', 'margin-bottom': '28px' } }),
          cols(3, [4, 5, 6].map(card), { d: { gap: '28px' } })
        ])
      ];
    }
  },
  {
    id: 'case', name: 'Case study', desc: 'One project: the brief, the work, the result.', category: 'Portfolio', keywords: ['project', 'results', 'client'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px', 'padding-bottom': '40px' }, [
        cols(1, [[
          T_H('Case study', 'eyebrow', { d: { 'margin-bottom': '14px' } }),
          T_H('What we made and why', 'display', { d: { 'margin-bottom': '18px', 'max-width': '26ch' } }),
          T_T('<p>One sentence on the outcome.</p>', 'lead', { d: { 'max-width': '52ch' } })
        ]])
      ]),
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '0px' }, [
        cols(1, [[N('image', { src: '', alt: '' }, { d: { 'border-radius': '16px', height: '420px', 'object-fit': 'cover' }, m: { height: '240px' } })]])
      ]),
      T_SEC({ 'background-color': cvar('bg') }, [
        cols(3, [['Client', 'Company name'], ['Scope', 'What you delivered'], ['Year', '2026']].map(([k, v]) => [
          T_H(k, 'eyebrow', { d: { 'margin-bottom': '6px' } }),
          T_T('<p>' + v + '</p>', 'small')
        ]), { d: { gap: '24px' } })
      ]),
      T_SEC({ 'background-color': cvar('surface') }, [
        cols(1, [[
          T_H('The brief', 'title', { d: { 'margin-bottom': '14px' } }),
          T_T('<p>What the client came with, in their own terms. Two or three sentences.</p>', 'body', { d: { 'margin-bottom': '32px' } }),
          T_H('What we did', 'title', { d: { 'margin-bottom': '14px' } }),
          T_T('<p>The decisions that mattered, and the ones you argued for.</p>', 'body')
        ]], { d: { 'max-width': '68ch' } })
      ]),
      T_SEC({ 'background-color': cvar('bg') }, [
        cols(3, [['3.2x', 'More enquiries'], ['-40%', 'Time to publish'], ['4 wks', 'Start to launch']].map(([n, l]) => [
          T_H(n, 'display', sized('44px', { 'margin-bottom': '6px' }, '34px'), 'div'),
          T_T('<p>' + l + '</p>', 'small')
        ]), { d: { gap: '24px' } })
      ]),
      T_SEC({ 'background-color': cvar('ink') }, [
        cols(1, [[
          T_H('Got something similar?', 'title', { d: { color: cvar('bg'), 'text-align': 'center', 'margin-bottom': '20px' } }),
          T_B('Start a project', { 'align-self': 'center' })
        ]])
      ])
    ]
  },
  {
    id: 'faq', name: 'FAQ', desc: 'Questions and answers, plus a way to ask more.', category: 'Company', keywords: ['questions', 'answers', 'support'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px', 'padding-bottom': '40px' }, [
        cols(1, [[
          T_H('Questions', 'display', { d: { 'margin-bottom': '14px' } }),
          T_T('<p>If it is not here, ask — the list gets better that way.</p>', 'lead')
        ]])
      ]),
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '0px' }, [
        cols(1, [[
          'What does this cost?', 'How long does it take?', 'What do you need from me?',
          'Who owns the work?', 'What if it is not right?'
        ].flatMap((q, i, all) => [
          T_H(q, 'subtitle', { d: { 'margin-bottom': '8px' } }, 'h2'),
          T_T('<p>Answer in two sentences.</p>', 'body',
            { d: divider(i === all.length - 1, '26px') })
        ])], { d: { 'max-width': '68ch' } })
      ]),
      T_SEC({ 'background-color': cvar('surface') }, [
        cols(2, [
          [T_H('Still stuck?', 'title', { d: { 'margin-bottom': '12px' } }),
          T_T('<p>Send it over and you will get a real answer.</p>', 'lead')],
          [N('form', {}, {})]
        ], { d: { gap: '56px', 'align-items': 'flex-start' } })
      ])
    ]
  },
  {
    id: 'blog', name: 'Blog index', desc: 'A list of posts with dates and summaries.', category: 'Content', keywords: ['posts', 'news', 'articles'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px', 'padding-bottom': '40px' }, [
        cols(1, [[
          T_H('Writing', 'display', { d: { 'margin-bottom': '14px' } }),
          T_T('<p>Notes on the work, roughly monthly.</p>', 'lead')
        ]])
      ]),
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '0px' }, [
        cols(1, [[1, 2, 3, 4].flatMap((i, k, all) => [
          T_H('Date · ' + (6 - i) + ' min read', 'eyebrow', { d: { 'margin-bottom': '8px' } }),
          T_H('The title of post ' + i, 'subtitle', { d: { 'margin-bottom': '8px' } }, 'h2'),
          T_T('<p>Two lines of summary — enough to decide whether to click.</p>', 'body',
            { d: divider(k === all.length - 1, '28px') })
        ])], { d: { 'max-width': '68ch' } })
      ])
    ]
  },
  {
    id: 'article', name: 'Article', desc: 'A single post at a readable measure.', category: 'Content', keywords: ['post', 'story', 'editorial'],
    build: () => [
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px', 'padding-bottom': '32px' }, [
        cols(1, [[
          T_H('Date · 6 min read', 'eyebrow', { d: { 'margin-bottom': '14px' } }),
          T_H('The title of the piece', 'display', { d: { 'margin-bottom': '16px', 'max-width': '28ch' } }),
          T_T('<p>A standfirst — the sentence someone would quote.</p>', 'lead', { d: { 'max-width': '54ch' } })
        ]], { d: { 'max-width': '68ch' } })
      ]),
      T_SEC({ 'background-color': cvar('bg'), 'padding-top': '0px' }, [
        cols(1, [[
          N('image', { src: '', alt: '' }, { d: { 'border-radius': '14px', height: '340px', 'object-fit': 'cover', 'margin-bottom': '32px' }, m: { height: '200px' } }),
          T_T('<p>Open with the thing that made you write this.</p>', 'body', { d: { 'margin-bottom': '20px' } }),
          T_T('<p>A second paragraph that earns the first.</p>', 'body', { d: { 'margin-bottom': '32px' } }),
          T_H('A subheading', 'title', { d: { 'margin-bottom': '14px' } }),
          T_T('<p>Break the piece where the argument turns.</p>', 'body', { d: { 'margin-bottom': '20px' } }),
          T_T('<p>Close on what you would do differently.</p>', 'body')
        ]], { d: { 'max-width': '68ch' } })
      ])
    ]
  },
  {
    id: 'soon', name: 'Coming soon', desc: 'A centred hero with a signup form.', category: 'Marketing', keywords: ['launch', 'signup', 'waitlist'],
    build: () => [
      T_SEC({ 'background-color': cvar('ink'), 'padding-top': '132px', 'padding-bottom': '132px' }, [
        cols(1, [[
          T_H('Launching soon', 'eyebrow', { d: { color: cvar('muted-i'), 'text-align': 'center', 'margin-bottom': '16px' } }),
          T_H('Something is coming', 'display', { d: { color: cvar('bg'), 'text-align': 'center', 'margin-bottom': '16px', 'max-width': '22ch', 'align-self': 'center' } }),
          T_T('<p>One sentence on what it is and why it is worth the wait.</p>', 'lead', { d: { color: cvar('muted-i'), 'text-align': 'center', 'max-width': '46ch', 'align-self': 'center' } })
        ]], { d: { 'margin-bottom': '28px' } }),
        /* A form keeps its light-section defaults wherever it lands, so on ink it
           has to be told its own colours or the labels go unreadable. */
        cols(1, [[N('form', {}, {
          d: {
            '--f-label': cvar('bg'), '--f-bg': cvar('bg'), '--f-text': cvar('ink'),
            '--f-border': cvar('slate'), '--f-btn-bg': cvar('brand'), '--f-btn-fg': cvar('ink')
          }
        })]], { d: { 'max-width': '440px', 'align-self': 'center' } })
      ])
    ]
  }
];
function pageFromTemplate(tid: string, name?: string): any {
  const t = TEMPLATES.find(x => x.id === tid) || TEMPLATES[0];
  const n = String(name || t.name).slice(0, 60);
  const base = slugify(n);
  let slug = base, k = 2;
  while (state.pages.some(p => p.slug === slug)) slug = base + '-' + k++;
  return { id: uid(), name: n, slug, title: '', desc: '', ogImage: '', tree: t.build() };
}

/* Somewhere to start that is not somebody else's website.
   The only way out of the demo used to be "Reset to demo content", which is the
   opposite of what a new user wants: to build their own site they had to delete two
   pages and then empty a six-node header and a fifteen-node footer by hand. That is
   the first thing anyone does with this tool and it was the roughest path in it.

   The counterpart to seed(), and the line it draws is content out, libraries in.
   Colours, text styles, classes, saved blocks and component definitions are things you
   built rather than content, and clearing them would be destroying work to save a click.
   Components land on the library side for the same reason blocks do, and the consequence is
   worth knowing: the pages go, so every definition is left with no instances. That is the
   same state as a block nobody has placed, and the Components tab says "0 instances" rather
   than pretending otherwise.

   A collection splits across that line, which seed() does not have to face: the
   *schema* is a library — 'Projects has a title, a summary, a cover and a year' is a
   content type you would reuse — while the *items* are content as much as any page
   is. Keeping both left the demo's Acme rebrand sitting inside a site the user had
   just asked to be empty. So the schemas stay and the items go.

   It runs inside edit(), so Cmd-Z brings the whole previous project back. */
function blankProject(name: string) {
  state.meta.name = String(name || '').trim().slice(0, 60) || 'Untitled site';
  /* the global regions still exist, they are simply empty — structure, not content:
     an empty one renders as nothing while staying there to be filled */
  state.header = [];
  state.footer = [];
  state.pages = [{ id: uid(), name: 'Home', slug: 'index', title: '', desc: '', ogImage: '', tree: [] }];
  collections().forEach(c => { c.items = []; });
  state.cur = 0;
  return state.pages[0];
}

/* ---- starter project ------------------------------------------------- */
/* The Pagecraft demo site. Every colour is a token reference and every text
   element uses a text style, so the whole thing re-skins from Project. Copy
   follows the brand voice: active verbs, clarity over hype, makers as peers. */
function seed() {
  state.meta.name = 'Pagecraft';
  state.meta.tokens = defaultTokens();
  state.meta.font = stackFor('Manrope', 's');
  state.meta.headFont = stackFor('Manrope', 's');
  state.meta.headHtml = '';        // the font stylesheet is written automatically

  const C = cvar;
  const H = (text: string, ts: string, css?: any) => N('heading', {
    text, ts,
    level: ts === 'display' ? 'h1' : ts === 'title' ? 'h2' : ts === 'eyebrow' ? 'div' : 'h3'
  }, css);
  const T = (html: string, ts: string, css?: any) => N('text', { html, ts }, css);
  const B = (text: string, o: any = {}, css: any = {}) => N('button', { text, ts: 'btn', ...o }, css);
  const cell = (w: number) => N('column', {}, { d: { 'flex-grow': String(w), 'flex-basis': 'auto' }, m: { 'flex-basis': 'auto' } });

  state.header = [
    N('section', { tag: 'header' }, {
      d: {
        ...BOX('18px', '28px', '18px', '28px'), 'background-color': C('bg'),
        'border-bottom-width': '1px', 'border-bottom-style': 'solid', 'border-bottom-color': C('line'),
        position: 'sticky', top: '0px', 'z-index': '50'
      }, m: { ...BOX('14px', '20px', '14px', '20px') }
    }, [
      cols(2, [
        [N('heading', { text: 'Pagecraft', level: 'div', ts: '' }, { d: { 'font-size': '19px', 'font-weight': '600', 'letter-spacing': '-.03em', color: C('ink') } })],
        [N('nav', {
          items: [{ label: 'Craft', href: 'index.html#craft' }, { label: 'Pricing', href: 'pricing.html' }, { label: 'Contact', href: 'index.html#contact' }]
        }, { d: { 'font-size': '14px', color: C('muted'), '--nav-hover': C('ink'), '--nav-gap': '30px', '--nav-panel': C('surface') } })]
      ], { d: { 'align-items': 'center', gap: '16px', 'flex-wrap': 'nowrap' } })
    ])
  ];

  state.footer = [
    N('section', { tag: 'footer' }, { d: { ...BOX('64px', '28px', '40px', '28px'), 'background-color': C('ink') }, m: { ...BOX('48px', '20px', '32px', '20px') } }, [
      cols(3, [
        [N('heading', { text: 'Pagecraft', level: 'div', ts: '' }, { d: { 'font-size': '18px', 'font-weight': '600', 'letter-spacing': '-.03em', color: C('bg'), 'margin-bottom': '10px' } }),
        T('<p>Shape the web. Build visually, publish professionally.</p>', 'small', { d: { color: C('muted-i') } })],
        [H('Sitemap', 'eyebrow', { d: { color: C('muted-i'), 'margin-bottom': '12px' } }),
        T('<p><a href="index.html">Home</a><br><a href="pricing.html">Pricing</a><br><a href="index.html#contact">Contact</a></p>', 'small', { d: { color: cvar('muted-i'), 'line-height': '2', '--link': C('bg') } })],
        [H('Elsewhere', 'eyebrow', { d: { color: C('muted-i'), 'margin-bottom': '12px' } }),
        T('<p><a href="https://dribbble.com">Dribbble</a><br><a href="https://github.com">GitHub</a><br><a href="index.html#craft">Read the docs</a></p>', 'small', { d: { color: cvar('muted-i'), 'line-height': '2', '--link': C('bg') } })]
      ], { d: { gap: '48px' } }),
      N('divider', {}, { d: { 'border-top-color': '#2b2f2b', 'margin-top': '44px', 'margin-bottom': '22px' } }),
      cols(1, [[T('<p>&copy; 2026 Pagecraft</p>', 'small', { d: { color: C('muted-i'), 'text-align': 'center' } })]])
    ])
  ];

  const hero = N('section', {}, {
    d: { ...BOX('108px', '28px', '104px', '28px'), 'background-color': C('bg') },
    m: { ...BOX('64px', '20px', '56px', '20px') }
  }, [
    N('row', {}, { d: { gap: '64px', 'align-items': 'center', 'flex-wrap': 'wrap' } }, [
      N('column', {}, { d: { 'flex-grow': '58' }, m: { 'flex-basis': '100%' } }, [
        H('Our craft', 'eyebrow', { d: { 'margin-bottom': '20px' } }),
        H('Shape the web.', 'display', { d: { 'margin-bottom': '22px' } }),
        T('<p>Build visually. Publish professionally. A canvas with the immediacy of real craft and the control of real code.</p>', 'lead', { d: { 'margin-bottom': '32px', 'max-width': '30ch' } }),
        N('row', {}, { d: { gap: '10px', 'flex-wrap': 'wrap' } }, [
          cell(0), cell(0)
        ])
      ]),
      N('column', {}, { d: { 'flex-grow': '42' }, m: { 'flex-basis': '100%' } }, [
        N('image', { src: '', alt: 'A page under construction on the Pagecraft canvas' },
          { d: { 'border-radius': '16px', height: '440px' }, m: { height: '240px' } })
      ])
    ])
  ]);
  /* the two hero actions — green carries the committed one, only that one */
  const heroBtns = hero.children[0].children[0].children[3];
  heroBtns.children[0].children.push(B('Start building', { icon: 'arrow', link: '#craft' },
    { d: { 'background-color': C('brand'), color: C('ink') } }));
  heroBtns.children[1].children.push(B('See an export', { link: '#craft' },
    { d: { 'background-color': 'transparent', color: C('ink'), 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line') } }));

  /* the three feature cards are identical furniture — a class, not three copies */
  const cardCls = classAdd('Card', {
    d: {
      ...BOX('28px', '28px', '28px', '28px'), 'background-color': C('bg'),
      'border-radius': '16px', 'border-width': '1px', 'border-style': 'solid', 'border-color': C('line')
    },
    m: { ...BOX('22px', '22px', '22px', '22px') }
  });
  const card = (t: string, body: string) => [H(t, 'subtitle', { d: { 'margin-bottom': '10px' } }), T('<p>' + body + '</p>', 'small')];
  const craft = N('section', {}, {
    d: { ...BOX('96px', '28px', '96px', '28px'), 'background-color': C('surface') },
    m: { ...BOX('56px', '20px', '56px', '20px') }
  }, [
    cols(1, [[
      H('Built with intention', 'eyebrow', { d: { 'margin-bottom': '18px' } }),
      H('Digital precision, human judgment.', 'title', { d: { 'margin-bottom': '14px', 'max-width': '22ch' } }),
      T('<p>Strong grids, deliberate space, and details that stay functional.</p>', 'lead')
    ]], { d: { 'margin-bottom': '56px' } }),
    cols(3, [
      card('Design tokens', 'Name a colour, a text style or a class once. Change it in one place and the whole site follows.'),
      card('Global regions', 'Header and footer are global by default. Page documents edit Main and never touch them by accident.'),
      card('Real HTML out', 'One semantic file per page and a single stylesheet. Nothing to install, nothing to run.')
    ], { d: { gap: '24px' } })
  ]);

  const media = N('section', {}, { d: { ...BOX('0px', '28px', '96px', '28px'), 'background-color': C('surface') } }, [
    cols(1, [[N('video', {}, { d: { 'border-radius': '16px' } })]])
  ]);

  const cta = N('section', {}, {
    d: { ...BOX('96px', '28px', '96px', '28px'), 'background-color': C('ink') },
    m: { ...BOX('64px', '20px', '64px', '20px') }
  }, [
    cols(1, [[
      H('A better canvas for the web.', 'title', { d: { color: C('bg'), 'text-align': 'center', 'margin-bottom': '28px' } }),
      B('Open the canvas', { icon: 'arrow', link: '#craft' }, { d: { 'background-color': C('brand'), color: C('ink'), 'align-self': 'center' } })
    ]])
  ]);

  /* apply it to the three card columns */
  craft.children[1].children.forEach(col => classApply(col, cardCls));

  craft.adv.htmlId = 'craft';                 // targets for the nav and footer links
  cta.adv.htmlId = 'contact';

  state.pages = [
    {
      id: uid(), name: 'Home', slug: 'index', title: 'Pagecraft — shape the web',
      desc: 'Build visually. Publish professionally. A visual website builder that exports real HTML.',
      tree: [hero, craft, media, cta]
    },
    {
      id: uid(), name: 'Pricing', slug: 'pricing', title: 'Pricing — Pagecraft',
      desc: 'Straightforward pricing for independent makers and studios.', tree: [
        N('section', {}, { d: { ...BOX('96px', '28px', '96px', '28px'), 'background-color': C('bg') } }, [
          cols(1, [[
            H('Pricing', 'display', { d: { 'text-align': 'center', 'margin-bottom': '16px' } }),
            T('<p>This page shares the same global header, footer and design tokens. Edit them once and every page follows.</p>', 'lead', { d: { 'text-align': 'center' } })
          ]])
        ])
      ]
    }
  ];
  state.cur = 0;
}



/* ============================================================= renderer */
const PH = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500"><rect width="800" height="500" fill="#f1eee3"/><g fill="none" stroke="#c2beb0" stroke-width="10"><circle cx="300" cy="180" r="42"/><path d="M120 380l150-130 120 104 100-86 190 162z" stroke-linejoin="round"/></g></svg>`);

const MQ = { t: '@media (max-width:1024px)', m: '@media (max-width:767px)' };

function decl(map: Decls) {
  let out = '';
  for (const k in map) {
    const v = map[k];
    if (v === '' || v == null) continue;
    out += `${k}:${v};`;
  }
  return out;
}
/* Everything Pagecraft emits is namespaced. The per-element class is what the
   generated stylesheet targets; the id is for anchors and can be overridden. */
const PFX = 'pagecraft-';
const widgetSlug = (type: string) => slugify((DEF[type] && DEF[type].label) || type);
const nodeClass = (n: PcNode) => PFX + String(n.id).replace(/^n/, '');
const autoId = (n: PcNode) => `${PFX}${widgetSlug(n.type)}-${String(n.id).replace(/^n/, '')}`;
const domIdOf = (n: PcNode) => (n.adv && n.adv.htmlId) ? n.adv.htmlId : autoId(n);
const selOf = (n: PcNode) => '.' + nodeClass(n);

/* per-node CSS for one breakpoint bucket */
function bucket(n: PcNode, b: Bp, editing: boolean, parent: PcNode | null = null,
  detachedComponentRoot = false) {
  const map = { ...(n.css[b] || {}) };
  if (n.type === 'column') {
    /* The marker is editor state, not page CSS. Resolve it at every breakpoint so a
       tablet row override reaches following columns even when the columns themselves
       have no tablet declaration. A component instance has intentionally empty styling;
       when its definition root is a Column, its Follow marker still has to resolve against
       the instance's real Row rather than the detached definition's null parent. */
    const own = cssAt(n, b, COLUMN_V_ALIGN);
    const def = n.use ? findComponent(n.use) : null;
    const inherited = def && def.node.type === 'column'
      ? cssAt(def.node, b, COLUMN_V_ALIGN) : '';
    const mode = own || inherited || 'follow';
    delete map[COLUMN_V_ALIGN];
    /* A detached definition root has no row. Its instance rule below owns this one
       relationship, which both avoids a false Top declaration and preserves the one-rule-in,
       one-rule-out promise of turning an ordinary column into a component. */
    const definitionOwnsExplicit = !!n.use && !own && !!inherited && inherited !== 'follow';
    if (!(detachedComponentRoot && mode === 'follow') && !definitionOwnsExplicit) {
      map['justify-content'] = mode === 'follow' ? rowVerticalValue(parent, b) : mode;
    }
  }
  let extra = '';
  if (n.hide && n.hide[b]) extra = editing ? 'opacity:.32;outline:1px dashed #f0a132;outline-offset:2px;' : 'display:none !important;';
  const body = decl(map) + extra;
  const rules: string[] = [];
  if (body) rules.push(`${selOf(n)}{${body}}`);
  /* after the base rule, and `:hover` outranks the bare class anyway, so a state wins on
     specificity as well as on order */
  STATES.forEach(([k, , sel]) => {
    const d = decl((n.st && n.st[k] && n.st[k]![b]) || {});
    if (d) rules.push(`${selOf(n)}${sel}{${d}}`);
  });
  if (n.type === 'text' && map['--link']) rules.push(`${selOf(n)} a{color:${map['--link']}}`);
  return rules.join('');
}

/* a burger menu is just "the inline list stops being inline below X" */
const navCollapse = (n: PcNode) => `${selOf(n)} .pagecraft-nav-toggle{display:flex}`
  + `${selOf(n)} .pagecraft-nav-list{display:none;position:absolute;top:calc(100% + 10px);right:0;z-index:60;`
  + `flex-direction:column;align-items:stretch;gap:2px;min-width:210px;padding:10px;`
  + `background:var(--nav-panel,#fff);border-radius:12px;box-shadow:0 20px 44px -14px rgba(15,23,42,.32)}`
  + `${selOf(n)}.is-open .pagecraft-nav-list{display:flex}`
  + `${selOf(n)} .pagecraft-nav-list a{padding:10px 12px;border-radius:7px}`
  + `${selOf(n)} .pagecraft-nav-list .sub-menu{display:flex;position:static;flex-direction:column;min-width:0;padding:0 0 0 16px;box-shadow:none;background:transparent}`;

function nodeCss(n: PcNode, editing: boolean, acc: { d: string; t: string; m: string },
  parent: PcNode | null = null, detachedComponentRoot = false) {
  acc.d += bucket(n, 'd', editing, parent, detachedComponentRoot);
  if (n.type === 'nav') {
    const c = n.props.collapse;
    if (c === 'tablet') acc.t += navCollapse(n);      // ≤1024 already covers mobile
    else if (c !== 'never') acc.m += navCollapse(n);
  }
  acc.t += bucket(n, 't', editing, parent, detachedComponentRoot);
  acc.m += bucket(n, 'm', editing, parent, detachedComponentRoot);
  if (n.adv && n.adv.css) acc.d += n.adv.css.replace(/&/g, selOf(n));
  (n.children || []).forEach(c => nodeCss(c, editing, acc, n));
  return acc;
}
/* Which definitions these trees actually render, following instances inside definitions. A
   page ships the rules for the components it uses and not for the ones it does not — the same
   reason a page's stylesheet is built from the page rather than from the project. */
function usedComponents(lists: PcNode[][]): ComponentDef[] {
  const seen = new Set<string>();
  const out: ComponentDef[] = [];
  const visit = (list: PcNode[]) => eachNode(list, n => {
    if (!n.use || seen.has(n.use)) return;
    const cd = findComponent(n.use);
    if (!cd) return;
    seen.add(n.use);
    out.push(cd);
    visit([cd.node]);                              // a component may place another
  });
  lists.forEach(visit);
  return out;
}
/* Element rules for a set of trees, without the project-wide foundation. Keeping this
   boundary explicit lets the WordPress package put the stable foundation/global regions in
   one content-addressed file and the current page in another without parsing generated CSS. */
function treeRuleCss(lists: PcNode[][], editing: boolean) {
  const acc = { d: '', t: '', m: '' };
  /* Definitions first, and only once each however many instances there are: an instance reads
     its definition rather than copying it, so one set of rules dresses all of them. First
     because an instance's own rules have to win, and two single-class selectors are decided by
     document order. */
  usedComponents(lists).forEach(cd => nodeCss(cd.node, editing, acc, null, true));
  lists.forEach(l => l.forEach(n => nodeCss(n, editing, acc)));
  return acc.d
    + (acc.t ? `${MQ.t}{${acc.t}}` : '')
    + (acc.m ? `${MQ.m}{${acc.m}}` : '');
}

function foundationCss(editing: boolean) {
  const tk = tokenCss();
  return baseCss(editing) + tk.d
    + (tk.t ? `${MQ.t}{${tk.t}}` : '')
    + (tk.m ? `${MQ.m}{${tk.m}}` : '');
}

/* one stylesheet for a set of trees: base + all desktop rules + two media blocks */
function treeCss(lists: PcNode[][], editing: boolean) {
  const acc = { d: '', t: '', m: '' };
  usedComponents(lists).forEach(cd => nodeCss(cd.node, editing, acc, null, true));
  lists.forEach(l => l.forEach(n => nodeCss(n, editing, acc)));
  const tk = tokenCss();
  return baseCss(editing) + tk.d + acc.d
    + (tk.t || acc.t ? `${MQ.t}{${tk.t}${acc.t}}` : '')
    + (tk.m || acc.m ? `${MQ.m}{${tk.m}${acc.m}}` : '');
}

/** WordPress stores project/global and page rules independently. The shared file always owns
    the foundation and design tokens, even when the project has no visible header or footer. */
function wordpressStyles(pg: Page) {
  const globalTrees = [state.header, state.footer];
  const globalMoves = animUsed(globalTrees);
  const pageMoves = animUsed([pg.tree]);
  return {
    global: tidy(foundationCss(false) + treeRuleCss(globalTrees, false)
      + (globalMoves ? `\n${ANIM_CSS}\n${ANIM_CALM}` : '')),
    page: tidy(treeRuleCss([pg.tree], false)
      + (pageMoves && !globalMoves ? `\n${ANIM_CSS}\n${ANIM_CALM}` : ''))
  };
}

/* The first half of this ships to every exported page, so it carries no comments
   — the reasoning for each block lives in NOTES.md under “The export stylesheet”.
   Four things worth knowing before editing it:
     · `.pagecraft-icon-glyph` must come after `.pagecraft-icon`, because an
       unlinked icon is the svg itself and wears both classes.
     · every marker variant restates each property it touches; a variant that
       inherits half a rule is how the 1.19:1 hover bug got in.
     · the focus ring is the only thing giving links, buttons and summaries a
       visible focus state — before it, only the video facade and the form fields
       had one. It is `currentColor`, not the brand: the default brand green is
       1.6:1 on Paper, so a green ring round a green button was invisible in
       exactly the case it mattered. Text colour is already chosen to contrast
       with its own ground, so the ring inherits that guarantee — and using
       `outline` alone leaves any author box-shadow intact.
     · the reduced-motion query closes the sheet, after `meta.css`, so a visitor's
       system preference outranks the project's own rules. */
function baseCss(editing: boolean) {
  const m = state.meta;
  return `
${tokenVars()}
:root{--maxw:${m.maxWidth};--accent:var(--c-brand)}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;font-family:${m.font};font-size:${m.size};line-height:1.6;color:var(--c-text);background:var(--c-bg);-webkit-font-smoothing:antialiased}
img,video,svg{max-width:100%}
.pagecraft-skip{
  position:fixed;left:12px;top:12px;z-index:2147483647;padding:10px 14px;
  color:var(--c-bg);background:var(--c-ink);border-radius:6px;text-decoration:none;
  transform:translateY(calc(-100% - 24px));transition:transform .15s ease;
}
.pagecraft-skip:focus{transform:translateY(0)}
.pagecraft-section{position:relative;width:100%}
.pagecraft-container{width:100%;max-width:var(--maxw);margin-left:auto;margin-right:auto;position:relative}
.pagecraft-container.full{max-width:none}
.pagecraft-row,.pagecraft-list{display:flex;flex-wrap:wrap;width:100%}
.pagecraft-column{display:flex;flex-direction:column;min-width:0;flex-shrink:1;flex-basis:0%}
.pagecraft-box{display:block;width:100%;min-width:0;position:relative}
.pagecraft-box.l-flex{display:flex;flex-wrap:wrap}
.pagecraft-box.l-grid{display:grid}
.pagecraft-box>*{min-width:0}
a.pagecraft-box{color:inherit;text-decoration:none}
.pagecraft-heading{margin:0;font-family:${m.headFont || 'inherit'}}
.pagecraft-heading a{color:inherit;text-decoration:none}
.pagecraft-wysiwyg>:first-child{margin-top:0}
.pagecraft-wysiwyg>:last-child{margin-bottom:0}
.pagecraft-wysiwyg a{text-decoration:underline;text-underline-offset:2px}
.pagecraft-wysiwyg ul,.pagecraft-wysiwyg ol{padding-left:1.3em;margin:.7em 0}
.pagecraft-wysiwyg h1,.pagecraft-wysiwyg h2,.pagecraft-wysiwyg h3,.pagecraft-wysiwyg h4{margin:.3em 0 .5em;line-height:1.25;font-family:${m.headFont || 'inherit'}}
.pagecraft-wysiwyg blockquote{margin:1em 0;padding-left:1em;border-left:3px solid currentColor;opacity:.85}
.pagecraft-button{display:inline-flex;align-items:center;justify-content:center;gap:.5em;text-decoration:none;border:0 solid transparent;cursor:pointer;line-height:1.2;transition:background-color .18s ease,color .18s ease,border-color .18s ease,transform .18s ease;max-width:100%}
.pagecraft-button svg{width:1em;height:1em;flex:0 0 auto}
.pagecraft-figure{margin:0;display:flex;flex-direction:column}
.pagecraft-image{display:block;width:100%;height:auto}
.pagecraft-caption{font-size:.82em;opacity:.7;margin-top:.55em}
.pagecraft-slider-box{position:relative;width:100%}
.pagecraft-slider{
  display:flex;gap:var(--sl-gap,24px);width:100%;
  overflow-x:auto;overscroll-behavior-x:contain;
  scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;
  scrollbar-width:none;padding-bottom:0;
}
.pagecraft-slider::-webkit-scrollbar{display:none;width:0;height:0}
.pagecraft-slider>[class]{flex:0 0 var(--sl-w,100%);scroll-snap-align:start;min-width:0}
.pagecraft-slider>*{scroll-snap-align:start;min-width:0}
.pagecraft-slider:focus-visible{outline:3px solid currentColor;outline-offset:3px}
.pagecraft-slide-btn{
  position:absolute;top:50%;translate:0 -50%;z-index:2;
  width:36px;height:36px;display:grid;place-items:center;cursor:pointer;
  border:1px solid var(--c-line,#e5e1d6);border-radius:99px;
  background:var(--c-bg,#fff);color:inherit;
}
.pagecraft-slide-btn.p{left:-8px;rotate:90deg}
.pagecraft-slide-btn.n{right:-8px;rotate:-90deg}
.pagecraft-slide-btn[hidden]{display:none}
.pagecraft-slide-btn:disabled{opacity:.35;cursor:default}
.pagecraft-slider-dots{display:flex;align-items:center;justify-content:center;gap:0;margin-top:16px}
.pagecraft-slider-dots[hidden]{display:none}
.pagecraft-slider-dot{appearance:none;width:36px;height:36px;padding:0;display:grid;place-items:center;border:0;border-radius:99px;background:transparent;color:var(--c-text,#111311);cursor:pointer}
.pagecraft-slider-dot::before{content:"";width:8px;height:8px;border-radius:50%;background:currentColor;opacity:.3;transition:transform .2s ease,opacity .2s ease,background-color .2s ease}
.pagecraft-slider-dot:hover::before{opacity:.68}
.pagecraft-slider-dot[aria-current=true]::before{background:var(--c-brand,#111311);opacity:1;transform:scale(1.25)}
.pagecraft-slider-dot:focus-visible{outline:2px solid var(--c-brand,#111311);outline-offset:0}
@media(max-width:767px){.pagecraft-slider-dots{margin-top:10px}.pagecraft-slider-dot{width:44px;height:44px}}
.pagecraft-crumbs ol{
  display:flex;flex-wrap:wrap;align-items:center;gap:var(--cb-gap,8px);
  list-style:none;margin:0;padding:0;
  font-size:var(--cb-size,13px);font-weight:var(--cb-weight,500);
}
.pagecraft-crumbs li{display:flex;align-items:center;gap:var(--cb-gap,8px)}
.pagecraft-crumbs a{color:var(--cb-color,#5f6660);text-decoration:none}
.pagecraft-crumbs a:hover{text-decoration:underline}
.pagecraft-crumbs [aria-current]{color:var(--cb-current,#111311)}
.pagecraft-crumbs li+li::before{content:"›";color:var(--cb-color,#5f6660);opacity:.6}
.pagecraft-crumbs[data-sep=slash] li+li::before{content:"/"}
.pagecraft-crumbs[data-sep=dot] li+li::before{content:"·"}
.pagecraft-crumbs[data-sep=dash] li+li::before{content:"—"}
.pagecraft-code{
  width:100%;margin:0;background:var(--cd-bg,#f4f2ea);color:var(--cd-text,#111311);
  border-radius:var(--cd-radius,10px);overflow:hidden;
}
.pagecraft-code-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:.55em var(--cd-pad-x,18px);border-bottom:1px solid var(--cd-line,#e5e1d6);
  font-family:var(--cd-ui,system-ui,sans-serif);font-size:.8em;opacity:.75;
}
.pagecraft-code-copy{
  font:inherit;cursor:pointer;background:none;border:1px solid var(--cd-line,#e5e1d6);
  border-radius:5px;padding:.2em .6em;color:inherit;
}
.pagecraft-code-copy:hover{background:#1113110d}
.pagecraft-code-copy[hidden]{display:none}
.pagecraft-code pre{
  margin:0;padding:var(--cd-pad,16px 18px);overflow-x:auto;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
  font-size:var(--cd-size,14px);line-height:1.55;tab-size:2;
}
.pagecraft-code[data-wrap] pre{white-space:pre-wrap;overflow-wrap:anywhere;overflow-x:visible}
.pagecraft-code[data-numbers] pre{counter-reset:pcline}
.pagecraft-code-line{display:block;counter-increment:pcline}
.pagecraft-code-line::before{
  content:counter(pcline);display:inline-block;width:2.2em;margin-right:1.1em;
  text-align:right;opacity:.4;user-select:none;
}
.pc-c-com{color:var(--cd-com,#5f6660);font-style:italic}
.pc-c-str{color:var(--cd-str,#2f6f5e)}
.pc-c-kw{color:var(--cd-kw,#8a4b2a)}
.pc-c-num{color:var(--cd-num,#3a5a9a)}
.pc-c-key,.pc-c-fn{color:var(--cd-key,#5b4a8a)}
.pagecraft-table-wrap{width:100%;overflow-x:auto}
.pagecraft-table{
  width:100%;border-collapse:collapse;font-size:var(--tbl-size,15px);
  color:var(--tbl-text,#111311);text-align:left;
}
.pagecraft-table caption{
  caption-side:bottom;padding-top:.7em;text-align:left;
  font-size:var(--tbl-caption-size,13px);color:var(--tbl-caption-color,#5f6660);
}
.pagecraft-table th,.pagecraft-table td{padding:var(--tbl-pad,10px 12px);vertical-align:top}
.pagecraft-table thead th{
  background:var(--tbl-head-bg,transparent);color:var(--tbl-head-text,#111311);
  font-weight:var(--tbl-head-weight,600);border-bottom:2px solid var(--tbl-line,#e5e1d6);
}
.pagecraft-table tbody th{font-weight:var(--tbl-head-weight,600);color:var(--tbl-head-text,#111311)}
.pagecraft-table[data-rules=rows] tbody tr+tr>*{border-top:1px solid var(--tbl-line,#e5e1d6)}
.pagecraft-table[data-rules=all] th,.pagecraft-table[data-rules=all] td{border:1px solid var(--tbl-line,#e5e1d6)}
.pagecraft-table[data-zebra] tbody tr:nth-child(even)>*{background:var(--tbl-zebra,#f8f6ef)}
.pagecraft-tabs{width:100%}
.pagecraft-tablist{display:flex;flex-wrap:wrap;gap:var(--tb-gap,22px);justify-content:var(--tb-align,flex-start);border-bottom:1px solid var(--tb-line,#e5e1d6)}
.pagecraft-tab{
  background:none;border:0;cursor:pointer;padding:var(--tb-pad,10px 2px);margin-bottom:-1px;
  font:inherit;font-size:var(--tb-size,15px);font-weight:var(--tb-weight,500);
  color:var(--tb-off,#5f6660);border-bottom:2px solid transparent;transition:color .16s,border-color .16s;
}
.pagecraft-tab.on{color:var(--tb-on,#111311);border-bottom-color:var(--tb-on,#111311)}
.pagecraft-tab:focus-visible{outline:3px solid currentColor;outline-offset:2px}
.pagecraft-tabpanel{padding-top:var(--tb-body-pad,20px);font-size:var(--tb-body-size,16px);color:var(--tb-body-color,#111311)}
.pagecraft-tabpanel>:first-child{margin-top:0}
.pagecraft-tabpanel>:last-child{margin-bottom:0}
.pagecraft-tabs[data-tabs-ready] [data-tab-idle]{display:none}
.pagecraft-pager{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;width:100%;margin-top:2.2em}
.pagecraft-page{
  display:inline-flex;align-items:center;justify-content:center;min-width:2.4em;padding:.5em .7em;
  border:1px solid var(--c-line);border-radius:6px;text-decoration:none;color:inherit;font-size:.9em;line-height:1;
}
.pagecraft-page.on{background:var(--c-ink);color:var(--c-bg);border-color:var(--c-ink)}
.pagecraft-page.off{opacity:.35}
.pagecraft-page:focus-visible{outline:3px solid var(--c-brand);outline-offset:2px}
.pagecraft-quote{margin:0;display:flex;flex-direction:column;border-left:0 solid transparent}
.pagecraft-quote blockquote{margin:0}
.pagecraft-quote p{margin:0}
.pagecraft-quote p+p{margin-top:.6em}
.pagecraft-quote p:first-of-type::before{content:"\\201C"}
.pagecraft-quote p:last-of-type::after{content:"\\201D"}
.pagecraft-attrib{font-size:.875rem;line-height:1.5;opacity:.72;margin-top:1em}
.pagecraft-attrib a{color:inherit}
.pagecraft-video{position:relative;width:100%;overflow:hidden}
.pagecraft-video-play{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;cursor:pointer;background:var(--c-ink);display:block}
.pagecraft-video-play img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.pagecraft-video-icon{
  position:absolute;left:50%;top:50%;width:66px;height:66px;margin:-33px 0 0 -33px;border-radius:50%;
  background:var(--c-brand);display:block;transition:transform .18s ease;
}
.pagecraft-video-play:focus-visible{outline:3px solid var(--c-brand);outline-offset:2px}
.pagecraft-video-icon::after{
  content:"";position:absolute;left:26px;top:21px;border-style:solid;
  border-width:12px 0 12px 19px;border-color:transparent transparent transparent var(--c-ink);
}
.pagecraft-video-play:hover .pagecraft-video-icon{transform:scale(1.08)}
.pagecraft-video>iframe,.pagecraft-video>video{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;object-fit:cover}
.pagecraft-nav-menu{display:flex;align-items:center;position:relative}
.pagecraft-nav-list{display:flex;align-items:center;gap:var(--nav-gap,26px);list-style:none;margin:0;padding:0}
.pagecraft-nav-list li{position:relative}
.pagecraft-nav-list .sub-menu{display:none;position:absolute;z-index:65;top:100%;left:0;min-width:190px;margin:0;padding:8px;list-style:none;background:var(--nav-panel,#fff);box-shadow:0 18px 38px -18px rgba(15,23,42,.36)}
.pagecraft-nav-list li:hover>.sub-menu,.pagecraft-nav-list li:focus-within>.sub-menu{display:block}
.pagecraft-nav-list .sub-menu .sub-menu{top:0;left:100%}
.pagecraft-nav-list a{display:block;text-decoration:none;color:inherit;transition:color .15s ease,background-color .15s ease}
.pagecraft-nav-list a:hover{color:var(--nav-hover,inherit)}
.pagecraft-nav-toggle{display:none;align-items:center;justify-content:center;width:40px;height:40px;margin:-8px -8px -8px 0;padding:0;border:0;background:none;color:inherit;cursor:pointer}
.pagecraft-nav-icon{position:relative;display:block;width:20px;height:2px;background:currentColor;border-radius:2px;transition:background-color .2s ease}
.pagecraft-nav-icon::before,.pagecraft-nav-icon::after{content:"";position:absolute;left:0;width:20px;height:2px;background:currentColor;border-radius:2px;transition:transform .2s ease}
.pagecraft-nav-icon::before{transform:translateY(-6px)}
.pagecraft-nav-icon::after{transform:translateY(6px)}
[data-nav].is-open .pagecraft-nav-icon{background-color:transparent}
[data-nav].is-open .pagecraft-nav-icon::before{transform:rotate(45deg)}
[data-nav].is-open .pagecraft-nav-icon::after{transform:rotate(-45deg)}
.pagecraft-form{display:flex;flex-wrap:wrap;gap:var(--f-gap,16px);width:100%}
.pagecraft-field{display:flex;flex-direction:column;gap:5px;flex:1 1 100%;min-width:0}
.pagecraft-field.half{flex:1 1 calc(50% - var(--f-gap,16px) / 2);min-width:12rem}
.pagecraft-field label{font-size:.82em;font-weight:500;color:var(--f-label,inherit)}
.pagecraft-field input,.pagecraft-field textarea,.pagecraft-field select{
  font:inherit;color:var(--f-text,inherit);background:var(--f-bg,#fff);
  border:1px solid var(--f-border,#ddd);border-radius:var(--f-radius,8px);
  padding:var(--f-pad,11px 13px);width:100%;
}
.pagecraft-field textarea{resize:vertical}
.pagecraft-field input:focus,.pagecraft-field textarea:focus,.pagecraft-field select:focus{outline:2px solid var(--f-btn-bg,#333);outline-offset:1px}
.pagecraft-field-check{flex-direction:row;align-items:center;gap:9px}
.pagecraft-field-check input{width:auto;padding:0}
.pagecraft-field-check label{font-size:1em}
.pagecraft-form-button{
  font:inherit;font-weight:600;cursor:pointer;border:0;align-self:flex-start;flex:0 0 auto;
  background:var(--f-btn-bg,#111);color:var(--f-btn-fg,#fff);
  border-radius:var(--f-radius,8px);padding:var(--f-pad,11px 13px);padding-left:26px;padding-right:26px;
}
.pagecraft-form-button:disabled{cursor:not-allowed;opacity:.55}
.pagecraft-form-status{flex:1 1 100%;margin:0;font-size:.82em;color:var(--f-label,inherit)}
.pagecraft-divider{width:100%;border:0 solid transparent;align-self:stretch}
.pagecraft-spacer{width:100%;flex:0 0 auto}

.pagecraft-accordion{display:flex;flex-direction:column;gap:var(--ac-gap,0px);width:100%}
.pagecraft-accordion-item{border-top:1px solid var(--ac-line,currentColor);border-radius:var(--ac-radius,0px)}
.pagecraft-accordion-item:last-child{border-bottom:1px solid var(--ac-line,currentColor)}
.pagecraft-accordion-q{
  display:flex;align-items:center;justify-content:space-between;gap:16px;cursor:pointer;
  padding:var(--ac-pad,18px) 0;list-style:none;
  font-size:var(--ac-q-size,17px);font-weight:var(--ac-q-weight,600);
  color:var(--ac-q-color,inherit);line-height:1.35;
}
.pagecraft-accordion-q::-webkit-details-marker{display:none}
.pagecraft-accordion-q::marker{content:""}
.pagecraft-accordion-a{
  font-size:var(--ac-a-size,16px);color:var(--ac-a-color,inherit);
  line-height:1.65;padding:0 0 var(--ac-pad,18px);max-width:72ch;
}
.pagecraft-accordion-a>:first-child{margin-top:0}
.pagecraft-accordion-a>:last-child{margin-bottom:0}
.pagecraft-accordion-a p{margin:0 0 .85em}
.pagecraft-accordion-mark{
  position:relative;flex:0 0 auto;width:16px;height:16px;
  color:var(--ac-mark,currentColor);transition:transform .2s ease;
}
.pagecraft-accordion-mark::before,.pagecraft-accordion-mark::after{
  content:"";position:absolute;left:50%;top:50%;background:currentColor;border-radius:1px;
}
.pagecraft-accordion-mark::before{width:15px;height:1.8px;margin:-.9px 0 0 -7.5px;transform:none}
.pagecraft-accordion-mark::after{width:1.8px;height:15px;margin:-7.5px 0 0 -.9px;transform:none;transition:transform .2s ease}
[data-marker=plus] [open]>.pagecraft-accordion-q .pagecraft-accordion-mark::after{transform:scaleY(0)}
[data-marker=caret] .pagecraft-accordion-mark::before{
  width:10.5px;height:1.8px;margin:-.9px 0 0 -8.9px;transform:rotate(45deg);transform-origin:right center;
}
[data-marker=caret] .pagecraft-accordion-mark::after{
  width:10.5px;height:1.8px;margin:-.9px 0 0 -1.6px;transform:rotate(-45deg);transform-origin:left center;
}
[data-marker=caret] [open]>.pagecraft-accordion-q .pagecraft-accordion-mark{transform:rotate(180deg)}

.pagecraft-embed{width:100%}
.pagecraft-embed>*{max-width:100%}
.pagecraft-embed-ratio{position:relative}
.pagecraft-embed-ratio>iframe,.pagecraft-embed-ratio>video,.pagecraft-embed-ratio>embed,.pagecraft-embed-ratio>object{
  position:absolute;inset:0;width:100%;height:100%;border:0;
}

.pagecraft-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;color:inherit;text-decoration:none}
.pagecraft-icon-glyph{
  display:block;flex:0 0 auto;box-sizing:content-box;
  width:var(--icon-size,30px);height:var(--icon-size,30px);stroke-width:var(--icon-stroke,1.75);
}

.pagecraft-gallery{display:grid;grid-template-columns:repeat(var(--g-cols,3),minmax(0,1fr));gap:var(--g-gap,12px);width:100%}
.pagecraft-gallery-item{margin:0;display:flex;flex-direction:column;min-width:0}
.pagecraft-gallery-frame{
  display:block;position:relative;overflow:hidden;
  border-radius:var(--g-radius,10px);background:rgba(17,19,17,.05);
}
.pagecraft-gallery-img{display:block;width:100%;height:auto}
.pagecraft-gallery-fixed .pagecraft-gallery-frame{aspect-ratio:var(--g-ratio,4 / 3)}
.pagecraft-gallery-fixed .pagecraft-gallery-img{height:100%;object-fit:var(--g-fit,cover)}
.pagecraft-gallery-caption{font-size:.82em;opacity:.7;margin-top:.5em}
.pagecraft-lightbox{
  padding:0;border:0;background:transparent;width:100%;height:100%;
  max-width:100vw;max-height:100vh;overflow:hidden;
}
.pagecraft-lightbox::backdrop{background:rgba(10,12,10,.93)}
.pagecraft-lightbox-fig{
  margin:0;width:100%;height:100%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;gap:16px;padding:clamp(16px,4vw,48px);
}
.pagecraft-lightbox-img{max-width:100%;max-height:100%;object-fit:contain;border-radius:6px}
.pagecraft-lightbox-cap{margin:0;color:#f2f2ee;font-size:14px;line-height:1.5;text-align:center;max-width:64ch}
.pagecraft-lightbox-btn{
  position:absolute;top:50%;transform:translateY(-50%);width:46px;height:46px;
  display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer;
  background:rgba(255,255,255,.14);color:#fff;font:400 22px/1 system-ui,sans-serif;
}
.pagecraft-lightbox-btn:hover{background:rgba(255,255,255,.26);color:#fff}
.pagecraft-lightbox-prev{left:14px}
.pagecraft-lightbox-next{right:14px}
.pagecraft-lightbox-close{position:absolute;top:14px;right:14px;transform:none}
.pagecraft-lightbox-btn[hidden]{display:none}

.pagecraft-button:focus-visible,.pagecraft-form-button:focus-visible,
.pagecraft-nav-list a:focus-visible,.pagecraft-nav-toggle:focus-visible,
.pagecraft-heading a:focus-visible,.pagecraft-wysiwyg a:focus-visible,
.pagecraft-figure:focus-visible,.pagecraft-icon:focus-visible,
.pagecraft-gallery-frame:focus-visible,.pagecraft-accordion-q:focus-visible,
.pagecraft-lightbox-btn:focus-visible{outline:3px solid currentColor;outline-offset:3px}
${m.css || ''}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:.01ms !important;animation-iteration-count:1 !important;
    transition-duration:.01ms !important;scroll-behavior:auto !important;
  }
}
` + (editing ? `
[data-id]{position:relative}
[data-id]:hover{outline:1px solid #b7f34a;outline-offset:0}
.s-cond-off{opacity:.42;outline:1px dashed #7aa2f7;outline-offset:2px}
[data-t=section]:hover,[data-t=row]:hover,[data-t=column]:hover{outline:1px dashed #6f7771;outline-offset:-1px}
[data-t=column]{min-height:40px}
[data-t=nav][data-sel] .pagecraft-nav-list{display:flex !important}
[data-t=nav][data-sel] .pagecraft-nav-icon{background-color:transparent}
[data-t=nav][data-sel] .pagecraft-nav-icon::before{transform:rotate(45deg)}
[data-t=nav][data-sel] .pagecraft-nav-icon::after{transform:rotate(-45deg)}
[data-t=tabs] [data-tab-idle]{display:none}
.pagecraft-video>iframe,.pagecraft-video>video{pointer-events:none}
.pagecraft-button,.pagecraft-heading a,.pagecraft-wysiwyg a{cursor:default}
.s-empty{
  display:flex;align-items:center;justify-content:center;gap:7px;min-height:76px;width:100%;
  border:1px dashed #cfcabb;border-radius:8px;color:#6f7771;
  font:500 12.5px "DM Sans",system-ui,sans-serif;background:#f8f6ef80;
}
.s-held{
  display:block;margin-top:8px;padding:7px 10px;border-radius:6px;
  background:#f8f6ef;border:1px dashed #cfcabb;color:#6f7771;
  font:500 11.5px "DM Sans",system-ui,sans-serif;
}
[data-editing]{outline:1.5px solid #111311 !important;outline-offset:2px;cursor:text !important}
[data-editing] *{cursor:text !important}

/* global regions render as locked context and link to their own editor */
.s-region{position:relative}
.s-region[data-state=locked],.s-region[data-state=dim]{outline:1px dashed #cfcabb;outline-offset:-1px}
/* locked and dimmed regions swallow interaction so global structure is never
   edited by accident; the chip stays clickable above them */
.s-region[data-state=locked]::after,.s-region[data-state=dim]::after{
  content:"";position:absolute;inset:0;z-index:9000;cursor:default;
}
.s-region[data-state=dim]>.s-rbody{opacity:.3}
.s-region[data-state=edit]{outline:1.5px solid #b7f34a;outline-offset:-1px}
.s-region[data-kind=main][data-state=edit]{outline:none}
.s-lockbar{
  position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:9001;
  display:flex;gap:6px;opacity:0;pointer-events:none;transition:opacity .14s ease;
}
/* wayfinding, not furniture — revealed on hover so it stays out of the way */
.s-region:hover>.s-lockbar{opacity:1;pointer-events:auto}
/* nothing stays pinned over the canvas — the way out lives in the chrome */
.s-lockchip,.s-lockopen{
  display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border-radius:6px;
  font:500 12px "DM Sans",system-ui,sans-serif;white-space:nowrap;
  background:#fff;border:1px solid #e5e1d6;color:#4b504b;box-shadow:0 8px 20px -10px #11131140;
}
.s-lockchip svg{color:#6f7771}
.s-lockopen{cursor:pointer;background:#111311;border-color:#111311;color:#f8f6ef}
.s-lockopen svg{color:#b7f34a}
.s-lockchip.on{background:#111311;border-color:#111311;color:#f8f6ef}
.s-lockchip.on svg{color:#b7f34a}

#s-root{min-height:100%}
.s-canvas-empty{
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  min-height:60vh;color:#6f7771;font:500 13.5px "DM Sans",system-ui,sans-serif;
  text-align:center;padding:40px;
}
.s-canvas-empty b{font-size:16px;color:#111311;font-weight:600;font-family:"Manrope",system-ui,sans-serif}
.s-openadd{
  margin-top:4px;padding:7px 14px;border-radius:8px;cursor:pointer;border:0;
  background:#111311;color:#f8f6ef;font:600 12.5px "Manrope",system-ui,sans-serif;
}
.s-openadd:hover{background:#2a2e2a}

/* selection: green outline plus the eight handles from the product screens */
#s-hud{position:absolute;top:0;left:0;z-index:9998;pointer-events:none}
/* Everything below divides by --z so it stays the same size on screen whatever the
   canvas is scaled to. The frame's *position* still comes from the element, which is
   what keeps it locked on; only its thickness is corrected. */
#s-hud .frame{position:absolute;outline:calc(1.5px / var(--z,1)) solid #b7f34a;pointer-events:none}
#s-hud .frame i{
  position:absolute;background:#b7f34a;border-radius:1px;
  width:calc(7px / var(--z,1));height:calc(7px / var(--z,1));
}
#s-hud .frame i.nw{left:calc(-4px / var(--z,1));top:calc(-4px / var(--z,1))}
#s-hud .frame i.ne{right:calc(-4px / var(--z,1));top:calc(-4px / var(--z,1))}
#s-hud .frame i.sw{left:calc(-4px / var(--z,1));bottom:calc(-4px / var(--z,1))}
#s-hud .frame i.se{right:calc(-4px / var(--z,1));bottom:calc(-4px / var(--z,1))}
#s-hud .frame i.n{left:50%;margin-left:calc(-3.5px / var(--z,1));top:calc(-4px / var(--z,1))}
#s-hud .frame i.s{left:50%;margin-left:calc(-3.5px / var(--z,1));bottom:calc(-4px / var(--z,1))}
#s-hud .frame i.w{top:50%;margin-top:calc(-3.5px / var(--z,1));left:calc(-4px / var(--z,1))}
#s-hud .frame i.e{top:50%;margin-top:calc(-3.5px / var(--z,1));right:calc(-4px / var(--z,1))}
#s-hud .frame.alt{outline:calc(1.5px / var(--z,1)) dashed #b7f34a;opacity:.8}
/* Column gutter grips. They live in the HUD overlay rather than the canvas DOM,
   so nothing about resizing can leak into the export. */
#s-hud .grip{
  position:absolute;width:calc(11px / var(--z,1));margin-left:calc(-5.5px / var(--z,1));
  pointer-events:auto;cursor:col-resize;display:flex;align-items:center;justify-content:center;
}
#s-hud .grip::before{content:'';width:3px;height:100%;border-radius:2px;background:#b7f34a;opacity:.35;transition:opacity .12s}
#s-hud .grip:hover::before,#s-hud .grip.on::before{opacity:1}
#s-hud .gtip{
  position:absolute;transform:scale(calc(1 / var(--z,1))) translate(-50%,-100%);
  transform-origin:50% 100%;background:#111311;color:#f8f6ef;
  border-radius:5px;padding:3px 7px;pointer-events:none;white-space:nowrap;
  font:500 11px "DM Sans",system-ui,sans-serif;
}
#s-hud .bar{
  position:absolute;display:flex;align-items:center;gap:1px;background:#111311;color:#f8f6ef;
  border-radius:6px 6px 0 0;padding:3px 3px 3px 8px;pointer-events:auto;white-space:nowrap;
  transform:scale(calc(1 / var(--z,1)));transform-origin:0 0;
  font:500 12px "DM Sans",system-ui,sans-serif;
}
#s-hud .bar .nm{padding-right:6px}
#s-hud .bar button{
  width:20px;height:20px;border:0;background:none;color:#f8f6ef;display:grid;place-items:center;
  border-radius:4px;cursor:pointer;padding:0;opacity:.75;
}
#s-hud .bar button:hover{background:#ffffff26;opacity:1;color:#b7f34a}
#s-hud .bar button.g{cursor:grab}
#s-drop{position:absolute;z-index:9999;pointer-events:none;background:#b7f34a;border-radius:2px;box-shadow:0 0 0 calc(1px / var(--z,1)) #11131126}
#s-drop.box{background:#b7f34a24;border:1.5px solid #b7f34a;border-radius:8px;box-shadow:none}
` : '');
}

/* --------------------------------------------------------- node markup */
/* One place that understands a video URL, used by both the embed and the facade */
function vidSrc(p: any) {
  const src = String(p.src || '').trim();
  let m = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return { kind: 'youtube', id: m[1] };
  m = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: 'vimeo', id: m[1] };
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(src) || src.startsWith('data:video')) return { kind: 'file', id: src };
  return { kind: src ? 'other' : 'none', id: src };
}
/* A facade poster is release content, so only an author-owned/frozen asset is eligible.
   Provider thumbnails are mutable remote bytes and cannot be part of an immutable release. */
function vidPoster(p: any) {
  return p.poster || '';
}
const embedUrl = (p: any) => {
  const v = vidSrc(p);
  const q: string[] = [];
  if (p.autoplay) q.push('autoplay=1');
  if (p.muted || p.autoplay) q.push('mute=1', 'muted=1');
  if (p.loop) q.push('loop=1');
  if (!p.controls) q.push('controls=0');
  if (v.kind === 'youtube') return `https://www.youtube.com/embed/${v.id}?${q.concat(p.loop ? ['playlist=' + v.id] : []).join('&')}`;
  if (v.kind === 'vimeo') return `https://player.vimeo.com/video/${v.id}?${q.join('&')}`;
  return v.id;
};
/* A facade keeps the player's ~600KB off the page until someone clicks it. */
const canFacade = (p: any) => p.facade && !p.autoplay && ['youtube', 'vimeo'].includes(vidSrc(p).kind);

function vid(p: any) {
  const src = String(p.src || '').trim();
  const q: string[] = [];
  if (p.autoplay) q.push('autoplay=1');
  if (p.muted || p.autoplay) q.push('mute=1', 'muted=1');
  if (p.loop) q.push('loop=1');
  if (!p.controls) q.push('controls=0');
  let mt = src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
  if (mt) return `<iframe src="https://www.youtube.com/embed/${mt[1]}?${q.join('&amp;')}${p.loop ? '&amp;playlist=' + mt[1] : ''}" title="Video" allow="accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  mt = src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (mt) return `<iframe src="https://player.vimeo.com/video/${mt[1]}?${q.join('&amp;')}" title="Video" allow="autoplay;fullscreen;picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)(\?|#|$)/i.test(src) || src.startsWith('data:video'))
    return `<video src="${esc(src)}"${p.controls ? ' controls' : ''}${p.autoplay ? ' autoplay' : ''}${p.muted || p.autoplay ? ' muted playsinline' : ''}${p.loop ? ' loop' : ''}${p.poster ? ` poster="${esc(p.poster)}"` : ''}></video>`;
  if (!src) return `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#0f172a;color:#94a3b8;font:500 13px sans-serif">Add a video URL</div>`;
  return `<iframe src="${esc(src)}" title="Video" allowfullscreen loading="lazy"></iframe>`;
}

/* Plain multi-line text to paragraphs: a blank line starts one, a single
   newline is a break. The same shape a WYSIWYG would produce by hand, without
   handing an accordion answer a rich-text surface it has nowhere to put. */
function para(str: unknown) {
  const t = String(str == null ? '' : str).replace(/\r\n?/g, '\n').trim();
  if (!t) return '';
  return t.split(/\n{2,}/).map(b => `<p>${esc(b).replace(/\n/g, '<br>')}</p>`).join('');
}

/* What the canvas is allowed to run from an Embed: nothing. The export ships the
   markup verbatim — that is the whole point of the widget — but the editor renders
   inside a live iframe on the same origin, so a pasted analytics tag or a widget
   loader would execute on every repaint, once per keystroke. Both forms go: the
   `<script>` element and the inline `on*` handler. Returns how many it held back,
   because an embed that renders as nothing needs to say why. */
function stripScripts(html: unknown) {
  let stripped = 0;
  const out = String(html == null ? '' : html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, () => { stripped++; return ''; })
    .replace(/<script\b[^>]*\/?>/gi, () => { stripped++; return ''; })
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, () => { stripped++; return ''; });
  return { html: out, stripped };
}

/* Pagecraft owns the document's one page-level `<main>`. Authors can still choose `main` in
   semantic controls or paste one into rich/embed markup, but those fragments live *inside*
   the page landmark and therefore become divs at publish time. This scanner changes actual
   tags only: comments and raw-text bodies such as JavaScript are copied byte-for-byte, so a
   string containing "<main>" never becomes evidence about the document structure. */
function demoteMainTags(html: unknown) {
  const source = String(html == null ? '' : html);
  const lower = source.toLowerCase();
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext']);
  const tagEnd = (from: number) => {
    let quote = '';
    for (let i = from; i < source.length; i++) {
      const ch = source[i];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '>') return i;
    }
    return -1;
  };
  const rawClose = (name: string, from: number) => {
    let found = from;
    while ((found = lower.indexOf(`</${name}`, found)) >= 0) {
      const after = lower[found + name.length + 2] || '';
      if (!after || /[\s/>]/.test(after)) return found;
      found += name.length + 2;
    }
    return -1;
  };
  const demote = (tag: string) => tag.replace(/^(<\s*\/?\s*)main\b/i, '$1div');

  let out = '', at = 0;
  while (at < source.length) {
    const openAt = source.indexOf('<', at);
    if (openAt < 0) { out += source.slice(at); break; }
    out += source.slice(at, openAt);
    if (source[openAt + 1] === '!' && source[openAt + 2] === '-' && source[openAt + 3] === '-') {
      const end = source.indexOf('-->', openAt + 4);
      const stop = end < 0 ? source.length : end + 3;
      out += source.slice(openAt, stop); at = stop; continue;
    }
    const openEnd = tagEnd(openAt + 1);
    if (openEnd < 0) { out += source.slice(openAt); break; }
    const open = source.slice(openAt, openEnd + 1);
    const named = open.match(/^<\s*(\/?)\s*([a-z][\w:-]*)\b/i);
    const closing = !!(named && named[1]);
    const name = named ? named[2].toLowerCase() : '';
    if (!name || closing || !raw.has(name) || /\/\s*>$/.test(open)) {
      out += name === 'main' ? demote(open) : open;
      at = openEnd + 1;
      continue;
    }
    const closeAt = rawClose(name, openEnd + 1);
    if (closeAt < 0) { out += open + source.slice(openEnd + 1); break; }
    const closeEnd = tagEnd(closeAt + 2 + name.length);
    if (closeEnd < 0) { out += open + source.slice(openEnd + 1); break; }
    out += open + source.slice(openEnd + 1, closeEnd + 1);
    at = closeEnd + 1;
  }
  return out;
}

const BICON: Record<string, string> = { arrow: IC.arrow, check: IC.check, plus: IC.plus };
/* Prev, the numbers, next. A `<nav>` because it is a set of navigation links, with
   aria-current on the page you are on so a screen reader is told where it is rather than
   left to infer it from the styling. The current page is not a link — linking to where you
   already are is a dead control that looks live. */
function pager(pg: Page, at: number, total: number, o: RenderOpts) {
  const to = (i: number) => esc((o.rel || '') + pagedPath(pg.slug, i));
  const cell = (i: number) => i === at
    ? `<span class="pagecraft-page on" aria-current="page">${i}</span>`
    : `<a class="pagecraft-page" href="${to(i)}">${i}</a>`;
  const step = (i: number, label: string, cls: string) => i >= 1 && i <= total
    ? `<a class="pagecraft-page ${cls}" href="${to(i)}" rel="${cls}">${label}</a>`
    : `<span class="pagecraft-page ${cls} off" aria-hidden="true">${label}</span>`;
  const nums = Array.from({ length: total }, (_, k) => cell(k + 1)).join('');
  return `<nav class="pagecraft-pager" aria-label="Pages">`
    + step(at - 1, 'Previous', 'prev') + nums + step(at + 1, 'Next', 'next') + `</nav>`;
}

const SEC_TAGS = ['section', 'div', 'header', 'footer', 'main', 'article', 'aside', 'nav'];
/* A Box's tag. Wider than a section's, because a box is the thing you reach for when the
   markup matters — a `ul` of `li`s, an `article`, a `nav`. Checked against the list rather
   than emitted as typed, for the reason every other tag prop is: a prop is author input. */
const BOX_TAGS = ['div', 'article', 'aside', 'nav', 'header', 'footer', 'main', 'section', 'ul', 'ol', 'li'];

function renderNode(n: PcNode, o: RenderOpts): string {
  const d = DEF[n.type];
  if (!d) return '';
  /* An instance renders its definition's tree. `o.inst` carries the instance down that render
     so three things can happen: the definition's root wears the instance's identity, a `prop`
     binding resolves against the instance's values, and a slot renders the instance's own
     children. Nothing is cloned — the definition is read, not copied, which is what makes one
     set of rules in the stylesheet serve every instance. */
  if (n.use && !(o.inst && o.inst === n)) {
    const cd = findComponent(n.use);
    if (cd && (o.stack || []).includes(n.use)) {
      /* A component that contains itself. Refused at the second turn rather than the
         thousandth, because the alternative is a page builder that can hang the tab it renders
         in — and the author needs to be told, not left with a blank space. */
      return o.edit
        ? `<div id="${n.id}" data-id="${n.id}" data-t="${n.type}" class="s-missing">${esc(cd.name)} contains itself</div>`
        : '';
    }
    if (!cd) {
      /* A definition that is not there. Silent in the export — an empty element is better than
         a broken one — and named in the editor, because a component nobody can find is a thing
         somebody has to fix. */
      return o.edit
        ? `<div id="${n.id}" data-id="${n.id}" data-t="${n.type}" class="s-missing">Missing component: ${esc(n.use)}</div>`
        : '';
    }
    return renderNode(cd.node, { ...o, inst: n, cdef: cd, stack: [...(o.stack || []), n.use] });
  }
  /* This node is the definition's root, rendering inside an instance: the element on the page
     is the instance's, so its id, its styling hook, its classes and its motion are the ones
     that belong on it. The definition's own class rides along, which is how one stylesheet
     rule serves every instance and the instance's own rules still win — they are emitted after
     the definition's. */
  const host = (o.inst && o.cdef && n === o.cdef.node) ? o.inst : null;
  /* an inner node of a definition: real markup, but not a thing the page owns */
  const inner = !!o.inst && !host;
  const self = host || n;
  const ts = self.props.ts && findStyle(self.props.ts) ? ' ts-' + self.props.ts
    : (n.props.ts && findStyle(n.props.ts) ? ' ts-' + n.props.ts : '');
  const managed = nodeClasses(self).map(c => ' c-' + c.id).join('')
    + (host ? nodeClasses(n).map(c => ' c-' + c.id).join('') : '');
  /* `cx` and `at` are what every widget's markup goes through, so motion rides along without a
     single render case needing to know about it — the same trick the styling hook class uses. */
  const anim = o.edit ? { cls: '', at: '' } : animAttrs(self);
  /* Assigned below, once the scope is known, and read by `cx` through the closure. A condition
     is answered from the item in scope, which is not resolved yet at this line — and the
     stylesheet writer cannot answer it at all, which is why the marker is a class the render
     adds rather than a declaration `bucket` emits. */
  let condCls = '';
  const cx = (c: string) => `class="${c} ${nodeClass(n)}${host ? ' ' + nodeClass(host) : ''}${ts}${managed}${anim.cls}${condCls}${self.adv && self.adv.cls ? ' ' + esc(self.adv.cls) : ''}"`;
  /* The editor addresses elements by node id; the export uses the readable one.
     A repeat is the same node rendered many times, so both need a per-item suffix
     or every card in a Collection List ships the same id — invalid markup, and it
     breaks every anchor pointing into one. The item slug is the suffix because it
     is stable and it matches the detail-page URLs.
     In the editor the first repeat keeps the bare node id, so selection painting,
     the HUD and the column grips still resolve it with getElementById. */
  const rep = o.repeat && o.item ? '-' + o.item.slug : '';
  /* An instance is the same definition rendered many times, so its inner elements need a
     per-instance suffix for exactly the reason a repeat does: without one, three cards on a
     page ship three elements with the same id, which is invalid markup and breaks every anchor
     pointing at one. */
  const ins = inner && o.inst ? '-' + String(o.inst.id).replace(/^n/, '') : '';
  const domId = o.edit
    ? (o.repIndex ? self.id + rep + ins : self.id + ins)
    : esc(domIdOf(self) + rep + ins);
  /* Only the instance is addressable. An inner element carries no `data-id`, so a click lands
     on the nearest ancestor that has one — the instance — which is the element whose panel can
     actually change anything. Its internals belong to the definition. */
  const hooks = inner ? '' : ` data-id="${self.id}" data-t="${self.type}"${state.ui.sel === self.id ? ' data-sel' : ''}`;
  const at = `id="${domId}"${o.edit ? hooks : ''}${anim.at}`;
  /* a node that declares a source opens a scope for itself and everything under
     it; `o.item` is set by a repeater, otherwise the canvas previews one */
  const sc = self.src ? findCollection(self.src) : null;
  const o2 = sc ? { ...o, col: sc, item: o.repeat && o.col === sc ? o.item : previewItem(sc) } : o;
  /* A slot renders the instance's children in place of its own, and its own when the instance
     put nothing there — a default, the way a slot has always worked. Those children are the
     page's nodes, so they render outside the instance's scope: their bindings are the page's
     bindings, and a `prop` binding inside them would be reading a component they are merely
     sitting in. */
  const filled = n.slot && o.inst ? slotKids(o.inst, o.cdef || null, n.slot) : null;
  const kidList = filled && filled.length ? filled : (n.children || []);
  const kidOpts = filled && filled.length ? { ...o2, inst: null, cdef: null } : o2;
  const kids = n.type === 'list' ? '' : kidList.map(c => renderNode(c, kidOpts)).join('');
  const p = boundProps(n, o2.col || null, o2.item || null, o.inst || null, o.cdef || null);

  /* A condition decides whether this element is on the page. Not in the editor, where it stays
     visible and selectable and wears a marker instead — an element you cannot see is an element
     you cannot fix, and a condition that hid its own element would be a control you could
     switch on and never switch off. The same reasoning `hide` uses for a breakpoint, and the
     same treatment. */
  if (n.showIf && !showsNode(n, o2.col || null, o2.item || null, o.inst || null, o.cdef || null)) {
    if (!o.edit) return '';
    /* `.s-cond-off` in the editing half of `baseCss`: dimmed and dashed in blue, where `hide`
       is amber. Two different statements — "not at this width" and "not for this item" — and an
       author who cannot tell them apart cannot debug either. */
    condCls = ' s-cond-off';
  }

  switch (n.type) {
    case 'section': {
      const tag = p.tag && SEC_TAGS.includes(p.tag) ? p.tag : 'section';
      const inner = kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a Row or component here</div>` : '');
      return `<${tag} ${at} ${cx('pagecraft-section')}><div class="pagecraft-container${p.width === 'full' ? ' full' : ''}">${inner}</div></${tag}>`;
    }
    case 'row':
      return `<div ${at} ${cx('pagecraft-row')}>${kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a Column</div>` : '')}</div>`;
    case 'box': {
      /* The layout is a class, not a declaration, so it cannot be half-overwritten by an
         author editing CSS — the same reason `.pagecraft-row` carries `display:flex` rather
         than every row storing it. */
      const mode = p.layout === 'flex' || p.layout === 'grid' ? ' l-' + p.layout : '';
      const href = pageHref(p.link, o);
      const inner = kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop anything here</div>` : '');
      if (href) {
        /* An anchor, and never a nested one: an `<a>` inside an `<a>` is invalid markup that
           browsers silently unnest, so the review flags it rather than this render guessing. */
        return `<a ${at} ${cx('pagecraft-box' + mode)} href="${esc(href)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}>${inner}</a>`;
      }
      const tag = p.tag && BOX_TAGS.includes(p.tag) ? p.tag : 'div';
      return `<${tag} ${at} ${cx('pagecraft-box' + mode)}>${inner}</${tag}>`;
    }
    case 'slider': {
      /* `tabindex` on the track, because a scrollable region a keyboard cannot reach is a
         region a keyboard user cannot read. It costs one tab stop, which is the trade the
         guidance asks for. */
      const track = `<div ${at} ${cx('pagecraft-slider')} data-slides role="group"`
        + ` aria-label="${esc(String(p.aria || 'Slides'))}" tabindex="0">`
        + (kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a Column — it becomes a slide</div>` : ''))
        + '</div>';
      if (!p.arrows) return track;
      const btn = (dir: string, label: string) =>
        `<button type="button" class="pagecraft-slide-btn ${dir}" data-slide-${dir} aria-label="${label}" hidden>`
        + `${svg('caret', 15)}</button>`;
      return `<div class="pagecraft-slider-box" data-slider>${track}`
        + btn('p', 'Previous slides') + btn('n', 'Next slides')
        + '<div class="pagecraft-slider-dots" data-slide-dots role="group" aria-label="Choose a slide" hidden></div></div>';
    }
    case 'list': {
      const lc = n.src ? findCollection(n.src) : null;
      const kidz = n.children || [];
      if (!lc) return o.edit
        ? `<div ${at} ${cx('pagecraft-list')}><div class="s-empty">${svg('plus', 12)} Pick a collection for this list</div></div>` : '';
      if (!kidz.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-list')}><div class="s-empty">${svg('plus', 12)} Drop a Column — it becomes the card</div></div>` : '';
      const all = listItems(n, lc);
      /* An empty collection exports nothing rather than an empty shell; the editor
         still says so, or the list would look broken. */
      if (!all.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-list')}><div class="s-empty">${esc(lc.name)} has no items yet</div></div>` : '';

      /* Only the paginator on this page slices. A second paginated list would otherwise
         show its own page 3 next to the first list's page 3, which means nothing. */
      const per = parseInt(String(p.per || ''), 10);
      const drives = per > 0 && o.pg ? paginatorOf(o.pg) : null;
      const mine = !!drives && drives.node.id === n.id;
      const total = mine ? listPageCount(n, lc) : 1;
      const at1 = mine ? Math.min(Math.max(1, o.pageNo || 1), total) : 1;
      const rows = mine ? all.slice((at1 - 1) * per, at1 * per) : all;

      const reps = rows.map((it, k) =>
        kidz.map(c => renderNode(c, { ...o, col: lc, item: it, repeat: true, repIndex: k })).join('')).join('');
      const body = `<div ${at} ${cx('pagecraft-list')}>${reps}</div>`;
      return mine && total > 1 ? body + pager(o.pg!, at1, total, o) : body;
    }
    case 'column':
      return `<div ${at} ${cx('pagecraft-column')}>${kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a component</div>` : '')}</div>`;
    case 'heading': {
      const tg = p.level && /^(h[1-6]|p|div)$/.test(p.level) ? p.level : 'h2';
      const body = esc(p.text).replace(/\n/g, '<br>');
      const href = pageHref(p.link, o);
      const inner = href ? `<a href="${esc(href)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}>${body}</a>` : body;
      return `<${tg} ${at} ${cx('pagecraft-heading')}>${inner}</${tg}>`;
    }
    case 'text':
      return `<div ${at} ${cx('pagecraft-wysiwyg')}>${p.html || (o.edit ? '<p></p>' : '')}</div>`;
    case 'quote': {
      /* the attribution decides the shape: a caption makes it a figure, its absence
         leaves a blockquote that needs no wrapper — the image widget's rule exactly */
      const said = `<p>${esc(p.text).replace(/\n/g, '<br>')}</p>`;
      const url = safeUrl(p.source);
      const from = url ? ` cite="${esc(url)}"` : '';
      const who = String(p.by || '').trim();
      if (!who) return `<blockquote ${at}${from} ${cx('pagecraft-quote')}>${said}</blockquote>`;
      const named = url ? `<a href="${esc(url)}">${esc(who)}</a>` : esc(who);
      return `<figure ${at} ${cx('pagecraft-quote')}>`
        + `<blockquote${from}>${said}</blockquote>`
        + `<figcaption class="pagecraft-attrib">${named}</figcaption></figure>`;
    }
    case 'image': {
      const src = esc(p.src || PH);
      const lz = !o.edit && p.lazy ? ' loading="lazy" decoding="async"' : '';
      /* intrinsic dimensions let the browser reserve space — no layout shift */
      const dim = (p.w && p.h) ? ` width="${parseInt(p.w, 10)}" height="${parseInt(p.h, 10)}"`
        : (!p.src ? ' width="800" height="500"' : '');
      const alt = ` alt="${p.decorative ? '' : esc(p.alt)}"`;
      const ihref = pageHref(p.link, o);
      /* `asset:<id>@<w>` is a variant of the same asset. The export rewrites every asset
         token to a path once the whole page is rendered, so a width marker rides along in
         the token rather than needing the renderer to know where files land. Only for a
         stored asset: a data URI or a remote URL has no variants to point at. */
      const set = (o.variants && !o.edit && /^asset:[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(String(p.src || '')))
        ? imageWidths(p.w).map(w => `${p.src}@${w} ${w}w`) : [];
      const ss = set.length
        ? ` srcset="${esc(set.join(', '))}" sizes="${esc(sizesFor(n.id))}"` : '';
      if (p.caption) {
        const img = `<img src="${src}"${ss}${alt}${dim}${lz} class="pagecraft-image">`;
        return `<figure ${at} ${cx('pagecraft-figure')}>${ihref ? `<a href="${esc(ihref)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}>${img}</a>` : img}<figcaption class="pagecraft-caption">${esc(p.caption)}</figcaption></figure>`;
      }
      if (ihref) return `<a ${at} ${cx('pagecraft-figure')} href="${esc(ihref)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}><img src="${src}"${ss}${alt}${dim}${lz} class="pagecraft-image"></a>`;
      return `<img ${at} src="${src}"${ss}${alt}${dim}${lz} ${cx('pagecraft-image')}>`;
    }
    case 'video': {
      const box = `${at} ${cx('pagecraft-video')} style="aspect-ratio:${esc(p.ratio || '16 / 9')}"`;
      if (!canFacade(p)) return `<div ${box}>${vid(p)}</div>`;
      const poster = vidPoster(p);
      return `<div ${box} data-facade>`
        + `<button class="pagecraft-video-play" type="button" data-embed="${esc(embedUrl(p))}" aria-label="Play video">`
        + (poster ? `<img src="${esc(poster)}" alt="" loading="lazy" decoding="async">` : '')
        + `<span class="pagecraft-video-icon" aria-hidden="true"></span></button></div>`;
    }
    case 'button': {
      const ico = p.icon && p.icon !== 'none' ? `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">${BICON[p.icon] || ''}</svg>` : '';
      const bhref = pageHref(p.link, o);
      const tag = bhref ? 'a' : 'button';
      const attrs = bhref ? `href="${esc(bhref)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}` : 'type="button"';
      return `<${tag} ${at} ${cx('pagecraft-button')} ${attrs}><span>${esc(p.text)}</span>${ico}</${tag}>`;
    }
    case 'nav': {
      const items = Array.isArray(p.items) ? p.items as NavItem[] : [];
      const name = esc(p.aria || 'Main');
      const mid = domId + '-menu';
      const location = /^[a-z0-9_-]+$/.test(String(p.menuLocation || ''))
        ? ` data-pagecraft-menu-location="${esc(String(p.menuLocation))}"` : '';
      const keyed = new Map(items.filter(it => it.id).map(it => [String(it.id), it]));
      const childrenOf = (parentId: string, ancestry: Set<string>): string => items.filter(it => {
        const parent = String(it.parentId || '');
        if (!parentId) return !parent || !keyed.has(parent);
        return parent === parentId;
      }).map(it => {
        const id = String(it.id || '');
        if (id && ancestry.has(id)) return '';
        const classes = String(it.cls || '').trim().split(/\s+/).filter(Boolean);
        const nextAncestry = new Set(ancestry);
        if (id) nextAncestry.add(id);
        const nested = id ? childrenOf(id, nextAncestry) : '';
        if (nested) classes.push('menu-item-has-children');
        const liClass = classes.length ? ` class="${esc(Array.from(new Set(classes)).join(' '))}"` : '';
        const rel = String(it.rel || '').trim().split(/\s+/).filter(Boolean);
        if (it.target === '_blank' && !rel.includes('noopener')) rel.push('noopener');
        const target = it.target === '_blank' ? ' target="_blank"' : '';
        const relationship = rel.length ? ` rel="${esc(rel.join(' '))}"` : '';
        return `<li${liClass}><a href="${esc(pageHref(it.href, o) || '#')}"${target}${relationship}>${esc(it.label || '')}</a>`
          + (nested ? `<ul class="sub-menu">${nested}</ul>` : '') + `</li>`;
      }).join('');
      return `<nav ${at} ${cx('pagecraft-nav-menu')} data-nav${location} aria-label="${name}">`
        + `<button class="pagecraft-nav-toggle" data-nav-t type="button" aria-expanded="false" aria-controls="${mid}" aria-label="${name} menu"><span class="pagecraft-nav-icon"></span></button>`
        + `<ul class="pagecraft-nav-list" id="${mid}" data-nav-l>`
        + childrenOf('', new Set())
        + `</ul></nav>`;
    }
    case 'form': {
      const fields = Array.isArray(p.fields) ? p.fields : [];
      const fid = (i: number) => domId + '-f' + i;
      const wordpressManaged = p.mode === 'wordpress';
      const formId = String(self.id || n.id).replace(/[^A-Za-z0-9_-]/g, '');
      const act = wordpressManaged ? `%%PAGECRAFT_FORM_ENDPOINT:${formId}%%` : safeFormAction(p.action);
      const disabled = act ? '' : ' disabled';
      const body = fields.map((f, i) => {
        const name = esc(f.name || slugify(f.label) || 'field-' + (i + 1));
        const req = f.required ? ' required' : '';
        const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
        /* Half-width fields share a row. A class rather than a declaration, so the mobile rule
           can put them back on their own line without an author having to think about it —
           Name and Email beside each other is 170px each on a phone. */
        const half = f.half ? ' half' : '';
        const lab = `<label for="${fid(i)}">${esc(f.label || name)}${f.required ? ' <span aria-hidden="true">*</span>' : ''}</label>`;
        if (f.type === 'checkbox') return `<div class="pagecraft-field pagecraft-field-check${half}">`
          + `<input id="${fid(i)}" name="${name}" type="checkbox"${req}${disabled}>`
          + `<label for="${fid(i)}">${esc(f.label || name)}</label></div>`;
        if (f.type === 'textarea') return `<div class="pagecraft-field${half}">${lab}`
          + `<textarea id="${fid(i)}" name="${name}" rows="4"${req}${ph}${disabled}></textarea></div>`;
        if (f.type === 'select') return `<div class="pagecraft-field${half}">${lab}`
          + `<select id="${fid(i)}" name="${name}"${req}${disabled}>`
          + String(f.opts || '').split(',').map(o => o.trim()).filter(Boolean)
            .map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')
          + `</select></div>`;
        return `<div class="pagecraft-field${half}">${lab}`
          + `<input id="${fid(i)}" name="${name}" type="${esc(f.type || 'text')}"${req}${ph}${disabled}></div>`;
      }).join('');
      if (!act) {
        const status = domId + '-status';
        return `<div ${at} ${cx('pagecraft-form')} role="group" aria-label="${esc(p.aria || 'Form')}" aria-describedby="${status}" data-disabled>`
          + body
          + `<button type="button" class="pagecraft-form-button" disabled>${esc(p.submit || 'Send')}</button>`
          + `<p class="pagecraft-form-status" id="${status}">This form is not configured to receive submissions.</p>`
          + `</div>`;
      }
      const managed = wordpressManaged
        ? ` data-pagecraft-form-mode="wordpress" data-pagecraft-form-id="${esc(formId)}"` : '';
      return `<form ${at} ${cx('pagecraft-form')} aria-label="${esc(p.aria || 'Form')}" action="${esc(act)}" method="${wordpressManaged ? 'post' : p.method === 'get' ? 'get' : 'post'}"${managed}>`
        + body
        + `<button type="submit" class="pagecraft-form-button">${esc(p.submit || 'Send')}</button>`
        + `</form>`;
    }
    case 'crumbs': {
      const manual = p.mode === 'manual';
      const trail = manual
        ? (Array.isArray(p.items) ? p.items as NavItem[] : []).map((it, i, all) =>
            ({ label: String(it.label || ''), href: i === all.length - 1 ? '' : String(it.href || '') }))
        : crumbTrail(o.pg, o, String(p.home == null ? 'Home' : p.home));
      /* Nothing on the front page. A breadcrumb there points at the page it is on, which
         is what "you are here" already says — and search engines ask for it to be left off. */
      if (!trail.length || (!manual && o.pg && isFront(o.pg) && trail.length < 2)) return o.edit
        ? `<nav ${at} ${cx('pagecraft-crumbs')}><div class="s-empty">${svg('crumbs', 12)}`
          + (manual ? ' Add a crumb in the panel' : ' The front page shows no trail') + '</div></nav>' : '';
      const li = trail.map((c, i) => {
        const last = i === trail.length - 1;
        const label = esc(c.label);
        const href = last ? '' : pageHref(c.href, o);
        return '<li>' + (last || !href
          ? `<span aria-current="page">${label}</span>`
          : `<a href="${href}">${label}</a>`) + '</li>';
      }).join('');
      /* The separator is a `data-sep` for CSS to draw, never a character in the markup: a
         screen reader should read the trail, not the punctuation between it. */
      return `<nav ${at} ${cx('pagecraft-crumbs')} aria-label="Breadcrumb" data-sep="${esc(String(p.sep || 'chevron'))}">`
        + `<ol>${li}</ol></nav>`;
    }
    case 'code': {
      const src = String(p.body == null ? '' : p.body);
      if (!src.trim()) return o.edit
        ? `<div ${at} ${cx('pagecraft-code')}><div class="s-empty">${svg('codeblock', 12)} Paste the code in the panel</div></div>` : '';
      const lang = String(p.lang || 'text');
      let inner = codeSpans(src, lang);
      /* No token straddles a newline, so numbering is a safe split — and it is only paid
         for when the numbers are asked for. */
      if (p.numbers) inner = inner.split('\n').map(l => `<span class="pagecraft-code-line">${l}</span>`).join('\n');
      const name = String(p.title == null ? '' : p.title).trim();
      const head = (name || p.copy)
        ? `<figcaption class="pagecraft-code-head">${name ? `<span>${esc(name)}</span>` : '<span></span>'}`
          + (p.copy ? '<button type="button" class="pagecraft-code-copy" data-copy hidden>Copy</button>' : '')
          + '</figcaption>'
        : '';
      /* `language-x` is the class every other tool in this world reads, so a page whose
         code came from here still looks like code to whatever reads it next. */
      return `<figure ${at} ${cx('pagecraft-code')}${p.softwrap ? ' data-wrap' : ''}${p.numbers ? ' data-numbers' : ''}>`
        + head + `<pre><code class="language-${esc(lang)}">${inner}</code></pre></figure>`;
    }
    case 'table': {
      const grid = tableGrid(p.body);
      if (!grid.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-table-wrap')}><div class="s-empty">${svg('plus', 12)} Paste or type the rows in the panel</div></div>` : '';
      const cap = String(p.caption == null ? '' : p.caption).trim();
      const head = p.head && grid.length > 1 ? grid[0] : null;
      const rows = head ? grid.slice(1) : grid;
      const cell = (v: string, k: number) =>
        (p.rowhead && k === 0 ? `<th scope="row">${esc(v)}</th>` : `<td>${esc(v)}</td>`);
      /* `scope` is the whole reason to mark a header at all: it is what tells a screen
         reader which cells a heading speaks for. A <th> without it is a bold cell. */
      const thead = head
        ? `<thead><tr>${head.map(v => `<th scope="col">${esc(v)}</th>`).join('')}</tr></thead>` : '';
      const tbody = `<tbody>${rows.map(r => `<tr>${r.map(cell).join('')}</tr>`).join('')}</tbody>`;
      /* A table cannot scroll — its wrapper does. Wide content that pushes the whole page
         sideways is the one layout failure a reader cannot work around. */
      return `<div ${at} ${cx('pagecraft-table-wrap')}>`
        + `<table class="pagecraft-table" data-rules="${esc(String(p.rules || 'rows'))}"${p.zebra ? ' data-zebra' : ''}>`
        + (cap ? `<caption>${esc(cap)}</caption>` : '')
        + thead + tbody + '</table></div>';
    }
    case 'tabs': {
      const rows = Array.isArray(p.items) ? p.items as TabPanel[] : [];
      if (!rows.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-tabs')}><div class="s-empty">${svg('plus', 12)} Add a tab in the panel</div></div>` : '';
      /* While the widget is selected every panel shows, so all of them can be read and
         restyled — the same reason the accordion opens and the burger unfolds. */
      const all = o.edit && state.ui.sel === n.id;
      const tid = (k: number) => `${domId}-t${k}`;
      const pid = (k: number) => `${domId}-p${k}`;
      /* `role=tab` with aria-selected and aria-controls, and the panels labelled back: a tab
         strip a screen reader cannot follow is a row of unexplained links. */
      const strip = rows.map((it, k) =>
        `<button type="button" role="tab" id="${tid(k)}" aria-controls="${pid(k)}"`
        + ` aria-selected="${k === 0 ? 'true' : 'false'}" tabindex="${k === 0 ? '0' : '-1'}"`
        + ` class="pagecraft-tab${k === 0 ? ' on' : ''}">${esc(it.label || 'Tab ' + (k + 1))}</button>`
      ).join('');
      const panels = rows.map((it, k) =>
        `<div role="tabpanel" id="${pid(k)}" aria-labelledby="${tid(k)}"`
        + `${(k === 0 || all) ? '' : ' data-tab-idle'} class="pagecraft-tabpanel">${para(it.panel)}</div>`
      ).join('');
      return `<div ${at} ${cx('pagecraft-tabs')} data-tabs>`
        + `<div class="pagecraft-tablist" role="tablist">${strip}</div>${panels}</div>`;
    }
    case 'accordion': {
      const items = Array.isArray(p.items) ? p.items : [];
      if (!items.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-accordion')}><div class="s-empty">${svg('plus', 12)} Add a question in the panel</div></div>` : '';
      /* One shared name is what makes exclusive opening native. It also means only
         one panel may carry `open`, so "all open" and "one at a time" cannot both
         be honoured — the toggle wins, and the first panel is the one left open. */
      const grp = p.single ? ` name="${domId}-ac"` : '';
      const mark = p.marker === 'none' ? '' : '<span class="pagecraft-accordion-mark" aria-hidden="true"></span>';
      /* While the accordion is selected every panel is opened, so the answers can
         be read and restyled. The same reason the burger menu unfolds when selected. */
      const forced = o.edit && state.ui.sel === n.id;
      const body = items.map((it, k) => {
        const wants = p.open === 'all' || (p.open === 'first' && k === 0);
        const open = forced || (p.single ? (wants && k === 0) : wants);
        return `<details class="pagecraft-accordion-item"${grp}${open ? ' open' : ''}>`
          + `<summary class="pagecraft-accordion-q"><span>${esc(String(it.q == null ? '' : it.q)).replace(/\n/g, ' ')}</span>${mark}</summary>`
          + `<div class="pagecraft-accordion-a">${para(it.a)}</div></details>`;
      }).join('');
      return `<div ${at} ${cx('pagecraft-accordion')} data-marker="${esc(p.marker || 'plus')}">${body}</div>`;
    }
    case 'embed': {
      /* Static markup is an owner's explicit integration. A CMS/component binding is editable
         content, so it is rendered as text instead of becoming an indirect script channel. */
      const supplied = String(p.html == null ? '' : p.html);
      const raw = n.bind && n.bind.html ? esc(supplied) : supplied;
      const ar = p.ratio ? ` style="aspect-ratio:${esc(p.ratio)}"` : '';
      const ecls = 'pagecraft-embed' + (p.ratio ? ' pagecraft-embed-ratio' : '');
      if (!raw.trim()) return o.edit
        ? `<div ${at} ${cx('pagecraft-embed')}><div class="s-empty">${svg('code', 12)} Paste embed HTML in the panel</div></div>` : '';
      if (!o.edit) return `<div ${at} ${cx(ecls)}${ar}>${raw}</div>`;
      const { html, stripped } = stripScripts(raw);
      const note = stripped
        ? `<div class="s-held">${stripped} script${stripped === 1 ? '' : 's'} held back here — ${stripped === 1 ? 'it runs' : 'they run'} on the exported page</div>` : '';
      return `<div ${at} ${cx(ecls)}${ar}>${html}${note}${html.trim() ? '' : '<div class="s-empty">Nothing to draw without its script</div>'}</div>`;
    }
    case 'icon': {
      const nm = p.name && ICON_PATHS[p.name] ? p.name : 'check';
      const lab = String(p.label == null ? '' : p.label).trim();
      const ihref2 = pageHref(p.link, o);
      /* A link with an icon inside and no text has no accessible name at all, so
         the label becomes the link's name and the glyph goes hidden. Unlinked, the
         glyph carries the label itself — or is hidden when there is none, which is
         the right answer for an icon sitting beside text that already says it. */
      if (ihref2) return `<a ${at} ${cx('pagecraft-icon')} href="${esc(ihref2)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}`
        + `${lab ? ` aria-label="${esc(lab)}"` : ''}>${iconSvg(nm, 'class="pagecraft-icon-glyph" aria-hidden="true"')}</a>`;
      return iconSvg(nm, `${at} ${cx('pagecraft-icon pagecraft-icon-glyph')} ${lab ? `role="img" aria-label="${esc(lab)}"` : 'aria-hidden="true"'}`);
    }
    case 'gallery': {
      const shown = (Array.isArray(p.items) ? p.items as GalleryTile[] : []).filter(Boolean);
      if (!shown.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-gallery')}><div class="s-empty">${svg('image', 12)} Add images in the panel</div></div>` : '';
      const lz = !o.edit && p.lazy ? ' loading="lazy" decoding="async"' : '';
      const tiles = shown.map((it, k) => {
        const dim = (it.w && it.h) ? ` width="${parseInt(it.w, 10)}" height="${parseInt(it.h, 10)}"` : '';
        const tsrc = esc(it.src || PH);
        const img = `<img src="${tsrc}" alt="${esc(it.alt || '')}"${dim}${lz} class="pagecraft-gallery-img">`;
        /* With the lightbox on the tile is a real link to the full image, so the
           gallery still works with scripting off; the script only intercepts a
           click that was already going somewhere useful. */
        const frame = p.lightbox
          ? `<a class="pagecraft-gallery-frame" href="${tsrc}" data-lb="${k}"${it.alt ? ` aria-label="${esc(it.alt)}"` : ''}>${img}</a>`
          : `<span class="pagecraft-gallery-frame">${img}</span>`;
        return `<figure class="pagecraft-gallery-item">${frame}`
          + `${p.captions && it.caption ? `<figcaption class="pagecraft-gallery-caption">${esc(it.caption)}</figcaption>` : ''}</figure>`;
      }).join('');
      return `<div ${at} ${cx('pagecraft-gallery' + (p.ratio ? ' pagecraft-gallery-fixed' : ''))}${p.lightbox ? ' data-lightbox' : ''}`
        + `${p.ratio ? ` style="--g-ratio:${esc(p.ratio)};--g-fit:${p.fit === 'contain' ? 'contain' : 'cover'}"` : ` style="--g-fit:${p.fit === 'contain' ? 'contain' : 'cover'}"`}>${tiles}</div>`;
    }
    case 'spacer': return `<div ${at} ${cx('pagecraft-spacer')} aria-hidden="true"></div>`;
    case 'divider': return `<hr ${at} ${cx('pagecraft-divider')}>`;
  }
  return '';
}

const renderList = (list: PcNode[], o: RenderOpts) => list.map(n => renderNode(n, o)).join('');


/* ============================================================== presets */
/* Column layouts, grouped by how many columns they produce. The count is
   structural so it lives on the desktop base; per-breakpoint width tweaks are
   done with each column's own Width control. */
const T3 = 33.3333, T6 = 66.6666;
const LAYOUTS = {
  1: [[100]],
  2: [[50, 50], [T6, T3], [T3, T6], [75, 25], [25, 75]],
  3: [[T3, T3, T3], [50, 25, 25], [25, 50, 25], [25, 25, 50]],
  4: [[25, 25, 25, 25], [40, 20, 20, 20], [20, 20, 20, 40]],
  5: [[20, 20, 20, 20, 20]],
  6: [[16.6666, 16.6666, 16.6666, 16.6666, 16.6666, 16.6666]]
};
const COUNTS = Object.keys(LAYOUTS).map(Number);
const DEFAULT_COLS = 2;                       // what a fresh Columns drop gives you
/* Palette keys that are not node types.

   `columns` was the only one and it was three special cases — one in `BASE`, one in `labelOf`,
   one in `iconOf` — plus a branch in `makeFor`. Box needed three more keys, so the special
   cases became a table. A key names a type, a label, an icon and the props that make it that
   thing; everything else reads the table.

   Why three keys for one widget: Flex and Grid differ from a plain box by one declaration, and
   a palette that offered "Box" with a Layout dropdown would hide two of the three layouts this
   editor never had behind a control nobody would think to open. The panel then shows the
   controls that layout actually has, which is the capability registry's argument at the level
   of one widget. */
const KEYS: Record<string, { type: string; label: string; icon: string; props?: Record<string, unknown> }> = {
  columns: { type: 'row', label: 'Columns', icon: 'columns' },
  box: { type: 'box', label: 'Box', icon: 'section', props: { layout: 'block' } },
  flex: { type: 'box', label: 'Flex', icon: 'row', props: { layout: 'flex' } },
  grid: { type: 'box', label: 'Grid', icon: 'columns', props: { layout: 'grid' } },
  linkbox: { type: 'box', label: 'Link block', icon: 'link', props: { layout: 'block', link: '#' } }
};
const BASE: Record<string, string> = Object.fromEntries(
  Object.entries(KEYS).map(([k, v]) => [k, v.type]));
const labelOf = (k: string) => KEYS[k] ? KEYS[k].label : DEF[k].label;
const iconOf = (k: string) => KEYS[k] ? KEYS[k].icon : DEF[k].icon;
function makeFor(key: string) {
  /* A slider with no slides is an empty strip, so it arrives with three — the same
     courtesy `columns` does, minus the ratios, since a slide's width is one declaration
     on the slider rather than a share of the row. */
  if (key === 'slider') {
    const made = DEF.slider.make();
    /* A slide is a column with no share of a row and no mobile full-width: both of those
       fight `--sl-w`, and a "Width (share)" reading 100 on a slide is a control that does
       nothing. The CSS holds the line for a column that arrives some other way. */
    const slide = () => { const c = N('column'); delete c.css.d['flex-grow']; delete c.css.m['flex-basis']; return c; };
    return N('slider', made.props, made.css, [slide(), slide(), slide()]);
  }
  if (key === 'columns') {
    return N('row', {}, {}, LAYOUTS[DEFAULT_COLS][0].map(w =>
      N('column', {}, { d: { 'flex-grow': String(+w.toFixed(4)) } })));
  }
  const k = KEYS[key];
  if (!k) return N(key);
  /* A grid arrives with a gap and two tracks, because one with neither reads as a bug rather
     than as a choice — the same courtesy `columns` does with its ratios.

     On the node and not in `baseCss`, which is the whole reason this is here. `.pagecraft-box
     .l-grid` is two classes, so a default sitting there outranks `.pagecraft-<id>` — the
     author's own rule — and the Columns control silently did nothing. Anything an author can
     change belongs where their change can win. */
  const css = k.props && k.props.layout !== 'block'
    ? { d: { gap: '24px', ...(k.props.layout === 'grid' ? { 'grid-template-columns': GRID_COLS[0][0] } : {}) } }
    : {};
  return N(k.type, k.props || {}, css);
}
/* which layout, if any, the row currently matches */
const rowRatios = (row: PcNode) => (row.children || []).map(c => parseFloat((c.css.d || {})['flex-grow']) || 0);
function matchLayout(row: PcNode) {
  const cur = rowRatios(row), list = (LAYOUTS as Record<number, number[][]>)[cur.length] || [];
  const i = list.findIndex((l: number[]) => l.every((w: number, k: number) => Math.abs(w - cur[k]) < 0.51));
  return i < 0 ? null : i;
}



/* Search-engine plumbing. Both need an absolute site URL, so they are only
   offered once the project has one. */
function sitemapXml() {
  const base = String(state.meta.baseUrl || '').replace(/\/+$/, '');
  if (!base) return '';
  /* `t.path` rather than the slug: it is what the writer names every file, so it is right
     for a detail page and for page two of a paginated one. Building the URL from the slug
     worked only because a detail target rewrites its slug, and a paginated one does not —
     it listed page one's address once per page. */
  const urls = exportTargets().filter(t => !isNotFound(t.pg)).map(t => `${base}/${t.path}`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`;
}
function robotsTxt() {
  const base = String(state.meta.baseUrl || '').replace(/\/+$/, '');
  return `User-agent: *\nAllow: /\n` + (base ? `Sitemap: ${base}/sitemap.xml\n` : '');
}


/* The only JavaScript Slate ever emits, and only onto pages that use a Nav:
   an accessible burger toggle (aria-expanded, Escape, click-outside). */
/* Emitted only when a page has a tab strip. It sets `data-tabs-ready`, which is what turns the
   `display:none` on: the panels are only hidden once something exists to show them again, so a
   page served without JS reads as the whole content stacked rather than one tab's worth. */
const TABS_JS = `<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-tabs]'),function(w){
var t=[].slice.call(w.querySelectorAll('[role=tab]')),p=[].slice.call(w.querySelectorAll('[role=tabpanel]'));
if(!t.length)return;w.setAttribute('data-tabs-ready','');
function show(i){t.forEach(function(b,k){var on=k===i;b.classList.toggle('on',on);
b.setAttribute('aria-selected',on?'true':'false');b.tabIndex=on?0:-1;
if(p[k]){if(on)p[k].removeAttribute('data-tab-idle');else p[k].setAttribute('data-tab-idle','');}});}
show(0);
t.forEach(function(b,k){b.addEventListener('click',function(){show(k);});
b.addEventListener('keydown',function(e){
var d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:e.key==='Home'?-999:e.key==='End'?999:0;
if(!d)return;e.preventDefault();
var i=d===-999?0:d===999?t.length-1:(k+d+t.length)%t.length;show(i);t[i].focus();});});
});})();
<\/script>
`;

const NAV_JS = `<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'),function(w){
var b=w.querySelector('[data-nav-t]');if(!b)return;
function set(o){w.classList.toggle('is-open',o);b.setAttribute('aria-expanded',o?'true':'false');}
b.addEventListener('click',function(e){e.stopPropagation();set(!w.classList.contains('is-open'));});
Array.prototype.forEach.call(w.querySelectorAll('[data-nav-l] a'),function(a){a.addEventListener('click',function(){set(false);});});
document.addEventListener('keydown',function(e){if(e.key==='Escape')set(false);});
document.addEventListener('click',function(e){if(!w.contains(e.target))set(false);});
});})();
<\/script>
`;

/* Swaps a facade for the real player on click. Emitted only when a page has one. */
const FACADE_JS = `<script>
(function(){Array.prototype.forEach.call(document.querySelectorAll('[data-facade] .pagecraft-video-play'),function(b){
b.addEventListener('click',function(){
var f=document.createElement('iframe');
f.src=b.getAttribute('data-embed')+(b.getAttribute('data-embed').indexOf('?')<0?'?':'&')+'autoplay=1';
f.title='Video';f.allow='accelerometer;autoplay;clipboard-write;encrypted-media;picture-in-picture';
f.setAttribute('allowfullscreen','');b.parentNode.replaceChild(f,b);
});});})();
<\/script>
`;

/* Emitted only onto pages with a Gallery whose lightbox is on. Every tile is
   already a working link to the full image, so this script never adds a
   capability — it upgrades a navigation into an overlay, and steps aside for a
   modified click or a browser with no <dialog>. */
const LB_JS = `<script>
(function(){
var gs=document.querySelectorAll('[data-lightbox]');if(!gs.length)return;
if(typeof HTMLDialogElement!=='function')return;
var dlg=null,imgEl,capEl,prevB,nextB,list=[],at=0;
function build(){
dlg=document.createElement('dialog');dlg.className='pagecraft-lightbox';
dlg.innerHTML='<figure class="pagecraft-lightbox-fig"><img class="pagecraft-lightbox-img" src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=" alt="" hidden><p class="pagecraft-lightbox-cap"></p></figure>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-prev" type="button" aria-label="Previous image">\u2039</button>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-next" type="button" aria-label="Next image">\u203a</button>'
+'<button class="pagecraft-lightbox-btn pagecraft-lightbox-close" type="button" aria-label="Close">\u00d7</button>';
document.body.appendChild(dlg);
imgEl=dlg.querySelector('.pagecraft-lightbox-img');capEl=dlg.querySelector('.pagecraft-lightbox-cap');
prevB=dlg.querySelector('.pagecraft-lightbox-prev');nextB=dlg.querySelector('.pagecraft-lightbox-next');
prevB.addEventListener('click',function(){go(-1);});
nextB.addEventListener('click',function(){go(1);});
dlg.querySelector('.pagecraft-lightbox-close').addEventListener('click',function(){dlg.close();});
dlg.addEventListener('click',function(e){if(e.target===dlg)dlg.close();});
dlg.addEventListener('keydown',function(e){
if(e.key==='ArrowLeft'){e.preventDefault();go(-1);}
if(e.key==='ArrowRight'){e.preventDefault();go(1);}
});
}
function show(){var it=list[at];imgEl.src=it.href;imgEl.alt=it.alt;imgEl.hidden=false;
capEl.textContent=it.cap;capEl.hidden=!it.cap;
prevB.hidden=nextB.hidden=list.length<2;}
function go(d){at=(at+d+list.length)%list.length;show();}
Array.prototype.forEach.call(gs,function(g){
var links=g.querySelectorAll('.pagecraft-gallery-frame[href]');
Array.prototype.forEach.call(links,function(a,i){
a.addEventListener('click',function(e){
if(e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
e.preventDefault();
if(!dlg)build();
list=Array.prototype.map.call(links,function(x){
var fg=x.parentNode,c=fg&&fg.querySelector('.pagecraft-gallery-caption'),im=x.querySelector('img');
return {href:x.getAttribute('href'),alt:im?im.getAttribute('alt')||'':'',cap:c?c.textContent:''};
});
at=i;show();dlg.showModal();
});
});
});
})();
<\/script>
`;

const tidy = (css: string) => css.replace(/\}/g, '}\n').replace(/\n{2,}/g, '\n').replace(/^\s+|\s+$/g, '');

/* `ctx` carries the item a detail page stands for, and `rel` — how far this file
   sits from the root. Both reach every link and every asset path through the
   render options, so the header and footer come out right on a nested page too. */
/* ---- structured data ---------------------------------------------------
   JSON-LD, so a search engine can tell a project page from an article without
   guessing at the markup. Two functions on purpose: `jsonLdGraph` returns the object,
   which is what the tests read, and `jsonLd` wraps it in the script tag. Asserting
   against a graph is worth more than asserting against a string. */

/** Absolute URLs are not optional in structured data — a relative `url` is worse than
    no `url`, because a consumer resolves it against its own host. Same rule the
    canonical tag and the sitemap already follow: no Site URL, no output. */
function jsonLdGraph(pg: Page, ctx: { col?: Collection | null; item?: Item | null; pageNo?: number } = {}) {
  const m = state.meta;
  const base = String(m.baseUrl || '').replace(/\/+$/, '');
  if (!base) return null;

  const abs = (u: string) => !u ? '' : (/^https?:/i.test(u) ? u : base + '/' + String(u).replace(/^\/+/, ''));
  /* A paginated page is a distinct exported document. Its canonical and Open Graph URL
     already use `pagedPath`; structured data must name that same document rather than
     claiming every slice is page one. Detail-page slugs continue through the same path
     helper, so nested Articles retain their exact export URL. */
  const url = `${base}/${pagedPath(pg.slug, ctx.pageNo || 1)}`;
  const org = `${base}/#org`;
  const site = `${base}/#site`;
  const image = abs(pg.ogImage || m.ogImage || '');

  /* `logo` is left out deliberately. Organization.logo means the brand's logo, and this
     project stores a favicon and a social share image — neither is declared to be one.
     Emitting a share image as a logo is a guess a consumer would act on. */
  const graph: Record<string, unknown>[] = [
    { '@type': 'Organization', '@id': org, name: m.name, url: base + '/' },
    { '@type': 'WebSite', '@id': site, name: m.name, url: base + '/', publisher: { '@id': org } }
  ];

  /* A detail page is one item of a collection, so it is an Article rather than a page
     that happens to be about something. */
  /* A BreadcrumbList only when the page shows one, and built from the same trail the
     widget renders — a claimed trail that is not on the page is worth less than none. */
  if (crumbsShown([state.header, pg.tree, state.footer])) {
    const trail = crumbTrail(pg, ctx);
    if (trail.length > 1) graph.push({
      '@type': 'BreadcrumbList',
      '@id': url + '#crumbs',
      itemListElement: trail.map((c, i) => {
        const el: Record<string, unknown> = { '@type': 'ListItem', position: i + 1, name: c.label };
        if (c.href) el.item = base + '/' + String(c.href).replace(/^\/+/, '');
        return el;
      })
    });
  }

  const isItem = !!(ctx.item && ctx.col);
  const node: Record<string, unknown> = isItem
    ? { '@type': 'Article', '@id': url + '#article', headline: pg.title || pg.name, url }
    : { '@type': 'WebPage', '@id': url, name: pg.title || pg.name, url };

  if (pg.desc) node.description = pg.desc;
  if (image) node.image = image;
  node.isPartOf = { '@id': site };
  if (isItem) node.publisher = { '@id': org };
  graph.push(node);

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** The graph as a script tag. `<` is escaped so a value containing `</script>` cannot
    close the block early — the one injection route a JSON island has. */
function jsonLd(pg: Page, ctx: { col?: Collection | null; item?: Item | null; pageNo?: number } = {}) {
  const g = jsonLdGraph(pg, ctx);
  if (!g) return '';
  const json = JSON.stringify(g, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>\n`;
}

/* Compiler-owned comments identify the actual global trees independently of the semantic
   tag a user chooses for a top-level Section. Connected publication rejects these reserved
   bytes when they originate in the document, so custom markup cannot counterfeit a boundary. */
/* Construct the delimiters at runtime so the single-file builder's own inline script never
   contains an HTML comment opener. A literal opener changes the browser tokenizer state and
   can make a later script close parse as text; `boot.test.mjs` enforces this source boundary. */
const HTML_COMMENT_OPEN = String.fromCharCode(60, 33, 45, 45);
const HTML_COMMENT_CLOSE = String.fromCharCode(45, 45, 62);
const SHARED_HEADER_START = HTML_COMMENT_OPEN + 'PAGECRAFT_SHARED_HEADER_START' + HTML_COMMENT_CLOSE;
const SHARED_HEADER_END = HTML_COMMENT_OPEN + 'PAGECRAFT_SHARED_HEADER_END' + HTML_COMMENT_CLOSE;
const SHARED_FOOTER_START = HTML_COMMENT_OPEN + 'PAGECRAFT_SHARED_FOOTER_START' + HTML_COMMENT_CLOSE;
const SHARED_FOOTER_END = HTML_COMMENT_OPEN + 'PAGECRAFT_SHARED_FOOTER_END' + HTML_COMMENT_CLOSE;

function buildPage(pg: Page, ctx: {
  col?: Collection | null; item?: Item | null; rel?: string; variants?: boolean;
  pageNo?: number; pages?: number;
  /** `@font-face` rules to ship instead of the Google stylesheet link. Empty means link it,
      which is what a single self-contained file has to do — it has nowhere to put the files. */
  fontCss?: string;
} = {}) {
  const m = state.meta;
  /* `variants` has to be carried through rather than defaulted here: only the caller knows
     whether the export it is running writes separate files, and it is the one flag on this
     object that the renderer cannot infer for itself. */
  /* `pg` is passed rather than inferred: a paginator names its own neighbouring files from
     the page's slug, and the export renders pages other than the one being edited. */
  const o = {
    edit: false, col: ctx.col || null, item: ctx.item || null, rel: ctx.rel || '',
    variants: !!ctx.variants, pageNo: ctx.pageNo || 1, pages: ctx.pages || 1, pg
  };
  const css = treeCss([state.header, pg.tree, state.footer], false);
  /* per page, not per project: two pages of a site can differ, and 34 KB is most of the weight
     of a page that has nothing moving on it */
  const moves = animUsed([state.header, pg.tree, state.footer]);
  /* The node tree, not a regex over rendered bytes, defines the document landmarks. Every
     page tree is wrapped in one Pagecraft-owned main; global regions stay outside. Any main
     authored inside those fragments is demoted by a raw-text-aware scanner before nesting,
     which prevents sibling content and multiple landmarks without treating script/embed text
     as structure. */
  const allNodes = [...state.header, ...pg.tree, ...state.footer];
  const occupied = new Set<string>();
  eachNode(allNodes, n => occupied.add(domIdOf(n)));
  let mainId = 'pagecraft-main';
  while (occupied.has(mainId)) mainId += '-content';
  const header = demoteMainTags(renderList(state.header, o));
  const pageBody = demoteMainTags(renderList(pg.tree, o));
  const footer = demoteMainTags(renderList(state.footer, o));
  const main = `<main id="${mainId}" class="pagecraft-main">${pageBody}</main>`;
  const body = SHARED_HEADER_START + header + SHARED_HEADER_END
    + main
    + SHARED_FOOTER_START + footer + SHARED_FOOTER_END;
  const title = pg.title || `${pg.name} — ${m.name}`;
  const base = String(m.baseUrl || '').replace(/\/+$/, '');
  const abs = (u: string) => !u ? '' : (/^https?:/i.test(u) ? u : (base ? base + '/' + String(u).replace(/^\/+/, '') : u));
  /* a 404 has no canonical URL — it is not a page that exists — and asks not to be indexed */
  const canon = (base && !isNotFound(pg)) ? `${base}/${pagedPath(pg.slug, o.pageNo)}` : '';
  const ogImg = abs(pg.ogImage || m.ogImage || '');
  return `<!doctype html>
<html lang="${esc(m.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${pg.desc ? `<meta name="description" content="${esc(pg.desc)}">\n` : ''}${canon ? `<link rel="canonical" href="${esc(canon)}">\n` : ''}${m.favicon ? `<link rel="icon" href="${esc(pageHref(m.favicon, o))}">\n` : ''}${ctx.fontCss ? `<style>\n${ctx.fontCss}\n</style>\n` : gfontsLink()}<meta property="og:type" content="${ctx.item && ctx.col ? 'article' : 'website'}">
<meta property="og:title" content="${esc(title)}">
${pg.desc ? `<meta property="og:description" content="${esc(pg.desc)}">\n` : ''}${canon ? `<meta property="og:url" content="${esc(canon)}">\n` : ''}${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}${jsonLd(pg, { col: o.col, item: o.item, pageNo: o.pageNo })}<style>
${tidy(css)}${moves ? `\n${ANIM_CSS}\n${ANIM_CALM}` : ''}
</style>
${isNotFound(pg) ? '<meta name="robots" content="noindex">\n' : ''}${demoteMainTags(m.headHtml || '')}${demoteMainTags(pg.headHtml || '')}
</head>
<body>
<a class="pagecraft-skip" href="#${mainId}">Skip to content</a>
${body}
${/data-slider/.test(body) ? SLIDE_JS : ''}${/data-copy/.test(body) ? CODE_JS : ''}${/data-tabs/.test(body) ? TABS_JS : ''}${/data-nav/.test(body) ? NAV_JS : ''}${/data-facade/.test(body) ? FACADE_JS : ''}${/data-lightbox/.test(body) ? LB_JS : ''}${moves ? `<script>\n${ANIM_JS}\n</script>\n` : ''}</body>
</html>
`;
}


export {
  esc, safeUrl, buildWordPressContentReference, parseWordPressContentReference, wordpressContentToken, parseWordPressContentToken, uid, clone, slugify, dbounce, DEF, TRANSITIONS, styleSeen, canDo, hasBackdrop, hasBorder, IC, ICONS, ICON_PATHS, ICON_NAMES, iconSvg, COMMON_STYLE, GF, stackFor, familyOf, isGoogle, usedFamilies, gfontsHref, gfontsLink, FONT_SUBSETS, parseFontCss, fontFaceCss, fontFile, fontGroups, FONT_BASE, LAYOUTS, COUNTS, DEFAULT_COLS, BASE, makeFor, labelOf, iconOf, rowRatios, matchLayout, N, cols, BOX, state, doc, page, tree, dk, DEV_KEY, DEV_LABEL, DEV_W, canvasWidth, fitZoom, ZOOMS, zoomFor, locate, locateAny, eachNode, nameOf, lvl, holds, fitsIn, wrap, insert, moveNode, reid, pageMove, pageDup, pageDelete, dupNode, delNode, applyCols, seed, blankProject, MIN_COL, BP_CHAIN, rowRatiosAt, resizeCols, applyColsAt, selIds, selNodes, multiOn, selSet, selToggle, selOrder, selRange, topMost, dupMany, delMany, moveMany, layerTarget, menuFor, ADV_SHARED, ctlKeys, fanTargets, RESERVED, TYPO_KEYS, TS_TYPES, tokenId, cvar, isRef, refId, colors, styles, classes, findColor, findStyle, findClass, nodeClasses, classAdd, classApply, classRemove, classFrom, classUsage, classDelete, classMove, parseU, cssVal, setCss, STATES, stRead, stWrite, tgtObj, tgtIsClass, propVal, VAL, linkOf, kb, resolveColor, defaultTokens, ensureTokens, initUi, tokenVars, tokenCss, stripTypo, grabTypo, tsApply, tsUnlink, tsUpdateFrom, tsCreateFrom, tsUsage, styleAdd, styleDelete, U, colorDelete, colorAdd, colorUsage, clip, copyNode, pasteNode, dropTree, styleClip, copyStyles, pasteStyles, pasteStylesMany, TEXT_SLOTS, SLOT_LABEL, PAGE_TEXT, contentKeys, textSlots, slotGet, slotSet, slotName, outsideTags, searchText, slotHits, snippet, searchAll, searchCount, replaceAll, blocks, findBlock, blockRootType, blockSave, blockInsert, blockDelete, components, findComponent, findProp, instValue, instSet, slotsOf, slotMark, slotKids, variantsOf, findVariant, instOwn, variantSet, variantFromInstance, variantUsage, variantDelete, variantRename, instControls, contentControls, contentKeysOf, CONTENT_PROP, propFromControl, PROP_KIND, componentFromNode, instanceInsert, instances, componentUsage, propAdd, propDelete, propRename, propMove, componentDelete, componentRename, componentOpen, componentClose, FIELD_TYPES, collections, findCollection, findField, findItem, uniqueId, collectionAdd, collectionDelete, collectionRename, fieldAdd, fieldDelete, fieldMove, titleField, itemTitle, itemSlug, REF_DEPTH, fieldPaths, published, FILTER_OPS, matches, itemAdd, itemDelete, itemMove, itemSet, itemSetSlug, itemDraft, listItems, pageHref, exportTargets, contentJson, contentImport, sitePlan, bindableKeys, COLL_CTL, bindGet, bindSet, bindField, boundField, COND_OPS, condValue, showsNode, condSet, srcSet, bindScope, BIND_CTL, bindSlots, guessBindings, applyBindings, previewIndex, previewItem, fieldValue, boundProps, TEMPLATES, templatePreview, pageFromTemplate, PATTERNS, patternInsert, flatten, step, smartTarget, crc32, CRC_T, applyOne, applyC, parentOf, firstChildOf, nudge, nudgeMany, atEdge, sendEdge, HOOKS, hist, edit, restore, undo, redo, LANGS, anchorsOf, parseLink, buildLink, pagedPath, pagedRel, listPageCount, paginatorOf, pageAt, ANIM_NAMES, ANIM_PFX, ANIM_SHA, animOf, animAttrs, animUsed, relink, pageSlugSet, FRONT, isFront, pageFront, NOT_FOUND, isNotFound, lint, gridTracks, lintCounts, sitemapXml, robotsTxt, jsonLd, jsonLdGraph, contrast, hex2rgb, parseColor, fmtColor, rgb2hsv, hsv2rgb, effective, chainTo, effectiveAt, SRCSET_W, imageWidths, sizesFor, A_RE, assetFile, assetPaths, ASSET_SLOTS, SCHEMA, migrate, PH, MQ, decl, selOf, PFX, widgetSlug, nodeClass, autoId, domIdOf, bucket, nodeCss, treeCss, wordpressStyles, baseCss, navCollapse, pager, TABS_JS, SLIDE_JS, CODE_JS, CODE_LANGS, codeSpans, tableGrid, collectionIndex, crumbTrail, crumbsShown, vid, vidSrc, vidPoster, embedUrl, canFacade, SEC_TAGS, FACADE_JS, LB_JS, para, stripScripts, renderNode, renderList, tidy, NAV_JS, SHARED_HEADER_START, SHARED_HEADER_END, SHARED_FOOTER_START, SHARED_FOOTER_END, buildPage
};
