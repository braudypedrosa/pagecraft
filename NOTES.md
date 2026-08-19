# Working notes

The how and the why. For orientation and current state read **[CONTEXT.md](CONTEXT.md)**;
for what the tool does for a user read `README.md`. Between the three, a conversation
transcript is never required to pick this up.

## Layout

| path | role |
|---|---|
| `builder.html` | source of truth — markup, styles, logic in one file |
| `build.mjs` | generates the three outputs below, and guards two invariants |
| `index.html` | generated: standalone page, doctype + brand fonts inlined |
| `dist/artifact.html` | generated: same fragment with fonts inlined, for publishing |
| `dist/core.cjs` | generated: the DOM-free regions, for `node --test` |
| `brand/` | vendored from the Pagecraft brand kit (fonts, licenses, tokens, logo) |
| `tests/core.test.cjs` | 221 cases against `dist/core.cjs` |

```bash
npm test          # rebuild, then run the suite
npm run build     # regenerate outputs
npm run serve     # static server on :4877
```

## Two rules the build enforces

1. **Core/UI split.** Pure logic lives between `/*<core>*/` … `/*</core>*/` markers and is
   extracted verbatim into `dist/core.cjs`. Anything touching the DOM stays outside.
   Adding a core symbol means adding it to the `EXPORTS` list in `build.mjs`.
2. **Control parity.** Every `case` in `ctlHtml` must have a matching `case` in `bindRight`.
   A slice-based edit once deleted four wiring branches while leaving their markup, giving
   controls that rendered and did nothing. The build now fails and names them.

## Storage

`localStorage['pagecraft.project.v1']`, migrating forward from the legacy `slate.*` key.
Images are blobs in IndexedDB (`slate.assets`), referenced as `asset:<id>`.

`SCHEMA = 7`. Migrations are cumulative and each is a no-op when already applied:

- v1→v2 images moved out of the JSON into the asset store
- v2→v3 loose `meta.color/bg/accent` became the reserved `text/bg/brand` tokens
- v3→v4 added `tokens.classes`
- v4→v5 backfilled `tag` onto the stock text styles
- v5→v6 added `meta.blocks`
- v6→v7 added `meta.collections`

## Blocks, and what "global" means

A block is `{id, name, node, sync}`. Saving asks for both the name and the choice in one step —
the toggle changes what saving means, so asking afterwards would be too late.

- **Plain block:** `blockInsert` places an independent copy. A starting point you are free to
  diverge from. This is the original behaviour.
- **Global block:** each placed copy is tagged `adv.block = <blockId>`. That link is what lets
  `blockPush(nodeId)` take one copy's content, make it the block, and bring every other copy into
  line — across every page and both global regions, found by `blockInstances`.

The link is deliberately *not* live sync. Copies are real, independently editable nodes; you edit
one and then push, with the same "N others will change" confirmation `tsUpdateFrom` uses for text
styles. Live sync would need an editing scope of its own, the way the global header and footer
work — worth doing, but a bigger change, and it would take in-place editing of a copy away.

A push preserves each copy's node id, so a selection is not lost mid-edit. Nothing about any of
this reaches the export, which only reads `adv.htmlId/cls/css`.

**`reid` now surrenders `adv.htmlId`.** It is the single funnel for every fresh copy — duplicate,
paste, place a block, push a block — and all four produced a `duplicate-id` error the moment the
source carried a hand-set anchor. Placing the demo's `#craft` section as a block was enough to do
it. Auto ids are derived per node so they stay unique on their own; only the hand-set anchor has
to go, and originals never pass through `reid`.

## Content collections

A collection is a content type: `{ id, name, slug, fields[], items[], detail }` on `state.meta`,
beside `tokens` and `blocks`. `SCHEMA` 6 → 7, one additive migration — nothing existing binds to
one, so an empty list is the whole step.

Phase 1 is the data only: the sidebar lists collections, and a wide dialog holds the field schema
and the items table. Binding, the Collection List and per-item pages come next.

- **Ids are slugs.** A collection id and an item slug both read in the binding UI and in exported
  paths, so both go through `uniqueId` against their own list rather than a global counter.
