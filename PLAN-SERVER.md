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

### 1. Edit content without re-exporting

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

## The stack question, left open on purpose

The spec's own `PRODUCT.md` is gone, so there is no recorded stack decision to honour.
What the milestones above constrain: a server that can run the core (any Node runtime),
a Postgres, and a way to serve generated files. Everything else — framework, host,
auth provider — is a decision for the first milestone and should be made against it
rather than in the abstract.

## Anti-patterns the spec names, worth repeating

Section 20 is short and this project has already violated one of them and recovered:
capabilities implemented per component. The others to watch are a schema that cannot be
migrated, and a component model bolted on after the documents exist. Both are addressed
by the order above.
