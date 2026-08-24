# The server-backed version — plan

Decided 2026-08-23. Two answers shape everything here:

- **For me and my clients now, a product other people sign up for later.** So build
  single-tenant workflows, but do not put anything in the data model that assumes one
  customer. The cost of getting that wrong is a migration; the cost of building
  multi-tenancy now is months of work that is not page-building.
- **Port the existing editor rather than rewrite it.** The core is a TypeScript module
  with 562 tests and no DOM assumptions. The chrome comes across as it is, and the
  strangler migration to components continues on the server rather than here.

Two source documents, and neither is optional reading:

- `CONTEXT.md` in this repo — the harvest map, the schema deltas, and the conventions
  that must hold.
- `~/Documents/Braudy/SITE_BUILDER_COMPONENT_SPEC.md` — 785 lines, the specification
  the deleted app implemented. Sections 1, 15, 16, 17 and 20 are the load-bearing ones.

---

## The thing worth noticing first

The spec's core architectural rule, section 1:

> Do not implement margin, padding, typography, borders, responsive visibility,
> animations, or conditions separately inside every component. Implement them as shared
> capability modules and attach them only to compatible component types.

That is what this repo now does. `COMMON_STYLE` holds the shared capabilities, and the
`when` predicate on a control decides which element types they attach to — a heading is
not offered a background image, a slide is not offered a share of a row. It was built
this session from a question about a heading's background, and it arrived at the spec's
rule by a different road.

So the port is closer than the harvest map's schema deltas suggest. What exists here is
the rule in a lighter form: per-control predicates rather than a declared list per
element. Making it explicit is the port, not a rewrite.

| spec `ElementDefinition` | what this repo already has |
|---|---|
| `type`, `title`, `icon` | the `DEF` key, `label`, `icon` |
| `category` | the palette group in `Add.tsx` — implicit, wants promoting |
| `canHaveChildren`, `allowedChildren`, `allowedParents` | `level` + `accepts` + `holds()` |
| `controls: ControlGroup[]` | `controls: { content, style }` + `COMMON_STYLE` |
| `sharedCapabilities: CapabilityName[]` | **implicit** — every type gets `COMMON_STYLE`, narrowed by `when` |
| `render: ElementRenderer` | a case in `renderNode` |

The one row in bold is the real work: turn a set of predicates into a declared capability
list per element, which is both more honest and what the spec asks for.

---

## Where the two inventories disagree

They overlap without nesting, and knowing which way round matters for sequencing.

**This repo is ahead on the spec's second release.** Accordion, Tabs, Gallery, Carousel
(the Slider), Navbar (Nav menu), query loop with filters, and pagination all ship here
and are tested. The spec lists them as *after* the MVP.

**This repo is behind on the spec's MVP primitives.** Missing outright: `Div`, `Flex`,
`Grid`, `Link Block`, `List`, and the form fields as first-class elements — a Form here
owns its fields as props rather than as child elements. Missing as a system: reusable
components with properties, variants and slots. Blocks here are copies that push changes
out; the spec wants instances.

The recommendation, stated so it can be argued with: **keep the widget set, add the
primitives that are load-bearing, and take the component-instance model early.** Flex,
Grid and Div are a genuine gap — without them a layout is only what `section > row >
column` can express. The component model is the one thing that is expensive to retrofit,
because every document written before it exists has to be migrated after.

Form fields as elements can wait. It is a real improvement and it changes nothing else.

---

## Milestones

Each one ends with something that works, and the first one crosses the boundary a file
cannot.

### 1. Edit content without re-exporting — done

The reason a server exists. Nothing else in this list matters if this does not land.

- A document store. One row per site, the document as JSON, a version column, and an
  `updated_at`. Postgres, because the document is JSON but the things around it are
  relational and will get more so at #2.
- Serve a site from the stored document — the same `buildPage` that runs here, called
  on request or on save. Rendering on save and serving static files is the closer match
  to what this project already proves: the export contract is bytes, and bytes are what
  is tested.
- The editor writes to the store instead of to `localStorage`. `writeNow()` is the seam;
  it is one function.
- A client logs in and edits content. Content only — not layout, not styles. The CMS
  already separates the two, so this is a permission on a route rather than a new
  concept.

**Done when** a client changes a headline, and the live page changes, and nobody
exported anything.

### 2. The editor, ported