- **The first text field is the title.** It names the item everywhere and derives its slug — the
  closest thing a collection has to a title, without making the author nominate one.
- **A hand-set slug stops following the title.** `itemSetSlug` sets `slugLocked`, because a URL
  that is already published should not move when someone fixes a typo in the heading.
- **Deleting a field clears its values.** An item cannot carry a value for a field the schema no
  longer has, or the next export emits orphans. `fieldDelete` returns how many it cleared, which
  is what the confirmation counts.
- **A collection keeps at least one field**, or there is nothing to fill in.
- **`seed()` does not clear collections or blocks** — they are project libraries, not page
  content, so Reset to demo content leaves them. The test harness clears them itself.

## Content collections

`meta.collections`, `SCHEMA` 6 → 7. A collection is a content type — a field schema plus the
items that fill it:

```js
{ id:'projects', name:'Projects', slug:'projects',
  fields:[{ id:'title', name:'Title', type:'text', required:1 }, …],
  items: [{ id, slug:'acme-rebrand', values:{ title:'…' } }],
  detail:'' }            // the page that templates each item (phase 4)
```

Field types mirror controls that already exist: `text · rich · image · link · number · date ·
option · bool`. An image value is an `asset:<id>` reference, and its cell opens the same
`mediaPicker()` every image field uses.

- **Ids are slugs**, made unique against their own list by `uniqueId` — they read in the binding
  UI and land in exported paths.
- **The first text field names each item** and gives it its URL. `itemSet` re-derives the slug
  as the title is typed, but stops the moment `itemSetSlug` is used: a published URL should not
  move because someone fixed a typo. That is what `slugLocked` is for.
- **Deleting a field clears its values on every item.** An item cannot carry a value for a field
  the schema no longer has, or the next export emits orphans. The confirm only appears when
  values would actually be lost — the same rule the colour and class deletions use.
- **A collection keeps at least one field**, since a collection with none could hold nothing.

`seed()` deliberately leaves collections and blocks alone — they are project libraries, not page
content, and "Reset to demo content" is page-scoped. The test harness's `blank()` clears them.

### Binding

`node.bind = { text: 'title' }` names a **field and nothing else**. The collection comes from
`node.src` on the nearest ancestor, so a card carries no collection id of its own and the same
card works wherever it lands — under a Collection List, or on a detail page.

- **`renderNode` resolves at one line.** `const p = boundProps(n, o2.col, o2.item)` replaces
  `const p = n.props`, so every widget case picks up bound values without being touched. A node
  with `src` opens a scope for itself and its subtree; `boundProps` returns the identity object
  when nothing is bound, so an unbound tree costs nothing.
- **A bound value always wins, even when empty.** The canvas has to show what the export writes,
  not a placeholder that quietly vanishes at build time.
- **The bind badge shares the label slot with the responsive badge** — same size, same green
  "this is not a literal any more" meaning. That is what made "everything that can be set"
  affordable: one badge per control, not a redesign.
- **A bound control shows its resolved value and goes inert**, with the badge left live to
  unbind. Showing the stale literal while the canvas showed something else was the first version
  and it read as a bug.
- Bindable = content props, minus `ts`: a text style is a design choice, not content.

### The Collection List

A `list` widget at the **same level as a row**, so it drops wherever a row drops and holds
columns. Its collection is `node.src` — the field phase 2 already uses — so anything inside binds
with no extra plumbing. Put one Column in and you get a grid of cards.

Its contents repeat **as a group**, once per item. One column in means N columns out; two means
2N. Nothing is silently dropped, which is why it repeats everything rather than only `children[0]`.

- **Every repeat needs its own id.** The first version shipped the same `id` on all N cards —
  invalid markup, and it breaks any anchor pointing into one. `renderNode` suffixes the id with
  the item slug when `o.repeat` is set; a hand-set `adv.htmlId` gets the same treatment, since an
  anchor cannot be unique across repeats either. In the **editor** the first repeat keeps the bare
  node id so `getElementById` still resolves it for selection painting, the HUD and the grips,
  while every copy keeps `data-id` pointing at the one template node.
- **`listItems`** applies sort, direction and limit. Sorting a `number` field compares numerically
  — as text, 100 sorts before 99. A limit of 0, empty or unparseable means all.
