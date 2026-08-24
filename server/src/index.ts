/* The entry point: read the environment, pick a store, listen.

   Everything decidable is decided here, so `app.ts` stays a function of its arguments and
   the tests can call it without a database, a build or a port. */
import { serve } from '@hono/node-server';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { MemoryStore, type Store } from './store.ts';
import { MemoryAuthStore, type AuthStore } from './auth.ts';
import { MemoryAssetStore, type AssetStore } from './assets.ts';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const PORT = Number(process.env.PORT || 8787);
const EDITOR_HOST = process.env.EDITOR_HOST || 'localhost';

/* The builder, as built. `node build.mjs` writes it; the server does not build it, because
   a server that runs a bundler on boot is a server that fails to boot for bundler reasons. */
const editorPath = join(repo, 'index.html');
const editorHtml = existsSync(editorPath) ? readFileSync(editorPath, 'utf8') : undefined;
if (!editorHtml) console.warn(`no editor at ${editorPath} — run \`node build.mjs\``);

/* One connection for all three, because they are one database and a second pool would only be
   a second thing to run out of. Order matters on first run: the auth and asset tables
   reference `sites`, and a foreign key to a table that is not there yet is an error. */
async function pickStores(): Promise<{ store: Store; assets: AssetStore; auth: AuthStore }> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DATABASE_URL is not set — using the in-memory stores. Nothing survives a restart,');
    console.warn('including who is signed in and who has been invited.');
    return { store: new MemoryStore(), assets: new MemoryAssetStore(), auth: new MemoryAuthStore() };
  }
  /* Imported here rather than at the top so a run without a database needs no driver. */
  const { Pool } = await import('pg');
  const { PgStore, PgAssetStore, PgAuthStore } = await import('./store-pg.ts');
  const pool = new Pool({ connectionString: url });
  const store = new PgStore(pool);
  const auth = new PgAuthStore(pool);
  const assets = new PgAssetStore(pool);
  await store.init();
  await auth.init();
  await assets.init();
  console.log('store: postgres');
  return { store, assets, auth };
}

const { store, assets, auth } = await pickStores();

/* One site, seeded, when the store is empty and we are running on memory. Without it the
   first thing a new checkout shows is "No site for host localhost", which reads as broken
   rather than as empty. */
if (!process.env.DATABASE_URL && !(await store.list()).length) {
  const Core = await import('../../app/src/core/index.ts');
  Core.seed();
  await store.create({
    host: EDITOR_HOST === 'localhost' ? 'site.localhost' : 'site.' + EDITOR_HOST,
    name: 'Demo',
    doc: { meta: Core.state.meta, header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages }
  });
  console.log('seeded one demo site');
}

/* The first owner. Somebody has to be able to sign in before anybody can be invited, and
   there is no route into an empty database otherwise — `/auth/login` answers 200 to an address
   it has never heard of, which is correct and useless.

   Idempotent, so setting it on every boot is harmless: `createUser` upserts on the address and
   `grant` upserts on the pair. Once there is an owner, everybody else arrives through
   `POST /api/sites/:id/people`, which is the flow this replaced. */
const OWNER = process.env.OWNER_EMAIL;
if (OWNER) {
  const user = await auth.createUser(OWNER, 'Owner');
  for (const s of await store.list()) await auth.grant(s.id, user.id, 'owner');
  console.log(`owner    ${OWNER} — POST /auth/login for a link`);
} else {
  console.warn('OWNER_EMAIL is not set — nobody can sign in. The sites still serve.');
}

/* Kept for trying the content role on a throwaway run. Inviting is the real route now, and on
   a database this is the one thing here that a restart would re-grant after a revoke — so it
   is a development convenience and says so. */
const CLIENT = process.env.CLIENT_EMAIL;
if (CLIENT) {
  const user = await auth.createUser(CLIENT, 'Client');
  for (const s of await store.list()) await auth.grant(s.id, user.id, 'content');
  console.log(`client   ${CLIENT} — content only (a shortcut; invite instead)`);
}

const app = createApp({
  store, auth, assets, editorHtml, editorHost: EDITOR_HOST,
  secureCookies: process.env.NODE_ENV === 'production'
});

serve({ fetch: app.fetch, port: PORT }, info => {
  console.log(`editor   http://${EDITOR_HOST}:${info.port}/`);
  console.log(`api      http://${EDITOR_HOST}:${info.port}/api/sites`);
  store.list().then(sites => sites.forEach(s => console.log(`site     http://${s.host}:${info.port}/  (${s.name})`)));
});
