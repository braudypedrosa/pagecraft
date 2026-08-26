-- A signed artifact is not deployable merely because its immutable row was built. This
-- separate finalization ledger records whether the hosted public-pointer commit succeeded or
-- whether a stale, built-but-unpublished identity was abandoned. Both states are terminal.
create table public.site_release_publications (
  release_id text primary key references public.site_releases (id) on delete restrict,
  site_id text not null references public.sites (id) on delete restrict,
  status text not null check (status in ('published', 'aborted')),
  finalized_at timestamptz not null,
  unique (site_id, release_id)
);

create index site_release_publications_site_idx
  on public.site_release_publications (site_id, finalized_at desc)
  where status = 'published';

create trigger site_release_publications_immutable
before update or delete on public.site_release_publications
for each row execute function private.reject_immutable_release_row();

alter table public.site_release_publications enable row level security;
revoke all on table public.site_release_publications from public, anon, authenticated;