- The core moves unchanged. It is `app/src/core/*.ts`, it imports nothing from the DOM,
  and its 562 tests come with it. This is the cheap half and it should be done first to
  prove the seam.
- `builder.html` comes across as one file, as it is. It works, it is tested by
  `boot.test.mjs`, and rewriting it while also standing up a server is two risks at once.
- Then the strangler continues: the `Legacy`/`Core` seam in `app/src/ui/ctx.ts` is what
  makes a panel portable one at a time, and the recording stub in `tests/ui.setup.tsx` is
  what makes each port assertable.
- The three functions that are deliberately not in the core — `makeZip`,
  `assetsToPaths`, `assetsToData` — become server-side, which is easier there than here.

**Done when** the editor runs against the store, and the export still produces the same
bytes for the same document. That last clause is a test, not a hope.

### 3. The capability registry, made explicit

- Declare `sharedCapabilities` per element type instead of inferring it from `when`
  predicates. The predicates become the registry's contents rather than its substitute.
- Style states as first class. Here `hover` and `focus` exist on a `st` axis and a
  button's hover is still a special case in `nodeCss`. The spec wants hover,
  focus-visible, active and disabled, uniformly. Anything ported has to stop treating
  hover as an exception.
- Conditions and richer bindings. Absent here: `bindGet`/`bindSet` bind a prop to a CMS
  field, full stop. The spec's bindings carry a source, a path and a fallback, and a
  condition can hide an element outright.

### 4. Reusable components

The component-instance model with properties, variants and slots — spec section 17. Taken
before the document set grows, because retrofitting it means migrating every document
written without it.

### 5. Multi-tenant, when there is a second customer

Not before. What #1 has to not preclude: a site belongs to an owner, an owner is not
assumed to be one, and nothing is keyed on "the" site. That is a schema discipline, not
a feature.

---

## What not to build

From the harvest map, still true, and now with a reason that is about time rather than
taste: anything that does not transfer. Porting the remaining dialogs to Preact here, a
state library for the 105 manual repaint calls, splitting the core into modules,
performance work — the canvas was measured at 4.7 ms for a full rebuild at 420 nodes and
9.5 ms at 1680, so there is nothing there to win.

What is still worth building here: export quality, patterns, lint rules, CMS semantics.
The harvest map carries all of it across.

## The stack, decided 2026-08-23

- **The server hosts the client sites.** Not publish-out. So it owns hosts, and eventually
  custom domains and TLS.
- **Plain Node and Hono**, the editor served as a static file. No framework the editor does
  not use, and nothing that tempts a rewrite of a thing being ported.
- **Magic-link email, sessions in Postgres.** Not built yet; `requireEditor` in `app.ts` is
  the named seam it attaches to.
- **A VPS or Fly/Railway, Postgres and a persistent volume.** The volume is for uploaded
  assets rather than for rendered pages — see below.

## Milestone 1 is done, and what it taught

`server/` holds it: `render.ts`, `store.ts`, `store-pg.ts`, `app.ts`, `index.ts`, and 16
tests. Proven against a running server, not only in-process: a document was saved over
`PUT /api/sites/s1`, and the next request to the site returned the changed page. Nobody
exported anything.

**Rendered pages are held in memory, not written to the volume.** A site's files are
tens of kilobytes and a render is about 5 ms, so a restart re-renders on first request
and there is never a file that disagrees with the document. Writing them out becomes
worth it when a front proxy should serve them without touching Node — and that wants an
atomic swap, because the stale-file problem arrives with it. The volume is still needed,
for assets.

**Three things the build found, each of which had been quietly true:**

- **The core is a singleton.** `restore()` loads a document into module-level `state` and
  everything after reads it. That is safe only while a render is one synchronous run, so
  `renderSite` is sync and says why at length. A test renders two documents in sequence and
  checks neither leaks into the other.
- **`tsc` was not checking the server.** `tsconfig.json`'s `include` listed `app/src`,
  `tests` and `vite.config.ts`. A deliberate type error in `server/` produced no output at
  all. Adding `server` to the list surfaced nine real errors immediately.
- **Vitest resolved imports Node cannot.** Sixteen tests passed against a server that could
  not boot: bundler resolution accepts `./app`, and Node's ESM resolver does not. The fix is
  real `.ts` extensions and `allowImportingTsExtensions` — including three inside
  `app/src/core`, which is the first thing the port needed from the core and the smallest
  possible version of "prove the seam".

## Auth and the content role — done

