create index site_revisions_saved_by_idx
  on public.site_revisions (saved_by)
  where saved_by is not null;
