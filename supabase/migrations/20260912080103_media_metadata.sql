-- Additive metadata only. Existing upload dates remain unknown.
alter table public.assets add column if not exists tags text[] not null default array[]::text[];
alter table public.assets add column if not exists metadata_version integer not null default 0;
alter table public.assets add column if not exists created_at timestamptz;
alter table public.assets alter column created_at set default now();