`auth.ts` and `content.ts`, with 35 more tests. Magic links: nothing but SHA-256 digests is
stored, so a stolen database yields no working login and no live session, and a link is spent
by being presented rather than by succeeding.

Two roles. `owner` does everything. `content` may save, and `content.ts` decides what the
save may contain.

**The content check is a projection, not a diff, and that is the whole design.** `skeleton()`
blanks every value that counts as content and compares what is left; a change is content-only
when the two skeletons are identical. Listing what may differ would have been the obvious
way and is the wrong way round — anything the list forgot would be permitted, so a prop added
to a widget next year would be silently writable by every client. This way an unknown field
is structure until somebody says otherwise. There is a test that invents a field and requires
a refusal.

Building it that way immediately caught two cases where **presence is itself content**, both
of which a field-by-field check would have got wrong in the other direction:

- `textSlots(node)` enumerates the slots that *have* a value, so blanking through it left an
  absent caption absent and a written one blanked. A client writing a caption for the first
  time read as a new field appearing, and was refused. Read `TEXT_SLOTS` directly and delete
  every declarable slot instead, present or not.
- the same for a CMS item's `draft` flag: blanking the value but not the key made "held back"
  differ from "never held back".

Two things deliberately not content, with the reasoning in the file: **links**, because the
one text field that can send a visitor anywhere deserves a conversation rather than a silent
write; and **page names and slugs**, because a slug is an address.

Verified against a running server. A content client signed in, saved a headline, and the live
page changed; the same client sending one CSS declaration got
`403 {"error":"content only"}`.

## The editor on the server — done

One build, two homes. Downloaded as a single file the editor saves to `localStorage`, which
is what makes that file self-contained. Served by this server it saves to this server, and
the server says so by injecting `window.PC_SERVER` — **including the document**, so `load()`
stays synchronous exactly as it is in the single-file build. Nothing above the persistence
seam knows which one it is in.

Three screens the server needed and did not have: a sign-in form, a picker for somebody with
more than one site, and a "nothing to edit yet" page for an account with no membership. One
site redirects straight into the editor, because a picker with one row on it is a click for
nothing.

Two things worth having written down:

- **`</script>` in a document would have closed the tag it was injected into.** The code
  widget now exists, so a document containing that sequence is not hypothetical, and the
  failure would have been the whole editor rather than one page. `<` is escaped to
  `\u003c`; there is a test that puts the sequence in a document and another that fails when
  the escape is removed. Convention 9, third time.
- **One save in flight, one queued behind it.** Without that guard a fast typist sends the
  second PUT before the first returns, the second carries the version the first is about to
  consume, and the server correctly calls it stale — so the editor would report a conflict it
  had caused itself.

A refused save is never a whisper. A 409 explains that somebody else saved, shows both
version numbers, and offers a download and a reload — not a merge, because merging two
documents is not something this can do and pretending otherwise would lose one of them
quietly. A 403 says the account edits text and CMS content, and that a save carries
everything at once so text changed alongside was not stored either.

Verified in a browser, as a person: typed an email into the sign-in form, followed the link
from the log, landed in the editor with the document already loaded, changed a headline and
watched it stamp "Saved" and the live page change. Then, as a content client, changed a
headline (saved) and a colour (refused, with the modal). Then forced a stale version and got
the conflict modal.

## The editor, scoped to the role — done

The server refuses a structural save from a content account and that is the boundary. This is
the other half: the editor no longer *offers* what cannot be done. `canStructure()` in
builder.html, through the `Legacy` seam so panels can ask, and false only for a `content`
role on the server — the single-file build has no accounts and nothing to scope.

What a content account gets: the Pages and CMS panels, the canvas, and an inspector with one
group in it. What it does not: the Add panel, the Navigator, Project settings, the Media
library (a dead end until assets are server-side), the Style and Advanced tabs, the
structural HUD buttons, and the keystrokes for delete, duplicate and nudge — a shortcut does
not need a button, so the verbs are gated in JS as well as hidden in CSS.

**The Content tab was not the line the server draws, which was the interesting part.** A
heading's Content tab holds its text — and also its HTML tag, its text style and its
alignment. A tag is structure and the other two write CSS, so a content account offered them
was being offered a refused save. The line that matches the server is `contentKeys(type)`,
derived from the same `TEXT_SLOTS` the server reads: a control edits content when it writes a
declared text slot and no CSS property. Both readers of that distinction now read one list, so
a widget whose slots change is covered in both places at once.

