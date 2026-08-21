# Pagecraft

Build a website visually and export real, static HTML — no accounts, no build step, no
dependencies.

## Run it

```bash
open index.html
```

One file, no install. Everything, autosave included, runs in your browser.

## Components

| Component | Notes |
|---|---|
| **Section** | Boxed or full-width inner container, tag from a whitelist |
| **Columns** | A row of columns — pick the count (1–6) and the split in its settings |
| **Row** | Bare flex container: gap, wrap, vertical align, distribution |
| **Heading** | h1–h6/p/div, optional link, text style or direct typography |
| **WYSIWYG** | Inline rich text: bold, italic, links, lists, headings, quotes |
| **Image** | Upload or reuse a stored image; alt, caption, link, fit, filters, intrinsic size |
| **Video** | YouTube, Vimeo or self-hosted file; ratio, autoplay/loop/mute |
| **Button** | Solid/outline/ghost/link, hover colours, trailing icon |
| **Nav menu** | Link list that collapses to an accessible burger menu |
| **Form** | Labelled fields (text, email, phone, number, long text, dropdown, checkbox), required flags, a submit endpoint |
| **Accordion** | Question and answer rows that fold. Native `<details>`, so it ships no JavaScript |
| **Gallery** | A grid of stored images, with captions and a full-size lightbox |
| **Icon** | One of 35 stroke glyphs, sized and coloured like text |
| **Embed** | Raw HTML for anything this builder does not model — a map, a booking widget, an SVG |
| **Divider**, **Spacer** | Layout helpers |

Columns stack their children with a 16px gap by default, so a first draft is never cramped.
Pages can be reordered in the Pages panel, which also sets the sitemap order.

The demo shares one **Card** class across its three feature cards — one rule in the export,
three elements using it.

Columns are created for you rather than added by hand — **Columns** drops a row of them and
its count control goes from 1 to 6. Select one to style it: proportional width per breakpoint,
padding, background, alignment.

**Reordering:** drag the handle in the selection toolbar on the canvas, press ⇧↑/⇧↓ to move
among siblings, or drag a row's handle in the **Navigator** — the list is the surface for
moving a Section past another Section, or for dropping something into a container that is
still empty. In the Navigator, the top and bottom thirds of a row place the element before or
after it, and the middle drops it *inside* when that row can hold it.

**Several at once:** with a multi-selection, the toolbar handle and the Navigator handle both
move the whole set. They keep their relative order and land together.

**Resizing:** select a row (or any column in it) and a grip appears on each gutter. Drag it to
move width between the two neighbours — every other column keeps what it had, so the row never
drifts off 100%. A live readout shows the split, a column stops at 4% rather than collapsing
where you cannot grab it back, and the whole drag is one ⌘Z. It writes to the breakpoint you
are editing, so resizing on Tablet leaves the desktop base alone. Where a row wraps and the
columns stack, there is no vertical gutter and no grip.

Structure is `Section › Row › Column › content`. Drop a component anywhere and the
missing wrappers are created automatically.

**Columns** drops a row of two. Its settings hold the column count (1–6) and, where more
than one split exists for that count, a layout picker drawn as proportional diagrams
(50/50, 66/33, 33/66, 75/25, …). The count is structural, so it lives on the desktop base;
per-breakpoint widths are set on each column's own Width control. Reducing the count moves
content out of the removed columns into the last surviving one rather than discarding it.

### Accordion

Each row is a real `<details>` with a `<summary>`, so the browser owns the behaviour: it
opens on click *and* on Enter or Space, it is announced to a screen reader, and the page
ships no accordion script at all. **One open at a time** is the native `name` attribute —
also the browser's job, not a script's. Where a browser has not caught up, the panels stay
independent, which is a lesser accordion rather than a broken one.

An answer is plain text: a blank line starts a new paragraph, a single newline is a break.
The marker is plus/minus, a caret, or nothing, and every part of a row — padding, both type
sizes, the divider and the marker — is a variable you can restyle at any breakpoint.

