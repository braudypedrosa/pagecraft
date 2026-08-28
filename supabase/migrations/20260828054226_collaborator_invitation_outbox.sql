-- Profile provisioning, membership assignment, and invitation enqueueing are one
-- database transaction. Email remains an external side effect, so it is represented as durable,
-- retryable work rather than being treated as part of the transaction.
create table public.collaborator_invitation_outbox (
  id text primary key,
  site_id text not null references public.sites (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  email text not null,
  redirect_to text not null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);

create unique index collaborator_invitation_outbox_pending_key
  on public.collaborator_invitation_outbox (site_id, user_id)
  where delivered_at is null;
create index collaborator_invitation_outbox_ready_idx
  on public.collaborator_invitation_outbox (next_attempt_at, created_at)
  where delivered_at is null;

alter table public.collaborator_invitation_outbox enable row level security;
revoke all on table public.collaborator_invitation_outbox from anon, authenticated;
