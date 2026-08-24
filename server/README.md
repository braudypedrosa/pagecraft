# The Pagecraft server

Serves sites from stored documents, so a client can change words without anybody re-exporting
anything.

The single-file builder exports a zip and that is a complete answer for a site nobody but its
author edits. This is the other case: the document lives in Postgres, the same core renders it,
and the person who owns the words signs in and changes them. Same core, same `exportTargets`,
same `buildPage` — `render.ts` has a test asserting that a page served from the store is
**byte-identical** to the one the builder exports, because everything this repo has proved
about its output has to keep covering the thing people actually visit.

## Run it

```bash
node build.mjs && cd server && npm install && OWNER_EMAIL=you@example.com npm start
```

That is the whole development setup. With no `DATABASE_URL` it uses in-memory stores and seeds
one demo site, so a fresh checkout shows a page rather than "No site for host localhost".
Nothing survives a restart, including who is signed in.

- editor: <http://localhost:8787/>
- the demo site: <http://site.localhost:8787/>

`node build.mjs` first, and separately: the server reads `index.html` as a file and does not
build it. A server that runs a bundler on boot is a server that fails to boot for bundler
reasons.

## Sign in

`POST /auth/login` with an email address sends a link. Without SMTP configured it is **printed
in the server log** — which is said out loud on boot, because "the link was sent" and "the link
was printed somewhere you are not looking" look identical from the form.

Only an address the server already knows gets a link, and `/auth/login` answers 200 either
way — an endpoint that says "no such user" is an endpoint that enumerates your users.

So somebody has to exist first, and that is `OWNER_EMAIL`: on boot it is created and granted
owner on every site. Idempotent, so leaving it set is harmless. Everybody after that arrives
through `POST /api/sites/:id/people`, which is the flow it replaced.

## Environment

Nothing here has a default that pretends to be a configuration. Where one is absent the server
says so on boot and carries on in the mode that absence implies.

| | |
|---|---|
| `PORT` | default `8787` |
| `EDITOR_HOST` | the name you sign in on, and the host sites are shared under as `/<slug>/`. Default `localhost`. Requests for any *other* host are looked up as custom domains |
| `OWNER_EMAIL` | the first owner. Absent: **nobody can sign in.** The sites still serve |
| `DATABASE_URL` | Postgres. Absent: in-memory stores, and one seeded demo site |
| `NODE_ENV` | `production` turns on `Secure` on the session cookie. Set it in production, or the cookie travels over plain HTTP |
| `CLIENT_EMAIL` | granted the content role on every site, for trying that role on a throwaway run. A development shortcut — invite instead |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | how login links are sent. Port defaults to 587, which is submission with STARTTLS; name 465 for implicit TLS. A loopback host may have no credentials, and nothing else may |
| `MAIL_FROM` | the From address. `Pagecraft <hello@example.com>` is allowed. **Required** for mail to be considered configured |
| `MAIL_PRODUCT` | what the message calls the thing being signed into. Default `Pagecraft` |
| `ACME_EMAIL` | Caddy's, not the server's — where a failed certificate renewal is reported |

## Deploy

```bash
POSTGRES_PASSWORD=… EDITOR_HOST=admin.example.com OWNER_EMAIL=you@example.com \
ACME_EMAIL=you@example.com docker compose -f server/compose.yml up -d --build
```

From the repository root, not from `server/`: the image's build context is the repo, because the
first stage builds the editor from `builder.html` and `app/`.

Three services. Caddy holds the certificates, the server holds the documents and renders them,
Postgres holds everything that has to survive a restart. The database has no `ports:` — it is
reachable by name from the other two services and from nothing else. The server binds
`127.0.0.1:8787`, so `/internal/tls-check` cannot be reached from outside the box; the app
refuses a request carrying `X-Forwarded-For` as well, and Caddy 404s `/internal/*` at the edge.
Three fences round one endpoint, because what it protects is this server's ability to get
certificates at all.

**What was verified, and what was not.** The image builds, the stack comes up, and the whole
flow was exercised against real Postgres in containers: sign in, create a site, serve it on its
own host, load the document back at the current schema, save, and see a component instance
render from a document that had been through the database. What is **not** tested is the ACME
exchange itself — it needs a public name and a real certificate authority. Everything either
side of it is: `caddy validate` accepts the Caddyfile, and the `ask` endpoint is tested from
both sides.

