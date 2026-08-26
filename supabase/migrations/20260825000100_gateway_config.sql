create table public.gateway_config (
  id text primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  updated_at timestamptz not null default now()
);

alter table public.gateway_config enable row level security;
revoke all on table public.gateway_config from anon, authenticated;

-- Insert the primary row after deployment using the SHA-256 digest of a newly generated
-- gateway key. The raw key belongs only in the Node application's environment.