Select the accordion and every panel opens on the canvas, so the answers can be read and
styled; that is editor-only and never reaches the export.

### Gallery

Pick images from the Media library or upload several at once. Columns are **responsive** —
three on desktop, two on mobile by default — and the tile shape is a ratio (4:3, square,
16:9, or whatever each image is). Alt text and an optional caption belong to each image.

With **Open full size on click** on, every tile is a real `<a href>` to the full image, so
the gallery works with JavaScript off. The small script that ships only *upgrades* that link
into an overlay — a native `<dialog>`, which brings its own focus trap, Escape handling and
backdrop; arrow keys and the on-screen arrows step through, and it wraps.

### Icon

Thirty-five stroke glyphs on a 24px grid, in four groups. An icon takes `currentColor` and
one size variable, so it inherits colour the way text does and scales with one control; give
it a background and padding and it becomes a badge.

Naming an icon makes a screen reader read it; leaving the label empty hides it, which is the
right answer for a glyph beside text that already says the same thing. A **linked** icon puts
the label on the link, because a link whose only content is a glyph otherwise has no
accessible name — and the review reports it as an error if you leave it out.

For a mark the set does not carry — a specific brand logo, say — paste its SVG into an
**Embed**.

### Embed

The escape hatch: markup this builder agrees not to understand, pasted straight into the
page. A map, a booking widget, a payment button, a third-party form, an inline SVG.

Scripts **ship to the exported page but never run in the editor**, which renders on every
keystroke; an embed that draws nothing without its script shows a placeholder and says how
many were held back. The review says the same thing, because it cannot check markup it does
not read. Pick an aspect ratio for an iframe that has no height of its own.

## Starting your own site

The builder opens on the Pagecraft demo, which is there to be read rather than kept.
**Project → Start an empty site** clears every page, the global header and footer, and the
items in any CMS collection, then asks what to call yours. What you *built* stays: colours,
text styles, style classes, saved blocks, and the collections' own field schemas — a content
type is something you designed, its items are content. ⌘Z brings the whole previous project
back if you change your mind.

**Reset to demo content** is the way back in the other direction.

## Global header and footer

Global by default on every page, and **edited in place** — never on a separate screen.
The canvas always shows all three regions. Hovering a region reveals a chip naming it;
clicking **Edit header** or **Edit footer** makes that region live and fades the rest of
the page to 30% and non-interactive, so it is unmistakable which global element you are
changing. Nothing stays pinned over the canvas: while a region is live, the status and the
**Done** button sit in the strip above it, in the chrome. The Navigator mirrors the same
model: three region rows, the live one expanded, the others locked.

Locked regions swallow interaction, so global structure is never edited by accident — only
the explicit chip button changes scope.

> Note: `branding/screens/SCREEN-DIRECTION.md` specifies a dedicated Global Regions
> workspace outside page documents. This build deliberately departs from that and edits
> them in place with focus dimming.

## Controls

Structured values get structured controls throughout: measurements are a number plus a unit
dropdown (container width, base font size, and every element measurement), language is a
picker of BCP-47 tags, images are upload fields, links are destination pickers, fonts and
shadows are libraries. What stays free text is only what is genuinely open-ended — names,
titles, slugs, the site URL, colour hex values, gradients, transforms, and the CSS and head
code fields.

Anything with a known set of values is a picker, not a text field. **Shadow** and
**Transition** offer named steps; **Filter** offers the common ones. Each list ends with
**Custom…**, which reveals a text field for anything the list does not cover — and a value
the list does not recognise reopens that field automatically.

**Icon** is a grid of the glyphs themselves, grouped, not a dropdown of names — thirty-five
names in a list is not a set you can choose from. **Questions** and **Images** are repeatable
rows on the same chrome as menu links and form fields, so a list of things looks the same
wherever one appears. A property that edits a list of its own is never offered for CMS
binding: there is no single field an item could supply for an array.

Every measurement has a unit dropdown, and the same property offers the same units wherever
it appears: sizes in `px/rem/em/vw`, lengths in `px/rem/%/vw/vh`, spacing and radii in
`px/rem/%`, tracking in `em/px`, border widths in `px/rem`.