**And a bug that only a browser could find.** `collections()` in the core materialises
`meta.collections` as a side effect of *reading* it, so merely opening the CMS panel turned a
document with no collections into one with an empty list — a new key under `meta`, which the
server correctly refused. A content account that clicked CMS could then save nothing at all
until it reloaded. No test caught it because no test clicks a tab. An absent list and an
empty one are the same document, so the skeleton normalises the empty case away; a collection
that actually exists is still structure, and there is a case for that too.

## Assets — done, with one gap named

In the single-file editor an image is a blob in IndexedDB, which is what makes that file work
with no server and also what makes it useless the moment two people share a site: a client on
another machine sees every image as a placeholder, because the bytes only ever existed in
somebody else's browser. So the server owns them.

**The naming rule moved into the core first, and that was the point of the exercise.**
`assetFile` and the `asset:` regex lived in builder.html, so a page served from the server and
the same page in an exported zip could have named the same image differently — and nothing
would have noticed until a link broke. They are `A_RE`, `assetFile` and `assetPaths` in the
core now, and builder.html's copies are gone. Deleting them was not optional: the core is
spliced into that file's scope, so keeping both is `Identifier 'A_RE' has already been
declared` and a dead app. The boot test said so by name, immediately.

**Type comes from the bytes.** A caller can put anything in `Content-Type`, and `image/png` on
arbitrary bytes is a way to host arbitrary content on somebody's own domain — so uploads are
sniffed by magic number, and anything that is not one of the five formats the server serves is
refused with a 415. Dimensions are read from the bytes too, by hand rather than by pulling in
an image library: the formats that matter keep their size in the first few bytes. An unread
size stays zero, and the review already has a rule for an image with no dimensions, so an
unknown format becomes a finding rather than a silent layout shift.

Bytes never enter the document. It holds `asset:<id>`, which is what keeps a save small and a
render synchronous. Rendered pages are strings; images are served straight from the store, on
the path `assetFile` gives them, cached hard because a replaced image is a different path.

Verified in a browser end to end: generated a real PNG on a canvas, uploaded it through the
editor's own `assetAdd`, watched the canvas resolve it, the save land, and the live site serve
`assets/real-photo.png` — 7,790 bytes, a valid PNG, 400×300 read back out of its IHDR. A
29-byte fake PNG earlier fetched with a 200 and decoded to 0×0, which is what a header without
an image looks like and worth knowing when a fixture lies.

### An image is content, narrowly — done

That gap is closed, and the decision is: **an image may point at nothing, or at an upload of
this site's own. Anything else is not content.** A client swaps between photographs they
uploaded; they cannot point an `<img src>` at somebody else's server, which is the same
objection that keeps links out, and they cannot reference an asset id belonging to another
site.

Two mistakes on the way there, both caught by driving the browser rather than by the suite:

- **Comparing the pair rather than the destination.** The first rule allowed `token → token`
  and refused everything else, including `empty → token` — which is the case that matters
  most, because the demo's image has no `src` and a client setting one for the first time was
  refused. What a value used to be is not the question; what it is now is.
- **Checking every image rather than the ones that moved.** With the rule made directional, an
  unchanged document started failing: an owner may point an image at a URL, and if that counts
  against the client then every content save on that site is refused for a value the client
  never touched. A content account answers for what it wrote, so the two documents are walked
  in step and only differing values are checked — safe because the skeleton comparison has
  already established the structure is identical.

`ASSET_SLOTS` lives in the core beside `TEXT_SLOTS`, for the reason `assetFile` does: the
server decides whether a save that moves an image is content, and the inspector decides
whether to offer the control that moves it. Those two answers have to agree, and one
declaration is the only thing that keeps them agreeing.

Verified as a content client in a browser: uploaded a photograph, pointed the hero image at
it, watched it save and the live site serve `assets/client-upload.png` — then pointed the same
image at `https://elsewhere.test/tracker.png` and got the refusal, with the tracker absent
from the served page.

**Not built yet:** the above; an invite flow, since a client is still an environment variable;
and `store-pg.test.ts` against a real database, because the SQL in `store-pg.ts` and
`ASSET_SCHEMA` has still never executed.

## Anti-patterns the spec names, worth repeating

Section 20 is short and this project has already violated one of them and recovered:
capabilities implemented per component. The others to watch are a schema that cannot be
migrated, and a component model bolted on after the documents exist. Both are addressed
by the order above.
