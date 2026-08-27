-- Account Settings v1 keeps billing deliberately provider-neutral. The plan value is
-- authoritative Pagecraft data; browser-editable Supabase metadata never controls limits.
alter table public.users
  add column if not exists plan text not null default 'free';

alter table public.users
  drop constraint if exists users_plan_check;
alter table public.users
  add constraint users_plan_check check (plan in ('free'));