**Font** draws on a library of 49 Google Fonts grouped by category — sans, serif, display,
monospace — plus system stacks. Choosing one is the whole job: the families actually in use
are collected from the project, its text styles, its classes and every element, and the
stylesheet link is written into each exported page automatically, with both preconnects and
`display=swap`. Nothing to paste into the head, and unused families are never requested.
The project-level body and heading fonts use the same picker.

Manrope and DM Sans are also embedded in the builder itself, being the brand faces, so they
render on the canvas with no network at all. Other Google families load over the network for
the canvas preview, so anywhere the builder runs without network access they fall back to
their stack while the **export still links them correctly**. Run `index.html` locally to
preview them for real.

## Add panel

Three tabs. **Widgets** are the components, in four groups — Layout, Content, Interactive,
Spacing — grouped by what a thing does rather than by how it is built, which is why the
Accordion sits beside the Form. **Blocks** are what you have saved from your own
pages. **Templates** are twenty-six ready-made sections, grouped by what they are for:

| category | sections |
|---|---|
| Hero | Split hero · Centred hero · Hero with signup |
| Features | Three features · Three cards · **Three features with icons** · Alternating rows · Two cards |
| Media | **Image grid** · Full-width media · Logo strip · Image pair |
| Call to action | Closing call to action · Inline call to action |
| About | About, image left · Statistics row |
| Testimonial | Pull quote · Three testimonials |
| Contact | Contact with form |
| Pricing | Three plans · Two plans |
| Process | Numbered steps |
| Team | Team grid |
| FAQ | **Questions that fold** · Question list |
| Content | Two-column prose |

Each is shown as a **wireframe preview** rather than a name in a list, with the green mark
showing where the action sits. The previews are drawn inline as SVG rather than shipped as
images, so they stay self-contained, scale, and read in either theme.

Every section builds from this project's colour tokens and text styles, so a template arrives
already on-brand rather than importing someone else's look. Drag one onto the canvas, or click
to append.

## Exported markup

Everything Pagecraft emits is namespaced, and everything addressable has an id:

```html
<section id="pagecraft-section-rk4811sc" class="pagecraft-section pagecraft-rk4811sc">
  <div class="pagecraft-container">
    <h1 id="pagecraft-heading-rk4812dv" class="pagecraft-heading pagecraft-rk4812dv ts-display">
```

The first class names the widget (`pagecraft-heading`, `pagecraft-nav-menu`,
`pagecraft-wysiwyg`); the second is the per-element hook the generated stylesheet targets.
The `id` is auto-generated from the widget name and is stable across renders, so it is safe
to link to — and it is **overridable under Advanced**, where the field shows the generated
value as its placeholder so you can see what you are replacing. Set an id there and it is
used verbatim; the styling hook is untouched either way.

## Templates and saved blocks

**New page** opens a whole-page template picker with twelve starts:

| | |
|---|---|
| **Blank** | An empty page |
| **Landing page** | Hero, three features, closing call to action |
| **Pricing** | Intro and three plan columns |
| **Contact** | Short intro beside a working form |
| **About** | The story, a stats row and a closing action |
| **Services** | What you offer, how it works, then an action |
| **Work** | A grid of projects with room for captions |
| **Case study** | One project: the brief, the work, the result |
| **FAQ** | Questions and answers, plus a way to ask more |
| **Blog index** | A list of posts with dates and summaries |
| **Article** | A single post at a readable measure |
| **Coming soon** | One screen, one promise, one form |

Each builds real structure out of *this* project's colour tokens and text styles, so a
template inherits your brand rather than importing someone else's. Slugs are de-duplicated
automatically. Headings get a real outline — one H1 and no skipped levels — rather than a flat
run of the same tag. The Contact, FAQ and Coming soon templates ship a form, and the review
then tells you its endpoint is missing, which is the honest sequence.

**Saved blocks** live in the Add panel beside the components. Select anything and press the
**block icon on the canvas bar** — or *Save … as block* in the Blocks tab — to name it and choose
whether it is **global**:

- **Plain** places an independent copy each time: a starting point you can diverge from.
- **Global** links every copy. Edit one, then press the globe on its canvas bar to push that
  content to the block and to every other copy, on every page. You are told how many will move
  before it happens, and it is a single ⌘Z.

Either way it is available on every page — drag it onto the canvas or click to
place it. A placed copy gets fresh ids but keeps *referencing* the classes and text styles it
used, so restyling the class still reaches it. Forgetting a block leaves the copies already
on your pages alone. Blocks are stored on the project, so they travel with the project JSON.

## Links

A link is a destination, not a string. The picker offers **No link · A page in this project ·
External URL · Email · Phone**; choosing a page gives a dropdown of the real pages and a
second one of the anchors that page actually has, so a dead link is not something you can
author by hand. A bare `#anchor` is read as belonging to its own page and re-emitted as
`page.html#anchor`, which is what makes it survive being placed in a global header or footer.
A link to a page that no longer exists degrades to a plain URL rather than silently
retargeting. Every destination the picker can build passes the export review.

## Images

Image fields are upload fields, never free text. An empty one is a drop target that also
takes a click; a filled one shows a thumbnail with the file name, size and pixel dimensions,
and a button to replace it. Anything already uploaded can be reused from a picker rather than
uploaded twice, and choosing it fills in the intrinsic size too. The same control handles
element images, video posters and background images.

Project **favicon** and **social share image**, and the per-page share image, use the same
upload control. A social image needs an absolute URL for crawlers, so that one works once a
**Site URL** is set and the page is exported with *images as separate files* — the field says
so rather than leaving you to discover it.

## Right-click

Everything you can do to an element is in one menu: **right-click it on the canvas or in the
Navigator**, or use the **⋯** button on the selection toolbar. Edit content, select parent,
copy/cut/paste, duplicate, copy/paste styles, hide on this breakpoint, save as a block, push a
global block to its copies, delete — each shown only when it applies, with its keyboard
shortcut beside it.

Right-clicking something that is not selected selects it first, so the menu always acts on
what you can see highlighted.

Because of this the selection toolbar on the canvas carries just three things: the element's
name, the drag handle, and **⋯**.

## Keyboard

The canvas is fully navigable without the mouse.

| | |
|---|---|
| `↑` `↓` | move through elements in reading order |
| `←` `→` | select the parent · the first child |
| `⇧↑` `⇧↓` | reorder among siblings |
| `↵` | edit text in place |
| `⌘C` `⌘X` `⌘V` | copy · cut · paste |
| `⌘D` · `⌫` | duplicate · delete |
| `⌘Z` `⌘⇧Z` | undo · redo |
| `esc` | drop back to one element, then select the parent |
| `⌘P` · `⌘E` | preview · export |
| `⌘click` · `⇧click` | add to the selection · select a range in the Navigator |

Paste is structural: it lands inside the selection when that can hold the element, otherwise
as its sibling, otherwise wherever above it fits — creating the same wrappers a drag would.
The clipboard holds a detached copy, so it works across pages and regions, and class and
text-style references travel with it rather than being flattened into a snapshot.

## Selecting more than one thing

Styling three cards should not mean three visits. On the canvas, **⌘-click**
(Ctrl on Windows) or **⇧-click** adds an element to the selection. In the **Navigator**, where
there is a list to sweep, ⇧-click takes every row between the current one and the one you
clicked — skipping anything inside a collapsed row, so a range never reaches what you cannot
see. ⌘-click still toggles a single row there.

The first element you picked stays the **primary** — the inspector draws its fields, and the
header shows the count and what is in the set. From there:

- **Style changes reach every selected element.** One colour, one padding value, one radius.
- **Content fields reach the ones that have that field**, so a mixed selection of headings and
  buttons can share a label without a button collecting a heading level.
- **The HTML id stays on the primary**, because two elements cannot share one id.
- **A class target takes a single write.** If you are styling a class rather than the elements,
  its members already share it, so nothing is written twice.
