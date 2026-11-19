-- Account levels foundation (billing design, phase 1).
-- `users.plan` stays the single value every limit reads, but it becomes a cached result:
-- the highest of an account's active plan grants and billing subscriptions. Only the
-- database gateway writes it, in the same transaction as the rows it is derived from.
-- Additive: older app builds keep reading `users.plan` and ignore the new tables.

alter table public.users drop constraint if exists users_plan_check;
alter table public.users add constraint users_plan_check
  check (plan in ('free', 'launch', 'studio', 'pro'));

alter table public.users
  add column if not exists plan_source text not null default 'free',
  add column if not exists plan_changed_at timestamptz;
alter table public.users drop constraint if exists users_plan_source_check;
alter table public.users add constraint users_plan_source_check
  check (plan_source in ('free', 'subscription', 'grant'));

comment on column public.users.plan is
  'Cached effective entitlement, derived from plan_grants and billing_subscriptions by the gateway. Never derived from user metadata or request input.';
comment on column public.users.plan_source is
  'Why the account has its plan: free (default), subscription (paid) or grant (complimentary or support).';

-- Complimentary, partner and support entitlements, each with a reason and optional expiry.
create table if not exists public.plan_grants (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users (id) on delete cascade,
  plan text not null check (plan in ('launch', 'studio', 'pro')),
  reason text not null check (length(reason) between 1 and 200),
  granted_by text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by text
);
create index if not exists plan_grants_user_idx on public.plan_grants (user_id);

-- One Pagecraft account per billing customer, per Paddle environment.
create table if not exists public.billing_customers (
  user_id text not null references public.users (id) on delete cascade,
  environment text not null check (environment in ('sandbox', 'live')),
  paddle_customer_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, environment),
  unique (environment, paddle_customer_id)
);

-- Mirror of Paddle subscription state. `last_event_at` rejects out-of-order webhooks.
create table if not exists public.billing_subscriptions (
  paddle_subscription_id text primary key,
  environment text not null check (environment in ('sandbox', 'live')),
  user_id text not null references public.users (id) on delete cascade,
  price_id text not null,
  plan text not null check (plan in ('launch', 'studio', 'pro')),
  status text not null check (status in ('active', 'trialing', 'past_due', 'paused', 'canceled')),
  status_changed_at timestamptz not null default now(),
  current_period_end timestamptz,
  scheduled_change text check (scheduled_change in ('cancel', 'pause', 'resume')),
  last_event_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists billing_subscriptions_user_idx on public.billing_subscriptions (user_id);

-- Idempotency and audit log for provider webhooks. Holds no payload or personal data.
create table if not exists public.billing_events (
  event_id text primary key,
  environment text not null check (environment in ('sandbox', 'live')),
  event_type text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text
);

alter table public.plan_grants enable row level security;
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
revoke all on table public.plan_grants from anon, authenticated;
revoke all on table public.billing_customers from anon, authenticated;
revoke all on table public.billing_subscriptions from anon, authenticated;
revoke all on table public.billing_events from anon, authenticated;

-- Existing complimentary Pro assignments become explicit grants, so a later billing change
-- cannot silently remove them.
insert into public.plan_grants (user_id, plan, reason, granted_by)
select u.id, 'pro', 'Complimentary Pro assigned before plan grants existed', 'migration'
from public.users u
where u.plan = 'pro'
  and not exists (select 1 from public.plan_grants g where g.user_id = u.id and g.plan = 'pro');
update public.users
set plan_source = 'grant', plan_changed_at = coalesce(plan_changed_at, now())
where plan = 'pro' and plan_source = 'free';
