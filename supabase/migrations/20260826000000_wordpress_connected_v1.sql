-- Connected WordPress v1. The database is private behind the service gateway; browser roles
-- receive no table/function privileges and RLS remains enabled as a second boundary.

-- Canonical documents now carry their schema explicitly. Missing legacy values are adopted
-- using the same boundary rule as the server: legacy `v`, otherwise the original v1 shape.
do $$
begin
  if exists (
    select 1 from public.sites
    where doc ? 'schemaVersion' and jsonb_typeof(doc -> 'schemaVersion') <> 'number'
  ) then
    raise exception 'sites contains a non-numeric schemaVersion; refusing unsafe adoption';
  end if;
  if exists (
    select 1 from public.site_revisions
    where doc ? 'schemaVersion' and jsonb_typeof(doc -> 'schemaVersion') <> 'number'
  ) then
    raise exception 'site_revisions contains a non-numeric schemaVersion; refusing unsafe adoption';
  end if;
end $$;

update public.sites
set doc = jsonb_set(
  doc,
  '{schemaVersion}',
  to_jsonb(case when jsonb_typeof(doc -> 'v') = 'number' then (doc ->> 'v')::integer else 1 end),
  true
)
where not (doc ? 'schemaVersion');

update public.site_revisions
set doc = jsonb_set(
  doc,
  '{schemaVersion}',
  to_jsonb(case when jsonb_typeof(doc -> 'v') = 'number' then (doc ->> 'v')::integer else 1 end),
  true
)
where not (doc ? 'schemaVersion');

alter table public.sites
  add constraint sites_doc_schema_version_check
  check ((doc ->> 'schemaVersion') ~ '^[1-9][0-9]*$') not valid;
alter table public.sites validate constraint sites_doc_schema_version_check;
alter table public.site_revisions
  add constraint site_revisions_doc_schema_version_check
  check ((doc ->> 'schemaVersion') ~ '^[1-9][0-9]*$') not valid;
alter table public.site_revisions validate constraint site_revisions_doc_schema_version_check;

alter table public.sites add column published_version integer;
update public.sites set published_version = version where published_version is null;
alter table public.sites alter column published_version set default 1;
alter table public.sites alter column published_version set not null;
alter table public.sites add column published_release_id text;
alter table public.sites add column published_release_sequence integer not null default 0;
alter table public.site_revisions add column context jsonb;

