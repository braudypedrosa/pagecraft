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

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..');

const PORT = Number(process.env.PORT || 8787);
const EDITOR_HOST = process.env.EDITOR_HOST || 'localhost';

/* The builder, as built. `node build.mjs` writes it; the server does not build it, because
   a server that runs a bundler on boot is a server that fails to boot for bundler reasons. */
const editorPath = join(repo, 'index.html');
const editorHtml = existsSync(editorPath) ? readFileSync(editorPath, 'utf8') : undefined;
if (!editorHtml) console.warn(`no editor at ${editorPath} — run \`node build.mjs\``);

async function pickStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('DATABASE_URL is not set — using the in-memory store. Nothing will survive a restart.');
    return new MemoryStore();
  }
  /* Imported here rather than at the top so a run without a database needs no driver. */
  const { Pool } = await import('pg');
  const { PgStore } = await import('./store-pg.ts');
  const store = new PgStore(new Pool({ connectionString: url }));
  await store.init();
  console.log('store: postgres');
  return store;
}

const store = await pickStore();

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

/* One auth store for now. It is memory-backed like the site store when there is no
   database, which means a restart signs everyone out — acceptable while the whole thing is
   one machine and two people, and the note in the log says so. */
const auth: AuthStore = new MemoryAuthStore();

/* The first owner, so a fresh checkout has somebody who can sign in. Without it there is no
   account and no way to make one, and `/auth/login` would answer 200 to an address it has
   never heard of, which is correct and useless. */
const OWNER = process.env.OWNER_EMAIL;
if (OWNER) {
  const user = await auth.createUser(OWNER, 'Owner');
  for (const s of await store.list()) await auth.grant(s.id, user.id, 'owner');
  console.log(`owner    ${OWNER} — POST /auth/login to get a link`);
} else {
  console.warn('OWNER_EMAIL is not set — nobody can sign in. The sites still serve.');
}

/* A client, for trying the content role without a database or an invite flow. On a real box
   this is what an invite would create; here it is one variable. */
const CLIENT = process.env.CLIENT_EMAIL;
if (CLIENT) {
  const user = await auth.createUser(CLIENT, 'Client');
  for (const s of await store.list()) await auth.grant(s.id, user.id, 'content');
  console.log(`client   ${CLIENT} — content only`);
}

const app = createApp({
  store, auth, editorHtml, editorHost: EDITOR_HOST,
  secureCookies: process.env.NODE_ENV === 'production'
});

serve({ fetch: app.fetch, port: PORT }, info => {
  console.log(`editor   http://${EDITOR_HOST}:${info.port}/`);
  console.log(`api      http://${EDITOR_HOST}:${info.port}/api/sites`);
  store.list().then(sites => sites.forEach(s => console.log(`site     http://${s.host}:${info.port}/  (${s.name})`)));
});
