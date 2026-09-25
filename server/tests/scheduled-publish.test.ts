/* The commit a schedule makes when it comes due.

   It differs from publishHosted in one deliberate way: it does not compare the draft version.
   A schedule publishes an earlier, reviewed snapshot while the draft moves on. The guard is the
   live pointer instead: the schedule applies only while the site still shows the publication
   its snapshot was prepared against. The same scenario runs on the memory store and on real
   Postgres (PGlite), because the SQL is where a guard like this is easiest to get subtly wrong. */
import { test } from 'vitest';
import a from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import * as Core from '../../app/src/core/index.ts';
import { MemoryStore, type Store } from '../src/store.ts';
import { PgStore, type Queryable } from '../src/store-pg.ts';
import type { Doc } from '../../app/src/core/types.ts';

const demo = (): Doc => {
  Core.seed();
  return structuredClone({
    schemaVersion: Core.SCHEMA,
    meta: Core.state.meta, header: Core.state.header,
    footer: Core.state.footer, pages: Core.state.pages,
  });
};
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const at = new Date('2026-10-01T09:00:00.000Z').toISOString();

const stores: [string, () => Promise<Store>][] = [
  ['memory', async () => new MemoryStore()],
  ['postgres', async () => {
    const sites = new PgStore((await PGlite.create()) as unknown as Queryable);
    await sites.init();
    return sites;
  }],
];

for (const [kind, make] of stores) {
  test(`${kind}: a due snapshot publishes while its baseline is live, even though the draft moved on`, async () => {
    const store = await make();
    const site = await store.create({ host: `${kind}.schedule.test`, name: 'Cabins', doc: demo() });
    const live = randomUUID();
    await store.publishHosted({ id: site.id, version: 1, publicationId: live, contentHash: hash('v1'), createdBy: 'owner', createdAt: at });

    // Version 2 is prepared for review with baseline = the live publication, then editing continues.
    const saved2 = await store.save(site.id, demo(), 1, 'owner');
    a.equal(saved2.ok, true);
    const snapshot = randomUUID();
    const saved3 = await store.save(site.id, demo(), 2, 'owner');
    a.equal(saved3.ok, true);

    const input = { id: site.id, version: 2, publicationId: snapshot, contentHash: hash('v2'), baselinePublicationId: live, createdBy: 'owner', createdAt: at };
    const published = await store.publishScheduled(input);
    a.equal(published.status, 'published');
    if (published.status !== 'published') return;
    a.equal(published.site.publishedPublicationId, snapshot);
    a.equal(published.site.publishedVersion, 2);
    // The draft is untouched: publishing an earlier snapshot never rewinds editing.
    a.equal(published.site.version, 3);

    // A runner that dies after committing retries: the replay changes nothing and succeeds.
    const replay = await store.publishScheduled(input);
    a.equal(replay.status, 'published');
    a.equal((await store.byId(site.id))?.publishedPublicationId, snapshot);
  });

  test(`${kind}: a newer publication supersedes the baseline, and the schedule does not apply`, async () => {
    const store = await make();
    const site = await store.create({ host: `${kind}.superseded.test`, name: 'Cabins', doc: demo() });
    const baseline = randomUUID();
    await store.publishHosted({ id: site.id, version: 1, publicationId: baseline, contentHash: hash('a1'), createdBy: 'owner', createdAt: at });
    await store.save(site.id, demo(), 1, 'owner');
    // Someone publishes version 2 by hand before the schedule comes due.
    const manual = randomUUID();
    await store.publishHosted({ id: site.id, version: 2, publicationId: manual, contentHash: hash('a2'), createdBy: 'owner', createdAt: at });

    const scheduled = await store.publishScheduled({ id: site.id, version: 1, publicationId: randomUUID(), contentHash: hash('a1-reviewed'), baselinePublicationId: baseline, createdBy: 'owner', createdAt: at });
    a.deepEqual(scheduled, { status: 'superseded', currentPublicationId: manual });
    a.equal((await store.byId(site.id))?.publishedPublicationId, manual);
  });

  test(`${kind}: a never-published site accepts a schedule whose baseline is null`, async () => {
    const store = await make();
    const site = await store.create({ host: `${kind}.first.test`, name: 'Cabins', doc: demo() });
    const snapshot = randomUUID();
    const first = await store.publishScheduled({ id: site.id, version: 1, publicationId: snapshot, contentHash: hash('first'), baselinePublicationId: null, createdBy: 'owner', createdAt: at });
    a.equal(first.status, 'published');
    // A schedule prepared against "never published" does not apply once anything is live.
    const late = await store.publishScheduled({ id: site.id, version: 1, publicationId: randomUUID(), contentHash: hash('late'), baselinePublicationId: null, createdBy: 'owner', createdAt: at });
    a.deepEqual(late, { status: 'superseded', currentPublicationId: snapshot });
  });

  test(`${kind}: an unknown site or revision is missing, not an error`, async () => {
    const store = await make();
    const site = await store.create({ host: `${kind}.missing.test`, name: 'Cabins', doc: demo() });
    const input = { publicationId: randomUUID(), contentHash: hash('x'), baselinePublicationId: null, createdBy: 'owner', createdAt: at };
    a.deepEqual(await store.publishScheduled({ ...input, id: site.id, version: 99 }), { status: 'missing' });
    a.deepEqual(await store.publishScheduled({ ...input, id: 'no-such-site', version: 1 }), { status: 'missing' });
  });
}