- **An empty collection exports nothing**, not an empty wrapper; the editor still explains why.
  Same for a list with no collection or no card.
- `select` controls may now take `opts` as a function of the node, which is how Sort by lists the
  chosen collection's fields.

### Detail pages

`page.collection` makes a page a template: at export it emits one file per item at
`<collection.slug>/<item.slug>.html`. `page.bindTitle` / `page.bindDesc` give each file its own
`<title>` and meta description, which is most of why per-item pages are worth having.

**`exportTargets()` is the new source of truth for what ships** — one entry per ordinary page,
one per item for a template, each carrying `{ pg, path, rel, col, item }`. The export picker, the
download handlers and `sitemapXml` all read it, so none of them can disagree about the file list.

The hard part was not generating the files, it was that **a page in a folder breaks every internal
link**. Two choke points fixed it:

- **`pageHref(link, o)`** — every link a page emits already funnelled through `safeUrl(p.link)`,
  so wrapping that one call in three widget cases plus the nav was enough. It prefixes `o.rel`,
  and resolves `cms:item` to the detail page of whichever item is rendering. Anything already
  absolute — a scheme, `//`, a rooted path, a bare fragment — is left alone.
- **`assetsToPaths(str, rel)`** — image paths climb out of the folder the same way.

Because both read `o`, the **shared header and footer come out right on a nested page** without
knowing anything about collections: `../index.html` there, `index.html` at the root.

`bindScope` falls back to `page().collection`, so a detail template needs no `src` node — the page
itself is the scope.

The review learned one thing: `cms:item` cannot be checked as a path, so instead it reports the two
ways it can genuinely fail — nothing around it names a collection (`item-link-no-scope`), or no
page templates that collection (`item-link-no-template`). It flagged `cms:item` as a dead link
until then.

### content.json

`contentJson(imgPath)` writes every collection — schema and items — beside the HTML. Two
deliberate choices:

- **No timestamp.** The same project exports the same bytes, so the file diffs cleanly and
  re-imports predictably. A generated-at stamp would make every export differ.
- **Every field appears on every item**, empty where unset, rather than omitted. A consumer can
  rely on the shape instead of probing for keys.

An item that has a detail page carries its `url`; one that does not carries none, rather than a
link to a file that was never written. Image values pass through the `imgPath` resolver the caller
supplies — the UI hands it `assetPath`, which maps `asset:<id>` to the same `assets/…` path the
HTML uses. Core takes it as an argument because only the UI holds the asset store, and that keeps
the function testable.

The site itself stays plain static HTML with everything baked in. This file is the portable copy —
re-importable, diffable, feedable to something else — not a runtime dependency. A page never
fetches it. Everything resolves at export — the site
that ships is plain HTML, with the JSON alongside as a portable copy.

## Zip export

The whole site as one archive, which is the only export that can honour a nested detail page — a
browser download saves flat, so `projects/acme-rebrand.html` would arrive as
`projects-acme-rebrand.html`.

Written by hand rather than pulled in: a site is a handful of files, and the format is a local
header per entry, a central directory, then a twenty-two byte tail. `CRC32` is a table and a loop;
compression comes from `CompressionStream('deflate-raw')` where the browser has it and falls back
to **stored**, which is still a valid archive. Entries under 256 bytes are stored regardless.

**Timestamps are fixed at the ZIP epoch** so the same site zips to the same bytes — the same
reasoning as `content.json` carrying no generated-at stamp.

`sitePlan()` in core lists what belongs in it: every page from `exportTargets()`, `content.json`
when there are collections, and the SEO pair when a Site URL is set. The UI appends every image any
page references, at the path those pages point to.

Verified by decompressing the archive with the browser's own `DecompressionStream` — independent of
the compressor — checking that each central-directory offset lands on a local header with a
matching name, and reading the extracted files: the detail page's `<title>` is the item's, its nav
carries `../`, the root page's does not, `content.json` parses, and `robots.txt` came through
stored. A system `unzip -t` would be a stronger check and is worth doing once by hand.

## Media library

