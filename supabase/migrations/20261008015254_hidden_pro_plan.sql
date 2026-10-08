-- Pro is a private, complimentary entitlement. New profiles remain on Free.
-- Only trusted account administration can assign it; Auth metadata is not consulted.
alter table public.users drop constraint if exists users_plan_check;
alter table public.users add constraint users_plan_check check (plan in ('free', 'pro'));
comment on column public.users.plan is
  'Authoritative Pagecraft entitlement: free by default; pro is privately assigned. Never derived from user metadata.';
