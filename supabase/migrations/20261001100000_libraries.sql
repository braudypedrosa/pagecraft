-- Phase 5 libraries: account-owned collections of reusable items, published as immutable
-- numbered versions with their own copies of the images they use.
-- Additive only. Older app builds never read or write these tables; see
-- docs/phase5-libraries-design.md.

create table if not exists public.libraries (
  id uuid primary key,
  owner_id text not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists libraries_owner_idx on public.libraries (owner_id);

-- Versions are insert-only: a published version is never edited, only superseded.
create table if not exists public.library_versions (
  library_id uuid not null references public.libraries (id) on delete cascade,
  version integer not null check (version >= 1),
  content jsonb not null,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  item_count integer not null default 0 check (item_count >= 0),
  source_site_id text,
  created_by text not null,
  created_at timestamptz not null default now(),
  primary key (library_id, version)
);

-- Image bytes copied out of the source site when a version is published, keyed by content
-- hash so repeated publishes of the same image store it once. They count toward the library
-- owner's media allowance alongside site assets.
create table if not exists public.library_assets (
  library_id uuid not null references public.libraries (id) on delete cascade,
  id text not null check (id ~ '^[a-f0-9]{64}$'),
  name text not null,
  type text not null,
  w integer not null default 0,
  h integer not null default 0,
  storage_path text not null,
  stored_bytes bigint not null check (stored_bytes >= 0),
  created_at timestamptz not null default now(),
  primary key (library_id, id)
);

alter table public.libraries enable row level security;
alter table public.library_versions enable row level security;
alter table public.library_assets enable row level security;
revoke all on table public.libraries from anon, authenticated;
revoke all on table public.library_versions from anon, authenticated;
revoke all on table public.library_assets from anon, authenticated;
