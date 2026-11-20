-- Founder CRM contacts move from a JSON file on the Reports host into the database, so billing
-- events can update them and the nightly database backup covers them (billing design, phase 2).
-- Only the server-keyed gateway reads or writes this table.

create table if not exists public.crm_contacts (
  id uuid primary key,
  account_id text unique references public.users (id) on delete set null,
  name text not null default '' check (length(name) <= 120),
  email text not null check (length(email) between 3 and 254 and email = lower(email)),
  company text not null default '' check (length(company) <= 160),
  stage text not null check (stage in ('lead', 'contacted', 'qualified', 'customer', 'archived')),
  source text not null check (source in ('unknown', 'direct', 'referral', 'organic', 'social', 'paid', 'other')),
  notes text not null default '' check (length(notes) <= 5000),
  follow_up_on date,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 1 check (revision >= 1)
);
create unique index if not exists crm_contacts_email_key on public.crm_contacts (email);

alter table public.crm_contacts enable row level security;
revoke all on table public.crm_contacts from anon, authenticated;
