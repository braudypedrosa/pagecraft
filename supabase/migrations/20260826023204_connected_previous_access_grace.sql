-- One bounded previous access token closes the refresh-response reordering window without
-- creating an unbounded bearer-token history. Connection status remains the primary revoke
-- boundary; revoked rows clear this grace slot atomically.

alter table public.wordpress_connections
  add column previous_access_token_digest text,
  add column previous_access_token_expires_at timestamptz,
  add constraint wordpress_connections_previous_access_pair_check check (
    (previous_access_token_digest is null and previous_access_token_expires_at is null)
    or (previous_access_token_digest is not null and previous_access_token_expires_at is not null)
  );

create index wordpress_connections_previous_access_idx
  on public.wordpress_connections (previous_access_token_digest)
  where status = 'active' and previous_access_token_digest is not null;
