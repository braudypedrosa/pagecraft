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

## The SQL, actually executed — done

`store-pg.ts` was written blind and stayed that way for four commits. It is exercised on every
`npm test` now, against PGlite — Postgres compiled to WASM, so a real parser, planner and type
system with no daemon and no container. `PgAssetStore` was written at the same time and was
therefore tested from its first line rather than four commits later.

Sixteen cases passed on the first run, which was not the interesting part. **Two things only
the real server binary could find**, and `tools/realpg.mjs` is the command that finds them:

- **The Postgres path could not be imported by the server at all.** `constructor(private db)`
  is a TypeScript parameter property, which generates an assignment rather than erasing, so
  Node's strip-only mode refuses the whole module. Vitest transforms, so sixteen tests passed
  against a file the server could never load — and because the Postgres store is imported
  dynamically only when `DATABASE_URL` is set, nothing would have noticed until the first
  boot with a database. Third time this session that Vitest accepted what Node will not, so
  there is now a guard: `loadable.test.ts` asks Node, in its own process, to import every
  server module, and greps for the four TypeScript features that need a compiler.
- **`bytea` comes back as a Buffer here and a Uint8Array under PGlite.** A Buffer is a
  subclass, so `instanceof` holds and `constructor.name` does not — my assertion was the
  latter, which is a test that passes in WASM and fails in production, precisely what that
  file exists not to be.

And the one claim PGlite cannot settle: two writers saving at the same version, on a real
server, produce exactly one winner. That is what the version in the `where` clause of `save`
buys, and it is now measured rather than argued.

The guard found one more thing on its own first run — it flagged `store-pg.ts`, because the
comment explaining why parameter properties are banned contains the words. A checker that
reads prose reports prose, so it strips comments first.

## Inviting somebody — done, and the store under it

The invite flow needed something first: **there was no Postgres auth store at all.** Users,
sessions and memberships were memory-only, so even with a database a restart signed everyone
out and forgot every grant. An invite that does not survive a restart is worse than the
environment variable it replaces, so `PgAuthStore` came first — written against the PGlite rig
that already existed, so its SQL was exercised from its first line.

Two statements in it are worth naming, both for the same reason — the database settles the
question rather than this code:

- `useLink` deletes and reads in one statement, so a link presented twice at once is consumed
  once. A read then a delete leaves exactly the gap a single-use token exists to close.
- `createUser` upserts on the address, so two invitations to the same person arriving together
  make one account.

**Inviting is a grant, not a token.** Creating an account for an address hands over nothing by
itself: signing in still needs a magic link delivered to that address. So there is no invite
to expire, resend or leak, and one fewer lifecycle to get wrong. `POST /api/sites/:id/people`
with an address and a role, `GET` to see who has access, `DELETE` to take it away — all three
behind the `admin` verb, which only an owner has.

Two ways a site could have ended up with nobody able to manage it, and both are closed: the
last owner cannot be removed, and an owner cannot demote themselves. There is no superuser and
the API is the only way in, so there would have been no route back. Another owner may demote
you, which is how it is meant to work.

Revoking takes effect on the next request without touching sessions, because access is checked
per request against the membership — a membership that is gone is access that is gone. The
revoked person stays signed in, with no sites, which is the honest state.

Verified against a real Postgres, including the part that matters: invited a client, **restarted
the server**, and signed them in — same id, same role, site still serving. Then the last owner
tried to leave (409), tried to demote themselves (409), and revoked the client, who was
immediately 404 on the site and still signed in with an empty list.

`CLIENT_EMAIL` survives as a development shortcut and says so: on a database it is the one
thing that would re-grant after a revoke on the next boot.

## The link actually arrives — done

**SMTP, because every provider speaks it.** Resend, Postmark, SES, Fastmail, a WordPress
host's mail server: an HTTP API would have meant writing one vendor's name into the code for
no reason. Credentials live in the environment and whoever runs this decides whose server
carries the mail. Nodemailer rather than a hand-rolled client, because an SMTP client is a
hundred lines and six ways to be subtly wrong, and this is one email.

**Making sending real made the throttle necessary**, which is why it arrived in the same
change rather than as a nicety. An endpoint that answers 200 to any address and emails it each
time is a way to have this server mail-bomb a stranger. Five links per address per fifteen
minutes, and **being over the limit answers exactly what being under it answers** — a
different reply would hand back the account enumeration the 200 exists to prevent. It is in
memory on purpose: a rate limit is not a record, and putting it in Postgres would mean a write
for every attempt, including all the ones that are the attack.

Two decisions worth naming:

- **A refused attempt does not extend the block.** Otherwise hammering the endpoint keeps an
  address locked out indefinitely, turning a protection for that person into a denial of
  service against them.
- **Loopback may speak plaintext; nothing else may.** `requireTLS` turns STARTTLS from an offer
  into a condition, without which a server that declines the upgrade gets the password in the
  clear. A local mail sink speaks plain SMTP and there is no wire between a process and
  itself — so the exception is a hostname check rather than an `SMTP_ALLOW_PLAINTEXT` variable,
  because a variable can be set on a real box by somebody in a hurry and a hostname cannot.

A mail server that refuses now returns 502 rather than "check your email", because a person
staring at that sentence is owed the truth.

