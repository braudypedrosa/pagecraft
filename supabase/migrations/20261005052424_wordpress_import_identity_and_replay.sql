-- Nullable for existing connections and older production builds.
alter table public.wordpress_import_credentials add column if not exists site_url text;

-- Keep only digests of consumed refresh tokens, never bearer credentials.
create table if not exists public.wordpress_import_used_refresh_tokens (
  digest text primary key,
  credential_id text not null references public.wordpress_import_credentials (id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists wordpress_import_used_refresh_credential_idx
  on public.wordpress_import_used_refresh_tokens (credential_id);
create index if not exists wordpress_import_used_refresh_expiry_idx
  on public.wordpress_import_used_refresh_tokens (expires_at);
alter table public.wordpress_import_used_refresh_tokens enable row level security;
revoke all on table public.wordpress_import_used_refresh_tokens from anon, authenticated;