- **Duplicate, delete and `⇧↑`/`⇧↓` act on the whole set.** A parent and its own child count
  once. Undo takes the whole fan-out back in one step.

The clipboard still holds one element at a time; copying with several selected takes the
primary and says so.

`esc` drops back to a single element before it starts walking up the tree, so you never lose
the set in one keystroke.

## Canvas zoom

The canvas renders each breakpoint at the width that breakpoint actually means — 414px on
Mobile, 834px on Tablet, and the larger of 1280px or your container width on Desktop — and
scales the frame to fit the space the panels leave. **What you see is the breakpoint you
are editing, whatever the size of your window.**

The readout at the bottom left shows the rendered width and doubles as the zoom control:
**Fit** (the default, which never magnifies) or a fixed 100 / 75 / 50 / 25%. On a 1280px
laptop the 1320px desktop frame sits at 45%; pick 100% and scroll if you need to read it.

Before this the canvas was simply whatever width was left over, so selecting an element —
which opens the inspector — could flip the canvas from your desktop layout to your mobile
one without saying so.

## Responsive

Pick Tablet or Mobile in the top bar and any value you change is written as a
breakpoint override (`max-width: 1024px` and `max-width: 767px`). The badge beside a
field turns green when an override exists; click it to clear.

A Nav menu collapses to a burger at whichever breakpoint you choose. While the nav is
selected its panel is held open on the canvas so you can style it.

## Design tokens

Colours and typography are defined once on the project and referenced by elements, so a
rebrand is one edit rather than one edit per element.

- **Colours** — seven named tokens to start (`text`, `bg`, `brand`, `ink`, `muted`, `line`,
  `surface`). Every colour control shows the palette as swatches: click one to link, and
  the field turns into a chip naming the token. Change the token in **Project → Colours**
  and everything linked to it follows. They export as `:root{--c-brand:…}` custom
  properties. Deleting a token inlines its literal value everywhere first, so nothing
  silently breaks; `text`, `bg` and `brand` are wired into the base stylesheet and can't be
  removed.
- **Text styles** — eight presets (Display, Section title, Card title, Lead, Body, Small,
  Eyebrow, Button label), each responsive across all three breakpoints. Pick one from a
  Heading, WYSIWYG or Button; anything you then set on that element overrides the style
  locally. **Update style** pushes the element's typography back up to the style so every
  other user of it moves too; **Detach** bakes the values in and stops following.

  A style also carries the **HTML tag** that belongs with it, so picking *Display* makes the
  heading an `h1` in the same gesture rather than leaving you to remember.

  Styles are created and edited directly in **Project → Text styles**: expand a row for
  size, weight, line height, letter spacing, font, transform, colour and default tag, with
  Desktop / Tablet / Mobile tabs so each breakpoint is reachable. On Tablet and Mobile, empty fields
  show the inherited base value as a placeholder, so an override is always a deliberate act.

- **Style classes** — any reusable set of declarations, per breakpoint, applied to any
  element, several at once. Save an element's styling as a class and it moves off the
  element onto the class; other elements can then share it.

### Copying a look

The **pipette** in the element header copies a look; ⌘⇧C does the same. While the clipboard
holds something, a strip appears under the header — *Holding "Card title" · Paste* — and
naming a multi-selection, so it reads **Paste to 3** when three things are selected. ⌘⇧V
pastes; the ✕ forgets it. Nothing sits on screen when the clipboard is empty. It carries all
three breakpoints, the element's classes and its text style — and it **replaces** rather than
merges, because "paste styles" means make this look like that, and a merge leaves behind
whatever the target had that the source never mentioned.

It works across widget types: CSS goes anywhere, while a text style only lands where the
target has one to set, so a Heading takes it and an Image quietly does not. Paste onto a
multi-selection and every member gets it. It is a separate clipboard from ⌘C/⌘V, so copying
a look never costs you the element you copied earlier.

A text style is still the right tool when a look should stay linked and restyle everywhere
at once. This is for the one-off.

