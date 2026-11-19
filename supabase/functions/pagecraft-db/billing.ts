import type postgres from "npm:postgres@3.4.7";
import { isPaidPlan } from "./plan-entitlements.ts";
import { recompute } from "./plan-grants.ts";

type Sql = postgres.Sql;
type Row = Record<string, unknown>;

/* Paddle subscription state, applied by the Node webhook after it has verified the signature and
   mapped the price to a plan from trusted server configuration. Everything for one event happens
   in one transaction: the event log row, the customer and subscription mirror, the cached plan
   and the founder CRM stage. A refusal is recorded on the event instead of being thrown, so the
   provider is not told to retry an event that can never apply. */

const OPS = new Set(["billing.applySubscription"]);
export const isBillingOp = (op: string) => OPS.has(op);

const ENVIRONMENTS = new Set(["sandbox", "live"]);
const STATUSES = new Set(["active", "trialing", "past_due", "paused", "canceled"]);
const CHANGES = new Set(["cancel", "pause", "resume"]);
const PADDLE_ID = /^[a-z]{3}_[a-z0-9]{10,40}$/;

const text = (value: unknown) => String(value ?? "");
const invalid = (message: string): never => {
  throw Object.assign(new Error(message), { status: 400, code: "INVALID_BILLING_EVENT" });
};
const id = (value: unknown, field: string) => {
  if (typeof value !== "string" || !PADDLE_ID.test(value)) invalid(`${field} is invalid`);
  return value as string;
};
const time = (value: unknown, field: string, optional = false) => {
  if (optional && (value === null || value === undefined)) return null;
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  if (!Number.isFinite(parsed)) invalid(`${field} is invalid`);
  return new Date(parsed).toISOString();
};

interface SubscriptionEvent {
  environment: "sandbox" | "live";
  eventId: string;
  eventType: string;
  occurredAt: string;
  subscriptionId: string;
  customerId: string;
  /** From the checkout's server-set custom data. Only trusted for a subscription seen first. */
  userId: string | null;
  priceId: string;
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  scheduledChange: string | null;
}

const parse = (args: Record<string, unknown>): SubscriptionEvent => {
  const environment = text(args.environment);
  if (!ENVIRONMENTS.has(environment)) invalid("environment is invalid");
  const eventType = text(args.eventType);
  if (!/^subscription\.[a-z_]{3,30}$/.test(eventType)) invalid("eventType is invalid");
  if (!isPaidPlan(args.plan)) invalid("plan is invalid");
  if (!STATUSES.has(text(args.status))) invalid("status is invalid");
  const scheduledChange = args.scheduledChange === null || args.scheduledChange === undefined
    ? null : text(args.scheduledChange);
  if (scheduledChange !== null && !CHANGES.has(scheduledChange)) invalid("scheduledChange is invalid");
  const userId = args.userId === null || args.userId === undefined ? null : text(args.userId);
  if (userId !== null && (!userId || userId.length > 200)) invalid("userId is invalid");
  return {
    environment: environment as "sandbox" | "live",
    eventId: id(args.eventId, "eventId"),
    eventType,
    occurredAt: time(args.occurredAt, "occurredAt")!,
    subscriptionId: id(args.subscriptionId, "subscriptionId"),
    customerId: id(args.customerId, "customerId"),
    userId,
    priceId: id(args.priceId, "priceId"),
    plan: text(args.plan),
    status: text(args.status),
    currentPeriodEnd: time(args.currentPeriodEnd, "currentPeriodEnd", true),
    scheduledChange,
  };
};

/* A paying account becomes a Customer in the founder CRM: its linked contact moves forward
   (an archived contact is left alone), an unlinked contact with the same email is linked, and
   otherwise a contact is created. */
// deno-lint-ignore no-explicit-any
async function markCustomer(transaction: any, userId: string) {
  await transaction`lock table crm_contacts in share row exclusive mode`;
  const linked = await transaction`
    update crm_contacts set stage = 'customer', updated_at = now(), revision = revision + 1
    where account_id = ${userId} and stage in ('lead', 'contacted', 'qualified')
    returning id
  `;
  if (linked.length) return;
  if ((await transaction`select 1 from crm_contacts where account_id = ${userId}`).length) return;
  const user = (await transaction`select email, name from users where id = ${userId}`)[0] as Row;
  const email = text(user.email).trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return;
  const adopted = await transaction`
    update crm_contacts set account_id = ${userId}, stage = case when stage = 'archived' then stage else 'customer' end,
      updated_at = now(), revision = revision + 1
    where email = ${email} and account_id is null
    returning id
  `;
  if (adopted.length) return;
  await transaction`
    insert into crm_contacts (id, account_id, name, email, stage, source)
    values (${crypto.randomUUID()}::uuid, ${userId}, ${text(user.name).trim().slice(0, 120)}, ${email}, 'customer', 'unknown')
  `;
}

