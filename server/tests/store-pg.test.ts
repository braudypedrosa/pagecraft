/* The SQL, actually executed.

   `store-pg.ts` was written blind — there was no database on the machine — and writing SQL
   blind is how a query that looks right ships wrong. This runs every method against PGlite,
   which is Postgres compiled to WASM: real parser, real planner, real types, no daemon and no
   container. So the SQL is exercised on every `npm test` rather than on the days somebody
   remembers.

   What this cannot test is two writers racing, because PGlite is one connection. The claim
   that depends on it — the version in the `where` clause of `save`, so the check and the write
   are one statement — is argued in that file rather than proven here. The single-statement
   shape is what hands the question to the database instead of to this code. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import * as Core from '../../app/src/core/index.ts';
import { PgStore, PgAssetStore, PgAuthStore, statements, SCHEMA, type Queryable } from '../src/store-pg.ts';
import { AUTH_SCHEMA, hashToken, newToken, LINK_TTL_MS, SESSION_TTL_MS } from '../src/auth.ts';
import { ASSET_SCHEMA } from '../src/assets.ts';
import type { Doc } from '../../app/src/core/types.ts';
import { cmsItemKey } from '../src/store.ts';
import { PgOwnedSiteStore } from '../src/accounts.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages
  });
};

/** A fresh database per test. Cheap enough that sharing one would only buy flakiness. */
const fresh = async () => {
  const db = await PGlite.create();
  const q = db as unknown as Queryable;
  const sites = new PgStore(q);
  const assets = new PgAssetStore(q);
  const auth = new PgAuthStore(q);
  /* sites first: the auth tables reference it, and a foreign key to a table that is not there
     yet is an error rather than a warning */
  await sites.init();
  await auth.init();
  await assets.init();
  return { db, sites, assets, auth };
};

/* ------------------------------------------------------------- the schema */

test('the schema splits into statements a driver will take one at a time', () => {
  const site = statements(SCHEMA);
  a.ok(site.length >= 2, 'a table and an index');
  a.ok(site.every(s => !s.includes('/*')), 'comments stripped, so a ; inside one cannot split it');
  const asset = statements(ASSET_SCHEMA);
  a.ok(asset.length >= 2);
  a.ok(asset.some(s => /create table if not exists assets/.test(s)));
  /* the comment in ASSET_SCHEMA contains no semicolon today; this is the guard for the day
     somebody writes one that does */
  a.equal(statements('/* a; b */ create table x (i int);').length, 1);
});

test('running init twice is not an error, because a restart is not a special case', async () => {
  const { sites, assets } = await fresh();
  await sites.init();
  await assets.init();
  a.deepEqual(await sites.list(), []);
});

test('owned-site creation commits the site, revision and membership together and enforces its quota', async () => {
  const { db, sites, auth } = await fresh();
  const owner = await auth.ensureAuthUser('supabase-owner', 'owner@example.test', 'Owner');
  const collaborator = await auth.ensureAuthUser('supabase-collaborator', 'collab@example.test', 'Collaborator');
  const owned = new PgOwnedSiteStore(db as unknown as Queryable);
  const first = await owned.create({ ownerId: owner.id, host: 'one.test', name: 'One', doc: demo() });
  a.equal(first.ok, true);
  if (!first.ok) throw new Error('site was not created');
  await auth.grant(first.site.id, collaborator.id, 'content');
  for (const [host, name] of [['two.test', 'Two'], ['three.test', 'Three']]) {
    a.equal((await owned.create({ ownerId: owner.id, host, name, doc: demo() })).ok, true);
  }
  const fourth = await owned.create({ ownerId: owner.id, host: 'four.test', name: 'Four', doc: demo() });
  a.deepEqual(fourth, { ok: false, reason: 'site_limit_reached' });
  a.equal((await auth.membershipsForUser(collaborator.id)).length, 1,
    'collaborator membership exists but does not consume their own creation quota');
  a.equal((await owned.create({ ownerId: collaborator.id, host: 'collab-owned.test', name: 'Mine', doc: demo() })).ok, true);
  a.equal((await sites.history(first.site.id)).length, 1);
});

/* -------------------------------------------------------------- the sites */

test('a site round-trips through jsonb with its document intact', async () => {
  const { sites } = await fresh();
  const doc = demo();
  const made = await sites.create({ host: 'acme.test', name: 'Acme', doc });

  a.equal(made.host, 'acme.test');
  a.equal(made.version, 1);
  a.ok(made.updatedAt, 'a timestamp, as a string');
  a.doesNotThrow(() => new Date(made.updatedAt).toISOString());

  const back = await sites.byId(made.id);
  a.deepEqual(back!.doc, doc, 'jsonb is not a lossy round trip for this document');
  a.deepEqual((await sites.byHost('acme.test'))!.id, made.id);
  a.equal(await sites.byHost('nobody.test'), null);
  a.equal(await sites.byId('nope'), null);
});

