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
publish `dist/artifact.html` and pass that URL, or the link changes.
**Republish after any session that changes `builder.html`.**

**You no longer have to remember any of this.** `dist/PUBLISHED.json` records the sha256 of
the copy that was actually published, and every `npm run build` / `npm test` ends with one
line saying whether the live artifact matches what the repo would produce:

```
Artifact: up to date — published 2026-08-19 from ad1eeff
Artifact is STALE — 3 commits behind (published from ad1eeff).
  live   https://claude.ai/code/artifact/16d1f437-…
  fix    republish dist/artifact.html to that URL, then: npm run publish:stamp
  keep   capabilities ["downloads"] · contract 0.2.4 · favicon 📐
```

The comparison is sound because the build is **byte-deterministic** — same `builder.html`
and same vendored fonts, same output, no timestamps. Three runs hashing identically is what
was actually checked, and `tests/pubcheck.test.mjs` covers the message states and the exit
codes. Those cases deliberately never assert the artifact *is* published: doing so would fail
the suite whenever someone edits `builder.html`, which is the coupling this check was kept
out of `npm test` to avoid.

| | |
|---|---|
| `npm run publish:check` | exits **1** when stale, so it can gate anything |
| `npm run publish:stamp -- <url>` | run this **immediately after** a real publish |
| `npm run hooks` | installs the tracked `post-commit`, which repeats the warning when a commit touches `builder.html`. Refuses if `core.hooksPath` is taken or `.git/hooks` holds anything real — this repo is shared with an unrelated app |

Three things the stale message carries because they are not recoverable from the repo:

- **Favicon 📐**, title from the fragment's own `<title>Pagecraft Builder</title>`. Keep both
  stable; a changed tab icon reads as a different page.
- **`capabilities: {downloads}` on contract `0.2.4`.** Publishing without an explicit
  `capabilities` argument carries it forward, which is what you want — the sandbox blocks a
  page-initiated download otherwise, and every export button here is one. `capabilities: {}`
  would break all of them silently.
- **A republish 409s** until that session has read the live copy. `WebFetch` the URL and look
  at what is on it *before* publishing. Do not reach for `force` first: it discards whatever
  is live, and only checking made it safe last time.

Deliberately **not** wired into `npm test`: a stale artifact is not a broken build, and
failing 261 passing tests over a publishing chore would train everyone to ignore the check.
It reports on every build and gates only where asked.

Why any of this exists: the live copy went stale twice. The second time it predated the whole
CMS — no collections, no Collection list, no detail pages, no zip export — while the repo was
six commits ahead. Both times the cause was the same, and it is not forgetfulness:
**republishing is a separate act from committing, and nothing connected the two.** Now
something does.

> The repo it sits in (`braudyp.dev`) is an unrelated Next.js finance app. This builder is
> standalone and does not touch it. It lives on the **`page-builder`** branch; the generated
> `index.html` and `dist/` are committed too, so a clone can just open the file.

## State as of this handoff

| | |
|---|---|
| Tests | **325**, `npm test` |
| Widgets | 17 |
| Icon set | 35 stroke glyphs in 4 groups (`ICONS` in core) |
| Rail | Add · Navigator · Pages · CMS, then Media and Project as dialogs |
| Section templates | 26, in 12 categories |
| Page templates | 12 |
| Font library | 49 Google Fonts, auto-linked on export |
| Storage schema | `SCHEMA = 7`, seven cumulative migrations |
| `builder.html` | 8,052 lines — 3,653 tested core, 4,400 untested UI |
| `index.html` | 856 KB with brand fonts embedded |
| Demo project | 64 nodes, 29.5 KB export |

Built and working: sections/rows/columns with auto-wrapping · inline WYSIWYG · images with an
IndexedDB asset store · deferred video · accessible nav · forms · design tokens (colours,
text styles, style classes) · a Media library every image field can pick from · in-place global header/footer editing · saved blocks · template
gallery · export review (lint) with a live indicator · keyboard editing and clipboard ·
namespaced `pagecraft-` output with overridable ids · SEO head, sitemap, robots ·
**multi-select** (⌘/⇧-click to add on the canvas, ⇧-click for a range in the Navigator, one
style edit fans out to the set).

**A context menu, and one dispatcher for every element verb.** `menuFor(ids)` in core answers
"what applies here"; `runAct(act, ids)` in the UI is the only thing that does it, called by the
HUD bar, the Navigator row, the inspector footer and the menu. Duplicate and delete existed
three times before, each with its own idea of scope. The HUD bar is three buttons now — name,
drag, ⋯ — instead of seven. Right-click works on the canvas and in the Navigator; inside the
scaled iframe it converts through `toScreen`.