export async function dispatchBilling(sql: Sql, op: string, args: Record<string, unknown>): Promise<unknown> {
  if (op !== "billing.applySubscription") invalid("unknown billing operation");
  const event = parse(args);
  return await sql.begin(async (transaction) => {
    const logged = await transaction`
      insert into billing_events (event_id, environment, event_type, occurred_at)
      values (${event.eventId}, ${event.environment}, ${event.eventType}, ${event.occurredAt})
      on conflict (event_id) do nothing
      returning event_id
    `;
    if (!logged.length) return { outcome: "duplicate" };
    const settle = async (outcome: string, error: string | null, extra: Record<string, unknown> = {}) => {
      await transaction`
        update billing_events set processed_at = now(), error = ${error} where event_id = ${event.eventId}
      `;
      return { outcome, ...(error ? { reason: error } : {}), ...extra };
    };

    const existing = (await transaction`
      select user_id, environment, last_event_at from billing_subscriptions
      where paddle_subscription_id = ${event.subscriptionId}
    `)[0] as Row | undefined;
    if (existing && text(existing.environment) !== event.environment) {
      return await settle("refused", "subscription belongs to the other environment");
    }
    const customer = (await transaction`
      select user_id from billing_customers
      where environment = ${event.environment} and paddle_customer_id = ${event.customerId}
    `)[0] as Row | undefined;
    // The first record of a subscription or customer decides the account; later events can't move it.
    const userId = existing ? text(existing.user_id) : customer ? text(customer.user_id) : event.userId;
    if (!userId) return await settle("refused", "no Pagecraft account on the subscription");
    if ((existing || customer) && event.userId && event.userId !== userId) {
      return await settle("refused", "subscription account does not match its first account");
    }
    if (customer && text(customer.user_id) !== userId) {
      return await settle("refused", "customer belongs to a different account");
    }
    const user = await transaction`select id from users where id = ${userId} for update`;
    if (!user.length) return await settle("refused", "account does not exist");
    const lastEvent = existing?.last_event_at instanceof Date
      ? existing.last_event_at.getTime() : Date.parse(text(existing?.last_event_at));
    if (existing && lastEvent >= Date.parse(event.occurredAt)) {
      return await settle("stale", null);
    }

    if (!customer) {
      const taken = await transaction`
        select 1 from billing_customers where user_id = ${userId} and environment = ${event.environment}
      `;
      if (taken.length) {
        await transaction`
          update billing_customers set paddle_customer_id = ${event.customerId}, updated_at = now()
          where user_id = ${userId} and environment = ${event.environment}
        `;
      } else {
        await transaction`
          insert into billing_customers (user_id, environment, paddle_customer_id)
          values (${userId}, ${event.environment}, ${event.customerId})
        `;
      }
    }
    await transaction`
      insert into billing_subscriptions (paddle_subscription_id, environment, user_id, price_id, plan, status,
        status_changed_at, current_period_end, scheduled_change, last_event_at)
      values (${event.subscriptionId}, ${event.environment}, ${userId}, ${event.priceId}, ${event.plan},
        ${event.status}, ${event.occurredAt}, ${event.currentPeriodEnd}, ${event.scheduledChange}, ${event.occurredAt})
      on conflict (paddle_subscription_id) do update set
        price_id = excluded.price_id, plan = excluded.plan,
        status_changed_at = case when billing_subscriptions.status = excluded.status
          then billing_subscriptions.status_changed_at else excluded.status_changed_at end,
        status = excluded.status, current_period_end = excluded.current_period_end,
        scheduled_change = excluded.scheduled_change, last_event_at = excluded.last_event_at, updated_at = now()
    `;
    const plan = await recompute(transaction, userId);
    if (plan.source === "subscription" && plan.changed) await markCustomer(transaction, userId);
    return await settle("applied", null, { userId, plan });
  });
}
