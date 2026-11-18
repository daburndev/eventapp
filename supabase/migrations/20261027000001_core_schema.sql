-- Core schema: tenants, venues, tiers, screens, submissions, queue state, audit log.
-- Every table has RLS enabled with no policies: the app never reads tables directly.
-- All access goes through the RPC functions in the next migration (camelCase JSON out).

create extension if not exists pgcrypto;

create schema if not exists private;

create type public.service_type as enum ('event', 'venue');

-- payment_pending is unused for events; kept so the venue flow (Phase 2) needs no enum rewrite.
create type public.submission_status as enum (
  'payment_pending',
  'pending_approval',
  'approved',
  'playing',
  'played',
  'rejected',
  'removed'
);

create type public.staff_role as enum ('owner', 'approver');

create type public.actor_type as enum ('guest', 'staff', 'screen', 'system');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.staff_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role public.staff_role not null default 'approver',
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
  name text not null,
  service_type public.service_type not null default 'event',
  is_accepting boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tiers (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  label text not null,
  duration_seconds integer not null check (duration_seconds between 5 and 600),
  price_satang integer check (price_satang is null or price_satang >= 0),
  sort_order integer not null default 0,
  is_active boolean not null default true
);

create table public.screens (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  last_seen_at timestamptz
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  tier_id uuid not null references public.tiers (id),
  public_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status public.submission_status not null default 'pending_approval',
  message text not null check (char_length(message) between 1 and 120),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  photo_path text,
  device_id text not null,
  rejection_reason text,
  decided_by uuid references auth.users (id),
  decided_at timestamptz,
  approved_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index submissions_queue_idx on public.submissions (venue_id, status, approved_at);
create index submissions_device_idx on public.submissions (venue_id, device_id, status);

-- One row per venue: every screen of a venue shows the same item at the same time.
create table public.screen_state (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  current_submission_id uuid references public.submissions (id),
  started_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  venue_id uuid references public.venues (id) on delete cascade,
  actor_type public.actor_type not null,
  actor_user_id uuid references auth.users (id),
  action text not null,
  submission_id uuid references public.submissions (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_venue_time_idx on public.audit_log (venue_id, created_at desc);

alter table public.organizations enable row level security;
alter table public.staff_members enable row level security;
alter table public.venues enable row level security;
alter table public.tiers enable row level security;
alter table public.screens enable row level security;
alter table public.submissions enable row level security;
alter table public.screen_state enable row level security;
alter table public.audit_log enable row level security;