A **grid modal** off the rail (`mediaModal`), not a side panel and not a field buried in Project
settings. It started as a 272px panel, which fitted one card per row — no way to look at images.
The modal takes `.modal.lg` and lays out six across. It is a view over `AS.mem`; the blobs stay
in IndexedDB.

- **One card builder, two surfaces.** `mediaCards(list, use, attr)` draws the tiles for both the
  manager and `mediaPicker`, so they cannot drift.
- **One upload path.** `mediaTake(file)` does the type check, the large-image warning and the
  toast — used by the modal, every element image field, and the favicon/social fields.
- **Every image field offers Upload *or* Library.** `mediaPicker()` returns a promise of an asset
  id and rides the ask layer, so it can open from inside Project settings, which is exactly where
  the favicon and social-image fields live. It replaced a `<select>` of filenames.
- **`askOpen(…, null, …)` means "no commit button"** — a picker resolves by choosing something, so
  its footer shows only Close.
- **Clicking a card places the image and closes the modal**, via `smartTarget('image')` extracted
  from `appendSmart`. The library is somewhere to work from, not an inventory.
- **`assetAdd` measures and stores intrinsic size.** It used to be measured by each caller and set
  on the in-memory copy only, so a reload dropped it — and it is what the export writes as
  width/height and what `no-dimensions` reads.
- **`.mcard` needs `width:100%`.** A `<button>` sizes to fit-content, so a long filename with
  `white-space:nowrap` widened one card to 254px inside a 161px grid cell — and since the thumb is
  `aspect-ratio:4/3`, it grew taller too, giving a row of uneven tiles.

## Dense list rows

The three lists in Project settings — colours, text styles, style classes — all use `.arow`, and
every row in all three is one line at 50px. Two rules got them there:

- **No stacked `<small>` under the name field.** That was what made a row two lines, and it made
  rows *within one list* different heights whenever the meta was conditional ("Built in" on
  reserved colours, "unused" on images). A read-only figure goes in a `.rowmeta` slot instead,
  which takes `--h-row` like a control so it cannot push the row over.
- **No usage counts.** They were noise on every row. Where a usage figure genuinely matters it
  appears in the delete confirmation, which is the moment it is worth reading. The media library
  is the one place that still shows `unused`, because its "Remove N unused" button depends on it.

Text style rows edit **size and weight inline**, writing `css.d` — the desktop base. The expanded
editor is where per-breakpoint overrides live, and its caret tooltip says so. A bare number in
the size field normalises to px via `parseU`, so typing `64` gives `64px`; clearing the field
deletes the declaration rather than writing an empty one.

## Column drag-resize

`resizeCols(row, i, pct, b)` is pure and tested: it moves `pct` of the row's width across the
gutter between columns `i` and `i+1`, leaves every other column alone, and clamps at `MIN_COL`
(4%) so a column can never collapse to something you cannot grab back. `applyColsAt(row, ws, b)`
writes the result at one breakpoint without touching the column count — `applyCols` remains the
one that adds and removes columns.

- **It writes at `dk()`, not at `d`.** The column's own Width (share) control is responsive, so
  resizing on Tablet had to produce a tablet override; writing the desktop base from a tablet
  drag would have been a silent corruption. `rowRatiosAt` reads with the same mobile → tablet →
  desktop fall-through the stylesheet uses.
- **The grips live in `#s-hud`, not the canvas DOM,** so there is no way for a resize affordance
  to leak into the export. They are positioned from the live column boxes rather than the stored
  ratios, so they land correctly whatever the widths resolve to.
- **A wrapped row gets no grips.** When the columns stack there is no vertical gutter; the check
  is `b.left < a.left + 1` on the adjacent pair.
- **One `tx` key for the whole gesture,** so a drag is a single ⌘Z rather than one per
  pointermove. Only `paintCss()` runs during the drag — the canvas is never rebuilt.

## Asking for things

`askText(title, label, value, opts)` and `askConfirm(title, msg, opts)` replace all 19 native
`prompt()`/`confirm()` calls. Both return a promise — a string / `true` on confirm, `null` /
`false` on any exit (button, X, backdrop, Escape).

