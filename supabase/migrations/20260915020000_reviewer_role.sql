-- Reviewers are invited collaborators who inspect assigned Phase 2 snapshots.
-- Existing owner/content rows stay valid. Older app builds never write this role.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'site_users'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%role%';
  if constraint_name is not null then
    execute format('alter table public.site_users drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.site_users
  add constraint site_users_role_check
  check (role in ('owner', 'content', 'reviewer'));