**Navigator drag-to-reorder and multi-element drag** — a row handle in the Navigator, and the
HUD handle now appears for a multi-selection. `moveMany` keeps a set's order and re-reads its
insertion point each step; `layerTarget` resolves a drop from the thirds of a row.

**Bind a whole card at once** — "Bind the fields inside…" on any container with a content
source. One sheet, every bindable place, pre-filled by `guessBindings` (which runs by
confidence, not document order, and consumes a field once used). Was ~15 interactions for a
five-field card. Doing it surfaced that **a WYSIWYG body was not bindable at all** — the
`rich` control had no `k`, so the UI never offered the most useful binding there is.

**Find and replace** — ⌘F. Searches page elements, both global regions, each page's title,
description and name, the project name and every CMS item value; a row jumps to wherever that
text is edited. Stays out of markup (`div` never matches a `<div>`) and out of page slugs (a
slug is a published URL). Replace all is one undo step.

**Copy/paste styles** — ⌘⇧C/⌘⇧V, or the two buttons in the Styling group. A second clipboard
from `clip` on purpose; replaces rather than merges; carries all three breakpoints, classes
and the text style, with `ts` gated on the target declaring that control the way `fanTargets`
already gates content props.

**Start an empty site** now sits beside Reset in Project settings: it clears pages, the
global regions and CMS *items*, keeps every library (colours, styles, classes, blocks, and
the collections' schemas), and is undoable. Before it, the only route out of the demo was
deleting two pages plus a 21-node header and footer by hand.

**Newest, this session** — four components and two export-quality fixes:

- **Accordion** — native `<details>`, so it ships no JavaScript; `single` is the native
  `name` attribute. Answers are plain text, paragraphed by blank lines.
- **Embed** — the escape hatch for markup the builder does not model. Ships verbatim;
  scripts are stripped *in the canvas only*, which renders on every keystroke.
- **Icon** — 35 stroke glyphs, `currentColor` plus one size variable. A linked icon with no
  label is a review error, because that link has no accessible name.
- **Gallery** — responsive grid, captions, and a lightbox that is a progressive enhancement:
  every tile is already an `<a href>` to the full image, so it works with scripting off.
- **A visible focus ring** on every focusable, in `currentColor` — the brand green measured
  1.6:1 on Paper, so a brand ring on a brand button was invisible. The video facade keeps its
  own pre-existing green ring: it has the same weakness, but it was not what the change was
  for, so it is left as found and written down instead.
- **`prefers-reduced-motion`** now reaches the export. It closes the stylesheet, *after*
  `meta.css`, so a project rule cannot switch motion back on.

## Verify it works

```bash
cd ~/Projects/braudyp.dev/page-builder
npm test            # rebuild + 325 cases, and reports the Artifact's freshness
npm run serve       # static server on :4877
open index.html     # or just open the file
npm run publish:check   # exits 1 if the published Artifact is behind
npm run hooks           # one-time: post-commit repeats that warning
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
5. **Cascade order** within a breakpoint: text style → class → element. Exactly two
   *breakpoint* media queries reach the export, plus one `prefers-reduced-motion` block that
   closes the stylesheet after `meta.css`. A test counts `@media (max-width` rather than bare
   `@media`, so the two do not get conflated again.
6. **`--mpad` owns the dialog inset**, the way `--gap-*`/`--h-ctl` own form rhythm. `.mh`,
   `.mb`, `.mf` and `#askBody` all read it, and `.tabs.flush` derives its edge-to-edge cancel
   and its label inset from it. Do not hard-code 18px in a dialog again — four copies of it
   plus an inline `padding:0 12px` gave the CMS dialog four different left edges.
7. **The export stylesheet carries no comments.** The first half of `baseCss` ships to every
   page; the reasoning for each block lives in `NOTES.md` and in the preamble above the
   function. Seven comments leaked into every export before this was noticed.

## How to work on it well

Three failure modes cost real time in this project. They are worth knowing in advance:

- **Bad defaults pass tests.** An unreadable button, a dead `#` link and cramped spacing all
  shipped under 106 green tests, because tests assert behaviour and these were defaults.
  Build a page as a user before trusting the suite.
- **SVG with a `viewBox` and no dimensions.** Bit three times — inline icons collapsed to
  nothing, a background caret scaled to fill the field. Always set width/height, or
  `background-size`. `iconSvg()` writes `width="24" height="24"` on every glyph for this
  reason, with `--icon-size` layered on in CSS; a test fails if the attributes go missing.
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
- **A CSS transition means a computed style read right after the click is the old one.**
  Reading the caret marker's `transform` immediately after opening a panel reported the
  identity matrix; the same read one call later reported `rotate(180deg)`. Same family as the
  microtask trap above — separate the act from the measurement.
- **A test that asserts a thing exists has not checked that it works.** The focus ring passed
  its assertion and was invisible: brand green measures 1.6:1 on Paper, so the ring round a
  brand-filled button could not be seen. Only looking at it caught that. This is the
  "bad defaults pass tests" lesson again, in a new costume.
- **~~The editor canvas is almost never at the desktop base~~ — fixed, and worth knowing
  why.** The canvas used to be whatever the panels left over (`window - 684`), so at a
  1440px window with the inspector open it was 741px and rendered the *mobile* layout
  while the chip read Desktop base. This was documented here as a gotcha for months; it
  was a design flaw. `canvasWidth()` now gives each breakpoint the width it means and the
  frame is scaled to fit, so what you see is what you are editing. The cascade fact behind
  the old symptom still holds: a text style carries its own `t`/`m` sizes and `treeCss`
  emits the breakpoint blocks *after* the desktop element rules, so setting `font-size` on
  the desktop base alone is still beaten below 1024px. Use `sized()`, which pins all three;
  a test fails if a styled heading resizes only on desktop.
  Also: after `setDev()` the frame width transitions, so `layoutCanvas` runs again on a
  timer — re-read any width in a later call.

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

1. ~~Drag-to-reorder in the Navigator, and multi-element drag~~ — both done. `moveMany` in
   core moves a set keeping its order; `layerTarget` resolves a Navigator drop from the
   thirds of a row. The HUD handle now shows for a multi-selection.
2. **Measure before optimising** — the canvas rebuilds `innerHTML` on content edits and undo
   keeps 80 full document clones. The demo is only 64 nodes; generate 300–500 and measure
   before changing anything
3. ~~Canvas zoom~~ — done, and it was the most important thing in the tool rather than
   the cosmetic item this list had it down as. Still open from that line: custom layer
   names, an Assets item in the rail
4. **Test the UI layer** — 4,400 lines have no unit tests, which is where the one real
   regression came from. Either extract more into core or add a DOM-shimmed layer. The three
   controls added this session (`qa`, `icon`, `imgs`) are all in that untested half
5. **The obvious next components**, now that the escape hatch exists: **Tabs** (needs a small
   script, and follows the `NAV_JS`/`LB_JS` pattern of emitting only when `data-tabs` is in
   the body), **Blockquote** as a real widget (the Pull quote pattern still exports a `<p>`
   where it wants `<blockquote>` + `<cite>`), **Table**, **Code block**, **Breadcrumb**
   (which pairs with CMS detail pages and would drive BreadcrumbList structured data), and a
   **scroll-snap slider** for logos and testimonials
6. **The CMS's missing verbs**: a Collection List sorts, directs and limits but cannot
   **filter**, which is what category and tag pages need; there is no **reference** field
   type, so nothing relates a post to an author; `content.json` goes out but nothing comes
   back **in**; and no **pagination** or **draft flag** that `exportTargets()` honours
7. **Export quality still open**: `srcset` (downscale via canvas at export — the biggest
   Lighthouse win and the biggest job), **JSON-LD** (Organization/WebSite per page, Article
   per item — a pure core function, easily tested), a **404 page** convention, and a
   **self-hosted fonts** option, since `gfontsLink()` is a third-party request and an EU
   privacy problem while `brand/fonts/` already proves the machinery
8. **Keep new form markup on the variables.** `--gap-1/2/3` and `--h-ctl/--h-row` in `:root`
   own every form measurement; there are no hard-coded vertical margins left in the markup.
   Anything sitting in a field row takes `--h-ctl` or it will be the one thing out of line
9. **Decide the product question**: does this become the editor for
   `~/Documents/Braudy/pagecraft` (a Next.js app with its own `PRODUCT.md` and `ROADMAP.md`,
   untouched so far), or stay standalone? The CMS now ships, so what a single HTML file cannot
   do is the deciding factor: letting anyone edit content without re-exporting needs a server

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