test('a host is unique, and the second attempt fails rather than shadowing the first', async () => {
  const { sites } = await fresh();
  await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  await a.rejects(() => sites.create({ host: 'acme.test', name: 'Again', doc: demo() }),
    /unique|duplicate/i);
  a.equal((await sites.list()).length, 1);
});

test('a save bumps the version and moves the timestamp', async () => {
  const { sites } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const doc = structuredClone(site.doc);
  doc.pages[0].title = 'Changed';

  const res = await sites.save(site.id, doc, 1);
  a.equal(res.ok, true);
  a.equal(res.site!.version, 2);
  a.equal(res.site!.doc.pages[0].title, 'Changed');
  a.ok(new Date(res.site!.updatedAt) >= new Date(site.updatedAt));
});

test('every accepted save is an immutable revision with its author', async () => {
  const { sites } = await fresh();
  const original = demo();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: original, savedBy: 'owner-1' });
  const changed = structuredClone(original);
  changed.pages[0].title = 'Later';
  await sites.save(site.id, changed, 1, 'owner-2');

  const history = await sites.history(site.id);
  a.deepEqual(history.map(r => [r.version, r.savedBy]), [[2, 'owner-2'], [1, 'owner-1']]);
  a.equal(history[0].doc.pages[0].title, 'Later');
  a.equal((await sites.revision(site.id, 1))!.doc.pages[0].title, original.pages[0].title);
  a.equal(await sites.revision(site.id, 99), null);
});

test('CMS write heads return the highest durable sequence for each connection and item', async () => {
  const { sites } = await fresh();
  const site = await sites.create({ host: 'cms.test', name: 'CMS', doc: demo() });
  const context = (connectionId: string, writeSequence: number, idempotencyKey: string) => ({
    cmsWrites: [{
      connectionId, collectionId: 'posts', itemId: 'one', writeSequence,
      idempotencyKey, bodyHash: String(writeSequence).repeat(64).slice(0, 64)
    }]
  });
  a.equal((await sites.save(site.id, site.doc, 1, 'owner', context('production', 1, 'write-one'))).ok, true);
  a.equal((await sites.save(site.id, site.doc, 2, 'owner', context('production', 3, 'write-three'))).ok, true);
  a.equal((await sites.save(site.id, site.doc, 3, 'owner', context('other', 99, 'other-write'))).ok, true);

  a.deepEqual(await sites.cmsWriteHeads(site.id, 'production', [cmsItemKey('posts', 'one')]), [{
    connectionId: 'production', collectionId: 'posts', itemId: 'one', writeSequence: 3,
    idempotencyKey: 'write-three', bodyHash: '3'.repeat(64), version: 3
  }]);
  a.deepEqual(await sites.cmsWriteHeads(site.id, 'production', [cmsItemKey('posts', 'missing')]), []);
});

test('a stale save is refused by the statement, and says both numbers', async () => {
  const { sites } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  a.equal((await sites.save(site.id, site.doc, 1)).ok, true);

  const late = await sites.save(site.id, site.doc, 1);
  a.equal(late.ok, false);
  a.deepEqual(late.conflict, { yours: 1, theirs: 2 });
  a.equal((await sites.byId(site.id))!.version, 2, 'and nothing was written');
});

test('saving a site that is gone is a plain no, not a conflict', async () => {
  const { sites } = await fresh();
  const res = await sites.save('never-existed', demo(), 1);
  a.equal(res.ok, false);
  a.equal(res.conflict, undefined, 'a missing row and a lost race are different answers');
});

test('the list is ordered by name, so a picker is stable', async () => {
  const { sites } = await fresh();
  for (const [host, name] of [['c.test', 'Charlie'], ['a.test', 'Alpha'], ['b.test', 'Bravo']]) {
    await sites.create({ host, name, doc: demo() });
  }
  a.deepEqual((await sites.list()).map(s => s.name), ['Alpha', 'Bravo', 'Charlie']);
  const metadata = await sites.listMeta();
  a.deepEqual(metadata.map(s => s.name), ['Alpha', 'Bravo', 'Charlie']);
  a.equal('doc' in metadata[0], false, 'the picker query does not transfer every site document');
});

