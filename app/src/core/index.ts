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
  Collection, Field, FieldType, Item, Page, StyleClass,
  Finding, RenderOpts, MenuItem, Slot, SlotHit, Control
} from './types';
import { IC, svg, ICONS, ICON_PATHS, ICON_NAMES, iconSvg } from './icons';

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
  if (/^data:image\//i.test(v) || /^asset:[a-z0-9]+$/i.test(v)) return v;
  if (/^[\w.-]+(\/|\?|#|$)/.test(v)) return v;            // page.html, example.com/x
  return '';
};
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
const slugify = (s: unknown) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';


const dbounce = (fn: (...a: any[]) => void, ms: number) => { let t: any; return (...a: any[]) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };


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
  allTrees().forEach(l => eachNode(l, n => scan(n.css)));
  return GF.map(([fam]) => fam).filter(f => seen.has(f));
}
/* one stylesheet request for every family in use */
function gfontsHref() {
  const fams = usedFamilies();
  if (!fams.length) return '';
  const q = fams.map(f => `family=${f.replace(/ /g, '+')}:wght@${gfIndex[f.toLowerCase()].w}`).join('&');
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}
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
function fontGroups() {
  const groups = [['Standard', FONT_BASE]];
  ['s', 'f', 'd', 'm'].forEach(cat => {
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

const DEF: Record<string, WidgetDef> = {

  section: {
    label: 'Section', icon: 'section', level: 1, accepts: [2],
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
    label: 'Row', icon: 'row', level: 2, accepts: [3],
    make: () => ({ props: {}, css: { d: { gap: '24px', 'align-items': 'stretch', 'justify-content': 'flex-start' }, t: {}, m: { gap: '20px' } } }),
    controls: {
      content: [
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space },
        { t: 'pick', c: 'align-items', label: 'Vertical align', r: 1, opts: [['flex-start', 'vTop'], ['center', 'vMid'], ['flex-end', 'vBot'], ['stretch', 'Fill']] },
        { t: 'select', c: 'justify-content', label: 'Horizontal distribute', r: 1, opts: [['flex-start', 'Start'], ['center', 'Center'], ['flex-end', 'End'], ['space-between', 'Space between'], ['space-around', 'Space around']] },
        { t: 'select', c: 'flex-wrap', label: 'Wrap', r: 1, opts: [['wrap', 'Wrap'], ['nowrap', 'No wrap']] },
        { t: 'cols', label: 'Columns' }
      ],
      style: []
    }
  },

  /* A Collection List is a Row whose contents repeat — put one Column inside and
     you get a grid of cards. The collection lives on `node.src`, the same field
     phase 2 uses, so anything inside binds with no extra plumbing. */
  list: {
    label: 'Collection list', icon: 'cms', level: 2, accepts: [3],
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
        { t: 'unit', k: 'limit', label: 'Show at most', units: [''], ph: 'all' },
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space },
        { t: 'pick', c: 'align-items', label: 'Vertical align', r: 1, opts: [['flex-start', 'vTop'], ['center', 'vMid'], ['flex-end', 'vBot'], ['stretch', 'Fill']] },
        { t: 'select', c: 'flex-wrap', label: 'Wrap', r: 1, opts: [['wrap', 'Wrap'], ['nowrap', 'No wrap']] }
      ],
      style: []
    }
  },

  column: {
    label: 'Column', icon: 'column', level: 3, accepts: [2, 4],
    make: () => ({ props: {}, css: { d: { 'flex-grow': '100', 'justify-content': 'flex-start', 'align-items': 'stretch', gap: '16px' }, t: {}, m: { 'flex-basis': '100%' } } }),
    controls: {
      content: [
        { t: 'slider', c: 'flex-grow', label: 'Width (share)', r: 1, min: 5, max: 100, step: .01, raw: 1 },
        { t: 'unit', c: 'flex-basis', label: 'Min basis', r: 1, units: ['%', 'px', 'rem'], note: 'Set 100% to force a full-width stack.' },
        { t: 'pick', c: 'justify-content', label: 'Vertical align', r: 1, opts: [['flex-start', 'vTop'], ['center', 'vMid'], ['flex-end', 'vBot']] },
        { t: 'pick', c: 'align-items', label: 'Horizontal align', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR'], ['stretch', 'Fill']] },
        { t: 'unit', c: 'gap', label: 'Gap', r: 1, units: U.space }
      ],
      style: []
    }
  },

  heading: {
    label: 'Heading', icon: 'heading', level: 4, edit: 'text',
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
    label: 'WYSIWYG', icon: 'text', level: 4, edit: 'rich',
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

  image: {
    label: 'Image', icon: 'image', level: 4,
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
        { t: 'dims', label: 'Intrinsic size', note: 'Exported as width/height so the page does not shift while loading.' },
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
        { t: 'pick', c: 'align-self', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR'], ['stretch', 'Fill']] }
      ],
      style: [
        { t: 'color', c: 'background-color', label: 'Background' },
        { t: 'color', c: 'color', label: 'Text colour' },
        { t: 'color', c: '--hover-bg', label: 'Hover background' },
        { t: 'color', c: '--hover-fg', label: 'Hover text' },
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
    make: () => ({
      props: {
        items: [{ label: 'Work', href: '#work' }, { label: 'Pricing', href: 'pricing.html' }, { label: 'Contact', href: '#contact' }],
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
    make: () => ({
      props: {
        action: '', method: 'post', submit: 'Send', aria: 'Contact form',
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
        { t: 'text', k: 'action', label: 'Where submissions go', ph: 'https://formspree.io/f/…', note: 'A static page cannot receive a POST itself. Paste the endpoint from a form service, or a mailto: address.' },
        { t: 'select', k: 'method', label: 'Method', opts: [['post', 'POST'], ['get', 'GET']] },
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
    make: () => ({ props: {}, css: { d: { height: '48px' }, t: {}, m: { height: '32px' } } }),
    controls: { content: [{ t: 'unit', c: 'height', label: 'Height', r: 1, units: U.len }], style: [] }
  },

  divider: {
    label: 'Divider', icon: 'divider', level: 4,
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
  accordion: {
    label: 'Accordion', icon: 'accordion', level: 4,
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
        { t: 'qa', k: 'items', label: 'Questions' },
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
    make: () => ({ props: { html: '', ratio: '' }, css: { d: { width: '100%' }, t: {}, m: {} } }),
    controls: {
      content: [
        {
          t: 'area', k: 'html', label: 'HTML', rows: 8, mono: 1, ph: '<iframe src="…" …></iframe>',
          note: 'Pasted straight into the page. Scripts run on the exported site but not in this canvas — an embed that needs one shows a placeholder here.'
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
          note: 'Named, a screen reader reads it. Empty, it is hidden — right for an icon beside text that already says it.'
        },
        { t: 'link', k: 'link', label: 'Link' },
        { t: 'pick', c: 'align-self', label: 'Alignment', r: 1, opts: [['flex-start', 'alignL'], ['center', 'alignC'], ['flex-end', 'alignR']] }
      ],
      style: [
        { t: 'unit', c: '--icon-size', label: 'Size', r: 1, units: U.size },
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
const COMMON_STYLE = [
  { g: 'Spacing', items: [{ t: 'box', c: 'padding', label: 'Padding', r: 1 }, { t: 'box', c: 'margin', label: 'Margin', r: 1, neg: 1 }] },
  {
    g: 'Background', items: [
      { t: 'color', c: 'background-color', label: 'Colour' },
      { t: 'img', c: 'background-image', label: 'Image', bg: 1 },
      { t: 'select', c: 'background-size', label: 'Size', opts: [['cover', 'Cover'], ['contain', 'Contain'], ['auto', 'Auto']] },
      { t: 'select', c: 'background-position', label: 'Position', opts: [['center center', 'Center'], ['top center', 'Top'], ['bottom center', 'Bottom'], ['left center', 'Left'], ['right center', 'Right']] },
      { t: 'select', c: 'background-repeat', label: 'Repeat', opts: [['no-repeat', 'No repeat'], ['repeat', 'Repeat']] },
      { t: 'text', c: 'background', label: 'Gradient / shorthand', ph: 'linear-gradient(...)' }
    ]
  },
  {
    g: 'Border & shadow', items: [
      { t: 'unit', c: 'border-width', label: 'Border width', units: U.border },
      { t: 'select', c: 'border-style', label: 'Border style', opts: [['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['none', 'None']] },
      { t: 'color', c: 'border-color', label: 'Border colour' },
      { t: 'unit', c: 'border-radius', label: 'Radius', r: 1, units: U.radius },
      { t: 'opt', c: 'box-shadow', label: 'Shadow', opts: SHADOWS, ph: '0 20px 40px -12px rgba(17,19,17,.2)' }
    ]
  },
  {
    g: 'Effects', items: [
      { t: 'slider', c: 'opacity', label: 'Opacity', min: 0, max: 1, step: .01, raw: 1 },
      { t: 'text', c: 'transform', label: 'Transform', ph: 'translateY(-4px) rotate(2deg)' },
      { t: 'opt', c: 'transition', label: 'Transition', opts: TRANSITIONS, ph: 'all .25s ease' }
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
    open: {}, collapsed: {}, custom: {}, zoom: 'fit'
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

const doc = () => ({ meta: state.meta, header: state.header, footer: state.footer, pages: state.pages });
const page = () => state.pages[state.cur] || state.pages[0];
const tree = () => state.ui.mode === 'header' ? state.header : state.ui.mode === 'footer' ? state.footer : page().tree;
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
  const d = DEF[n.type];
  if (n.type === 'heading') return (n.props.text || '').slice(0, 26) || d.label;
  if (n.type === 'button') return n.props.text || d.label;
  if (n.type === 'text') return (n.props.html || '').replace(/<[^>]*>/g, ' ').trim().slice(0, 24) || d.label;
  if (n.type === 'row') return `Row · ${n.children.length} col`;
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
  state.ui.sel = live.length ? live[0] : null;
  state.ui.multi = live.slice(1);
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

/* Builds the wrapper chain needed to legally place `type` inside a parent
   of level `pl`, e.g. a Heading (4) dropped on the root (0) becomes
   Section > Row > Column > Heading. */
function wrap(type: string, pl: number, node: any): any {
  let out = node;
  for (let l = lvl(type) - 1; l > pl; l--) out = N(CHAIN[l], {}, {}, [out]);
  return out;
}
/* Can a node of type `t` live inside a parent of type `pt`? Anything deeper in
   the hierarchy can, plus the one special case of a row nested in a column.
   `t` may be a palette key (e.g. `columns`), so normalise it first. */
const holds = (pt: any, t: string) => {
  const b = BASE[t] || t;
  return (lvl(b) > lvl(pt)) || (pt === 'column' && b === 'row');
};

function insert(type: string, parentNode: any, index: number) {
  const leaf = makeFor(type);
  const pl = parentNode ? lvl(parentNode.type) : 0;
  const packed = (parentNode && parentNode.type === 'column' && lvl(type) === 2) ? leaf : wrap(type, pl, leaf);
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
  const pl = parentNode ? lvl(parentNode.type) : 0;
  const packed = (parentNode && parentNode.type === 'column' && h.node.type === 'row') ? h.node : wrap(h.node.type, pl, h.node);
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

  out.push({ act: 'hide', label: (hidden ? 'Show on ' : 'Hide on ') + dev });
  if (!many) out.push({ act: 'block', label: 'Save as a block' });
  if (!many && n.adv && n.adv.block && findBlock(n.adv.block)) out.push({ act: 'push', label: 'Push to the other copies' });
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
  const canHold = (pt: string | null, t: string) => (pt === null ? lvl(BASE[t] || t) === 1 : holds(pt, t));
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
const TS_TYPES = ['heading', 'text', 'button'];    // elements that can carry a text style

const tokenId = (s: unknown) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
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
const findColor = (id: string) => colors().find(c => c.id === id) || null;
const findStyle = (id: string) => styles().find(t => t.id === id) || null;
const findClass = (id: string) => classes().find(c => c.id === id) || null;
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
function tsCreateFrom(n: PcNode, name: string) {
  const base = tokenId(name) || 'style';
  let id = base, k = 2;
  while (findStyle(id)) id = base + '-' + k++;
  ensureTokens().text.push({ id, name: String(name || 'New style').slice(0, 40), css: grabTypo(n) });
  stripTypo(n);
  n.props.ts = id;
  return id;
}
const allTrees = () => [state.header, state.footer, ...state.pages.map(p => p.tree)];

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
function parseLink(href: string, hereSlug: string) {
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
function cssVal(n: { css: Css }, c: string, resp?: boolean): { v: string; own: boolean } {
  const b: Bp = resp ? dk() : 'd';
  const own = n.css[b] ? n.css[b][c] : undefined;
  if (own !== undefined && own !== '') return { v: own, own: true };
  if (b === 'm' && n.css.t && n.css.t[c]) return { v: n.css.t[c], own: false };
  const d = n.css.d ? n.css.d[c] : '';
  return { v: d == null ? '' : d, own: false };
}

/** Write one CSS property at the breakpoint being edited. An empty value deletes the
    declaration rather than storing `""`, so the value below it in the cascade shows
    through — which is what clearing a field is supposed to do. */
function setCss(n: { css: Css }, c: string, val: string | null | undefined, resp?: boolean) {
  const b: Bp = resp ? dk() : 'd';
  n.css[b] = n.css[b] || {};
  if (val === '' || val == null) delete n.css[b][c]; else n.css[b][c] = val;
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

const propVal = (n: PcNode, k?: string) => (k == null ? undefined : n.props[k]);

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
const hex2rgb = (v: string) => {
  let h = String(v || '').trim();
  const m3 = h.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m3) h = '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
  const m = h.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  const rgb = h.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
  return null;
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

    const visit = (list: PcNode[], chain: PcNode[], region: string): void => list.forEach((n: PcNode) => {
      const w = { ...scope, region, node: DEF[n.type].label };
      const anchor = n.adv && n.adv.htmlId;
      if (anchor) { if (seenIds.has(anchor)) dupIds.add(anchor); seenIds.add(anchor); }

      /* links */
      const links: any[] = [];
      if (n.type === 'nav') ((n.props.items as any[]) || []).forEach((it: any) => links.push(it.href));
      if (n.props.link !== undefined) links.push(n.props.link);
      if (n.type === 'text') [...String(n.props.html || '').matchAll(/href="([^"]*)"/g)].forEach(m => links.push(m[1]));
      links.filter(h => h !== undefined && h !== null).forEach(href => {
        const h = String(href).trim();
        if (!h) return;
        if (h === '#') { add('warn', 'empty-anchor', `A link in the ${region} points at “#”, which goes nowhere.`, w, n.id); return; }
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
        if (path === '' && region !== 'page') {
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
        if (!(n.props.w && n.props.h))
          add('warn', 'no-dimensions', `An image in the ${region} has no width/height, so the page will shift as it loads.`, w, n.id);
      }
      /* video */
      if (n.type === 'video' && !canFacade(n.props) && ['youtube', 'vimeo'].includes(vidSrc(n.props).kind) && !n.props.autoplay)
        add('warn', 'eager-video', `A video in the ${region} loads its player on page load. Turn on “Load on click” to defer it.`, w, n.id);

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
        const slots = (Array.isArray(n.props.items) ? n.props.items : []).filter(Boolean);
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
      if (n.type === 'heading' && HEADING_TAGS.test(n.props.level))
        headings.push({ level: +n.props.level[1], node: n, region });

      /* forms */
      if (n.type === 'form') {
        const fields = Array.isArray(n.props.fields) ? n.props.fields : [];
        if (!String(n.props.action || '').trim())
          add('error', 'form-no-action', `A form in the ${region} has nowhere to send submissions, so it will silently do nothing. Paste an endpoint from a form service, or a mailto: address.`, w, n.id);
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
const styleClip: { css: Css | null; cls: string[] | null; ts: string; adv: string; from: string } =
  { css: null, cls: null, ts: '', adv: '', from: '' };

function copyStyles(id: string) {
  const h = locate(id);
  if (!h) return false;
  const n = h.node;
  styleClip.css = clone(n.css);
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
  image: ['alt', 'caption'],
  accordion: [['items', 'q', 'a']],
  gallery: [['items', 'alt', 'caption']],
  nav: [['items', 'label']],
  form: [['fields', 'label', 'ph']]
};
/* the fields on a page itself, rather than on anything in it */
const PAGE_TEXT = [['title', 'Browser title'], ['desc', 'Meta description'], ['name', 'Page name']];
const SLOT_LABEL = {
  text: 'Text', html: 'Rich text', label: 'Label', alt: 'Alt text', caption: 'Caption',
  q: 'Question', a: 'Answer', ph: 'Placeholder'
};

function textSlots(n: PcNode) {
  const out: any[] = [];
  for (const spec of ((TEXT_SLOTS as Record<string, any[]>)[n.type] || [])) {
    if (typeof spec === 'string') {
      if (typeof n.props[spec] === 'string') out.push({ prop: spec, i: -1, sub: '' });
    } else {
      const [arr, ...subs] = spec;
      const list = Array.isArray(n.props[arr]) ? n.props[arr] : [];
      list.forEach((row: any, i: number) => subs.forEach((sub: string) => {
        if (row && typeof row[sub] === 'string') out.push({ prop: arr, i, sub });
      }));
    }
  }
  return out;
}
const slotGet = (n: PcNode, s: Slot): any => (s.i < 0 ? n.props[s.prop] : n.props[s.prop][s.i][s.sub]);
const slotSet = (n: PcNode, s: Slot, v: string) => { if (s.i < 0) n.props[s.prop] = v; else n.props[s.prop][s.i][s.sub] = v; };
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
    const pl = parentType === null ? 0 : lvl(parentType);
    const nested = parentType === 'column' && lvl(fresh.type) === 2;
    if (lvl(fresh.type) <= pl && !nested) return false;
    list.splice(index, 0, nested ? fresh : wrap(fresh.type, pl, fresh));
    return true;
  };
  const h = intoId ? locate(intoId) : null;
  if (!h) return place(tree(), tree().length, null) ? fresh : null;
  if (place(h.node.children, h.node.children.length, h.node.type)) return fresh;
  if (place(h.list, h.i + 1, h.parent ? h.parent.type : null)) return fresh;
  let up = h.parent;
  while (up) {
    const uh = locate(up.id);
    if (place(up.children, up.children.length, up.type)) return fresh;
    up = uh && uh.parent;
  }
  return null;
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
  else if (c.k) n.props[c.k] = v;
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
  ['number', 'Number'], ['date', 'Date'], ['option', 'Option'], ['bool', 'Yes / no']
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
  const it = { id: uid(), slug: '', values: {} };
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
function listItems(n: PcNode, col: Collection) {
  let out = (col.items || []).slice();
  const f = n.props.sort ? findField(col, n.props.sort) : null;
  if (f) out.sort((a, b) => {
    const av = a.values[f.id] ?? '', bv = b.values[f.id] ?? '';
    return f.type === 'number'
      ? (parseFloat(av) || 0) - (parseFloat(bv) || 0)
      : String(av).localeCompare(String(bv));
  });
  if (n.props.dir === 'desc') out.reverse();
  const lim = parseInt(n.props.limit, 10);
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
  v = safeUrl(v);
  if (!v || !o || !o.rel || /^([a-z][\w+.-]*:|\/\/|\/|#)/i.test(v)) return v;
  return o.rel + v;
}

/* Every file the project exports: one per ordinary page, and one per item for a
   page marked as a collection's detail template. `rel` is how far that file sits
   from the root, which is what every internal link and asset path needs. */
function exportTargets() {
  const out: any[] = [];
  for (const pg of state.pages) {
    const col = pg.collection ? findCollection(pg.collection) : null;
    if (!col) { out.push({ pg, path: pg.slug + '.html', rel: '', col: null, item: null }); continue; }
    for (const it of col.items) {
      const t = pg.bindTitle ? String(fieldValue(col, it, pg.bindTitle) || '').trim() : '';
      const d = pg.bindDesc ? String(fieldValue(col, it, pg.bindDesc) || '').trim() : '';
      out.push({
        pg: { ...pg, slug: col.slug + '/' + it.slug, title: t || pg.title, desc: d || pg.desc },
        path: col.slug + '/' + it.slug + '.html', rel: '../', col, item: it
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
      items: c.items.map(it => {
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
  /* content props only: a text style is a design choice, not content */
  return (c.content || []).filter(x => x.k && x.k !== 'ts' && !COLL_CTL.includes(x.t)).map(x => x.k);
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
        element: nameOf(n), label: c.label || c.k, current: bindGet(n, c.k)
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
    if (bindGet(h.node, prop) === (fieldId || '')) return;
    bindSet(h.node, prop, fieldId);
    n++;
  });
  return n;
}

const bindGet = (n: PcNode, key: string) => (n.bind || {})[key] || '';
function bindSet(n: PcNode, key: string, fieldId: string) {
  if (!fieldId) {
    if (n.bind) { delete n.bind[key]; if (!Object.keys(n.bind).length) delete n.bind; }
    return;
  }
  n.bind = n.bind || {};
  n.bind[key] = fieldId;
}
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
function previewItem(col: Collection | null) {
  if (!col || !col.items.length) return null;
  return col.items[Math.min(previewIndex(col.id), col.items.length - 1)];
}
const fieldValue = (col: Collection | null, item: Item | null, fid: string) => {
  if (!col || !item || !findField(col, fid)) return '';
  const v = item.values[fid];
  return v == null ? '' : v;
};
/* Props with bindings resolved. A bound value always wins, even when it is
   empty — the canvas should show what the export will, not a placeholder that
   quietly disappears at build time. Returns the identity object when nothing is
   bound, so an unbound tree costs nothing to render. */
function boundProps(n: PcNode, col: Collection | null, item: Item | null) {
  if (!n.bind || !col || !item) return n.props;
  const out = { ...n.props };
  for (const [k, fid] of Object.entries(n.bind)) out[k] = fieldValue(col, item, fid);
  return out;
}

function itemSetSlug(colId: string, iid: string, slug: string) {
  const col = findCollection(colId); if (!col) return;
  const it = findItem(col, iid); if (!it) return;
  it.slugLocked = 1;
  it.slug = uniqueId(slug || itemTitle(col, it), col.items.filter(x => x.id !== it.id).map(x => x.slug));
}
const blockRootType = (id: string) => { const b = findBlock(id); return b ? b.node.type : null; };
/* A block is saved content. A **global** block additionally tags every copy it
   places with `adv.block`, which is what lets one copy push its content back to
   the block and out to the others. Copies are still real nodes with their own ids —
   nothing about this reaches the export, which only reads `adv.htmlId/cls/css`. */
function blockSave(nodeId: string, name: string, sync?: boolean | 0 | 1) {
  const h = locate(nodeId);
  if (!h) return null;
  const base = tokenId(name) || 'block';
  let id = base, k = 2;
  while (findBlock(id)) id = base + '-' + k++;
  const node = clone(h.node);
  if (node.adv) delete node.adv.block;            // never save one instance's link into the source
  blocks().push({ id, name: String(name || nameOf(h.node)).slice(0, 40), node, sync: !!sync });
  return id;
}
/* Every placed copy of a global block, across every page and both global regions. */
function blockInstances(id: string) {
  const out: any[] = [];
  const scan = (list: PcNode[], where: string) => eachNode(list, (n: PcNode) => {
    if (n.adv && n.adv.block === id) out.push({ node: n, where });
  });
  scan(state.header, 'header');
  scan(state.footer, 'footer');
  state.pages.forEach((p, i) => scan(p.tree, 'page:' + i));
  return out;
}
const blockUsage = (id: string) => blockInstances(id).length;
/* Takes the content of one copy and makes it the block, then brings every other
   copy into line. Each keeps its own node id and its own link, so selections and
   styling hooks survive; only the content beneath is replaced. */
function blockPush(nodeId: string) {
  const h = locate(nodeId);
  if (!h || !h.node.adv || !h.node.adv.block) return 0;
  const b = findBlock(h.node.adv.block);
  if (!b) return 0;
  const source = clone(h.node);
  delete source.adv.block;
  b.node = source;
  let n = 0;
  for (const { node } of blockInstances(b.id)) {
    if (node.id === nodeId) continue;
    const copy = reid(clone(source));
    node.type = copy.type;
    node.props = copy.props;
    node.css = copy.css;
    node.cls = copy.cls;
    node.hide = copy.hide;
    node.children = copy.children;
    node.adv = { ...copy.adv, block: b.id };      // reid already surrendered the anchor
    n++;
  }
  return n;
}
function blockInsert(id: string, parentNode: PcNode | null, index: number) {
  const b = findBlock(id);
  if (!b) return null;
  const fresh = reid(clone(b.node));
  if (b.sync) { fresh.adv = fresh.adv || {}; fresh.adv.block = b.id; }
  if (parentNode === undefined) return dropTree(fresh, state.ui.sel);
  const pl = parentNode ? lvl(parentNode.type) : 0;
  const nested = parentNode && parentNode.type === 'column' && lvl(fresh.type) === 2;
  if (lvl(fresh.type) <= pl && !nested) return dropTree(fresh, parentNode ? parentNode.id : null);
  const list = parentNode ? parentNode.children : tree();
  list.splice(Math.max(0, Math.min(index, list.length)), 0, nested ? fresh : wrap(fresh.type, pl, fresh));
  return fresh;
}
const blockDelete = (id: string) => { state.meta.blocks = blocks().filter(b => b.id !== id); };

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
const SCHEMA = 7;                       // bump when the stored shape changes
function migrate(d: any) {
  if (!d || !d.pages || !d.pages.length) return null;
  const v = d.v || 1;
  if (v > SCHEMA) return null;          // written by a newer build — refuse rather than corrupt
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
  d.v = SCHEMA;
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

const PATTERNS = [
  {
    id: 'hero-split', cat: 'Hero', preview: () => PV(ph(8,12,34)+ph(8,20,26)+pl(8,30,32)+pl(8,36,24)+pg(8,44)+pb(54,10,34,38,2)),
    name: 'Split hero', desc: 'Headline and copy beside an image.',
    build: () => T_SEC({ 'background-color': cvar('bg'), 'padding-top': '104px' }, [
      cols(2, [
        [T_H('A headline with weight', 'display', { d: { 'margin-bottom': '16px' } }),
        T_T('<p>One sentence on what this is and who it is for.</p>', 'lead'),
        N('button', { text: 'Get started', ts: 'btn' }, { d: { 'background-color': cvar('brand'), color: cvar('ink'), 'align-self': 'flex-start' } })],
        [N('image', { src: '', alt: '' }, { d: { 'border-radius': '16px', height: '380px' }, m: { height: '220px' } })]
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
        T_T('<p>&ldquo;A sentence in their words that a prospect would recognise as their own problem, solved.&rdquo;</p>', 'lead',
          sized('26px', { 'line-height': '1.4', color: cvar('ink'), 'text-align': 'center', 'max-width': '34ch', 'align-self': 'center' }, '20px')),
        T_T('<p>Name, Role at Company</p>', 'small', { d: { 'text-align': 'center' } })
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
        T_T('<p>&ldquo;One sentence a prospect would recognise as their own problem, solved.&rdquo;</p>', 'body', { d: { 'margin-bottom': '14px' } }),
        T_T('<p>Name, Role at Company</p>', 'small')
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
  }
];
function patternInsert(pid: string, parentNode: PcNode | null, index: number) {
  const p = PATTERNS.find(x => x.id === pid);
  if (!p) return null;
  const node = p.build();
  if (parentNode === undefined) return dropTree(node, state.ui.sel);
  const pl = parentNode ? lvl(parentNode.type) : 0;
  if (lvl(node.type) <= pl) return dropTree(node, parentNode ? parentNode.id : null);
  const list = parentNode ? parentNode.children : tree();
  list.splice(Math.max(0, Math.min(index, list.length)), 0, wrap(node.type, pl, node));
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

const TEMPLATES = [
  {
    id: 'blank', name: 'Blank', desc: 'An empty page.',
    build: () => []
  },
  {
    id: 'landing', name: 'Landing page', desc: 'Hero, three features, closing call to action.',
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
    id: 'pricing', name: 'Pricing', desc: 'Intro and three plan columns.',
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
    id: 'contact', name: 'Contact', desc: 'Short intro beside a working form.',
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
    id: 'about', name: 'About', desc: 'The story, a stats row and a closing action.',
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
    id: 'services', name: 'Services', desc: 'What you offer, how it works, then an action.',
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
    id: 'work', name: 'Work', desc: 'A grid of projects with room for captions.',
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
    id: 'case', name: 'Case study', desc: 'One project: the brief, the work, the result.',
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
    id: 'faq', name: 'FAQ', desc: 'Questions and answers, plus a way to ask more.',
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
    id: 'blog', name: 'Blog index', desc: 'A list of posts with dates and summaries.',
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
    id: 'article', name: 'Article', desc: 'A single post at a readable measure.',
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
    id: 'soon', name: 'Coming soon', desc: 'A centred hero with a signup form.',
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
   Colours, text styles, classes and saved blocks are things you built rather than
   content, and clearing them would be destroying work to save a click.

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
function bucket(n: PcNode, b: Bp, editing: boolean) {
  const map = n.css[b] || {};
  let extra = '';
  if (n.hide && n.hide[b]) extra = editing ? 'opacity:.32;outline:1px dashed #f0a132;outline-offset:2px;' : 'display:none !important;';
  const body = decl(map) + extra;
  const rules: string[] = [];
  if (body) rules.push(`${selOf(n)}{${body}}`);
  if (n.type === 'button') {
    const hb = map['--hover-bg'], hf = map['--hover-fg'];
    if (hb || hf) rules.push(`${selOf(n)}:hover{${hb ? `background-color:${hb};` : ''}${hf ? `color:${hf};border-color:${hf};` : ''}}`);
  }
  if (n.type === 'text' && map['--link']) rules.push(`${selOf(n)} a{color:${map['--link']}}`);
  return rules.join('');
}

/* a burger menu is just "the inline list stops being inline below X" */
const navCollapse = (n: PcNode) => `${selOf(n)} .pagecraft-nav-toggle{display:flex}`
  + `${selOf(n)} .pagecraft-nav-list{display:none;position:absolute;top:calc(100% + 10px);right:0;z-index:60;`
  + `flex-direction:column;align-items:stretch;gap:2px;min-width:210px;padding:10px;`
  + `background:var(--nav-panel,#fff);border-radius:12px;box-shadow:0 20px 44px -14px rgba(15,23,42,.32)}`
  + `${selOf(n)}.is-open .pagecraft-nav-list{display:flex}`
  + `${selOf(n)} .pagecraft-nav-list a{padding:10px 12px;border-radius:7px}`;

function nodeCss(n: PcNode, editing: boolean, acc: { d: string; t: string; m: string }) {
  acc.d += bucket(n, 'd', editing);
  if (n.type === 'nav') {
    const c = n.props.collapse;
    if (c === 'tablet') acc.t += navCollapse(n);      // ≤1024 already covers mobile
    else if (c !== 'never') acc.m += navCollapse(n);
  }
  acc.t += bucket(n, 't', editing);
  acc.m += bucket(n, 'm', editing);
  if (n.adv && n.adv.css) acc.d += n.adv.css.replace(/&/g, selOf(n));
  (n.children || []).forEach(c => nodeCss(c, editing, acc));
  return acc;
}
/* one stylesheet for a set of trees: base + all desktop rules + two media blocks */
function treeCss(lists: PcNode[][], editing: boolean) {
  const acc = { d: '', t: '', m: '' };
  lists.forEach(l => l.forEach(n => nodeCss(n, editing, acc)));
  const tk = tokenCss();
  return baseCss(editing) + tk.d + acc.d
    + (tk.t || acc.t ? `${MQ.t}{${tk.t}${acc.t}}` : '')
    + (tk.m || acc.m ? `${MQ.m}{${tk.m}${acc.m}}` : '');
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
.pagecraft-section{position:relative;width:100%}
.pagecraft-container{width:100%;max-width:var(--maxw);margin-left:auto;margin-right:auto;position:relative}
.pagecraft-container.full{max-width:none}
.pagecraft-row,.pagecraft-list{display:flex;flex-wrap:wrap;width:100%}
.pagecraft-column{display:flex;flex-direction:column;min-width:0;flex-shrink:1;flex-basis:0%}
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
.pagecraft-image{display:block;width:100%}
.pagecraft-caption{font-size:.82em;opacity:.7;margin-top:.55em}
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
.pagecraft-form{display:flex;flex-direction:column;gap:var(--f-gap,16px);width:100%}
.pagecraft-field{display:flex;flex-direction:column;gap:5px}
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
  font:inherit;font-weight:600;cursor:pointer;border:0;align-self:flex-start;
  background:var(--f-btn-bg,#111);color:var(--f-btn-fg,#fff);
  border-radius:var(--f-radius,8px);padding:var(--f-pad,11px 13px);padding-left:26px;padding-right:26px;
}
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
  display:block;flex:0 0 auto;
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
[data-t=section]:hover,[data-t=row]:hover,[data-t=column]:hover{outline:1px dashed #6f7771;outline-offset:-1px}
[data-t=column]{min-height:40px}
[data-t=nav][data-sel] .pagecraft-nav-list{display:flex !important}
[data-t=nav][data-sel] .pagecraft-nav-icon{background-color:transparent}
[data-t=nav][data-sel] .pagecraft-nav-icon::before{transform:rotate(45deg)}
[data-t=nav][data-sel] .pagecraft-nav-icon::after{transform:rotate(-45deg)}
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
  transform:scale(calc(1 / var(--z,1))) translateY(-100%);transform-origin:0 100%;
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
/* Poster for a click-to-play facade. YouTube publishes a predictable still;
   Vimeo needs an API call, so it falls back to whatever the author supplied. */
function vidPoster(p: any) {
  if (p.poster) return p.poster;
  const v = vidSrc(p);
  return v.kind === 'youtube' ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : '';
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

const BICON: Record<string, string> = { arrow: IC.arrow, check: IC.check, plus: IC.plus };
const SEC_TAGS = ['section', 'div', 'header', 'footer', 'main', 'article', 'aside', 'nav'];

function renderNode(n: PcNode, o: RenderOpts): string {
  const d = DEF[n.type];
  if (!d) return '';
  const ts = n.props.ts && findStyle(n.props.ts) ? ' ts-' + n.props.ts : '';
  const managed = nodeClasses(n).map(c => ' c-' + c.id).join('');
  const cx = (c: string) => `class="${c} ${nodeClass(n)}${ts}${managed}${n.adv && n.adv.cls ? ' ' + esc(n.adv.cls) : ''}"`;
  /* The editor addresses elements by node id; the export uses the readable one.
     A repeat is the same node rendered many times, so both need a per-item suffix
     or every card in a Collection List ships the same id — invalid markup, and it
     breaks every anchor pointing into one. The item slug is the suffix because it
     is stable and it matches the detail-page URLs.
     In the editor the first repeat keeps the bare node id, so selection painting,
     the HUD and the column grips still resolve it with getElementById. */
  const rep = o.repeat && o.item ? '-' + o.item.slug : '';
  const domId = o.edit
    ? (o.repIndex ? n.id + rep : n.id)
    : esc(domIdOf(n) + rep);
  const at = `id="${domId}"${o.edit ? ` data-id="${n.id}" data-t="${n.type}"${state.ui.sel === n.id ? ' data-sel' : ''}` : ''}`;
  /* a node that declares a source opens a scope for itself and everything under
     it; `o.item` is set by a repeater, otherwise the canvas previews one */
  const sc = n.src ? findCollection(n.src) : null;
  const o2 = sc ? { ...o, col: sc, item: o.repeat && o.col === sc ? o.item : previewItem(sc) } : o;
  const kids = n.type === 'list' ? '' : (n.children || []).map(c => renderNode(c, o2)).join('');
  const p = boundProps(n, o2.col || null, o2.item || null);

  switch (n.type) {
    case 'section': {
      const tag = SEC_TAGS.includes(p.tag) ? p.tag : 'section';
      const inner = kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a Row or component here</div>` : '');
      return `<${tag} ${at} ${cx('pagecraft-section')}><div class="pagecraft-container${p.width === 'full' ? ' full' : ''}">${inner}</div></${tag}>`;
    }
    case 'row':
      return `<div ${at} ${cx('pagecraft-row')}>${kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a Column</div>` : '')}</div>`;
    case 'list': {
      const lc = n.src ? findCollection(n.src) : null;
      const kidz = n.children || [];
      if (!lc) return o.edit
        ? `<div ${at} ${cx('pagecraft-list')}><div class="s-empty">${svg('plus', 12)} Pick a collection for this list</div></div>` : '';
      if (!kidz.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-list')}><div class="s-empty">${svg('plus', 12)} Drop a Column — it becomes the card</div></div>` : '';
      const rows = listItems(n, lc);
      /* An empty collection exports nothing rather than an empty shell; the editor
         still says so, or the list would look broken. */
      if (!rows.length) return o.edit
        ? `<div ${at} ${cx('pagecraft-list')}><div class="s-empty">${esc(lc.name)} has no items yet</div></div>` : '';
      const reps = rows.map((it, k) =>
        kidz.map(c => renderNode(c, { ...o, col: lc, item: it, repeat: true, repIndex: k })).join('')).join('');
      return `<div ${at} ${cx('pagecraft-list')}>${reps}</div>`;
    }
    case 'column':
      return `<div ${at} ${cx('pagecraft-column')}>${kids || (o.edit ? `<div class="s-empty">${svg('plus', 12)} Drop a component</div>` : '')}</div>`;
    case 'heading': {
      const tg = /^(h[1-6]|p|div)$/.test(p.level) ? p.level : 'h2';
      const body = esc(p.text).replace(/\n/g, '<br>');
      const href = pageHref(p.link, o);
      const inner = href ? `<a href="${esc(href)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}>${body}</a>` : body;
      return `<${tg} ${at} ${cx('pagecraft-heading')}>${inner}</${tg}>`;
    }
    case 'text':
      return `<div ${at} ${cx('pagecraft-wysiwyg')}>${p.html || (o.edit ? '<p></p>' : '')}</div>`;
    case 'image': {
      const src = esc(p.src || PH);
      const lz = !o.edit && p.lazy ? ' loading="lazy" decoding="async"' : '';
      /* intrinsic dimensions let the browser reserve space — no layout shift */
      const dim = (p.w && p.h) ? ` width="${parseInt(p.w, 10)}" height="${parseInt(p.h, 10)}"` : '';
      const alt = ` alt="${p.decorative ? '' : esc(p.alt)}"`;
      const ihref = pageHref(p.link, o);
      if (p.caption) {
        const img = `<img src="${src}"${alt}${dim}${lz} class="pagecraft-image">`;
        return `<figure ${at} ${cx('pagecraft-figure')}>${ihref ? `<a href="${esc(ihref)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}>${img}</a>` : img}<figcaption class="pagecraft-caption">${esc(p.caption)}</figcaption></figure>`;
      }
      if (ihref) return `<a ${at} ${cx('pagecraft-figure')} href="${esc(ihref)}"${p.target ? ` target="${p.target}" rel="noopener"` : ''}><img src="${src}"${alt}${dim}${lz} class="pagecraft-image"></a>`;
      return `<img ${at} src="${src}"${alt}${dim}${lz} ${cx('pagecraft-image')}>`;
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
      const items = Array.isArray(p.items) ? p.items : [];
      const name = esc(p.aria || 'Main');
      const mid = domId + '-menu';
      return `<nav ${at} ${cx('pagecraft-nav-menu')} data-nav aria-label="${name}">`
        + `<button class="pagecraft-nav-toggle" data-nav-t type="button" aria-expanded="false" aria-controls="${mid}" aria-label="${name} menu"><span class="pagecraft-nav-icon"></span></button>`
        + `<ul class="pagecraft-nav-list" id="${mid}" data-nav-l>`
        + items.map(it => `<li><a href="${esc(pageHref(it.href, o) || '#')}">${esc(it.label || '')}</a></li>`).join('')
        + `</ul></nav>`;
    }
    case 'form': {
      const fields = Array.isArray(p.fields) ? p.fields : [];
      const fid = (i: number) => domId + '-f' + i;
      const body = fields.map((f, i) => {
        const name = esc(f.name || slugify(f.label) || 'field-' + (i + 1));
        const req = f.required ? ' required' : '';
        const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
        const lab = `<label for="${fid(i)}">${esc(f.label || name)}${f.required ? ' <span aria-hidden="true">*</span>' : ''}</label>`;
        if (f.type === 'checkbox') return `<div class="pagecraft-field pagecraft-field-check">`
          + `<input id="${fid(i)}" name="${name}" type="checkbox"${req}>`
          + `<label for="${fid(i)}">${esc(f.label || name)}</label></div>`;
        if (f.type === 'textarea') return `<div class="pagecraft-field">${lab}`
          + `<textarea id="${fid(i)}" name="${name}" rows="4"${req}${ph}></textarea></div>`;
        if (f.type === 'select') return `<div class="pagecraft-field">${lab}`
          + `<select id="${fid(i)}" name="${name}"${req}>`
          + String(f.opts || '').split(',').map(o => o.trim()).filter(Boolean)
            .map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')
          + `</select></div>`;
        return `<div class="pagecraft-field">${lab}`
          + `<input id="${fid(i)}" name="${name}" type="${esc(f.type || 'text')}"${req}${ph}></div>`;
      }).join('');
      const act = safeUrl(p.action) || (/^mailto:/i.test(String(p.action || '')) ? p.action : '');
      return `<form ${at} ${cx('pagecraft-form')} aria-label="${esc(p.aria || 'Form')}"`
        + `${act ? ` action="${esc(act)}" method="${p.method === 'get' ? 'get' : 'post'}"` : ''}>`
        + body
        + `<button type="submit" class="pagecraft-form-button">${esc(p.submit || 'Send')}</button>`
        + `</form>`;
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
      const raw = String(p.html == null ? '' : p.html);
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
      const nm = ICON_PATHS[p.name] ? p.name : 'check';
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
      const shown = (Array.isArray(p.items) ? p.items : []).filter(Boolean);
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
/* `columns` is a palette key, not a node type — it builds a row of columns */
const BASE: Record<string, string> = { columns: 'row' };
const labelOf = (k: string) => k === 'columns' ? 'Columns' : DEF[k].label;
const iconOf = (k: string) => k === 'columns' ? 'columns' : DEF[k].icon;
function makeFor(key: string) {
  if (key !== 'columns') return N(key);
  return N('row', {}, {}, LAYOUTS[DEFAULT_COLS][0].map(w =>
    N('column', {}, { d: { 'flex-grow': String(+w.toFixed(4)) } })));
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
  /* every file, which for a detail template is one per item */
  const urls = exportTargets().map(t => `${base}/${t.pg.slug}.html`);
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
dlg.innerHTML='<figure class="pagecraft-lightbox-fig"><img class="pagecraft-lightbox-img" alt=""><p class="pagecraft-lightbox-cap"></p></figure>'
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
function show(){var it=list[at];imgEl.src=it.href;imgEl.alt=it.alt;
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
function buildPage(pg: Page, ctx: { col?: Collection | null; item?: Item | null; rel?: string } = {}) {
  const m = state.meta;
  const o = { edit: false, col: ctx.col || null, item: ctx.item || null, rel: ctx.rel || '' };
  const css = treeCss([state.header, pg.tree, state.footer], false);
  const body = renderList(state.header, o) + renderList(pg.tree, o) + renderList(state.footer, o);
  const title = pg.title || `${pg.name} — ${m.name}`;
  const base = String(m.baseUrl || '').replace(/\/+$/, '');
  const abs = (u: string) => !u ? '' : (/^https?:/i.test(u) ? u : (base ? base + '/' + String(u).replace(/^\/+/, '') : u));
  const canon = base ? `${base}/${pg.slug}.html` : '';
  const ogImg = abs(pg.ogImage || m.ogImage || '');
  return `<!doctype html>
<html lang="${esc(m.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
${pg.desc ? `<meta name="description" content="${esc(pg.desc)}">\n` : ''}${canon ? `<link rel="canonical" href="${esc(canon)}">\n` : ''}${m.favicon ? `<link rel="icon" href="${esc(pageHref(m.favicon, o))}">\n` : ''}${gfontsLink()}<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
${pg.desc ? `<meta property="og:description" content="${esc(pg.desc)}">\n` : ''}${canon ? `<meta property="og:url" content="${esc(canon)}">\n` : ''}${ogImg ? `<meta property="og:image" content="${esc(ogImg)}">\n<meta name="twitter:card" content="summary_large_image">\n` : ''}<style>
${tidy(css)}
</style>
${m.headHtml || ''}
</head>
<body>
${body}
${/data-nav/.test(body) ? NAV_JS : ''}${/data-facade/.test(body) ? FACADE_JS : ''}${/data-lightbox/.test(body) ? LB_JS : ''}</body>
</html>
`;
}


export {
  esc, safeUrl, uid, clone, slugify, dbounce, DEF, IC, ICONS, ICON_PATHS, ICON_NAMES, iconSvg, COMMON_STYLE, GF, stackFor, familyOf, isGoogle, usedFamilies, gfontsHref, gfontsLink, fontGroups, FONT_BASE, LAYOUTS, COUNTS, DEFAULT_COLS, BASE, makeFor, labelOf, iconOf, rowRatios, matchLayout, N, cols, BOX, state, doc, page, tree, dk, DEV_KEY, DEV_LABEL, DEV_W, canvasWidth, fitZoom, ZOOMS, zoomFor, locate, locateAny, eachNode, nameOf, lvl, holds, wrap, insert, moveNode, reid, pageMove, pageDup, pageDelete, dupNode, delNode, applyCols, seed, blankProject, MIN_COL, BP_CHAIN, rowRatiosAt, resizeCols, applyColsAt, selIds, selNodes, multiOn, selSet, selToggle, selOrder, selRange, topMost, dupMany, delMany, moveMany, layerTarget, menuFor, ADV_SHARED, ctlKeys, fanTargets, RESERVED, TYPO_KEYS, TS_TYPES, tokenId, cvar, isRef, refId, colors, styles, classes, findColor, findStyle, findClass, nodeClasses, classAdd, classApply, classRemove, classFrom, classUsage, classDelete, classMove, parseU, cssVal, setCss, tgtObj, tgtIsClass, propVal, linkOf, kb, resolveColor, defaultTokens, ensureTokens, initUi, tokenVars, tokenCss, stripTypo, grabTypo, tsApply, tsUnlink, tsUpdateFrom, tsCreateFrom, tsUsage, styleDelete, colorDelete, colorAdd, colorUsage, clip, copyNode, pasteNode, dropTree, styleClip, copyStyles, pasteStyles, pasteStylesMany, TEXT_SLOTS, SLOT_LABEL, PAGE_TEXT, textSlots, slotGet, slotSet, slotName, outsideTags, searchText, slotHits, snippet, searchAll, searchCount, replaceAll, blocks, findBlock, blockRootType, blockSave, blockInsert, blockDelete, FIELD_TYPES, collections, findCollection, findField, findItem, uniqueId, collectionAdd, collectionDelete, collectionRename, fieldAdd, fieldDelete, fieldMove, titleField, itemTitle, itemSlug, itemAdd, itemDelete, itemMove, itemSet, itemSetSlug, listItems, pageHref, exportTargets, contentJson, sitePlan, bindableKeys, COLL_CTL, bindGet, bindSet, srcSet, bindScope, BIND_CTL, bindSlots, guessBindings, applyBindings, previewIndex, previewItem, fieldValue, boundProps, blockInstances, blockUsage, blockPush, TEMPLATES, pageFromTemplate, PATTERNS, patternInsert, flatten, step, smartTarget, crc32, CRC_T, applyOne, applyC, parentOf, firstChildOf, nudge, nudgeMany, HOOKS, hist, edit, restore, undo, redo, LANGS, anchorsOf, parseLink, buildLink, lint, lintCounts, sitemapXml, robotsTxt, contrast, hex2rgb, effective, SCHEMA, migrate, PH, MQ, decl, selOf, PFX, widgetSlug, nodeClass, autoId, domIdOf, bucket, nodeCss, treeCss, baseCss, navCollapse, vid, vidSrc, vidPoster, embedUrl, canFacade, SEC_TAGS, FACADE_JS, LB_JS, para, stripScripts, renderNode, renderList, tidy, NAV_JS, buildPage
};
