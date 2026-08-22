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
const IC: Record<string, string> = {
  cms: '<ellipse cx="8" cy="3.8" rx="5.5" ry="2.3"/><path d="M2.5 3.8v8.4c0 1.27 2.46 2.3 5.5 2.3s5.5-1.03 5.5-2.3V3.8"/><path d="M2.5 8c0 1.27 2.46 2.3 5.5 2.3s5.5-1.03 5.5-2.3"/>',
  section:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M4 5.5h8M4 8h8M4 10.5h5"/>',
  row:'<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M8 3.5v9"/>',
  table:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M1.5 6h13M6.5 6v7.5"/>',
  codeblock:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M5 7l-1.6 1.6L5 10.2M9.2 7l1.6 1.6-1.6 1.6" stroke-linecap="round"/>',
  column:'<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5.6 2.5v11M10.4 2.5v11"/>',
  columns:'<rect x="1.5" y="3.5" width="13" height="9" rx="1.5"/><path d="M5.8 3.5v9M10.2 3.5v9"/>',
  heading:'<path d="M4 13V3M12 13V3M4 8h8" stroke-linecap="round"/>',
  text:'<path d="M2.5 3.5h11M2.5 6.6h11M2.5 9.7h11M2.5 12.8h6" stroke-linecap="round"/>',
  quote:'<path d="M6.6 4.3C4.5 5.3 3.3 7 3.3 8.9c0 1.4.9 2.4 2.2 2.4 1.1 0 1.9-.8 1.9-1.8s-.7-1.7-1.7-1.7M13.6 4.3c-2.1 1-3.3 2.7-3.3 4.6 0 1.4.9 2.4 2.2 2.4 1.1 0 1.9-.8 1.9-1.8s-.7-1.7-1.7-1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  image:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.6" cy="6.4" r="1.2"/><path d="M1.8 11.6l3.4-3 3 2.6 2.3-2 3.7 3.3"/>',
  video:'<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><path d="M6.6 5.9l4 2.1-4 2.1z" fill="currentColor" stroke="none"/>',
  button:'<rect x="1.5" y="4.5" width="13" height="7" rx="3.5"/><path d="M5 8h6" stroke-linecap="round"/>',
  spacer:'<path d="M2.5 2.5h11M2.5 13.5h11" stroke-linecap="round"/><path d="M8 5v6M6.2 6.6L8 4.8l1.8 1.8M6.2 9.4L8 11.2l1.8-1.8"/>',
  divider:'<path d="M1.5 8h13" stroke-linecap="round"/><path d="M4 4.6h8M4 11.4h8" opacity=".4"/>',
  nav:'<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" stroke-linecap="round"/>',
  form:'<rect x="2" y="2.5" width="12" height="4" rx="1.2"/><rect x="2" y="9.5" width="12" height="4" rx="1.2"/><path d="M4.5 4.5h3M4.5 11.5h5" stroke-linecap="round"/>',
  globe:'<circle cx="8" cy="8" r="6.3"/><path d="M1.9 6.2h12.2M1.9 9.8h12.2M8 1.7c-1.6 1.7-2.5 3.9-2.5 6.3S6.4 12.6 8 14.3c1.6-1.7 2.5-3.9 2.5-6.3S9.6 3.4 8 1.7z"/>',
  lock:'<rect x="3.5" y="7" width="9" height="6.5" rx="1.3"/><path d="M5.8 7V5.2a2.2 2.2 0 014.4 0V7"/>',
  external:'<path d="M9.5 2.5H13V6"/><path d="M13 2.5L7.5 8"/><path d="M11.5 9.5v3H3.5v-8h3" stroke-linecap="round"/>',
  link:'<path d="M6.5 9.5l3-3M5.6 7.6L4.2 9a2.3 2.3 0 003.2 3.2l1.4-1.4M10.4 8.4l1.4-1.4A2.3 2.3 0 008.6 3.8L7.2 5.2" stroke-linecap="round"/>',
  unlink:'<path d="M5.6 7.6L4.2 9a2.3 2.3 0 003.2 3.2l1.4-1.4M10.4 8.4l1.4-1.4A2.3 2.3 0 008.6 3.8L7.2 5.2" stroke-linecap="round"/><path d="M2.5 2.5l11 11" stroke-linecap="round" opacity=".7"/>',
  icon:'<path d="M8 1.8l1.9 4 4.3.6-3.1 3 .8 4.3L8 11.7 4.1 13.7l.8-4.3-3.1-3 4.3-.6z"/>',
  caret:'<path d="M3.5 5.5L8 10l4.5-4.5" stroke-linecap="round" stroke-linejoin="round"/>',
  /* the same chevron the other way up. A down caret was standing in for both directions, so
     Move up and Move down were the same glyph — and Select parent pointed downwards. Drawn
     rather than rotated, for the reason the `more` icon was: a rotated glyph needs a class on
     the element that carries it, which is a second thing to remember at every call site. */
  caretUp:'<path d="M3.5 10.5L8 6l4.5 4.5" stroke-linecap="round" stroke-linejoin="round"/>',
  trash:'<path d="M2.8 4.5h10.4M6.2 4.5V2.8h3.6v1.7M4.2 4.5l.6 8.2c0 .5.5.8 1 .8h4.4c.5 0 1-.3 1-.8l.6-8.2" stroke-linecap="round"/>',
  copy:'<rect x="5.5" y="5.5" width="8" height="8" rx="1.4"/><path d="M10.5 5.5v-2A1 1 0 009.5 2.5h-6a1 1 0 00-1 1v6a1 1 0 001 1h2"/>',
  /* Three dots in a row. It exists because the overflow button used to be `drag`
     rotated 90 degrees, and a 3x2 dot grid beside a 2x3 dot grid is the same glyph
     twice at 12px — "drag to move" and "everything else" were indistinguishable. */
  more:'<circle cx="3.6" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="12.4" cy="8" r="1.15" fill="currentColor" stroke="none"/>',
  drag:'<circle cx="6" cy="4" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="4" r="1.1" fill="currentColor" stroke="none"/><circle cx="6" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="10" cy="12" r="1.1" fill="currentColor" stroke="none"/>',
  eye:'<path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.9"/>',
  eyeoff:'<path d="M2 2l12 12" stroke-linecap="round"/><path d="M6.2 6.3A2 2 0 008 10a2 2 0 001.7-1M4.2 4.6C2.5 5.9 1.5 8 1.5 8S3.9 12.5 8 12.5c1 0 1.9-.2 2.7-.6M12.4 10.4c1.3-1.2 2.1-2.4 2.1-2.4S12.1 3.5 8 3.5c-.4 0-.8 0-1.2.1"/>',
  desktop:'<rect x="1.5" y="2.5" width="13" height="9" rx="1.5"/><path d="M5.5 14h5"/>',
  tablet:'<rect x="3.5" y="1.5" width="9" height="13" rx="1.5"/>',
  mobile:'<rect x="4.5" y="1.5" width="7" height="13" rx="1.5"/>',
  alignL:'<path d="M2 3.5h12M2 8h7M2 12.5h10" stroke-linecap="round"/>',
  alignC:'<path d="M2 3.5h12M4.5 8h7M3 12.5h10" stroke-linecap="round"/>',
  alignR:'<path d="M2 3.5h12M7 8h7M4 12.5h10" stroke-linecap="round"/>',
  alignJ:'<path d="M2 3.5h12M2 8h12M2 12.5h12" stroke-linecap="round"/>',
  vTop:'<path d="M2 2.5h12" stroke-linecap="round"/><rect x="5" y="5" width="6" height="8" rx="1"/>',
  vMid:'<path d="M2 8h12" stroke-linecap="round" opacity=".5"/><rect x="5" y="4" width="6" height="8" rx="1"/>',
  vBot:'<path d="M2 13.5h12" stroke-linecap="round"/><rect x="5" y="3" width="6" height="8" rx="1"/>',
  toTop:'<path d="M3 2.8h10M8 13.2V6M5 8.9L8 5.9l3 3" stroke-linecap="round" stroke-linejoin="round"/>',
  toBottom:'<path d="M3 13.2h10M8 2.8V10M5 7.1L8 10.1l3-3" stroke-linecap="round" stroke-linejoin="round"/>',
  plus:'<path d="M8 3v10M3 8h10" stroke-linecap="round"/>',
  edit:'<path d="M11.2 2.6l2.2 2.2-8 8L3 13.5l.7-2.4z" stroke-linejoin="round"/>',
  arrow:'<path d="M6 3.5L10.5 8 6 12.5" stroke-linecap="round" stroke-linejoin="round"/>',
  check:'<path d="M3 8.5l3.2 3.2L13 5" stroke-linecap="round" stroke-linejoin="round"/>',
  page:'<rect x="2.5" y="1.5" width="11" height="13" rx="1.5"/><path d="M5 5h6M5 8h6M5 11h4"/>',
  code:'<path d="M5.5 5L2.5 8l3 3M10.5 5l3 3-3 3M9.3 3.2l-2.6 9.6" stroke-linecap="round"/>',
  tabs:'<path d="M1.8 6.2h12.4v7.6a.9.9 0 01-.9.9H2.7a.9.9 0 01-.9-.9z" stroke-linejoin="round"/><path d="M1.8 6.2l1.4-3.4h3.6l.7 3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  accordion:'<rect x="1.5" y="2.2" width="13" height="3.6" rx="1"/><rect x="1.5" y="7.4" width="13" height="6.4" rx="1"/><path d="M4 9.9h6M4 11.9h4" opacity=".5"/>',
  gallery:'<rect x="1.5" y="2.5" width="5.4" height="5.4" rx="1"/><rect x="9.1" y="2.5" width="5.4" height="5.4" rx="1"/><rect x="1.5" y="9.6" width="5.4" height="3.9" rx="1"/><rect x="9.1" y="9.6" width="5.4" height="3.9" rx="1"/>',
  pipette:'<path d="M9.6 2.4l4 4" stroke-linecap="round"/><path d="M12.3 5.1L6.2 11.2l-2.9.9.9-2.9 6.1-6.1z" stroke-linecap="round" stroke-linejoin="round"/>'
};
const svg = (n: string, s: number = 14, cls: string = ''): string =>
  `<svg class="${cls}" width="${s}" height="${s}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">${IC[n] || ''}</svg>`;

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

export { IC, svg, ICONS, ICON_PATHS, ICON_NAMES, iconSvg };
