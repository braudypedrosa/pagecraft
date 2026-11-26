-- Storage objects are outside PostgreSQL transactions. Keep deletion work durable after the
-- owning rows cascade so a temporary Storage failure cannot orphan account-owned library files.
create table if not exists public.storage_deletion_outbox (
  path text primary key check (char_length(path) between 1 and 1000),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists storage_deletion_outbox_due_idx
  on public.storage_deletion_outbox (next_attempt_at, created_at);

alter table public.storage_deletion_outbox enable row level security;
revoke all on table public.storage_deletion_outbox from anon, authenticated;