test('a document with characters that break naive SQL survives being a parameter', async () => {
  /* Not a hypothetical: the code widget exists, so a document holds arbitrary source. */
  const { sites } = await fresh();
  const doc = demo();
  const nasty = `it's "quoted" \\\\ back\\\\slashed; drop table sites; -- and   no null byte`;
  doc.pages[0].title = nasty.replace(/ /g, '');
  doc.meta.css = "body::after{content:'--; drop table sites;'}";
  const site = await sites.create({ host: 'acme.test', name: nasty.replace(/ /g, ''), doc });

  const back = await sites.byId(site.id);
  a.equal(back!.doc.pages[0].title, doc.pages[0].title);
  a.equal(back!.doc.meta.css, doc.meta.css);
  a.equal((await sites.list()).length, 1, 'the table is still there');
});

/* ------------------------------------------------------------- the assets */

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 250, 251, 252, 0, 255]);

test('bytes go in and come back as the same bytes', async () => {
  const { sites, assets } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });

  const put = await assets.put({ siteId: site.id, name: 'Logo Mark.PNG', type: 'image/png', w: 40, h: 20, bytes: PNG });
  a.ok(put.id);

  const got = await assets.get(site.id, put.id);
  a.ok(got, 'nothing came back');
  /* `instanceof`, not `constructor.name`. PGlite hands back a Uint8Array and the `pg` driver
     hands back a Buffer, which is a subclass of one — so a name check passes in WASM and fails
     against the real server, which is precisely the kind of test this file exists to not be. */
  a.ok(got!.bytes instanceof Uint8Array, 'bytea is not a string on the way out');
  a.deepEqual([...got!.bytes], [...PNG], 'including the high bytes and the zero');
  a.deepEqual([got!.w, got!.h], [40, 20]);
  a.equal(got!.name, 'Logo Mark.PNG', 'stored as uploaded; sanitised only in the path');
  a.equal('bytes' in (await assets.list(site.id))[0], false, 'library listings do not fetch bytea');
});

test('an asset is reachable by the path a rendered page asks for', async () => {
  const { sites, assets } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const made = await assets.put({ siteId: site.id, name: 'Logo Mark.PNG', type: 'image/png', w: 4, h: 4, bytes: PNG });

  const hit = await assets.byPath(site.id, `assets/logo-mark-${made.id}.png`);
  a.ok(hit, 'the sanitised path did not resolve');
  a.ok(await assets.byPath(site.id, 'assets/logo-mark.png'), 'legacy filename-only URLs remain readable');
  a.equal(await assets.byPath(site.id, 'assets/logo-mark.jpg'), null);
  a.equal(await assets.byPath(site.id, 'Logo Mark.PNG'), null, 'the raw name is not the path');
});

test('assets belong to their site, and one site cannot read another’s', async () => {
  const { sites, assets } = await fresh();
  const one = await sites.create({ host: 'a.test', name: 'A', doc: demo() });
  const two = await sites.create({ host: 'b.test', name: 'B', doc: demo() });
  const mine = await assets.put({ siteId: one.id, name: 'x.png', type: 'image/png', w: 1, h: 1, bytes: PNG });

  a.equal(await assets.get(two.id, mine.id), null, 'the id alone is not enough');
  a.equal(await assets.byPath(two.id, 'assets/x.png'), null);
  a.deepEqual((await assets.list(two.id)), []);
  a.equal((await assets.list(one.id)).length, 1);
});

test('putting the same id twice replaces the bytes rather than failing', async () => {
  const { sites, assets } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const first = await assets.put({ siteId: site.id, name: 'x.png', type: 'image/png', w: 1, h: 1, bytes: PNG });
  const other = new Uint8Array([0x89, 0x50, 9, 9, 9]);
  const again = await assets.put({ id: first.id, siteId: site.id, name: 'x.png', type: 'image/png', w: 2, h: 2, bytes: other });

  a.equal(again.id, first.id);
  a.deepEqual([...(await assets.get(site.id, first.id))!.bytes], [...other]);
  a.equal((await assets.list(site.id)).length, 1, 'replaced, not duplicated');
});

test('removing an asset needs the right site, and says whether it did anything', async () => {
  const { sites, assets } = await fresh();
  const one = await sites.create({ host: 'a.test', name: 'A', doc: demo() });
  const two = await sites.create({ host: 'b.test', name: 'B', doc: demo() });
  const asset = await assets.put({ siteId: one.id, name: 'x.png', type: 'image/png', w: 1, h: 1, bytes: PNG });

  a.equal(await assets.remove(two.id, asset.id), false, 'not yours to delete');
  a.equal((await assets.list(one.id)).length, 1);
  a.equal(await assets.remove(one.id, asset.id), true);
  a.equal(await assets.remove(one.id, asset.id), false, 'and not twice');
});

