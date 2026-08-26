-- Read-only link destinations mirrored from paired WordPress targets. The connector replaces
-- one complete, bounded snapshot at a time; Pagecraft never stores editable native post data.

create table public.wordpress_content_indexes (
  connection_id text primary key
    references public.wordpress_connections (id) on delete cascade,
  generation bigint not null check (generation > 0),
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  synced_at timestamptz not null
);

create index wordpress_content_indexes_synced_idx
  on public.wordpress_content_indexes (synced_at desc);

alter table public.wordpress_content_indexes enable row level security;
revoke all on table public.wordpress_content_indexes from public, anon, authenticated;
