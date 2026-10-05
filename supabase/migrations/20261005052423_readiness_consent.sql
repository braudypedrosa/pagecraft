-- Accepted access remains in site_users/library_members. These rows grant no access.
create table if not exists public.collaboration_invitations (
  id text primary key,
  kind text not null check (kind in ('site_owner', 'library')),
  resource_id text not null,
  recipient_id text not null references public.users (id) on delete cascade,
  invited_by text not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (kind, resource_id, recipient_id)
);
create index if not exists collaboration_invitations_recipient_idx
  on public.collaboration_invitations (recipient_id, created_at);
alter table public.collaboration_invitations enable row level security;
revoke all on table public.collaboration_invitations from anon, authenticated;

-- The resource is polymorphic; remove its pending invitations in the same delete transaction.
create or replace function public.pagecraft_cleanup_consent_invitations()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  delete from public.collaboration_invitations
  where kind = case when TG_TABLE_NAME = 'sites' then 'site_owner' else 'library' end
    and resource_id = OLD.id::text;
  return OLD;
end;
$$;
revoke all on function public.pagecraft_cleanup_consent_invitations() from public, anon, authenticated;
drop trigger if exists pagecraft_cleanup_consent_invitations on public.sites;
create trigger pagecraft_cleanup_consent_invitations before delete on public.sites
  for each row execute function public.pagecraft_cleanup_consent_invitations();
drop trigger if exists pagecraft_cleanup_consent_invitations on public.libraries;
create trigger pagecraft_cleanup_consent_invitations before delete on public.libraries
  for each row execute function public.pagecraft_cleanup_consent_invitations();