The reason this had to change is not only that OS chrome looked wrong in an art-directed tool:
**sandboxed iframes refuse `prompt()` outright.** Naming a class, adding a colour, saving a
block and naming a text style therefore did nothing at all in the published Artifact — the
click threw `prompt() is not supported` and the flow died silently.

Three things the implementation has to get right:

- **It is a second layer, `#ask`, not the shared `#modal`.** Over half these asks fire from
  inside Project settings, and reusing the one modal element would tear the dialog underneath
  out from under the user. `#ask` sits at `z-index:300` above it.
- **`createLink` needs its range back.** The two link prompts run `execCommand` against the
  canvas iframe's live selection, and opening a dialog moves focus out of it. `linkPrompt()`
  clones the range first and restores it before the command, or the link lands nowhere.
- **Every calling handler had to become `async`.** Twelve of them. `node --check` on the
  extracted `<script>` is how to catch a missed one — the build does not parse the UI layer.

Green stays off destructive confirms: `askYes` takes `.primary` for a normal commit and
`.danger` for a delete, per the reserved-green rule.

## The history buttons

`paintHistory()` is the single owner of the Undo/Redo disabled state, called from `tx`, `endTx`,
`repaint`, `repaintCss` and `render`. `tx()` pushes a snapshot without going through `edit()`, so
`HOOKS.change()` never fired and the buttons kept their stale state until the next full render —
after any style edit `hist.u.length` was 1 while Undo was still greyed out. ⌘Z worked, so the
bug read as "the button is broken" rather than "the state is stale".

## Form rhythm and control heights

Five variables in `:root` own every form measurement, because there used to be nine
hard-coded inline margin values in the markup and four control heights inside one row:

| | |
|---|---|
| `--gap-1` 6px | a label to its control · a note to what it annotates · stacked rows |
| `--gap-2` 12px | one field to the next (exactly double `--gap-1`) |
| `--gap-3` 14px | the panel inset, and the space a group leaves at its foot |
| `--h-ctl` 37px | a full-size control, and anything that sits beside one |
| `--h-row` 32px | a compact control inside a dense list row (`.arow`) |

Three things this had to fix, all of which read as "awkward" without being obvious:

- **`.ctl` had no explicit `line-height`,** so the same control measured 37px in a panel and
  38px in a dialog. Nothing could be aligned to it. It is pinned at 1.4 now, which is what
  makes `--h-ctl` a fact rather than an estimate.
- **Grid gap and field margin were double-counted.** The dialog's paired fields sat in a grid
  with `gap:14px` while each `.f` also carried `margin-bottom:11px` — 25px apart, against 11px
  for the same fields in a plain stack. `.fgrid` now owns the row spacing and `.fgrid>.f`
  gives its margin up. One owner.
- **Satellites in a field row had no height at all.** `.clr .x` collapsed to its 13px glyph;
  the swatch was 30px beside a 37px field. Swatch, control and trailing button are all
  `--h-ctl` now, so a colour row has one top edge and one bottom edge. Same treatment for
  `.tg`/`.tgx` in the class-target row.

Bare text inside a row (`.tgrow small`, "5 uses") is *not* given a control height — it stays
centred. A row measuring 37/17/37 is correct, not ragged.

## The inspector comes and goes

`#right` is hidden outright when nothing is selected — there is nothing to inspect, and the
canvas gains the width. Two things this depends on:

- **Any class that sets its own `display` beats the browser's `[hidden]` rule** and needs an
  explicit escape hatch. This has bitten twice now: `.right[hidden]` for the inspector, and
  `.btn[hidden]` for the picker's hidden commit button, which rendered as an empty green square.
  Every element the code toggles `hidden` on — `#right`, `#modal`, `#ask`, the panes, `#askYes` —
  has a matching rule; add one for anything new.
- The panel joining or leaving changes the canvas width, so `renderRight` re-runs
  `positionHud()` and `renderDim()` on the next frame whenever its visibility flips.
  `select()` paints the HUD *before* it calls `renderRight`, so without this the selection
  frame lands 318px off the element it is meant to be framing.

Worth knowing: with the panel away the default canvas is ~1134px instead of ~816px, which is
finally *above* the 1024px tablet breakpoint — so the editor's resting state now shows the
desktop base rather than the tablet overrides.

## Tool rail

