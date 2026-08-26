# Production handover — build.itspagecraft.com

Pagecraft runs on the existing Namecheap/cPanel account. Supabase holds the durable data, and
Cloudflare proxies the public hostname.

## Production topology

- Public URL: `https://build.itspagecraft.com`
- Node 24 application: `/home/itspbuku/pagecraft-app`
- Runtime: CloudLinux Node selector and LiteSpeed Passenger
- Startup bridge: `app.cjs`, which imports `server/src/index.ts`
- Supabase project: `Pagecraft` (`pwgwvicrdbjiecjxiyvl`, Singapore)
- Database bridge: `https://pwgwvicrdbjiecjxiyvl.supabase.co/functions/v1/pagecraft-db`
- Cloudflare: proxied A record to `67.223.118.197`, Full (strict), Always Use HTTPS enabled

Namecheap blocks outbound PostgreSQL ports. The Node process therefore calls the authenticated
Supabase Edge Function over HTTPS. The function exposes a fixed operation list and parameterized
queries; it never accepts caller-provided SQL.

## Source of truth

- Node transport: `server/src/store-gateway.ts`
- Edge Function: `supabase/functions/pagecraft-db/`
- Reproducible schema: `supabase/migrations/`
- Passenger bridge: `app.cjs`

The gateway key is not committed. Supabase stores only its SHA-256 digest in
`public.gateway_config`; the raw value exists only as `DATABASE_GATEWAY_KEY` in the cPanel
application environment.

## Application environment

Required:

| Variable | Value or purpose |
|---|---|
| `DATABASE_GATEWAY_URL` | Deployed `pagecraft-db` Edge Function URL |
| `DATABASE_GATEWAY_KEY` | Private raw gateway key; never commit it |
| `EDITOR_HOST` | `build.itspagecraft.com` |
| `EDITOR_ORIGIN` | `https://build.itspagecraft.com` |
| `OWNER_EMAIL` | `braudypedrosa@gmail.com` |
| `NODE_ENV` | `production`, which enables Secure session cookies |

Mail is sent through Resend SMTP using a dedicated sending-only key restricted to
`braudyp.dev`. The current sender is `Pagecraft <pagecraft@braudyp.dev>`. Keep
`SMTP_PASS` only in the cPanel application environment.

Connected WordPress additionally fails closed until the release trust chain is provisioned:

| Variable | Value or purpose |
|---|---|
| `PAGECRAFT_RELEASE_KEY_ID` | Identifier for the online Ed25519 release key |
| `PAGECRAFT_RELEASE_PRIVATE_KEY` | PKCS#8 release private key encoded as base64url; runtime secret |
| `PAGECRAFT_ROOT_PUBLIC_KEY` | Raw 32-byte offline root public key encoded as base64url |
| `PAGECRAFT_KEYSET_ENVELOPE` | Root-signed canonical release-key set JSON |
| `PAGECRAFT_CONNECTOR_PACKAGE_PATH` | Absolute path to the provisioned connector ZIP |
| `PAGECRAFT_CONNECTOR_PACKAGE_VERSION` | Exact connector package version |
| `PAGECRAFT_THEME_PACKAGE_PATH` | Absolute path to the theme ZIP |
| `PAGECRAFT_THEME_PACKAGE_VERSION` | Exact theme package version |

Generate the root and release keys on an offline machine with
`node server/tools/provision-release-keys.mjs`. Store the root private key offline and the
release private key in the server secret store. Never save either private key in this checkout,
WordPress, a deployment log, or chat. Inject only the root public key while building the private
WordPress packages:

```bash
PAGECRAFT_ROOT_PUBLIC_KEY_BASE64URL='<offline-root-public-key>' \
  bash wordpress/tools/build-packages.sh 0.1.0
```

The package builder rejects a missing/invalid root key and verifies that the development marker
is absent from the resulting connector archive. Copy both archives to a private, non-public
server directory and configure the package path/version variables before enabling Connected
WordPress. The application signs package metadata at runtime; WordPress downloads a package only
through a scoped, one-time authorization.

## Deploy an application update

```bash
cd ~/Projects/pagecraft
npm test

rsync -az --delete -e 'ssh -F .pagecraft-local/ssh-config' server/src/ \
  itspagecraft-host:/home/itspbuku/pagecraft-app/server/src/
rsync -az --delete -e 'ssh -F .pagecraft-local/ssh-config' app/src/core/ \
  itspagecraft-host:/home/itspbuku/pagecraft-app/app/src/core/
rsync -az -e 'ssh -F .pagecraft-local/ssh-config' app.cjs index.html package.json package-lock.json \
  itspagecraft-host:/home/itspbuku/pagecraft-app/

ssh -F .pagecraft-local/ssh-config itspagecraft-host \
  'cloudlinux-selector restart --json --interpreter nodejs \
   --domain build.itspagecraft.com --app-root pagecraft-app'

node tools/smoke.mjs https://build.itspagecraft.com
```

