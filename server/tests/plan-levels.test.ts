import a from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { test } from 'vitest';
import {
  effectivePlan, FREE_PLAN, LAUNCH_PLAN, PAST_DUE_GRACE_DAYS, planEntitlements, PRO_PLAN, STUDIO_PLAN,
} from '../src/plans.ts';

const now = new Date('2026-11-19T00:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

test('catalog maps every plan and fails closed to Free', () => {
  a.equal(planEntitlements('launch'), LAUNCH_PLAN);
  a.equal(planEntitlements('studio'), STUDIO_PLAN);
  a.equal(planEntitlements('pro'), PRO_PLAN);
  for (const value of [undefined, null, '', 'enterprise', 'toString', '__proto__', 'constructor']) {
    a.equal(planEntitlements(value as string), FREE_PLAN, String(value));
  }
  a.equal(LAUNCH_PLAN.ownedSites, 5);
  a.equal(STUDIO_PLAN.ownedSites, 20);
  for (const plan of [LAUNCH_PLAN, STUDIO_PLAN, PRO_PLAN]) a.equal(plan.public, false, 'no paid plan is public before checkout');
});

test('effective plan is Free with nothing active', () => {
  a.deepEqual(effectivePlan({ now }), { plan: 'free', source: 'free' });
  a.deepEqual(effectivePlan({
    now,
    grants: [
      { plan: 'pro', revokedAt: daysAgo(1) },
      { plan: 'studio', expiresAt: daysAgo(1) },
      { plan: 'free' },
      { plan: 'enterprise' },
    ],
    subscriptions: [
      { plan: 'studio', status: 'canceled' },
      { plan: 'studio', status: 'paused' },
      { plan: 'unknown', status: 'active' },
    ],
  }), { plan: 'free', source: 'free' });
});

test('effective plan takes the highest active entitlement', () => {
  a.deepEqual(effectivePlan({
    now,
    grants: [{ plan: 'launch', expiresAt: '2027-01-01T00:00:00Z' }],
    subscriptions: [{ plan: 'studio', status: 'active' }],
  }), { plan: 'studio', source: 'subscription' });
  a.deepEqual(effectivePlan({
    now,
    grants: [{ plan: 'pro' }],
    subscriptions: [{ plan: 'studio', status: 'trialing' }],
  }), { plan: 'pro', source: 'grant' });
  a.deepEqual(effectivePlan({
    now,
    grants: [{ plan: 'launch' }],
    subscriptions: [{ plan: 'launch', status: 'active' }],
  }), { plan: 'launch', source: 'subscription' }, 'a paying subscription is reported over an equal grant');
});

test('past-due subscriptions keep their plan only within the grace window', () => {
  const pastDue = (days: number) => effectivePlan({
    now, subscriptions: [{ plan: 'launch', status: 'past_due', statusChangedAt: daysAgo(days) }],
  }).plan;
  a.equal(pastDue(0), 'launch');
  a.equal(pastDue(PAST_DUE_GRACE_DAYS - 0.01), 'launch');
  a.equal(pastDue(PAST_DUE_GRACE_DAYS), 'free');
  a.equal(effectivePlan({ now, subscriptions: [{ plan: 'launch', status: 'past_due' }] }).plan, 'free',
    'a past-due subscription without a known start date fails closed');
});

test('migration turns existing complimentary Pro accounts into explicit grants', async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean,
        file_size_limit bigint, allowed_mime_types text[]);`);
    const dir = join(import.meta.dirname, '../../supabase/migrations');
    const names = readdirSync(dir).filter(name => name.endsWith('.sql')).sort();
    const target = names.findIndex(name => name.includes('plan_grants_and_subscriptions'));
    a.ok(target > 0);
    for (const name of names.slice(0, target)) await db.exec(readFileSync(join(dir, name), 'utf8'));
    await db.query(`insert into users (id, email, plan) values ('comp', 'comp@example.test', 'pro'), ('free', 'free@example.test', 'free')`);
    for (const name of names.slice(target)) await db.exec(readFileSync(join(dir, name), 'utf8'));
    const users = await db.query(`select id, plan, plan_source, plan_changed_at is not null as changed from users order by id`);
    a.deepEqual(users.rows, [
      { id: 'comp', plan: 'pro', plan_source: 'grant', changed: true },
      { id: 'free', plan: 'free', plan_source: 'free', changed: false },
    ]);
    const grants = await db.query(`select user_id, plan, granted_by from plan_grants`);
    a.deepEqual(grants.rows, [{ user_id: 'comp', plan: 'pro', granted_by: 'migration' }]);
    await a.rejects(db.query(`update users set plan='enterprise' where id='free'`));
    await a.rejects(db.query(`update users set plan_source='browser' where id='free'`));
  } finally {
    await db.close();
  }
});
