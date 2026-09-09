import * as Core from '../../../app/src/core/index.ts';
import type { Doc, Node, Page } from '../../../app/src/core/types.ts';
import { buildIndependentStudioDocument as buildV202 } from '../2.0.2/source.ts';

const C = Core.cvar;
const N = Core.N as (
  type: string,
  props?: Record<string, unknown>,
  css?: Record<string, Record<string, string>>,
  children?: Node[],
) => Node;
const BOX = Core.BOX as (
  top: string,
  right: string,
  bottom: string,
  left: string,
) => Record<string, string>;

const named = (node: Node, cls: string) => {
  node.adv = {
    ...(node.adv || {}),
    cls: [node.adv?.cls, cls].filter(Boolean).join(' '),
  };
  return node;
};

const heading = (
  copy: string,
  style: 'display' | 'title' | 'subtitle',
  level: 'h1' | 'h2' | 'h3' | 'div' = 'h2',
  css: Record<string, Record<string, string>> = {},
) => N('heading', { text: copy, ts: style, level }, css);

const text = (
  html: string,
  style: 'lead' | 'body' | 'small' = 'body',
  css: Record<string, Record<string, string>> = {},
) => N('text', { html, ts: style }, css);

const column = (
  grow: number,
  children: Node[],
  css: Record<string, string> = {},
  mobile: Record<string, string> = {},
) => N('column', {}, {
  d: { 'flex-grow': String(grow), ...css },
  t: {},
  m: { 'flex-basis': '100%', ...mobile },
}, children);

const row = (
  children: Node[],
  css: Record<string, string> = {},
  mobile: Record<string, string> = {},
) => N('row', {}, {
  d: { gap: '32px', ...css },
  t: {},
  m: { gap: '22px', ...mobile },
}, children);

const ledgerEntry = (title: string, copy: string, final = false) => named(N('box', {
  layout: 'block',
}, {
  d: {
    padding: '34px 0 38px',
    'border-top-width': '1px',
    'border-top-style': 'solid',
    'border-top-color': '#405068',
    ...(final ? {
      'border-bottom-width': '1px',
      'border-bottom-style': 'solid',
      'border-bottom-color': '#405068',
    } : {}),
  },
  t: {},
  m: { padding: '28px 0 32px' },
}, [row([
  column(44, [heading(title, 'subtitle', 'h3', {
    d: {
      color: C('paper'),
      'font-size': 'clamp(28px,3.1vw,44px)',
      'line-height': '1.02',
      'letter-spacing': '-.035em',
      'max-width': '15ch',
    },
    t: {},
    m: { 'font-size': '30px', 'max-width': '12ch' },
  })]),
  column(56, [text(`<p>${copy}</p>`, 'body', {
    d: {
      color: C('paper-muted'),
      'font-size': '18px',
      'line-height': '1.65',
      'max-width': '44ch',
    },
    t: {},
    m: { 'font-size': '16px' },
  })]),
], { 'align-items': 'flex-start', gap: '56px' })]), 'nl-loop-ledger-entry');

const editorialLoop = () => named(N('section', { tag: 'section' }, {
  d: {
    ...BOX('108px', '42px', '112px', '42px'),
    'background-color': C('ink'),
    color: C('paper'),
  },
  t: { ...BOX('82px', '28px', '86px', '28px') },
  m: { ...BOX('64px', '20px', '68px', '20px') },
}, [
  row([
    column(63, [heading('Direction is made in the open.', 'display', 'h2', {
      d: {
        color: C('paper'),
        'font-size': 'clamp(68px,8vw,112px)',
        'line-height': '.9',
        'letter-spacing': '-.04em',
        'max-width': '10.5ch',
      },
      t: {},
      m: { 'font-size': '49px', 'max-width': '10ch' },
    })]),
    column(37, [text('<p>A useful idea is not protected from friction. We put it against real language, real constraints, and the people who will carry it forward.</p>', 'lead', {
      d: {
        color: C('paper-muted'),
        'max-width': '38ch',
        'padding-left': '30px',
        'border-left-width': '1px',
        'border-left-style': 'solid',
        'border-left-color': C('acid'),
      },
      t: {},
      m: {
        'padding-left': '0',
        'padding-top': '24px',
        'border-left-width': '0',
        'border-top-width': '1px',
        'border-top-style': 'solid',
        'border-top-color': C('acid'),
      },
    })]),
  ], { 'align-items': 'flex-end', gap: '74px' }),
  named(N('image', {
    src: 'asset:northline-editorial-production',
    alt: 'Editorial layouts and production materials being tested on a working table',
    w: '1536',
    h: '1024',
    lazy: 1,
  }, {
    d: {
      width: '100%',
      height: '180px',
      'object-fit': 'cover',
      'object-position': 'center 58%',
      filter: 'grayscale(1) contrast(1.12)',
      opacity: '.78',
      'margin-top': '82px',
    },
    t: { height: '150px' },
    m: { height: '118px', 'margin-top': '48px' },
  }), 'nl-loop-strip'),
  named(N('box', { layout: 'block' }, {
    d: { 'margin-top': '52px' },
    t: {},
    m: { 'margin-top': '36px' },
  }, [
    ledgerEntry('Name the pressure.', 'Begin with the decision the work has to support, and the tension making that decision difficult.'),
    ledgerEntry('Make the direction earn its place.', 'Put language, content, constraints, and real use against the idea. Keep what clarifies; remove what merely decorates.'),
    ledgerEntry('Leave the logic behind.', 'Hand over more than finished files: leave a system people can extend without flattening its point of view.', true),
  ]), 'nl-loop-ledger'),
]), 'nl-loop-editorial');

export function buildIndependentStudioDocument(): Doc {
  const document = buildV202();
  const home = document.pages.find(page => page.slug === 'index') as Page;
  const replacement = editorialLoop();
  let nodeIndex = 0;
  const assignStableIds = (node: Node) => {
    node.id = `northline-v203-node-${String(++nodeIndex).padStart(4, '0')}`;
    for (const child of node.children || []) assignStableIds(child);
  };
  assignStableIds(replacement);
  home.tree[3] = replacement;
  document.meta.css += `
.nl-loop-editorial .nl-loop-strip{transition:filter .45s ease,opacity .45s ease}
@media(hover:hover) and (pointer:fine){
  .nl-loop-editorial:hover .nl-loop-strip{filter:grayscale(.2) contrast(1.08);opacity:.95}
}
@media(prefers-reduced-motion:reduce){
  .nl-loop-editorial .nl-loop-strip{transition:none}
}
`;
  return document;
}
