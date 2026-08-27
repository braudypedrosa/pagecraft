-- Pagecraft Free media is charged after optimization and shared across a user's owned sites.
-- Browser roles still cannot access these tables or the private bucket directly.
alter table public.assets add column if not exists owner_id text references public.users (id) on delete restrict;
alter table public.assets add column if not exists storage_path text;
alter table public.assets add column if not exists stored_bytes bigint;
alter table public.assets add column if not exists original_bytes bigint;
alter table public.assets add column if not exists content_hash text;
alter table public.assets add column if not exists optimized boolean not null default false;

update public.assets asset set
  owner_id = coalesce(asset.owner_id, (
    select membership.user_id from public.site_users membership
    where membership.site_id = asset.site_id and membership.role = 'owner'
    order by membership.user_id limit 1
  )),
  stored_bytes = coalesce(asset.stored_bytes, octet_length(asset.bytes)),
  original_bytes = coalesce(asset.original_bytes, octet_length(asset.bytes))
where asset.owner_id is null or asset.stored_bytes is null or asset.original_bytes is null;

create index if not exists assets_owner_idx on public.assets (owner_id);
create unique index if not exists assets_storage_path_key on public.assets (storage_path)
  where storage_path is not null;
alter table public.assets add constraint assets_stored_bytes_check
  check (stored_bytes is null or stored_bytes >= 0) not valid;
alter table public.assets validate constraint assets_stored_bytes_check;
alter table public.assets add constraint assets_original_bytes_check
  check (original_bytes is null or original_bytes >= 0) not valid;
alter table public.assets validate constraint assets_original_bytes_check;
alter table public.assets add constraint assets_content_hash_check
  check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$') not valid;
alter table public.assets validate constraint assets_content_hash_check;
alter table public.assets alter column bytes drop not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pagecraft-assets', 'pagecraft-assets', false, 10485760,
  array['image/webp','image/svg+xml']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on table public.assets from anon, authenticated;
