create table public.sites (
  id text primary key,
  host text not null unique,
  name text not null,
  doc jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  slug text not null
);
create index sites_host_idx on public.sites (host);
create unique index sites_slug_key on public.sites (slug);

create table public.users (
  id text primary key,
  email text not null unique,
  name text not null default '',
  auth_user_id text,
  created_at timestamptz not null default now()
);
create unique index users_auth_user_id_key on public.users (auth_user_id)
  where auth_user_id is not null;

create table public.login_links (
  digest text primary key,
  email text not null,
  expires_at timestamptz not null
);

create table public.sessions (
  digest text primary key,
  user_id text not null references public.users (id) on delete cascade,
  expires_at timestamptz not null
);
create index sessions_user_idx on public.sessions (user_id);

create table public.site_users (
  site_id text not null references public.sites (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'content')),
  primary key (site_id, user_id)
);
create index site_users_user_idx on public.site_users (user_id);

create table public.assets (
  id text primary key,
  site_id text not null references public.sites (id) on delete cascade,
  name text not null,
  type text not null,
  w integer not null default 0,
  h integer not null default 0,
  bytes bytea not null
);
create index assets_site_idx on public.assets (site_id);

alter table public.sites enable row level security;
alter table public.users enable row level security;
alter table public.login_links enable row level security;
alter table public.sessions enable row level security;
alter table public.site_users enable row level security;
alter table public.assets enable row level security;

revoke all on table public.sites from anon, authenticated;
revoke all on table public.users from anon, authenticated;
revoke all on table public.login_links from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.site_users from anon, authenticated;
revoke all on table public.assets from anon, authenticated;