Three panel items (Add, Navigator, Pages) then a `.railgap` spacer and **Project**, which
opens a dialog rather than swapping the panel. The click handler returns early on
`data-act="project"` and the `.on` toggle is scoped to `[data-t]` buttons, so a dialog item
never takes the active treatment for a panel that has not changed. The top bar keeps its own
Project button — the rail is hidden in preview, so that one is the fallback.

## Add panel

`renderPalette` draws the tab row; `drawAddBody` fills `#addBody` per tab. Template previews
are inline SVG wireframes built from the `pb`/`pl`/`pg`/`ph` helpers — blocks, lines, the green
action, headings — so nothing raster ships. Every left edge in the panel is on a 14px inset;
the tab row needs an explicit `height` because its parent scrolls as a block, not a flex column.

## Exported naming

Widget class `pagecraft-<widget-slug>` + styling hook `pagecraft-<nodeid>`; auto id
`pagecraft-<widget-slug>-<nodeid>`, overridden verbatim by `adv.htmlId`. All four derive from
`widgetSlug` / `nodeClass` / `autoId` / `domIdOf` in core — change them there, not in
`renderNode`. Editor-only classes keep the short `s-` prefix because they never ship.

## Cascade order

Within each breakpoint: **text style → class → element**. All are single-class selectors, so
source order decides. `treeCss` emits `baseCss + tokens.d + elements.d`, then one `@media`
per breakpoint in the same order. Exactly two media queries reach the export.

The consequence that bites: because the breakpoint blocks come *after* the desktop element
rules, an element value set only on the desktop base loses to a text style's own tablet or
mobile value. Tablet is `max-width:1024px` and the editor canvas is ~816px, so this is the
normal case, not an edge one. `sized(px, extra, mobile)` pins a font-size at all three
breakpoints; a test walks every template and pattern and fails on a desktop-only override.

## The selection set

`state.ui.sel` holds the one **primary** selection — the key object whose controls the
inspector draws — and `state.ui.multi` holds the rest. Splitting it this way is what let
every existing single-selection path keep reading `state.ui.sel` untouched; only the code
that fans out calls `selIds()`. Nothing is persisted, so there was no migration.

`applyC` is the single funnel every control writes through, which is why fan-out is one
change rather than fifty. Its rules live in `fanTargets` (core, tested): a CSS property
reaches every member; a content prop reaches only members whose type declares that control;
`_id` never fans out, because two elements cannot share an HTML id. A class target is
already shared by its members, so it takes one write instead of N.

On the canvas both modifiers add, because a range needs a flat list to sweep and the canvas
has depth instead — shift-clicking two headings would otherwise drag in every row and column
between them. The Navigator is the surface that presents a list, so that is where shift takes
a range, and `selRange` walks it the way `renderLayers` does: skipping the children of a
collapsed row, so a range cannot reach what is not on screen.

`topMost()` drops any id that already has an ancestor in the set — otherwise delete and
duplicate act twice on the same subtree, and the second delete acts on a node that is gone.
`delMany` runs back to front so a splice cannot shift an index still to come.

## Decisions worth not relitigating

- **Global regions edit in place** with the rest of the page dimmed. This departs from
  `branding/screens/SCREEN-DIRECTION.md`, which specifies a separate workspace. Deliberate.
- **Green is reserved** for action, focus, selection and status. Publish is the only green
  fill in the chrome. "Done" is neutral because leaving a scope is not a committed action.
- **Brand Slate fails AA as body text** (4.27:1 on Paper, 4.05:1 on Ink). The defaults ship
  three Slates: `muted` #5f6660 for Paper, `muted-i` #b0b7b1 for Ink, `slate` #6f7771 for
  fills and large text. The real fix belongs upstream in the brand kit.
- **An image starts with no alt text, and the prompt lives in the placeholder.** The default
  used to be the literal string `Descriptive alt text`, which satisfied the `no-alt` check —
  so a hand-placed image exported meaningless alt text and the review never said so. Guidance
  that ships as a prop value is content; guidance in a `ph` is guidance.
- **Element image fields are upload-only.** Project favicon and social image are uploads too;
  the social one needs a Site URL plus separate-files export to resolve for crawlers.
