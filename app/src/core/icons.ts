/* Icons — the first module split out of the flat core.

   Chosen first because it is a true leaf: six declarations, and nothing in here calls
   anything outside it. That matters, because the rest of the core is one scope with
   real cycles waiting (`menuFor` needs `clip`, whose module would need `DEF`), and a
   split that creates one is worse than no split at all. Take the leaves first.

   Fully annotated, so this file already passes `noImplicitAny` even though the flag
   is still off globally — checkable on its own with
     npx tsc --noImplicitAny --noEmit --skipLibCheck app/src/core/icons.ts
   That is the shape of the remaining work: annotate a section, split it, repeat, and
   flip the flag once nothing is left. */


/* ---------------------------------------------------------------- icons */
/* Editor chrome, one set: a 24-unit grid, artwork between 3 and 21, round caps and joins, and
   every glyph centred both as a whole and inside its own frame (tests/icon-quality.test.mjs).
   Nothing here is published; icons that reach a site live in PUBLISHED_GLYPHS below. */
const IC: Record<string, string> = {
  sliders: '<path d="M3 8h8M17 8h4M3 16h4M13 16h8"/><circle cx="14" cy="8" r="3"/><circle cx="10" cy="16" r="3"/>',
  cms: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3"/>',
  section: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 9h10M7 12h10M7 15h10"/>',
  row: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M12 6v12"/>',
  flex: '<rect x="3" y="6" width="5.5" height="12" rx="1.8"/><rect x="12" y="6" width="9" height="12" rx="1.8"/>',
  grid: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 4v16M3 12h18"/>',
  box: '<rect x="4" y="4" width="16" height="16" rx="3"/>',
  search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="M15.8 15.8L20.2 20.2"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M3 10h18M3 15h18M12 10v10"/>',
  codeblock: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.5 9l-3 3 3 3M14.5 9l3 3-3 3"/>',
  crumbs: '<path d="M4.5 8l4 4-4 4M10 8l4 4-4 4M15.5 8l4 4-4 4"/>',
  slider: '<rect x="6" y="5" width="12" height="14" rx="2.5"/><path d="M3 8v8M21 8v8"/>',
  column: '<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M12 3v18"/>',
  columns: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M15 4v16"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  text: '<path d="M4 6h16M4 10h16M4 14h16M4 18h9"/>',
  quote: '<path d="M10 7H5.5A1.5 1.5 0 0 0 4 8.5V12a1.5 1.5 0 0 0 1.5 1.5H10V7zM10 13.5c0 2-1.2 3.3-3.5 3.5"/><path d="M20 7h-4.5A1.5 1.5 0 0 0 14 8.5V12a1.5 1.5 0 0 0 1.5 1.5H20V7zM20 13.5c0 2-1.2 3.3-3.5 3.5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3.5 17.5l4.8-4.3a1.6 1.6 0 0 1 2.1 0l3.1 2.8 1.6-1.4a1.6 1.6 0 0 1 2.1 0l3.3 2.9"/>',
  video: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9.7 8.8l5 3.2-5 3.2z" fill="currentColor"/>',
  button: '<rect x="3" y="7" width="18" height="10" rx="5"/><path d="M9 12h6"/>',
  spacer: '<path d="M4 3.5h16M4 20.5h16M12 7.5v9M9.5 10L12 7.5l2.5 2.5M9.5 14l2.5 2.5 2.5-2.5"/>',
  divider: '<path d="M3 12h18"/><g opacity=".45"><path d="M7 6.5h10M7 17.5h10"/></g>',
  nav: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  form: '<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M6.5 7h4M6.5 17h7"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.5 3.6 5.6 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.6-3.6-9S9.6 5.5 12 3z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10.5" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  external: '<path d="M14 4h6v6M20 4l-8.5 8.5M18 14v3.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H10"/>',
  link: '<path d="M10 13.5a4 4 0 0 0 5.8.4l3-3a4 4 0 0 0-5.7-5.7l-1.3 1.3M14 10.5a4 4 0 0 0-5.8-.4l-3 3a4 4 0 0 0 5.7 5.7l1.3-1.3"/>',
  unlink: '<path d="M17.7 12l1.1-1.1a4 4 0 0 0-5.7-5.7L12 6.3M6.3 12l-1.1 1.1a4 4 0 0 0 5.7 5.7L12 17.7M4 4l16 16"/>',
  reset: '<path d="M4 4v5h5M4.6 9A8 8 0 1 1 4 12.5"/>',
  icon: '<path d="M12 3.6l2.7 5.5 6 .9-4.35 4.25 1 6L12 17.4l-5.35 2.85 1-6L3.3 10l6-.9z"/>',
  caret: '<path d="M6 9l6 6 6-6"/>',
  /* Drawn rather than rotated: a rotated glyph needs a class at every call site. */
  caretUp: '<path d="M6 15l6-6 6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  trash: '<path d="M4 6.5h16M9 6.5V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5M6 6.5l.8 12.1A2.5 2.5 0 0 0 9.3 21h5.4a2.5 2.5 0 0 0 2.5-2.4L18 6.5M10 11v5.5M14 11v5.5"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M5.5 15.5A2 2 0 0 1 3.5 13.5v-7.5A2.5 2.5 0 0 1 6 3.5h7.5a2 2 0 0 1 2 2"/>',
  /* Deliberately not `copy`: two identical squares is what a component is not. */
  component: '<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" stroke="none"/>',
  library: '<rect x="3" y="4" width="4.5" height="16" rx="1.2"/><rect x="9.75" y="4" width="4.5" height="16" rx="1.2"/><path d="M16.9 4.8l2.6-.7 2 15.1-2.6.7z"/>',
  /* One row of dots, so it never reads as the `drag` grid beside it. */
  more: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
  drag: '<circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.6" fill="currentColor" stroke="none"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeoff: '<path d="M4 4l16 16M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6M9.6 5.8A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.2 7.7A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/>',
  desktop: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M12 16v4M8.5 20h7"/>',
  tablet: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
  mobile: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11.2 17.5h1.6"/>',
  alignL: '<path d="M4 6h16M4 12h9M4 18h13"/>',
  alignC: '<path d="M4 6h16M7.5 12h9M5.5 18h13"/>',
  alignR: '<path d="M4 6h16M11 12h9M7 18h13"/>',
  alignJ: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  vTop: '<path d="M4 3.5h16"/><rect x="8" y="7.5" width="8" height="13" rx="1.8"/>',
  vMid: '<path d="M3 12h2.5M18.5 12H21"/><rect x="8" y="5" width="8" height="14" rx="1.8"/>',
  vBot: '<path d="M4 20.5h16"/><rect x="8" y="3.5" width="8" height="13" rx="1.8"/>',
  toTop: '<path d="M5 4h14M12 20V9M7.5 13L12 8.5l4.5 4.5"/>',
  toBottom: '<path d="M5 20h14M12 4v11M7.5 11l4.5 4.5 4.5-4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M15.8 4.2a2.5 2.5 0 0 1 3.6 0l.4.4a2.5 2.5 0 0 1 0 3.6L8.5 19.5 3.7 20.3l.8-4.8zM13.5 6.5l4 4"/>',
  arrow: '<path d="M9 6l6 6-6 6"/>',
  check: '<path d="M5 12.2l4.6 4.6L19 7.2"/>',
  page: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h6"/>',
  code: '<path d="M7.5 7.5L3 12l4.5 4.5M16.5 7.5L21 12l-4.5 4.5M13.8 5l-3.6 14"/>',
  tabs: '<path d="M3 9.5V6.5A2.5 2.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v3.5"/><path d="M3 9.5h15.5A2.5 2.5 0 0 1 21 12v5.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  accordion: '<rect x="3" y="3.5" width="18" height="5" rx="1.8"/><rect x="3" y="11.5" width="18" height="9" rx="1.8"/><path d="M7 16h10"/>',
  gallery: '<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/>',
  pipette: '<path d="M13 7l4 4M17.3 3.7a2.1 2.1 0 0 1 3 3L17 10l-3-3zM13.8 7.8L5 16.6 3.7 20.3 7.4 19l8.8-8.8"/>',
  audio: '<path d="M4 10.5v3M8 7.5v9M12 4v16M16 7.5v9M20 10.5v3"/>',
  countdown: '<circle cx="12" cy="13" r="8"/><path d="M12 13V9M9.5 2.5h5"/>',
  marquee: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 12h10M14 9l3 3-3 3"/>',
  filter: '<path d="M4.5 4h15a1 1 0 0 1 .8 1.6L14.5 13v5.2L9.5 20v-7L3.7 5.6A1 1 0 0 1 4.5 4z"/>',
  compare: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M12 2.5v19M9 9.5L6.5 12 9 14.5M15 9.5l2.5 2.5-2.5 2.5"/>',
  timeline: '<path d="M6.5 7.5v2M6.5 14.5v2"/><circle cx="6.5" cy="5" r="2.3"/><circle cx="6.5" cy="12" r="2.3"/><circle cx="6.5" cy="19" r="2.3"/><path d="M12.5 5H20M12.5 12H20M12.5 19H20"/>',
  progress: '<rect x="3" y="5" width="18" height="5" rx="2.5"/><rect x="3" y="14" width="18" height="5" rx="2.5"/><rect x="4.3" y="6.3" width="11" height="2.4" rx="1.2" fill="currentColor" stroke="none"/><rect x="4.3" y="15.3" width="7" height="2.4" rx="1.2" fill="currentColor" stroke="none"/>',
  hotspot: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/>',
  strips: '<rect x="3" y="4" width="10" height="16" rx="2.2"/><path d="M17 5v14M21 5v14"/>',
  switcher: '<path d="M3 6h4.5M3 12h4.5M3 18h4.5"/><rect x="11" y="4" width="10" height="16" rx="2.5"/>',
  exhibit: '<path d="M3 6h8M3 12h8M3 18h8"/><rect x="14" y="8" width="7" height="8" rx="2"/>',
  scrolly: '<rect x="11" y="4" width="10" height="16" rx="2.5"/><path d="M5.5 5v13M3 15.5L5.5 18 8 15.5"/>',
  clocks: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  roster: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5"/>',
  tiers: '<rect x="3" y="7.5" width="5" height="9" rx="1.5"/><rect x="9.5" y="4" width="5" height="16" rx="1.5"/><rect x="16" y="7.5" width="5" height="9" rx="1.5"/>',
  qapills: '<rect x="3" y="4" width="8" height="5" rx="2.5"/><rect x="13" y="4" width="8" height="5" rx="2.5"/><rect x="3" y="12.5" width="18" height="7.5" rx="2"/>',
  dockbar: '<rect x="3" y="7" width="18" height="10" rx="2.5"/><path d="M9 7v10M15 7v10"/>',
  arches: '<path d="M8.5 19V8.5a3.5 3.5 0 0 1 7 0V19z"/><path d="M8.5 19H4.5a1 1 0 0 1-1-1v-6.5a2.5 2.5 0 0 1 5-.5M15.5 19h4a1 1 0 0 0 1-1v-6.5a2.5 2.5 0 0 0-5-.5"/>',
  reel: '<rect x="8.5" y="4.5" width="7" height="15" rx="1.6"/><path d="M6.2 6.8l-2.4.9v8.6l2.4.9M17.8 6.8l2.4.9v8.6l-2.4.9" opacity=".65"/>',
  grow: '<rect x="8.5" y="4" width="7" height="16" rx="1.3"/><rect x="3" y="6.8" width="3.8" height="10.4" rx=".9" opacity=".55"/><rect x="17.2" y="6.8" width="3.8" height="10.4" rx=".9" opacity=".55"/>',
  chapters: '<rect x="3" y="4" width="18" height="11.5" rx="2.5"/><path d="M3 20h4M10 20h4M17 20h4"/>',
  slotpicker: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 2.8V7M16 2.8V7M9 15.5l2 2 4-4"/>'
};
/* The grid's outer unit is spare, so it is cropped: 12px chrome icons stay legible. */
const IC_VIEW = '1 1 22 22';
const icStroke = (size: number) => size < 16 ? 2 : 1.75;
const svg = (n: string, s: number = 14, cls: string = ''): string =>
  `<svg class="${cls}" width="${s}" height="${s}" viewBox="${IC_VIEW}" fill="none" stroke="currentColor" stroke-width="${icStroke(s)}" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ''}</svg>`;
