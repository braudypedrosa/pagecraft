create table if not exists public.wordpress_import_credentials (
  id text primary key,
  owner_id text not null references public.users (id) on delete cascade,
  installation_id text not null,
  access_token_digest text not null unique,
  access_expires_at timestamptz not null,
  refresh_token_digest text not null unique,
  status text not null check (status in ('active', 'revoked')) default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (owner_id, installation_id)
);

create index if not exists wordpress_import_credentials_owner_idx
  on public.wordpress_import_credentials (owner_id, status);

alter table public.wordpress_import_credentials enable row level security;
revoke all on table public.wordpress_import_credentials from anon, authenticated;

alter table public.connected_one_time_grants
  drop constraint if exists connected_one_time_grants_kind_check;
alter table public.connected_one_time_grants
  add constraint connected_one_time_grants_kind_check
  check (kind in ('oauth-consent', 'editor-code', 'package-download',
    'manual-import-consent', 'manual-import-code'));