Verified against a real SMTP server — Mailpit in Docker, which has an API to read back what
arrived, so the assertion is about the message a person would open rather than the object
handed to a library. Then the whole loop in a browser: typed an address into the sign-in form,
read the link out of the inbox, followed it, and landed in the editor. Nothing was printed to
the console, which is the point. And the throttle live: eight requests, all answered 200,
exactly five emails.

`tools/realmail.mjs` keeps that check with its docker command in the header. Nothing in the
test suite talks to a mail server — a suite that can send email is a suite that can email
somebody by accident.

## Custom domains — the app's half done, the proxy's half written but unverified

Routing already matched a request on its Host header, so what was missing was a way to say
which host that is. `PUT /api/sites/:id/host`, owner only: moving a domain takes a site off the
address people have and puts it on one they do not, and every saved link stops working. That is
not content however little markup it changes.

`validHost` is stricter than it looks necessary to be, because a host is not a label — it is
what a request is matched on, what a certificate is issued for, and what gets asked of Let's
Encrypt. A scheme, a port, a path, a wildcard or a bare address is refused, and a pasted
`https://acme.com/` is explained rather than accepted.

**The part that stops this becoming somebody else's problem.** On-demand TLS means the first
request for a name triggers an issuance, so a proxy that will do that for *any* name pointed at
this box can be made to ask Let's Encrypt for thousands of certificates — a rate limit, and
then no certificates for anybody. `GET /internal/tls-check?domain=…` is the question the proxy
asks first, and the app is the only thing that knows the answer. It is not under `/api` because
the proxy carries no session; instead it refuses anything arriving with an `X-Forwarded-For`,
which the proxy does not set on its own ask, and the Caddyfile refuses `/internal/*` at the edge
as well.

Verified over real HTTP: the ask says 200 for a claimed domain, 404 for a stranger's, 400 for a
wildcard, and 403 when it arrives from outside. Moving a site to `acme.localhost` made it answer
there, stop answering on the old host, and flipped both answers from the ask.

**The Caddyfile is validated and was run.** The image would not pull at first and the file
carried an honest "UNVALIDATED" header for one commit; the pull finished later, and validating
it found a real error in the first line it checked — `interval` and `burst` under
`on_demand_tls`, which current Caddy removed and named in as many words. Documentation is not a
run. Two warnings after that: a `header_up X-Forwarded-Host` that Caddy passes upstream anyway,
and unformatted input, both now gone.

Then it was actually run in front of the server: a site served through it, `www.site.localhost`
redirected 301 to the apex, `/internal/*` was refused at the edge, and an unknown host still
404ed. And the fence on the app's side was checked on its own, by putting up a second proxy that
forwards `/internal` deliberately — the app answered 403, so both layers are real rather than
one of them being decoration.

What remains untested is the ACME exchange, which needs a public name and a real certificate
authority. The `ask` behind it is tested from both directions.

Caddy rather than an ACME client in the app because issuance is the easy part: renewal, reload
without dropping connections, and what happens at 3am when a renewal fails are the rest of it,
and a page builder is the least interesting place to keep a security bug.

The `www` redirect lives in the proxy rather than as an alias list per site, so the app keeps
exactly one host per site and `byHost` stays a lookup rather than a search.

## Milestone 3, first part: the capability registry is explicit

The spec's section 1 asks for shared capabilities attached only to the component types they
suit. This repo did the first half — `COMMON_STYLE` holds them once — and faked the second with
`takesBackdrop`, which was `!CONTENT_TYPES.includes(n.type)`: a list of nine names, and a
background image for everything not on it.

That list worked and was the wrong shape, for the same reason the content check was before it
got turned inside out. **An exclusion list grants by default.** The widget added next year gets
a background image by never having been considered — silently, and in the direction that gives
away more rather than less.

So each widget declares `caps` now, and `canDo(node, cap)` is the only answer. Five
capabilities, and only the ones that exist: `spacing`, `decoration`, `effects`, `typography`,
`animation`. The spec also lists `positioning`, `conditions` and `interactions`, and naming
those here would have made the registry a wish rather than a description.

What changed on screen: a heading's Style tab lost the Background and Border groups outright,
rather than keeping a Background group with most of its controls predicated away. A section
keeps everything. An image and an icon lose decoration. A button and a quote keep it, because
they are text that is also a box — an exception the registry can state and a rule about
"content" could not.

Three things fell out of doing it:

- **`every widget declares caps` is a test**, and it fails by name. Deleting one widget's
  declaration produces `heading declares no caps`, which is the whole point of declaring.
- **The Motion panel asks the registry too.** Every widget declares `animation`, so nothing
  moved — but a capability nothing reads is exactly the wish-not-description failure the
  registry exists to avoid, so it reads it.
- **A divider can be faded.** I declared spacers and dividers without `effects`, reasoning that
  a spacer has nothing to fade. A divider is styled almost entirely through the shared groups —
  its colour is a background — and opacity is how somebody makes a rule quiet. Corrected, with
  the reasoning in the test.

## What is left

- **The rest of milestone 3**: style states as first class (hover, focus-visible, active,
  disabled, uniformly — a button's hover is still a special case in `nodeCss`), and conditions
  with richer bindings.
- **Milestones 4 and 5**: the reusable component model, and multi-tenancy when there is a
  second customer.

## Anti-patterns the spec names, worth repeating

Section 20 is short and this project has already violated one of them and recovered:
capabilities implemented per component. The others to watch are a schema that cannot be
migrated, and a component model bolted on after the documents exist. Both are addressed
by the order above.
