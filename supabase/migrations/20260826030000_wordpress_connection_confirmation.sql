-- OAuth credentials are provisioned first, then activated only after WordPress confirms that
-- it durably stored the binding. This prevents a lost token response from creating an
-- unrecoverable active connection.

alter table public.wordpress_connections
  add column if not exists confirmation_expires_at timestamptz,
  add column if not exists confirmed_at timestamptz;

-- Connections created before this migration had no explicit confirmation phase. Preserve their
-- established behavior while requiring every new active row to carry confirmation evidence.
update public.wordpress_connections
set confirmed_at = coalesce(confirmed_at, updated_at, created_at)
where status = 'active' or (status = 'revoked'
  and authorization_code_used_at is not null and access_token_digest is not null);

alter table public.wordpress_connections
  drop constraint if exists wordpress_connections_status_check;
alter table public.wordpress_connections
  add constraint wordpress_connections_status_check
  check (status in ('pending', 'provisioned', 'active', 'revoked'));

alter table public.wordpress_connections
  drop constraint if exists wordpress_connections_confirmation_state_check;
alter table public.wordpress_connections
  add constraint wordpress_connections_confirmation_state_check check (
    (status = 'pending' and confirmation_expires_at is null and confirmed_at is null)
    or (status = 'provisioned' and confirmation_expires_at is not null
      and confirmed_at is null and access_token_digest is not null
      and access_token_expires_at is not null and refresh_token_digest is not null)
    or (status = 'active' and confirmed_at is not null)
    or status = 'revoked'
  );

create index if not exists wordpress_connections_confirmation_expiry_idx
  on public.wordpress_connections (confirmation_expires_at)
  where status = 'provisioned';
