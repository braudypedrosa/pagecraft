create table public.site_revisions (
  site_id text not null references public.sites (id) on delete cascade,
  version integer not null check (version > 0),
  doc jsonb not null,
  saved_by text references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (site_id, version)
);

create index site_revisions_site_time_idx
  on public.site_revisions (site_id, created_at desc);

insert into public.site_revisions (site_id, version, doc, created_at)
select id, version, doc, updated_at from public.sites
on conflict (site_id, version) do nothing;

alter table public.site_revisions enable row level security;
revoke all on table public.site_revisions from anon, authenticated;