- **There is no bare Column in the palette.** Every route it offered was already covered:
  dropped on the root or a section it built the same `Section > Row > Column` that **Columns**
  builds, and dropped on a row it did what that row's own 1–6 count control does. `DEF.column`
  stays — `cols()`, `wrap()`, `applyCols()` and every template depend on it. Columns are
  created for you and then styled, not added by hand.
- **A link's mode is remembered while it has nothing to store.** The mode is derived from the
  href, so `url`, `email` and `phone` parsed back as `none` before you had typed anything: the
  select snapped shut, its input never appeared, and anything typed was discarded because the
  builder was told the mode was `none`. `ui.lmode` holds the pending choice, and `linkOf()` is
  read by *both* the markup and the wiring — the bug's second half was those two disagreeing.
  Cleared when the selection moves, like `ui.target`.
- **Links are destinations, not strings.** A bare `#anchor` is normalised to `page.html#anchor`
  so it survives being placed in a global region.
- **The dark chrome restates `color` for every button variant.** `.topbar .btn:hover` and
  `.btn.ghost:hover` are both three classes, so the bar only won on source order — and since
  it never mentioned `color`, the light-surface `var(--text)` leaked through and painted
  near-black text on the ink bar at **1.19:1**. The rule is now `.topbar .btn.ghost:hover`
  (four classes), so it wins on specificity rather than on position. Any new `.btn` variant
  that sets its own hover `color` needs the same treatment, or it inherits the same bug.
- **A colour field looks the same in both its states.** `.tokchip` (linked to a token) now
  shares `.clr .hex`'s chrome exactly — same background, border, padding and type size — and
  the green link glyph carries the difference. It used to be a solid ink pill, which made
  half the colour fields in a panel read as a different widget.
- **Templates and patterns share `T_H`/`T_T`/`T_SEC`/`T_B`/`T_BG`/`sized`/`divider`/`carded`.**
  `T_H` derives the outline level from the text style (`display`→h1, `title`→h2,
  `subtitle`→h3, `eyebrow`→div) with an explicit override as the fourth argument. Before
  this, `N` filled the level from the widget default and *every* template rendered a flat
  run of H2s with no H1 — 4 templates shipping that under 132 green tests.
- **`carded()` puts every card-shaped pattern on one shared `Card` class,** so restyling a
  card restyles all of them.

## Recurring failure modes seen here

- **Bad defaults pass tests.** An unreadable button, a dead `#` link and cramped spacing all
  shipped under 106 green tests, because tests assert behaviour and these were defaults.
  Build a page as a user before believing the suite.
- **SVG with a `viewBox` and no dimensions.** Bit three times: inline icons collapsed to
  nothing, and a background caret scaled to fill. Always set width/height, or
  `background-size`.
- **Bundled probes lie.** Several verification steps gave wrong answers because six
  mutations shared one expression, or the canvas was at tablet width. One step per call.

## Open, roughly in priority order

1. ~~Cross-browser pass~~ — done. `tools/compat.html` probes 28 dependencies and reports to
   `tools/probe-server.mjs`; run it with `node tools/probe-server.mjs` then open
   `http://localhost:4899/` in each browser. Safari 26 / Firefox 153 / Chrome: **28/28 pass**,
   including `execCommand('bold')` actually formatting and a Blob surviving IndexedDB →
   `blob:` URL → `<img>`. One check needs a human gesture — pointer capture holding over an
   iframe — and is on the page as a drag target
3. Column drag-resize on the gutter; drag-to-reorder in the Navigator; **multi-element
   drag** — the HUD hides its drag handle while several are selected, because moving a set
   together was out of scope for the multi-select pass
4. Measure before optimising: canvas rebuilds `innerHTML` on content edits, and undo keeps
   80 full document clones. The demo is 64 nodes — generate 300–500 and measure first
5. Canvas zoom; custom layer names; an Assets item in the rail
6. `4,241` of `7,363` lines are UI with no unit tests — extract more into core, or add a
   DOM-shimmed layer
7. Decide whether this becomes the editor for `~/Documents/Braudy/pagecraft` or stays
   standalone. It changes whether CMS, accounts and cloud persistence are next
