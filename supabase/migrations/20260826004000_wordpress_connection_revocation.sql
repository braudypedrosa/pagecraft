-- Scoped, idempotent disconnect. The access digest is deliberately retained only through its
-- existing expiry so a connector can confirm an exact retry after a lost success response.
alter table public.wordpress_connections
  add column if not exists revoked_at timestamptz,
  add column if not exists revocation_idempotency_key text;

update public.wordpress_connections
set revoked_at = coalesce(revoked_at, updated_at),
    revocation_idempotency_key = coalesce(revocation_idempotency_key, 'legacy-revocation:' || id)
where status = 'revoked';
update public.wordpress_connections
set revoked_at = null, revocation_idempotency_key = null
where status <> 'revoked';

alter table public.wordpress_connections
  drop constraint if exists wordpress_connections_revocation_pair_check;
alter table public.wordpress_connections
  add constraint wordpress_connections_revocation_pair_check check (
    (status <> 'revoked' and revoked_at is null and revocation_idempotency_key is null)
    or (status = 'revoked' and revoked_at is not null and revocation_idempotency_key is not null)
  );