create table public.wordpress_connections (
  id text primary key,
  site_id text not null references public.sites (id) on delete restrict,
  created_by text not null references public.users (id) on delete restrict,
  installation_id text not null,
  environment text not null check (environment in ('staging', 'production')),
  profile text not null check (profile in ('existing-theme', 'pagecraft-theme')),
  target_origin text not null check (target_origin ~ '^https://[^/]+$' or target_origin ~ '^http://[^/]*localhost[^/]*$'),
  target_path text not null check (target_path ~ '^/'),
  redirect_uri text not null,
  webhook_url text not null,
  scopes jsonb not null check (jsonb_typeof(scopes) = 'array'),
  status text not null check (status in ('pending', 'active', 'revoked')),
  code_challenge text not null,
  authorization_code_digest text not null unique,
  authorization_code_expires_at timestamptz not null,
  authorization_code_used_at timestamptz,
  access_token_digest text unique,
  access_token_expires_at timestamptz,
  refresh_token_digest text unique,
  desired_release_id text,
  pending_release_id text,
  next_sequence integer not null default 1 check (next_sequence > 0),
  last_acknowledged_sequence integer not null default 0 check (last_acknowledged_sequence >= 0),
  active_release_id text,
  active_hash text check (active_hash is null or active_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz,
  revocation_idempotency_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index wordpress_connections_one_environment_idx
  on public.wordpress_connections (site_id, environment) where status <> 'revoked';
create unique index wordpress_connections_installation_idx
  on public.wordpress_connections (installation_id) where status <> 'revoked';
create unique index wordpress_connections_target_idx
  on public.wordpress_connections (target_origin, target_path) where status <> 'revoked';
create index wordpress_connections_site_status_idx
  on public.wordpress_connections (site_id, status, environment);
create index wordpress_connections_created_by_idx on public.wordpress_connections (created_by);
create index wordpress_connections_desired_idx
  on public.wordpress_connections (desired_release_id) where desired_release_id is not null;
create index wordpress_connections_pending_idx
  on public.wordpress_connections (pending_release_id) where pending_release_id is not null;

-- Sequence allocation is a durable, project-scoped worker lease. Compilation preflight happens
-- first; an unbuilt lease older than five minutes can be reclaimed without changing its id or
-- sequence, so a dead worker cannot leave an immortal gap in the signed parent chain.
create table public.site_release_counters (
  site_id text primary key references public.sites (id) on delete cascade,
  next_sequence integer not null default 1 check (next_sequence > 0)
);
create table public.site_release_reservations (
  site_id text not null references public.sites (id) on delete cascade,
  idempotency_key text not null,
  release_id text not null unique,
  sequence integer not null check (sequence > 0),
  parent_release_id text,
  created_by text not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (site_id, idempotency_key),
  unique (site_id, sequence)
);
create unique index site_release_reservations_one_unbuilt_idx
  on public.site_release_reservations (site_id) where completed_at is null;

create table public.site_releases (
  id text primary key,
  site_id text not null references public.sites (id) on delete restrict,
  sequence integer not null check (sequence > 0),
  source_version integer not null check (source_version > 0),
  schema_version integer not null check (schema_version > 0),
  parent_release_id text references public.site_release_reservations (release_id) on delete restrict,
  artifact_hash text not null check (artifact_hash ~ '^[0-9a-f]{64}$'),
  artifact_bytes integer not null check (artifact_bytes >= 0),
  artifact bytea not null,
  hosted_files jsonb not null,
  manifest text not null,
  manifest_hash text not null check (manifest_hash ~ '^[0-9a-f]{64}$'),
  signature text not null,
  key_id text not null,
  files jsonb not null,
  pages jsonb not null,
  cms jsonb not null,
  assets jsonb not null,
  scripts jsonb not null,
  audit jsonb not null,
  idempotency_key text not null,
  created_by text not null references public.users (id) on delete restrict,
  created_at timestamptz not null,
  unique (site_id, sequence),
  unique (site_id, idempotency_key)
);
create index site_releases_site_time_idx on public.site_releases (site_id, created_at desc);
create index site_releases_source_idx on public.site_releases (site_id, source_version);
create index site_releases_parent_idx on public.site_releases (parent_release_id) where parent_release_id is not null;
create index site_releases_creator_idx on public.site_releases (created_by);

create table public.release_assets (
  release_id text not null references public.site_releases (id) on delete restrict,
  asset_id text not null,
  path text not null,
  mime text not null,
  bytes integer not null check (bytes >= 0),
  hash text not null check (hash ~ '^[0-9a-f]{64}$'),
  width integer not null check (width >= 0),
  height integer not null check (height >= 0),
  primary key (release_id, asset_id),
  unique (release_id, path)
);
create index release_assets_hash_idx on public.release_assets (hash);

create table public.release_targets (
  release_id text not null references public.site_releases (id) on delete restrict,
  connection_id text not null references public.wordpress_connections (id) on delete restrict,
  sequence integer not null check (sequence > 0),
  envelope text not null,
  signature text not null,
  key_id text not null,
  created_at timestamptz not null,
  primary key (release_id, connection_id),
  unique (connection_id, sequence)
);
create index release_targets_connection_time_idx on public.release_targets (connection_id, created_at desc);

create table public.deployments (
  id text primary key,
  connection_id text not null,
  release_id text not null,
  sequence integer not null check (sequence > 0),
  status text not null check (status in (
    'queued', 'downloading', 'staged', 'needs_approval',
    'activating', 'verifying', 'live', 'failed', 'rolled_back'
  )),
  active_hash text check (active_hash is null or active_hash ~ '^[0-9a-f]{64}$'),
  error text,
  detail jsonb,
  idempotency_key text not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (release_id, connection_id)
    references public.release_targets (release_id, connection_id) on delete restrict,
  unique (connection_id, idempotency_key),
  unique (connection_id, release_id, sequence, status)
);
create index deployments_release_time_idx on public.deployments (release_id, created_at desc);
create index deployments_connection_time_idx on public.deployments (connection_id, created_at desc);
create index deployments_status_time_idx on public.deployments (status, created_at desc);

-- Compatibility name used by the product plan and reporting. Writes go through `deployments`.
-- SECURITY INVOKER prevents the view owner from bypassing the underlying table's RLS if a
-- future gateway role is ever granted access to this reporting surface.
create view public.wordpress_deployments
with (security_invoker = true)
as select * from public.deployments;

alter table public.wordpress_connections
  add constraint wordpress_connections_desired_release_fk
  foreign key (desired_release_id) references public.site_releases (id) on delete restrict;
alter table public.wordpress_connections
  add constraint wordpress_connections_pending_release_fk
  foreign key (pending_release_id) references public.site_releases (id) on delete restrict;
alter table public.wordpress_connections
  add constraint wordpress_connections_active_release_fk
  foreign key (active_release_id) references public.site_releases (id) on delete restrict;
alter table public.sites
  add constraint sites_published_release_fk
  foreign key (published_release_id) references public.site_releases (id) on delete restrict;

create table public.wordpress_webhook_outbox (
  event_id text primary key,
  connection_id text not null references public.wordpress_connections (id) on delete restrict,
  release_id text not null references public.site_releases (id) on delete restrict,
  target_sequence integer not null check (target_sequence > 0),
  webhook_url text not null,
  payload jsonb not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  signature text not null,
  key_id text not null,
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (connection_id, release_id)
);
create index wordpress_webhook_outbox_ready_idx
  on public.wordpress_webhook_outbox (next_attempt_at, created_at)
  where delivered_at is null;

-- Short-lived browser handoffs must survive Passenger worker changes. Only digests are stored;
-- one-time grants are atomically consumed and editor credentials remain site/owner scoped.
create table public.connected_one_time_grants (
  digest text primary key check (digest ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('oauth-consent', 'editor-code', 'package-download')),
  site_id text references public.sites (id) on delete cascade,
  connection_id text references public.wordpress_connections (id) on delete cascade,
  payload jsonb not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index connected_one_time_grants_expiry_idx
  on public.connected_one_time_grants (expires_at) where used_at is null;

create table public.connected_editor_sessions (
  digest text primary key check (digest ~ '^[0-9a-f]{64}$'),
  connection_id text not null references public.wordpress_connections (id) on delete cascade,
  site_id text not null references public.sites (id) on delete cascade,
  owner_id text not null references public.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index connected_editor_sessions_expiry_idx on public.connected_editor_sessions (expires_at);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
-- Keep later Connected-mode additions gateway-only by default. Explicit grants must be an
-- intentional migration decision rather than an accidental consequence of project defaults.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

create or replace function private.reject_immutable_release_row()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '55000';
end $$;

create trigger site_releases_immutable
before update or delete on public.site_releases
for each row execute function private.reject_immutable_release_row();
create trigger release_assets_immutable
before update or delete on public.release_assets
for each row execute function private.reject_immutable_release_row();
create trigger release_targets_immutable
before update or delete on public.release_targets
for each row execute function private.reject_immutable_release_row();
create trigger deployments_immutable
before update or delete on public.deployments
for each row execute function private.reject_immutable_release_row();

create or replace function private.guard_webhook_identity()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin
  if row(old.event_id, old.connection_id, old.release_id, old.target_sequence, old.webhook_url,
         old.payload, old.body_hash, old.signature, old.key_id, old.created_at)
     is distinct from
     row(new.event_id, new.connection_id, new.release_id, new.target_sequence, new.webhook_url,
         new.payload, new.body_hash, new.signature, new.key_id, new.created_at) then
    raise exception 'webhook event identity is immutable' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger wordpress_webhook_identity_immutable
before update on public.wordpress_webhook_outbox
for each row execute function private.guard_webhook_identity();

create or replace function private.claim_wordpress_webhooks(worker text, batch_size integer default 10)
returns setof public.wordpress_webhook_outbox
language sql security definer
set search_path = public, pg_catalog
as $$
  with claim as (
    select event_id from public.wordpress_webhook_outbox
    where delivered_at is null
      and next_attempt_at <= now()
      and (locked_at is null or locked_at < now() - interval '5 minutes')
    order by next_attempt_at, created_at
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  )
  update public.wordpress_webhook_outbox o
  set locked_at = now(), locked_by = worker, attempts = attempts + 1
  from claim where o.event_id = claim.event_id
  returning o.*
$$;

revoke all on function private.reject_immutable_release_row() from public, anon, authenticated;
revoke all on function private.guard_webhook_identity() from public, anon, authenticated;
revoke all on function private.claim_wordpress_webhooks(text, integer) from public, anon, authenticated;

alter table public.wordpress_connections enable row level security;
alter table public.site_release_counters enable row level security;
alter table public.site_release_reservations enable row level security;
alter table public.site_releases enable row level security;
alter table public.release_assets enable row level security;
alter table public.release_targets enable row level security;
alter table public.deployments enable row level security;
alter table public.wordpress_webhook_outbox enable row level security;
alter table public.connected_one_time_grants enable row level security;
alter table public.connected_editor_sessions enable row level security;

revoke all on table public.wordpress_connections from anon, authenticated;
revoke all on table public.site_release_counters from anon, authenticated;
revoke all on table public.site_release_reservations from anon, authenticated;
revoke all on table public.site_releases from anon, authenticated;
revoke all on table public.release_assets from anon, authenticated;
revoke all on table public.release_targets from anon, authenticated;
revoke all on table public.deployments from anon, authenticated;
revoke all on table public.wordpress_deployments from anon, authenticated;
revoke all on table public.wordpress_webhook_outbox from anon, authenticated;
revoke all on table public.connected_one_time_grants from anon, authenticated;
revoke all on table public.connected_editor_sessions from anon, authenticated;
