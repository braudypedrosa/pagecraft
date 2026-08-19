# Start here

Everything needed to continue this work in a fresh conversation. Nothing in the chat
transcript is required — if something is missing here, that is a bug in this file.

Read in this order: **this file** (orientation), `README.md` (what the tool does for a
user), `NOTES.md` (how it is built and why the decisions went that way).

---

## What this is

A visual page builder that exports static HTML, built on the **Pagecraft** brand system.
Dependency-free: one HTML file, no framework, no build step for the user, autosaves in the
browser. Lives at `~/Projects/braudyp.dev/page-builder/`.

Published (private) at
<https://claude.ai/code/artifact/16d1f437-f2ca-44df-aff7-02875acdd2c2> — to update it,
publish `dist/artifact.html` and pass that URL, or the link changes. It had gone a long
way stale: the live copy still carried all 18 native `prompt()`/`confirm()` calls, which
sandboxed iframes refuse, so naming a class or a colour silently did nothing there.
**Republish after any session that changes `builder.html`.**

> The repo it sits in (`braudyp.dev`) is an unrelated Next.js finance app. This builder is
> standalone and does not touch it. It lives on the **`page-builder`** branch; the generated
> `index.html` and `dist/` are committed too, so a clone can just open the file.

## State as of this handoff

| | |
|---|---|
| Tests | **206**, `npm test` |
| Widgets | 13 |
| Rail | Add · Navigator · Pages · CMS, then Media and Project as dialogs |
| Section templates | 23, in 12 categories |
| Page templates | 12 |
| Font library | 49 Google Fonts, auto-linked on export |
| Storage schema | `SCHEMA = 7`, seven cumulative migrations |
| `builder.html` | 7,105 lines — 3,025 tested core, 4,080 untested UI |
| `index.html` | 744 KB with brand fonts embedded |
| Demo project | 64 nodes, 24.6 KB export |

Built and working: sections/rows/columns with auto-wrapping · inline WYSIWYG · images with an
IndexedDB asset store · deferred video · accessible nav · forms · design tokens (colours,
text styles, style classes) · a Media library every image field can pick from · in-place global header/footer editing · saved blocks · template
gallery · export review (lint) with a live indicator · keyboard editing and clipboard ·
namespaced `pagecraft-` output with overridable ids · SEO head, sitemap, robots ·
**multi-select** (⌘/⇧-click to add on the canvas, ⇧-click for a range in the Navigator, one
style edit fans out to the set).

## Verify it works

```bash
cd ~/Projects/braudyp.dev/page-builder
npm test            # rebuild + 206 cases
npm run serve       # static server on :4877
open index.html     # or just open the file
```

`npm run build` regenerates `index.html`, `dist/artifact.html` and `dist/core.cjs` from
`builder.html`. **Only edit `builder.html`** — the other three are generated.

## Conventions that must hold

1. **Core/UI split.** Pure logic goes between `/*<core>*/` … `/*</core>*/`; it is extracted
   verbatim into `dist/core.cjs` for the tests. New core symbols also go in the `EXPORTS`
   list in `build.mjs`. Anything touching the DOM stays outside the markers.
2. **Control parity.** Every `case` in `ctlHtml` needs a matching `case` in `bindRight`. The
   build fails by name otherwise. This exists because a slice-based edit once deleted four
   wiring branches and left the markup, giving controls that rendered and did nothing.
3. **Green is reserved** for action, focus, selection and status. Publish is the only green
   fill in the chrome.
4. **Namespacing.** Class `pagecraft-<widget-slug>` plus styling hook `pagecraft-<nodeid>`;
   auto id `pagecraft-<widget-slug>-<nodeid>`, overridden verbatim by `adv.htmlId`. All of it
   derives from `widgetSlug` / `nodeClass` / `autoId` / `domIdOf` in core.
5. **Cascade order** within a breakpoint: text style → class → element. Exactly two media
   queries reach the export.

## How to work on it well

Three failure modes cost real time in this project. They are worth knowing in advance:

- **Bad defaults pass tests.** An unreadable button, a dead `#` link and cramped spacing all
  shipped under 106 green tests, because tests assert behaviour and these were defaults.
  Build a page as a user before trusting the suite.
- **SVG with a `viewBox` and no dimensions.** Bit three times — inline icons collapsed to
  nothing, a background caret scaled to fill the field. Always set width/height, or
  `background-size`.
- **A promise resolves on a microtask, so a synchronous probe reads the old value.** Testing
  the new `askText`/`askConfirm` dialogs, cancelling and immediately reading the control that
  the cancel branch resets reported it unchanged — the `await` continuation had not run. `await
  new Promise(r => setTimeout(r, 0))` first, or you will chase a bug that is not there.
- **`node --check` the extracted `<script>`.** The build parses only the core regions, so a
  missing `async` in the 3,300-line UI layer ships silently. Extract from `<script>` to
  `</script>`, wrap it, and check it — that is what caught twelve handlers at once.