Precedence within each breakpoint runs **text style → class → this element**, so a preset
supplies defaults and local tweaks always win. Between two classes, the one lower in the
project list wins — reorder them in **Project → Style classes**.

The inspector is explicit about where an edit lands. The Style tab opens with a **Styling**
group listing `This element` and each applied class with its usage count; whichever you
pick receives the writes, and the note tells you how many elements a class edit will reach.
Nothing is restyled by accident. Deleting a class bakes its declarations into every user
first, so the page never moves — local overrides still win on the way out.

## Content collections

**CMS** in the tool rail holds your content types. A collection is a field schema plus the items
that fill it — text, rich text, image, link, number, date, option, yes/no.

Three things you can do with one:

- **Bind a property to a field.** Point any container at a collection (*Advanced → Content
  source*) and every content field inside grows a badge next to its label. Click it, pick a
  field, and that property comes from content. A bound field shows the value it will render and
  goes inert; the badge unbinds it.
- **Or bind the whole card at once.** **Bind the fields inside…** opens a sheet listing every
  place inside the scope that could take a value, already filled in with a first guess — a
  heading takes the title, a text block the summary, an image the image field, a button the
  link field. Change any row, then commit the lot in one step. It also serves as the one place
  to *see* what is bound to what.
- **Repeat with a Collection list.** Drop one from *Add → Layout*, put a single Column inside, and
  that card renders once per item — with sort, direction and a limit.
- **Generate a page per item.** Mark a page as a collection's detail template in *Pages*, and the
  export writes `<collection>/<slug>.html` for every item, each with its own title and meta
  description taken from fields you choose. A card can link to *this item's own page*.

Everything resolves at export: what ships is plain static HTML with the content baked in, so it
needs no JavaScript and crawlers see all of it. **content.json** in the export dialog writes the
same data as a portable file — the site never fetches it.

## Image storage

**Media** in the tool rail opens the library as a grid. Everything you upload anywhere in the
builder lands there, so the same file is never stored twice:

- **Upload** takes one or several files at once.
- **Click a card** to place that image on the canvas, wherever the current selection allows it.
- Each card shows its size, intrinsic dimensions, and whether anything references it — with one
  click to **remove every unused file**.

Every image field — an Image element, a Background, the favicon, the social share image — offers
**Upload** or **Library**, and Library opens a thumbnail picker rather than a list of filenames.
Choosing an image also fills in its intrinsic width and height, so the page does not shift while
it loads.

## Find and replace

**⌘F** searches every page, both global regions, each page's own browser title, meta
description and name, the project name, and every CMS item value. Results group by where
they live, and a row is a button: it switches page or global region, selects the element and
scrolls to it — or opens the CMS dialog, the Pages panel or Project settings when that is
where the text is edited.

**Replace all** is one action over the whole project, confirmed with a count, and one ⌘Z
undoes the lot. Two things it deliberately does not touch: **markup**, so searching `div`
never rewrites a `<div>` and `class` never matches an attribute; and **page slugs**, because
a slug is a published URL and moving one because a word changed is how links break.

## Export review

A **Review** indicator sits in the top bar with a live count — green when clean, amber for
suggestions, red for problems — so failures surface while you work rather than when you try
to publish. It recomputes on idle, not on every keystroke. Clicking it opens the full report.

The Export dialog opens with the same review, because the failures that matter in static
output are silent ones. It reports:

- **Dead links** — an internal link to a page that isn't in the project, or a fragment with
  no matching element id, checked per page against that page's real ids
- **Travelling fragments** — a bare `#anchor` inside a global header or footer, which only
  resolves on pages that happen to own that anchor
- **Missing alt text** (an error unless the image is marked decorative) and **images with no
  intrinsic size**, which shift the page as it loads
- **Heading structure** — a missing or duplicated `H1`, and jumps like `H1` → `H3`
- **Duplicate anchor ids**, empty buttons, and links pointing at `#`
- **Contrast** — every text element measured against the background actually behind it,
  against the WCAG AA thresholds (4.5:1, or 3:1 for large text)