test('deleting a site takes its assets with it', async () => {
  /* `on delete cascade` in the schema. Worth a test because the alternative is rows nobody
     can reach and a volume that only grows. */
  const { db, sites, assets } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  await assets.put({ siteId: site.id, name: 'x.png', type: 'image/png', w: 1, h: 1, bytes: PNG });
  a.equal((await assets.list(site.id)).length, 1);

  await db.query('delete from sites where id = $1', [site.id]);
  a.equal((await assets.list(site.id)).length, 0);
});

test('an asset cannot belong to a site that does not exist', async () => {
  const { assets } = await fresh();
  await a.rejects(
    () => assets.put({ siteId: 'no-such-site', name: 'x.png', type: 'image/png', w: 1, h: 1, bytes: PNG }),
    /foreign key|violates/i);
});


/* ---------------------------------------------------------------- the auth */

test('the auth schema is statements too, and running it twice is fine', async () => {
  a.ok(statements(AUTH_SCHEMA).length >= 5, 'four tables and an index');
  const { auth } = await fresh();
  await auth.init();
  a.equal(await auth.userByEmail('nobody@acme.test'), null);
});

test('an account is one account however the address was typed', async () => {
  const { auth } = await fresh();
  const first = await auth.createUser('  Client@Acme.TEST ', 'Client');
  a.equal(first.email, 'client@acme.test');

  /* Twice, because two invitations to the same address arriving together must make one
     account — which is what the `on conflict` is for. */
  const again = await auth.createUser('CLIENT@acme.test');
  a.equal(again.id, first.id);
  a.equal(again.name, 'Client', 'and an empty name does not erase the one that was there');
  a.equal((await auth.userById(first.id))!.email, 'client@acme.test');
  a.deepEqual((await auth.usersByIds([first.id, first.id, 'missing'])).map(user => user.id), [first.id],
    'revision authors resolve in one query and duplicate ids do not duplicate users');
});

test('a link is consumed by the statement that reads it', async () => {
  const { auth } = await fresh();
  const u = await auth.createUser('client@acme.test');
  const token = newToken();
  await auth.putLink(hashToken(token), u.email, Date.now() + LINK_TTL_MS);

  a.deepEqual(await auth.useLink(hashToken(token)), { email: 'client@acme.test' });
  a.equal(await auth.useLink(hashToken(token)), null, 'delete and read in one statement');
});

test('an expired link is spent by being presented, not by succeeding', async () => {
  const { auth } = await fresh();
  const u = await auth.createUser('client@acme.test');
  const token = newToken();
  await auth.putLink(hashToken(token), u.email, Date.now() - 1000);
  a.equal(await auth.useLink(hashToken(token)), null, 'expired');
  await auth.putLink(hashToken(token), u.email, Date.now() + LINK_TTL_MS);
  a.ok(await auth.useLink(hashToken(token)), 'and a fresh one for the same digest works');
});

test('a session lives until it expires, and then it does not', async () => {
  const { auth } = await fresh();
  const u = await auth.createUser('client@acme.test');
  const live = newToken(), dead = newToken();
  await auth.putSession(hashToken(live), u.id, Date.now() + SESSION_TTL_MS);
  await auth.putSession(hashToken(dead), u.id, Date.now() - 1);

  const s = await auth.sessionByDigest(hashToken(live));
  a.equal(s!.userId, u.id);
  a.ok(s!.expiresAt > Date.now(), 'a number, not a Date, whatever the driver hands back');
  a.equal(await auth.sessionByDigest(hashToken(dead)), null);
  a.deepEqual(await auth.sessionsOf(u.id), [hashToken(live)], 'and the expired row is gone');
  a.equal((await auth.userForSession(hashToken(live)))!.id, u.id, 'session and user resolve together');

  await auth.dropSession(hashToken(live));
  a.equal(await auth.sessionByDigest(hashToken(live)), null);
});