**Caddy runs with `network_mode: host`** so that `127.0.0.1:8787` in the Caddyfile means what it
says. That does not work on Docker Desktop, so on a Mac bring up `db` and `server` only and put
your own proxy in front. On Linux it is what you want.

## How a site is addressed

Two ways, and every site gets the first for free.

**By path, under this server's own host.** A site has a `slug` and answers at
`/<slug>/…` — `pagecraft.example.com/acme/about`. No DNS, no certificate, nothing for anybody
to configure: it works the moment the site is saved, which is what makes a link sendable this
afternoon. The slug comes from the site's name and is unique; `PUT /api/sites/:id/slug` moves
it, which breaks existing links and is therefore an admin's call rather than a writer's.

Sites share that namespace with this server's own routes, so a site called `api` would shadow
one. `validSlug` refuses `RESERVED_PATHS`, and `slug.test.ts` checks that list against **Hono's
own route table** — add a route without adding its prefix and the test fails by name. Do not
hand-maintain that list against your memory; the test is there so you do not have to.

**By domain**, matched on the Host header, for a site that has earned one. See below. A site can
have both, and `shareUrl` reports the domain once there is one because that is the better
address to give somebody.

This works because the export is internally relative — a page one directory down asks for
`../assets/logo.png`, and links are `pricing.html` rather than `/pricing.html` — so the same
rendered files serve identically from a domain root or a path prefix. There is a test asserting
that, because it is the property the whole scheme rests on.

## Put it on a subdomain

The case this was built for: one hostname of your own, sites shared by path under it.

**1. A box.** This does not run on Cloudflare Workers, Vercel functions or anything
edge-shaped — it uses `pg`, reads the editor off disk, sends SMTP, and wants a volume for
Postgres. A small VPS, Fly or Railway. Two cores and a gigabyte is plenty.

**2. DNS.** An `A` record for `pagecraft.example.com` at the box's address. If your DNS is at
Cloudflare, the orange-cloud proxy is the one decision worth thinking about:

| | |
|---|---|
| **DNS only** (grey cloud) | Caddy gets a Let's Encrypt certificate itself. Simplest, and what the Caddyfile here assumes. Recommended. |
| **Proxied** (orange cloud) | Cloudflare terminates TLS and Caddy's certificate is redundant. Workable, and you are choosing to debug two TLS layers instead of one. |

**3. Bring it up.** Two shapes, depending on what the box is.

### On Fly

`server/fly.toml`. Two things instead of four — this app and a Postgres it attaches to — because
Fly's proxy terminates TLS for a hostname you add, so Caddy would be a second TLS layer to debug
for no benefit.

```bash
fly launch --no-deploy --copy-config --config server/fly.toml
fly postgres create --name pagecraft-db
fly postgres attach pagecraft-db
fly secrets set OWNER_EMAIL=you@example.com
fly deploy --config server/fly.toml --dockerfile server/Dockerfile
fly certs add pagecraft.example.com
```

Change `EDITOR_HOST` and `primary_region` in the toml before the first deploy. A wrong
`EDITOR_HOST` means every request is looked up as a custom domain and nothing is found, which
looks like a broken deployment rather than a wrong setting.

No volume, and that is not an accident: documents, sessions, invitations and uploaded images all
live in Postgres — images as `bytea` rather than files — so there is nothing on disk to lose.

What this gives up is `on_demand_tls`. On Fly a client's custom domain is a `fly certs add` each
time: fine for a handful, a chore for hundreds. Sites shared by path need none of it.

**Verified as far as it can be from here:** the image builds, the toml parses, and the port in it
matches the port the server listens on. The deploy itself needs an account, so it is untried —
if it fails, `fly logs` and the boot lines this server prints will say which of the four
environment values is wrong.

### On a plain box, from the repository root:

```bash
POSTGRES_PASSWORD=… EDITOR_HOST=pagecraft.example.com OWNER_EMAIL=you@example.com ACME_EMAIL=you@example.com docker compose -f server/compose.yml up -d --build
```