- **Eagerly loaded video players**
- **Forms that go nowhere** — a static page cannot receive its own POST, so a form with no
  endpoint is an error, not a shrug. Unlabelled fields and two fields submitting under the
  same name are reported too, as are form colours that lose contrast on a dark section
- **Accordion rows with no question**, which is a row nobody can click, and rows that open
  onto an empty answer. Counted per accordion, not listed per row
- **Galleries** held to the same standards as the Image element: alt text on every image
  that has one, intrinsic sizes, and a note for tiles still waiting for a file
- **A linked icon with no label** — a link whose only content is a glyph has no accessible
  name at all
- **Embeds** — an empty one, and one carrying a script, which is the review saying plainly
  that it cannot check markup it does not read

Problems open the list automatically; suggestions wait to be asked for. **Show me** on any
finding jumps to the page, switches to the right region, and selects the element.

## Export


**Download site .zip** is the one to reach for: every page, every image it references,
`content.json`, and the sitemap and robots pair, with folders intact. It is the only export that
can place a detail page at `projects/acme-rebrand.html` — a browser download saves flat, so the
per-page buttons squash that to `projects-acme-rebrand.html`.

The archive is written without any library: deflate where the browser offers it, stored otherwise,
and fixed timestamps so the same site zips to the same bytes.

Two modes in the Export dialog:

- **Images inlined** — one self-contained `.html` per page, nothing to upload alongside it.
- **Images as separate files** — markup points at `assets/…` and the images download
  beside the HTML, so browsers can cache them across pages.

Either way the output is semantic markup plus a single inline stylesheet with two breakpoint
media queries and one for reduced motion.

Pagecraft emits JavaScript only when a component needs it, and only onto pages using that
component: a 677-byte burger-menu toggle for a Nav, a 502-byte facade swap for deferred
video, and a 2.2 KB lightbox for a Gallery that opens full size. All three are absent
otherwise, and an Accordion needs none at all.

Output quality built into every export:

- `width`/`height` on images (filled in automatically on upload, or via **Detect**), so
  pages reserve space instead of reflowing
- **video behind a click-to-play facade** by default — a YouTube embed pulls several hundred
  kilobytes before anyone presses play, so the poster stands in until they do
- `lang`, and — once a **Site URL** is set in Project settings — `canonical`, `og:url`,
  absolute `og:image`, `twitter:card`, plus **sitemap.xml** and **robots.txt**
- per-page social share image, falling back to a project-wide one
- **a visible keyboard focus ring** on every link, button, summary, gallery tile and form
  control. It is `currentColor` rather than the brand colour, because a brand ring around a
  brand-filled button is invisible in exactly the case it has to work — text colour already
  contrasts with its own ground, so the ring inherits that guarantee
- **`prefers-reduced-motion` honoured.** A visitor who has asked their system for less motion
  gets it, and that block closes the stylesheet — after your own CSS — so a project rule
  cannot switch motion back on

The dialog is ordered by what you are most likely to want. The footer carries the two
committed actions — **Download site .zip** and **Download this page** — beside a note saying
exactly what the archive will contain. Below the preview, two labelled groups hold the rest:

- **Individual files, instead of the archive** — every page as flat files, `sitemap.xml +
  robots.txt`, `content.json`, and **Copy this page's HTML** for where a browser blocks
  downloads. The archive already contains all of these, so these are the route for when it
  cannot be used. `sitemap.xml + robots.txt` is disabled until a **Site URL** is set, since a
  sitemap has to know its own domain.
- **The project itself, not the site** — export and import project JSON. A backup you reopen
  and keep editing, not publishable HTML. Importing replaces everything in the project, and
  says so.

## Saving

Your work saves itself as you go, in this browser. If saving ever fails — private
browsing, or a full browser store — the top bar turns red and offers an immediate backup
file rather than letting you keep working against a save that is not happening. Open the
same project in two tabs and Pagecraft notices, then asks which copy to keep.

## Browser support

Current Safari, Firefox and Chrome, on desktop. Pagecraft is a desktop tool — building a
page needs the room — but everything it exports is responsive and works everywhere.
