-- Link Pagecraft profiles to verified Supabase Auth identities without removing the
-- legacy magic-link/session tables. Those tables remain available for one rollback release.
alter table public.users add column if not exists auth_user_id text;
create unique index if not exists users_auth_user_id_key
  on public.users (auth_user_id) where auth_user_id is not null;

-- Browser roles never query Pagecraft's authorization tables directly. The Hono server and
-- its fixed-operation gateway remain the sole authorization boundary.
alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;