test('a role is granted, changed and revoked, and the list reads by address', async () => {
  const { sites, auth } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const zoe = await auth.createUser('zoe@acme.test');
  const adam = await auth.createUser('adam@acme.test', 'Adam');
  await auth.grant(site.id, zoe.id, 'owner');
  await auth.grant(site.id, adam.id, 'content');

  a.deepEqual((await auth.membershipsForUser(adam.id)).map(m => m.siteId), [site.id]);
  const session = hashToken(newToken());
  await auth.putSession(session, adam.id, Date.now() + SESSION_TTL_MS);
  a.equal((await auth.accessForSession(session, site.id))!.role, 'content');
  a.equal((await auth.accessForSession(session, 'missing'))!.role, null, 'valid identity, no membership');

  const list = await auth.members(site.id);
  a.deepEqual(list.map(m => m.email), ['adam@acme.test', 'zoe@acme.test']);
  a.equal(list.find(m => m.email === 'adam@acme.test')!.name, 'Adam');

  /* granting again is a change of role, not a second row */
  await auth.grant(site.id, adam.id, 'owner');
  a.equal((await auth.membership(site.id, adam.id))!.role, 'owner');
  a.equal((await auth.members(site.id)).length, 2);

  a.equal(await auth.revoke(site.id, adam.id), true);
  a.equal(await auth.revoke(site.id, adam.id), false, 'and not twice');
  a.equal(await auth.membership(site.id, adam.id), null);
});

test('a role cannot be granted for a site or a person that does not exist', async () => {
  const { sites, auth } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const u = await auth.createUser('client@acme.test');
  await a.rejects(() => auth.grant('no-such-site', u.id, 'owner'), /foreign key|violates/i);
  await a.rejects(() => auth.grant(site.id, 'no-such-user', 'owner'), /foreign key|violates/i);
});

test('the role column refuses a role nobody defined', async () => {
  /* The check constraint, so a typo in a future caller cannot store a role that then reads as
     no permissions at all — or worse, as some. */
  const { db, sites, auth } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const u = await auth.createUser('client@acme.test');
  await a.rejects(
    () => db.query('insert into site_users (site_id, user_id, role) values ($1, $2, $3)',
      [site.id, u.id, 'superuser']),
    /check constraint|violates/i);
});

test('deleting a site or a person takes the memberships with them', async () => {
  const { db, sites, auth } = await fresh();
  const site = await sites.create({ host: 'acme.test', name: 'Acme', doc: demo() });
  const u = await auth.createUser('client@acme.test');
  await auth.grant(site.id, u.id, 'content');
  await auth.putSession(hashToken('x'), u.id, Date.now() + SESSION_TTL_MS);

  await db.query('delete from users where id = $1', [u.id]);
  a.equal(await auth.membership(site.id, u.id), null, 'membership cascaded');
  a.equal(await auth.sessionByDigest(hashToken('x')), null, 'and so did the session');
});

/* ------------------------------------------------------ slug, as real SQL

   `slug` is the first thing added to `sites` after it shipped, so it arrives as an alter with a
   backfill rather than as a column in the create. That sequence is the part worth executing: a
   NOT NULL on a table that already has rows and no values for them fails, and the order it fails
   in is not obvious from reading it. */

test('the slug column arrives on a table that already has rows', async () => {
  const db = new PGlite();
  /* the schema as it was before slug existed, and a site stored under it */
  await db.query(`create table sites (
    id text primary key, host text not null unique, name text not null,
    doc jsonb not null, version integer not null default 1,
    updated_at timestamptz not null default now())`);
  await db.query(
    `insert into sites (id, host, name, doc) values ($1, $2, $3, $4)`,
    ['old', 'acme.example.com', 'Acme', JSON.stringify(demo())]
  );

  /* then the schema as it is now, which has to cope */
  const store = new PgStore(db as unknown as Queryable);
  await store.init();

  const back = await store.byId('old');
  a.equal(back!.slug, 'acme', 'backfilled from the first label of the host');
  a.equal((await store.bySlug('acme'))!.id, 'old', 'and reachable by it');

  /* and running it again is not a special case */
  await store.init();
  a.equal((await store.byId('old'))!.slug, 'acme');
});

test('two sites cannot share a path, and the index is what says so', async () => {
  const db = new PGlite();
  const store = new PgStore(db as unknown as Queryable);
  await store.init();

  const one = await store.create({ host: 'a.invalid', slug: 'acme', name: 'A', doc: demo() });
  a.equal(one.slug, 'acme');

  await a.rejects(
    () => store.create({ host: 'b.invalid', slug: 'acme', name: 'B', doc: demo() }),
    /unique|duplicate/i, 'asked for a taken path: the caller is told');

  /* not asked for one, so the insert retries until the index lets it through */
  const auto = await store.create({ host: 'c.invalid', name: 'Acme', doc: demo() });
  a.equal(auto.slug, 'acme-2');

  a.equal(await store.setSlug(auto.id, 'acme'), null, 'moving onto a taken path is refused');
  const moved = await store.setSlug(auto.id, 'acme-three');
  a.equal(moved!.slug, 'acme-three');
});
