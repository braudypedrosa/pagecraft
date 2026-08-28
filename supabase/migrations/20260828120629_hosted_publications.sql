alter table public.sites
  add column if not exists published_publication_id uuid;

create table if not exists public.hosted_publications (
  id uuid primary key,
  site_id text not null references public.sites (id) on delete cascade,
  source_version integer not null check (source_version > 0),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  storage_key text not null,
  created_by text not null,
  created_at timestamptz not null,
  unique (site_id, source_version, content_hash)
);

create index if not exists hosted_publications_site_time_idx
  on public.hosted_publications (site_id, created_at desc);

alter table public.hosted_publications enable row level security;
revoke all on table public.hosted_publications from anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sites_published_publication_id_fkey'
  ) then
    alter table public.sites
      add constraint sites_published_publication_id_fkey
      foreign key (published_publication_id)
      references public.hosted_publications (id)
      deferrable initially deferred;
  end if;
end $$;
