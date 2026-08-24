# Deploy handover — pagecraft.braudyp.dev

Everything needed to put this server on `pagecraft.braudyp.dev`. Written for somebody with
server and Cloudflare access who does not have the history: it states the invariants, marks the
two genuine decisions, and gives a command that says whether it worked.

## What is being deployed

A Node server (Hono) that stores site documents in Postgres and renders them on request. Sites
are shared by path: `pagecraft.braudyp.dev/<slug>/<page>`. The editor is served from the same
host at `/`, behind a magic-link sign-in.

Repository: `~/Projects/pagecraft`, public at `github.com/braudypedrosa/pagecraft`.
Server code: `server/`. Image: `server/Dockerfile`. Fly config: `server/fly.toml`.

## Hard requirements

**It cannot run on Cloudflare Workers, Pages, or any edge runtime.** It uses `pg` over TCP,
reads `index.html` off disk, and sends SMTP. It needs a normal Node process.

**It needs Postgres.** Everything that must survive a restart is there — documents, sessions,
invitations, and uploaded images as `bytea`. Nothing is written to disk, so **no volume is
required**; that is a property of the code, not an oversight.

**Node 24.** The server runs TypeScript directly via Node's type stripping. The Dockerfile pins
this; do not change it to an older major.

**The editor must be built before the image.** `node build.mjs` writes `index.html`, and the
Dockerfile's first stage does this itself — so a plain `fly deploy` is enough. Do not add a build
step that runs a bundler at container start.

## The two decisions

**1. Cloudflare proxy: use DNS only (grey cloud).** Recommended, and what the config assumes.
Fly terminates TLS for the hostname; proxying through Cloudflare adds a second TLS layer to
debug for no benefit here. If you deliberately choose proxied, set SSL/TLS mode to Full (strict).

**2. SMTP now or later.** Without it, sign-in links are **printed to the server log** instead of
emailed. That is workable for the first sign-in and unacceptable as a standing state — anyone who
can read logs can sign in as anyone. Deploying without it first is fine; set it before a second
person uses the server.

## Steps

```bash
cd ~/Projects/pagecraft

# 1. the app. `apps create` rather than `launch`: launch is interactive and may rewrite fly.toml.
fly apps create pagecraft

# 2. Postgres, attached so DATABASE_URL is set for the app.
#    On current flyctl this is `fly postgres create` + `fly postgres attach`. If your flyctl
#    offers Managed Postgres instead, create one there and set DATABASE_URL as a secret by hand.
#    The invariant is only this: the app must start with DATABASE_URL pointing at a Postgres.
fly postgres create --name pagecraft-db
fly postgres attach pagecraft-db --app pagecraft

# 3. the owner. Without this nobody can sign in — the sites still serve, but the editor is shut.
fly secrets set --app pagecraft OWNER_EMAIL=braudy@creationworx.com

# 4. deploy
fly deploy --app pagecraft --config server/fly.toml --dockerfile server/Dockerfile

# 5. the hostname, then the DNS record it prints, at Cloudflare — DNS only, grey cloud
fly certs add --app pagecraft pagecraft.braudyp.dev
```

**Before step 4**, set `EDITOR_HOST` in `server/fly.toml` to `pagecraft.braudyp.dev`. It ships as
`pagecraft.example.com`. Also set `primary_region` to whatever is nearest; it ships as `lhr`.

## Environment

Set in `server/fly.toml` under `[env]` (not secret) or via `fly secrets set` (secret).

| | | |
|---|---|---|
| `EDITOR_HOST` | **required** | `pagecraft.braudyp.dev`. The host the editor answers on and the host sites are shared under. Get this wrong and every request is treated as a custom-domain lookup, so the editor answers `No site for host …` — see the failure mode below |
| `DATABASE_URL` | **required** | set by `fly postgres attach`. Absent, the server runs on in-memory stores and loses everything on restart |
| `OWNER_EMAIL` | **required** | the first person who can sign in. Idempotent, so leaving it set is fine |
| `NODE_ENV=production` | set in fly.toml | puts `Secure` on the session cookie. Without it the cookie can travel in clear |
| `PORT=8787` | set in fly.toml | must match `http_service.internal_port` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | optional | how links are sent. `MAIL_FROM` is required for mail to count as configured; port defaults to 587. **Secrets** |
| `ACME_EMAIL` | not needed on Fly | Caddy's, for the compose deployment only |
| `CLIENT_EMAIL` | do not set | a development shortcut that grants the content role on every site |

Generate `POSTGRES_PASSWORD` only for the compose path (below); on Fly the attach handles
credentials. Nothing secret goes in the repository — `fly secrets` or the environment, never a
committed file.

## Verify

```bash
node tools/smoke.mjs https://pagecraft.braudyp.dev
```

Read-only: signs nothing in, creates nothing. Exit code is the number of failures, and each
failure prints what to change. Then open the URL: it should show a sign-in form, and after
signing in, **"Make your first site"** with a name field.

## The failure mode to expect

If `EDITOR_HOST` does not match the hostname, the site answers `No site for host
pagecraft.braudyp.dev` for every request. This looks like broken DNS, a broken proxy or a broken
box, and it is one string in `fly.toml`. The smoke test names it and prints the value to use.
Check that before investigating anything else.

Second most likely: a 503 with `No editor build`. That means `index.html` is missing from the
image — the Dockerfile's first stage failed, so read the build log rather than the runtime log.

## Alternative: a plain box

If Fly is not wanted, `server/compose.yml` runs the same image with Postgres and Caddy, and Caddy
gets the certificate itself. From the repository root:

```bash
POSTGRES_PASSWORD="$(openssl rand -base64 32)" EDITOR_HOST=pagecraft.braudyp.dev \
OWNER_EMAIL=braudy@creationworx.com ACME_EMAIL=braudy@creationworx.com \
docker compose -f server/compose.yml up -d --build
```

Needs ports 80 and 443 reachable, an A record at the box, and grey cloud at Cloudflare so Caddy
can complete the ACME challenge. Caddy uses `network_mode: host`, which does not work on Docker
Desktop — Linux only.

## What has been verified, and what has not

Verified in containers against real Postgres: the image builds, the stack comes up, sign-in
works, a site is created from a name alone, it serves at its path, documents round-trip, a
content account can edit words and not structure, and the smoke test passes — and fails with the
right advice against a deliberately wrong `EDITOR_HOST`.

**Not verified:** any Fly deployment, and the ACME certificate exchange. Both need an account and
a public name. If `fly deploy` fails, `fly logs` plus the boot lines this server prints name which
environment value is wrong.

## Report back

The URL, the output of `tools/smoke.mjs`, and — if anything failed — the boot lines from
`fly logs`. The server prints one line per configured thing on start (`store:`, `owner`, `mail`),
which is usually enough to see what is missing.