- **Bundled probes lie.** Several verification steps returned wrong answers because six
  mutations shared one expression, or the canvas was rendering at tablet width, or a
  screenshot caught a mid-render frame. One assertion per call, and prefer the generated
  stylesheet or a screenshot over `getComputedStyle` through an iframe.
- **The tablet breakpoint is `max-width:1024px`, so the editor canvas is almost never at
  the desktop base.** At a 1500px window the canvas is 816px, which matches the tablet
  query. A text style carries its own `t`/`m` sizes and `treeCss` emits the breakpoint
  blocks *after* the desktop element rules — so overriding `font-size` on the desktop base
  alone is silently beaten everywhere you can actually see it. A step number set to 19px
  rendered at the Display style's 44px for exactly this reason. Use the `sized()` helper,
  which pins all three; a test now fails if a styled heading resizes only on desktop.
  Also: after `setDev()` the canvas width transitions, so re-read it in a later call.

## One thing left open

Cross-browser: **Safari 26, Firefox 153 and Chrome each pass all 28** feature checks in
`tools/compat.html`, including `execCommand` actually formatting and a Blob surviving
IndexedDB → `blob:` URL → `<img>`. Firefox has also passed the one check that needs a human
gesture — pointer capture holding over the iframe during a real drag.

**Safari has not done that drag yet.** To finish it:

```bash
node tools/probe-server.mjs        # then open http://localhost:4899/ in Safari
```

Scroll to the bottom, drag the green square across the grey frame, release. It appends to
`tools/compat-results.jsonl`. A result of `0 over frame` means the drag missed the frame, not
that the browser failed.

## Next, in priority order

1. **Drag-to-reorder** in the Navigator, and **multi-element drag** — the HUD hides its drag
   handle while several are selected, because moving a set together was left out of the
   multi-select pass. (Column drag-resize is done: grips in `#s-hud`, `resizeCols` in core.)
2. **Measure before optimising** — the canvas rebuilds `innerHTML` on content edits and undo
   keeps 80 full document clones. The demo is only 64 nodes; generate 300–500 and measure
   before changing anything
3. **Canvas zoom** (it is in the brand mockup; only the px readout exists), custom layer
   names, an Assets item in the rail
4. **Test the UI layer** — 3,288 lines have no unit tests, which is where the one real
   regression came from. Either extract more into core or add a DOM-shimmed layer
5. **Keep new form markup on the variables.** `--gap-1/2/3` and `--h-ctl/--h-row` in `:root`
   own every form measurement; there are no hard-coded vertical margins left in the markup.
   Anything sitting in a field row takes `--h-ctl` or it will be the one thing out of line
6. **Decide the product question**: does this become the editor for
   `~/Documents/Braudy/pagecraft` (a Next.js app with its own `PRODUCT.md` and `ROADMAP.md`,
   untouched so far), or stay standalone? It determines whether CMS, accounts and cloud
   persistence are next

- **A variant rule leaks the properties its context override forgets to restate.** The dark
  top bar and the `.btn.ghost` variant have equal specificity, so the bar won only on source
  order — and because `.topbar .btn:hover` never set `color`, the light-surface `var(--text)`
  came through and put near-black text on the ink bar at 1.19:1. Fixed by naming the variant
  in the context (`.topbar .btn.ghost:hover`), which wins on specificity instead. Worth
  checking hover states on a *real* hover: computed styles at rest tell you nothing, and every
  button pair in the chrome now measures 14:1 or better (danger icons, on their tinted ground,
  are the tightest at ~5.1:1).

## Found while building the templates

- **Fixed:** the Undo button used to go stale after a style edit, because `tx()` pushes onto
  `hist.u` without going through `edit()`. `paintHistory()` now owns that state and is called
  from every path that moves history depth.
- **Fixed:** the Image widget's default `alt` was the literal string `Descriptive alt text`,
  which satisfied the `no-alt` check, so a hand-placed image exported meaningless alt text and
  the review stayed quiet. The default is now empty and the prompt lives in the field's
  placeholder, where it cannot become content. `no-alt` also only fires once an image has a
  `src` — a placeholder with no source is reported by `no-image` instead, so a fresh template
  does not open on a wall of errors.

## Known deviations from the brand kit

- Global regions are edited **in place** with the rest of the page dimmed. The kit's
  `screens/SCREEN-DIRECTION.md` specifies a separate Global Regions workspace. Deliberate,
  at the user's direction.
- Brand **Slate `#6f7771` fails WCAG AA as body text** — 4.27:1 on Paper, 4.05:1 on Ink. The
  defaults ship three Slates (`muted` #5f6660 for Paper, `muted-i` #b0b7b1 for Ink, `slate`
  at the brand value for fills and large text). The real fix belongs upstream in the kit.