The server imports `app/src/core/` at runtime for schema migration and rendering. Never deploy
`server/src/` without the matching core directory: a newer editor with an older server renderer
can accept a document that production cannot render.

If dependencies change, run this before restarting. The root production dependencies mirror
the server workspace because CloudLinux installs from the application-root manifest. Do not run
the virtual environment's `npm` directly inside the app root: the selector owns the
`node_modules` symlink.

```bash
ssh -F .pagecraft-local/ssh-config itspagecraft-host \
  'cloudlinux-selector install-modules --json --interpreter nodejs \
   --app-root pagecraft-app --skip-web-check'
```

## Deploy a database change

First reconcile `supabase migration list` with the repository. The live project's historical
version labels predate these checked-in filenames, so do not blindly replay the initial schema
against production. Resolve that history once, then keep the checked-in list authoritative.

Apply new ordered files from `supabase/migrations/` to project
`pwgwvicrdbjiecjxiyvl`, including these Connected WordPress migrations in order:

1. `20260826000000_wordpress_connected_v1.sql`
2. `20260826001638_gateway_release_blob_transport.sql`
3. `20260826004000_wordpress_connection_revocation.sql`

Before touching the live project, prove the complete migration chain, RLS/grant posture, and
database advisors against a disposable PostgreSQL 17 instance:

```bash
server/tools/test-supabase-migrations.sh
server/tools/test-postgres-concurrency.sh

deno fmt --check --config supabase/functions/pagecraft-db/deno.json \
  supabase/functions/pagecraft-db
deno check --config supabase/functions/pagecraft-db/deno.json \
  supabase/functions/pagecraft-db/index.ts
deno test --config supabase/functions/pagecraft-db/deno.json \
  supabase/functions/pagecraft-db
```

Then deploy
`supabase/functions/pagecraft-db/` **before** restarting the Node application. The old application
ignores new gateway operations, while the new application cannot use an old gateway that does not
know them. Keep
`verify_jwt=false`: this function deliberately uses its own gateway-key authentication.

For a fresh project, generate a random gateway key, apply the migrations, and insert its digest:

```sql
insert into public.gateway_config (id, secret_hash)
values ('primary', '<sha256-of-new-gateway-key>');
```

Put the raw key in cPanel as `DATABASE_GATEWAY_KEY`. Never put it in SQL, a migration, a shell
history file, or this repository.

## Backups and recovery

The current Supabase Free plan does not provide the automatic daily backup guarantee used by a
customer-facing production service. Run the encrypted backup job on an off-server runner and keep
its output in separate off-site storage. The exact commands, retention policy, integrity checks,
and disposable-project restore drill are in [`RECOVERY.md`](../RECOVERY.md).

Do not call a backup complete until its encrypted artifact and checksum have left both Namecheap
and the Supabase project. Run and record a restore drill before launch and at least quarterly.

## TLS renewal

The origin certificate is a Let's Encrypt certificate installed through cPanel. Renewal is
handled by the existing user crontab through:

```text
/home/itspbuku/pagecraft-ops/acme-home/acme.sh
```

Renewal uses the HTTP webroot at `/home/itspbuku/build.itspagecraft.com`, so no Cloudflare API
credential is stored on the server. The deploy hook installs renewed certificates through
cPanel UAPI. The same renewal runner also maintains the separate apex/`www` landing certificate.

## Verify

```bash
node tools/smoke.mjs https://build.itspagecraft.com

curl -I https://build.itspagecraft.com/
curl -I http://build.itspagecraft.com/
```

Expected: the HTTPS request returns `200` with HSTS; HTTP redirects to HTTPS; the observable smoke
suite passes; the public page renders the Pagecraft magic-link sign-in form. The smoke script marks
the Secure-cookie check explicitly unverified because proving it would consume a real login link;
`server/tests/auth.test.ts` performs that authenticated callback locally. Restart Passenger once
and confirm the owner row remains in Supabase to prove the app is not using memory storage.

## Current production note

The application, database gateway, DNS, origin TLS, renewal, restart persistence, Resend SMTP,
and public sign-in screen are live.