**4. Check it.**

```bash
node tools/smoke.mjs https://pagecraft.example.com
```

Read-only — it signs nothing in and creates nothing. Six checks, each one a thing that breaks in
a way the logs do not obviously explain, and each failure prints what to change. The exit code is
the number of failures.

The one that earns its keep is `EDITOR_HOST`. Set it wrong and every request is looked up as a
custom domain, so the editor answers `No site for host …` — which reads as a broken box, wrong
DNS or a bad proxy, and is one string in a config file. The check names it and prints the value
to use.

**5. Sign in.** `POST /auth/login` with `OWNER_EMAIL`. Without SMTP configured the link is
printed in `docker compose logs server`, which is fine for the first sign-in and not fine as a
habit — set `SMTP_*` and `MAIL_FROM` before anybody else uses it.

Note what is *not* needed for this shape. The Caddyfile's `on_demand_tls` and its
`/internal/tls-check` gate exist to certify **clients'** domains on demand; with one hostname
and sites on paths, that machinery sits unused until somebody adds a custom domain. It costs
nothing to leave in place and it is the reason the file looks more complicated than this
deployment is.

## Custom domains

1. The client points their domain at the box — an A record, or a CNAME to it.
2. `PUT /api/sites/:id/host` with `{"host":"acme.com"}` claims it. Until a site claims it, the
   next step says no.
3. The first HTTPS request arrives, Caddy has no certificate, and asks the app
   (`/internal/tls-check?domain=…`) whether this is a domain it serves. Without that question
   anybody who points a DNS record here can make this server request a certificate on their
   behalf, and a few thousand of those is a rate limit and a box that can no longer get
   certificates for its own clients.
4. On a 200 Caddy issues and proxies. On anything else it declines and nothing is requested.

`www` redirects to the apex in the proxy rather than as an alias per site, so the app keeps
exactly one host per site — which is what makes looking a site up a lookup rather than a search.

Read `Caddyfile`; it explains itself at length and is the file most likely to be lifted out of
here and used on its own.

## What a `content` account may do

Change words, and only words. The check works backwards on purpose: `skeleton()` blanks every
value that counts as content and compares what is left, so **anything nobody has thought about
is refused rather than permitted**. A prop added to a widget next month is structure until
somebody says otherwise.

Content is every text slot the core declares, a page's own title and description, CMS item
values and their draft flag, a component instance's text, rich-text, image and link properties,
and an image *when it is one of this site's own uploads* — checked by value, because an
arbitrary URL is not content and neither is somebody else's asset id.

Not content: links, layout, styling, adding or removing anything, and everything under `meta`,
which is where component definitions live — so a client can change what an instance says and
not what the component is.

`content.ts` has the full list and the reasoning for each line, including the three traps that
only showed up in a browser.

## Layout

| | |
|---|---|
| `src/index.ts` | read the environment, pick a store, listen. Everything decidable is decided here so `app.ts` stays a function of its arguments |
| `src/app.ts` | every route |
| `src/render.ts` | a stored document to the files a browser asks for. **Synchronous, and must stay that way** — the core keeps its document in a module-level singleton, so an `await` in the middle of a render is how two sites start swapping pages under load |
| `src/store.ts`, `src/store-pg.ts` | sites, in memory and in Postgres |
| `src/auth.ts` | magic links, sessions, roles |
| `src/content.ts` | what a `content` account may save |
| `src/assets.ts` | uploads, sniffed rather than trusted |
| `src/mail.ts` | SMTP, throttled per address |
| `Caddyfile` | TLS for domains that are not mine |

## Tests

```bash
npm test          # from the repository root — the whole suite, server included
```

`tests/loadable.test.ts` is worth knowing about: it imports every server module with **real
Node**, in its own process. Vitest is a compiler and will resolve things Node's own resolver
refuses — that has happened three times, and once it was a parameter property in `store-pg.ts`
that meant the Postgres path could never load. Sixteen tests passed against a file the server
could not import, and the first sign of it would have been a production boot.

Two checks need a service and are therefore not in the suite: `tools/realpg.mjs` wants a real
Postgres, and `tools/realmail.mjs` wants a real SMTP sink. Neither ever sends mail anywhere.
