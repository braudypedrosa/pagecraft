create table if not exists public.api_credentials (
  id text primary key,
  owner_id text not null references public.users (id) on delete cascade,
  name text not null,
  token_digest text not null unique,
  token_prefix text not null,
  status text not null check (status in ('active', 'revoked')) default 'active',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_credentials_owner_idx
  on public.api_credentials (owner_id, status, created_at desc);

alter table public.api_credentials enable row level security;
revoke all on table public.api_credentials from anon, authenticated;
