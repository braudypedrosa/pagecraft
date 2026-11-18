import type postgres from "npm:postgres@3.4.7";
import { effectivePlan, isPaidPlan, type EffectivePlan } from "./plan-entitlements.ts";

type Sql = postgres.Sql;
type Row = Record<string, unknown>;

const OPS = new Set([
  "plan.status",
  "plan.recompute",
  "plan.grant",
  "plan.revokeGrant",
  "plan.recomputeStale",
]);

export const isPlanOp = (op: string) => OPS.has(op);

const text = (value: unknown) => String(value ?? "");
const refuse = (message: string, code: string, status = 400): never => {
  throw Object.assign(new Error(message), { status, code });
};
const iso = (value: unknown) =>
  value instanceof Date ? value.toISOString() : value ? new Date(text(value)).toISOString() : null;

const requiredText = (value: unknown, field: string, max: number) => {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean || clean.length > max) refuse(`${field} is invalid`, "INVALID_PLAN_REQUEST");
  return clean;
};

const grantWire = (row: Row) => ({
  id: text(row.id),
  userId: text(row.user_id),
  plan: text(row.plan),
  reason: text(row.reason),
  grantedBy: text(row.granted_by),
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
  revokedAt: iso(row.revoked_at),
  revokedBy: row.revoked_by === null || row.revoked_by === undefined ? null : text(row.revoked_by),
});

const subscriptionWire = (row: Row) => ({
  id: text(row.paddle_subscription_id),
  environment: text(row.environment),
  priceId: text(row.price_id),
  plan: text(row.plan),
  status: text(row.status),
  statusChangedAt: iso(row.status_changed_at),
  currentPeriodEnd: iso(row.current_period_end),
  scheduledChange: row.scheduled_change ? text(row.scheduled_change) : null,
});

/* Recomputes `users.plan` from grants and subscriptions while holding the user row lock, so
   two writers (a webhook and a grant) cannot interleave and leave a stale cached plan. */
// deno-lint-ignore no-explicit-any
export async function recompute(transaction: any, userId: string, now = new Date()) {
  const user = (await transaction`
    select id, plan, plan_source from users where id = ${userId} for update
  `)[0] as Row | undefined;
  if (!user) refuse("account does not exist", "USER_NOT_FOUND", 404);
  const grants = await transaction`
    select plan, expires_at, revoked_at from plan_grants
    where user_id = ${userId} and revoked_at is null
  ` as Row[];
  const subscriptions = await transaction`
    select plan, status, status_changed_at from billing_subscriptions where user_id = ${userId}
  ` as Row[];
  const next: EffectivePlan = effectivePlan({
    now,
    grants: grants.map((row) => ({
      plan: text(row.plan),
      expiresAt: iso(row.expires_at),
      revokedAt: iso(row.revoked_at),
    })),
    subscriptions: subscriptions.map((row) => ({
      plan: text(row.plan),
      status: text(row.status),
      statusChangedAt: iso(row.status_changed_at),
    })),
  });
  const changed = text(user!.plan) !== next.plan || text(user!.plan_source) !== next.source;
  if (changed) {
    await transaction`
      update users set plan = ${next.plan}, plan_source = ${next.source}, plan_changed_at = now()
      where id = ${userId}
    `;
  }
  return { ...next, changed };
}

export async function dispatchPlan(
  sql: Sql,
  op: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  if (op === "plan.status") {
    const userId = requiredText(args.userId, "userId", 200);
    const user = (await sql<Row[]>`
      select plan, plan_source, plan_changed_at from users where id = ${userId}
    `)[0];
    if (!user) refuse("account does not exist", "USER_NOT_FOUND", 404);
    const grants = await sql<Row[]>`
      select * from plan_grants where user_id = ${userId} order by created_at desc
    `;
    const subscriptions = await sql<Row[]>`
      select * from billing_subscriptions where user_id = ${userId} order by updated_at desc
    `;
    return {
      plan: text(user!.plan),
      source: text(user!.plan_source),
      changedAt: iso(user!.plan_changed_at),
      grants: grants.map(grantWire),
      subscriptions: subscriptions.map(subscriptionWire),
    };
  }

  if (op === "plan.recompute") {
    const userId = requiredText(args.userId, "userId", 200);
    return await sql.begin((transaction) => recompute(transaction, userId));
  }

  if (op === "plan.grant") {
    const userId = requiredText(args.userId, "userId", 200);
    if (!isPaidPlan(args.plan)) refuse("plan is invalid", "INVALID_PLAN_REQUEST");
    const reason = requiredText(args.reason, "reason", 200);
    const grantedBy = requiredText(args.grantedBy, "grantedBy", 200);
    let expiresAt: string | null = null;
    if (args.expiresAt !== undefined && args.expiresAt !== null) {
      const parsed = Date.parse(text(args.expiresAt));
      if (!Number.isFinite(parsed) || parsed <= Date.now()) {
        refuse("expiresAt must be a future time", "INVALID_PLAN_REQUEST");
      }
      expiresAt = new Date(parsed).toISOString();
    }
    return await sql.begin(async (transaction) => {
      const exists = await transaction`select id from users where id = ${userId} for update`;
      if (!exists.length) refuse("account does not exist", "USER_NOT_FOUND", 404);
      const row = (await transaction`
        insert into plan_grants (user_id, plan, reason, granted_by, expires_at)
        values (${userId}, ${text(args.plan)}, ${reason}, ${grantedBy}, ${expiresAt})
        returning *
      `)[0] as Row;
      return { grant: grantWire(row), plan: await recompute(transaction, userId) };
    });
  }

  if (op === "plan.revokeGrant") {
    const grantId = requiredText(args.grantId, "grantId", 64);
    const revokedBy = requiredText(args.revokedBy, "revokedBy", 200);
    return await sql.begin(async (transaction) => {
      const found = (await transaction`
        select user_id from plan_grants where id::text = ${grantId}
      `)[0] as Row | undefined;
      if (!found) refuse("plan grant does not exist", "GRANT_NOT_FOUND", 404);
      const userId = text(found!.user_id);
      // Lock the account first, matching recompute's order, then retire the grant.
      await transaction`select id from users where id = ${userId} for update`;
      const revoked = await transaction`
        update plan_grants set revoked_at = now(), revoked_by = ${revokedBy}
        where id::text = ${grantId} and revoked_at is null
        returning id
      `;
      return { revoked: revoked.length > 0, plan: await recompute(transaction, userId) };
    });
  }

  if (op === "plan.recomputeStale") {
    /* Grants expire and past-due grace runs out without any event arriving, so a periodic job
       re-derives every paid account. Each account is its own short transaction. */
    const rows = await sql<Row[]>`select id from users where plan <> 'free' order by id limit 1000`;
    let changed = 0;
    for (const row of rows) {
      const result = await sql.begin((transaction) => recompute(transaction, text(row.id)));
      if (result.changed) changed++;
    }
    return { checked: rows.length, changed };
  }

  return refuse("unknown gateway operation", "UNKNOWN_OPERATION");
}
