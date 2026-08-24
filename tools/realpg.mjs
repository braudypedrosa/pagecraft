/* The store methods against the real Postgres binary, not the WASM build.

   `server/tests/store-pg.test.ts` runs the same SQL under PGlite on every `npm test`, which
   is what makes it exercised rather than hoped for. This file is the other half: it needs a
   server and a container, so it is a command somebody runs rather than a test that runs
   itself — and it is the only place two writers can race for the same version, which is the
   one claim PGlite cannot settle.

     docker run -d --rm --name pcpg -e POSTGRES_PASSWORD=pc -e POSTGRES_DB=pagecraft \
       -p 55432:5432 postgres:17-alpine
     node tools/realpg.mjs
     docker stop pcpg

   It found two things the WASM run could not. `constructor(private db)` is a parameter
   property, which Node's strip-only mode refuses — so the whole Postgres path could not be
   imported by the server at all, while sixteen tests passed against it under Vitest. And
   `bytea` comes back as a Buffer here and a Uint8Array there, so an assertion on
   `constructor.name` passed in WASM and failed against the real thing. */
import { Pool } from 'pg';
import { PgStore, PgAssetStore } from '../server/src/store-pg.ts';
import * as Core from '../app/src/core/index.ts';
import assert from 'node:assert/strict';

const pool = new Pool({ connectionString: 'postgres://postgres:pc@localhost:55432/pagecraft' });
const sites = new PgStore(pool), assets = new PgAssetStore(pool);
await sites.init(); await assets.init();
await pool.query('delete from sites');

Core.seed();
const doc = structuredClone({ meta: Core.state.meta, header: Core.state.header, footer: Core.state.footer, pages: Core.state.pages });

const site = await sites.create({ host: 'real.test', name: 'Real', doc });
assert.equal(site.version, 1);
assert.deepEqual((await sites.byId(site.id)).doc, doc, 'jsonb round trip');
assert.deepEqual((await sites.byHost('real.test')).id, site.id);

const ok = await sites.save(site.id, doc, 1);
assert.equal(ok.ok, true); assert.equal(ok.site.version, 2);
const stale = await sites.save(site.id, doc, 1);
assert.equal(stale.ok, false);
assert.deepEqual(stale.conflict, { yours: 1, theirs: 2 });

const PNG = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1,2,3,250,0,255]);
const put = await assets.put({ siteId: site.id, name: 'Logo Mark.PNG', type: 'image/png', w: 40, h: 20, bytes: PNG });
const got = await assets.get(site.id, put.id);
assert.ok(got.bytes instanceof Uint8Array, 'bytea instanceof');
assert.deepEqual([...got.bytes], [...PNG], 'bytea round trip');
assert.ok(await assets.byPath(site.id, 'assets/logo-mark.png'), 'path lookup');

/* the one thing pglite cannot test: two writers racing for the same version */
const both = await Promise.all([
  sites.save(site.id, doc, 2),
  sites.save(site.id, doc, 2)
]);
const won = both.filter(r => r.ok).length;
console.log('concurrent saves at the same version — winners:', won, 'losers:', both.length - won);
assert.equal(won, 1, 'exactly one save may win a race');

await pool.query('delete from sites where id = $1', [site.id]);
assert.equal((await assets.list(site.id)).length, 0, 'cascade');

await pool.end();
console.log('real postgres: every check passed');