/* Glyphs already on customers' sites (Button icons, slider arrows). Frozen on their original
   16-unit grid: changing one rewrites every site that uses it on its next publish. */
const PUBLISHED_GLYPHS = {
  arrow: '<path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round"/>',
  check: '<path d="M3 8.5l3.2 3.2L13 5" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<path d="M8 3v10M3 8h10" stroke-linecap="round"/>',
  caret: '<path d="M3.5 5.5L8 10l4.5-4.5" stroke-linecap="round" stroke-linejoin="round"/>'
};
/* --------------------------------------------------- the public icon set
   Drawn on a 24px grid at stroke 1.75, stroke-only so `currentColor` and one
   size variable style every one of them. IC above is 16px chrome furniture at
   stroke 1.4 — the two sets are deliberately separate: these ship in exports,
   those never leave the editor.

   Every glyph is a bare path list. `iconSvg` supplies viewBox, dimensions and
   stroke — dimensions above all, because a viewBox with no width/height has
   collapsed to nothing three times in this project. */
const ICONS: [string, [string, string][]][] = [
  ['Interface', [
    ['check', '<path d="M20 6.5L9.2 17.3 4 12.1"/>'],
    ['check-circle', '<circle cx="12" cy="12" r="9"/><path d="M8.2 12.4l2.6 2.6 5-5.6"/>'],
    ['plus', '<path d="M12 5v14M5 12h14"/>'],
    ['minus', '<path d="M5 12h14"/>'],
    ['close', '<path d="M6 6l12 12M18 6L6 18"/>'],
    ['arrow-right', '<path d="M4 12h15M13.2 6l6 6-6 6"/>'],
    ['arrow-up-right', '<path d="M7 17L17.2 6.8M8.4 6.8h8.8v8.8"/>'],
    ['chevron-down', '<path d="M6 9.5l6 6 6-6"/>'],
    ['chevron-right', '<path d="M9.5 6l6 6-6 6"/>'],
    ['menu', '<path d="M4 7h16M4 12h16M4 17h16"/>'],
    ['search', '<circle cx="11" cy="11" r="6.4"/><path d="M15.8 15.8l4.7 4.7"/>'],
    ['settings', '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v3.1M12 18.3v3.1M4.4 7.2l2.7 1.6M16.9 15.2l2.7 1.6M4.4 16.8l2.7-1.6M16.9 8.8l2.7-1.6"/>'],
    ['external', '<path d="M14 4h6v6M20 4l-8.6 8.6M17 14.4v5.1H4.5V7h5.1"/>'],
    ['download', '<path d="M12 4v11.4M7.4 11l4.6 4.6L16.6 11M4.4 19.6h15.2"/>']
  ]],
  ['Signals', [
    ['star', '<path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.4 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.4 6.1-.9z"/>'],
    ['heart', '<path d="M12 20.2C9.5 18.4 4.6 14.9 4.6 11a3.9 3.9 0 017.4-1.8A3.9 3.9 0 0119.4 11c0 3.9-4.9 7.4-7.4 9.2z"/>'],
    ['zap', '<path d="M13.4 2.4L4.6 14.2H10l-1.4 7.4 8.8-11.8h-5.4z"/>'],
    ['sparkle', '<path d="M10 3.2l1.7 4.6 4.6 1.7-4.6 1.7L10 15.8 8.3 11.2 3.7 9.5l4.6-1.7z"/><path d="M17.6 14.4l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>'],
    ['info', '<circle cx="12" cy="12" r="9"/><path d="M12 11.1v5.6M12 7.5v.9"/>'],
    ['alert', '<path d="M12 3.6l8.8 15.8H3.2z"/><path d="M12 9.4v4.4M12 16.6v.9"/>'],
    ['shield', '<path d="M12 3l8 3v5.9c0 5-3.4 8.1-8 9.1-4.6-1-8-4.1-8-9.1V6z"/>'],
    ['lock', '<rect x="4.8" y="10.9" width="14.4" height="9.4" rx="2"/><path d="M8.2 10.9V8a3.8 3.8 0 017.6 0v2.9"/>']
  ]],
  ['Contact', [
    ['mail', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.6 6.6L12 12.5l8.4-5.9"/>'],
    ['phone', '<path d="M6.1 3.2h2.8l1.9 4.7-2.1 1.4a12.3 12.3 0 005.9 5.9l1.4-2.1 4.7 1.9v2.8a2 2 0 01-2.2 2A16.6 16.6 0 014.1 5.4a2 2 0 012-2.2z"/>'],
    ['chat', '<path d="M20 14.8a2 2 0 01-2 2H8.6L4 20.6V6a2 2 0 012-2h12a2 2 0 012 2z"/>'],
    ['map-pin', '<path d="M12 21.2C12 21.2 5 15.1 5 10.4a7 7 0 1114 0c0 4.7-7 10.8-7 10.8z"/><circle cx="12" cy="10.2" r="2.6"/>'],
    ['clock', '<circle cx="12" cy="12" r="9"/><path d="M12 6.9v5.5l3.6 2.2"/>'],
    ['calendar', '<rect x="3.6" y="5.1" width="16.8" height="15.3" rx="2"/><path d="M3.6 10.1h16.8M8.2 3v4.1M15.8 3v4.1"/>'],
    ['users', '<circle cx="9.2" cy="8" r="3.4"/><path d="M2.6 20a6.6 6.6 0 0113.2 0"/><path d="M16.2 5.2a3.4 3.4 0 010 5.6M17.6 14.5A6.6 6.6 0 0121.4 20"/>']
  ]],
  ['Craft', [
    ['code', '<path d="M8.4 7.4L3.8 12l4.6 4.6M15.6 7.4L20.2 12l-4.6 4.6M13.7 4.4l-3.4 15.2"/>'],
    ['layers', '<path d="M12 3l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.6l9 4.8 9-4.8"/>'],
    ['box', '<path d="M12 3.2l8.4 4.4v8.8L12 20.8l-8.4-4.4V7.6z"/><path d="M3.6 7.6L12 12l8.4-4.4M12 12v8.8"/>'],
    ['chart', '<path d="M3 20.2h18"/><path d="M6.6 20.2v-6.4M12 20.2V7.4M17.4 20.2v-9.2"/>'],
    ['globe', '<circle cx="12" cy="12" r="9"/><path d="M3.2 9.4h17.6M3.2 14.6h17.6"/><path d="M12 3c-2.4 2.6-3.7 5.7-3.7 9s1.3 6.4 3.7 9c2.4-2.6 3.7-5.7 3.7-9S14.4 5.6 12 3z"/>'],
    ['play', '<circle cx="12" cy="12" r="9"/><path d="M10.2 8.4l6 3.6-6 3.6z"/>']
  ]]
];
/* flat lookup, and the order the picker walks */
const ICON_PATHS: Record<string, string> = ICONS.reduce(
  (all: Record<string, string>, [, list]) => { list.forEach(([k, p]) => { all[k] = p; }); return all; },
  {} as Record<string, string>);
const ICON_NAMES = Object.keys(ICON_PATHS);
/* Dimensions are not optional. A viewBox with no width/height collapses, and it
   has done so three times here — the CSS var carries the real size on top. */
const iconSvg = (name: string, attrs: string = ''): string =>
  `<svg ${attrs} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ICON_PATHS.check}</svg>`;

export { IC, IC_VIEW, icStroke, PUBLISHED_GLYPHS, svg, ICONS, ICON_PATHS, ICON_NAMES, iconSvg };
