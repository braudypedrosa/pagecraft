-- Large immutable release artifacts use bounded JSON gateway chunks while they cross the
-- Supabase Edge Function. The complete canonical bytea remains on site_releases after the
-- final transaction; these rows are only a private, resumable upload staging area.
create table public.gateway_blob_uploads (
  hash text primary key check (hash ~ '^[0-9a-f]{64}$'),
  bytes integer not null check (bytes > 0),
  chunk_bytes integer not null check (chunk_bytes between 1 and 1048576),
  chunk_count integer not null check (chunk_count > 0),
  created_at timestamptz not null default now(),
  constraint gateway_blob_upload_dimensions_check
    check (chunk_count = (((bytes::bigint + chunk_bytes - 1) / chunk_bytes)::integer))
);

create table public.gateway_blob_chunks (
  blob_hash text not null references public.gateway_blob_uploads (hash) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  bytes integer not null check (bytes between 1 and 1048576),
  chunk_hash text not null check (chunk_hash ~ '^[0-9a-f]{64}$'),
  content bytea not null,
  created_at timestamptz not null default now(),
  primary key (blob_hash, chunk_index),
  constraint gateway_blob_chunk_length_check check (octet_length(content) = bytes)
);

create index gateway_blob_uploads_created_idx on public.gateway_blob_uploads (created_at);

-- A content-addressed chunk may be retried but must never be changed in place. Completed or
-- abandoned uploads can still be removed by the private gateway after finalization/expiry.
create trigger gateway_blob_uploads_no_update
before update on public.gateway_blob_uploads
for each row execute function private.reject_immutable_release_row();
create trigger gateway_blob_chunks_no_update
before update on public.gateway_blob_chunks
for each row execute function private.reject_immutable_release_row();

alter table public.gateway_blob_uploads enable row level security;
alter table public.gateway_blob_chunks enable row level security;

revoke all on table public.gateway_blob_uploads from public, anon, authenticated;
revoke all on table public.gateway_blob_chunks from public, anon, authenticated;
