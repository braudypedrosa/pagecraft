-- Phase 5, slice 2: read-only library sharing. A member can list a library, read its versions
-- and import from it into sites they own; only the library's owner publishes. Membership is by
-- user row, so an invitation to an address with no account yet waits on a pending user row,
-- exactly like site invitations.
-- Additive only. Older app builds never read or write this table; see
-- docs/phase5-libraries-design.md.

create table if not exists public.library_members (
  library_id uuid not null references public.libraries (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  invited_by text not null,
  created_at timestamptz not null default now(),
  primary key (library_id, user_id)
);
create index if not exists library_members_user_idx on public.library_members (user_id);

alter table public.library_members enable row level security;
revoke all on table public.library_members from anon, authenticated;
