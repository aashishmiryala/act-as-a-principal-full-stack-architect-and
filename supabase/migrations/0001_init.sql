-- ════════════════════════════════════════════════════════════════════════════
-- AIoT HealthGuard — initial schema
-- ----------------------------------------------------------------------------
-- Production Postgres/Supabase schema for the HealthGuard monitoring console.
-- Every table has Row-Level Security enabled. Anonymous callers can read nothing
-- that is PHI; the app's end-users authenticate with Supabase Auth and the
-- policies below scope access to authenticated staff (with per-user rules on
-- profiles and the audit log). Column ids are text to match the device/patient
-- identifiers minted by the edge fleet firmware (e.g. esp32-a107, pat_001).
--
-- Apply with:
--   POST https://api.supabase.com/v1/projects/<ref>/database/query
--   (Authorization: Bearer $SUPABASE_ACCESS_TOKEN)
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─── Enums ──────────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('admin', 'clinician', 'caregiver', 'patient');
exception when duplicate_object then null; end $$;

do $$ begin
  create type device_status as enum ('online', 'offline', 'degraded', 'provisioning');
exception when duplicate_object then null; end $$;

do $$ begin
  create type alert_severity as enum ('info', 'warning', 'critical');
exception when duplicate_object then null; end $$;

-- ─── profiles (extends auth.users) ──────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role user_role not null default 'clinician',
  ward text,
  avatar_color text not null default '#22d3ee',
  created_at timestamptz not null default now()
);

-- ─── patients ───────────────────────────────────────────────────────────────
create table if not exists public.patients (
  id text primary key,                       -- e.g. pat_001
  mrn text unique not null,
  full_name text not null,
  sex text not null check (sex in ('male', 'female', 'other')),
  date_of_birth date not null,
  room text,
  ward text not null,
  condition text,
  admitted_at timestamptz not null default now(),
  baseline jsonb not null default '{}'::jsonb,
  primary_caregiver uuid references public.profiles (id)
);

-- ─── devices (ESP32 fleet) ──────────────────────────────────────────────────
create table if not exists public.devices (
  id text primary key,                       -- e.g. esp32-a107
  name text not null,
  patient_id text references public.patients (id) on delete set null,
  firmware text not null default 'hg-fw 2.4.1',
  hardware text not null default 'ESP32-WROOM-32',
  status device_status not null default 'provisioning',
  battery_pct numeric(5,2) not null default 100,
  rssi int not null default -55,
  ip_address text,
  sample_rate_hz int not null default 1,
  sensors jsonb not null default '[]'::jsonb,
  location jsonb,
  last_seen timestamptz,
  uptime_sec bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists devices_patient_idx on public.devices (patient_id);

-- ─── telemetry (time-series) ────────────────────────────────────────────────
create table if not exists public.telemetry (
  id bigint generated always as identity,
  device_id text not null references public.devices (id) on delete cascade,
  patient_id text references public.patients (id) on delete set null,
  ts timestamptz not null default now(),
  seq bigint not null,
  metrics jsonb not null,
  battery numeric(5,2),
  rssi int,
  primary key (id, ts)
);
create index if not exists telemetry_device_ts_idx on public.telemetry (device_id, ts desc);

-- ─── alerts ─────────────────────────────────────────────────────────────────
create table if not exists public.alerts (
  id text primary key,                       -- client-minted alert id
  device_id text not null references public.devices (id) on delete cascade,
  patient_id text references public.patients (id) on delete set null,
  ts timestamptz not null default now(),
  severity alert_severity not null,
  metric text not null,
  title text not null,
  description text,
  value numeric,
  detector text not null,
  score numeric(6,4) not null default 0,
  recommendation text,
  acknowledged boolean not null default false,
  acknowledged_by text,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists alerts_device_ts_idx on public.alerts (device_id, ts desc);
create index if not exists alerts_unacked_idx on public.alerts (acknowledged, ts desc);

-- ─── doc_chunks (RAG corpus) ────────────────────────────────────────────────
create table if not exists public.doc_chunks (
  id text primary key,
  doc_id text not null,
  title text not null,
  category text not null,
  source text not null,
  heading text,
  content text not null,
  tokens int not null default 0
);

-- ─── audit_log ──────────────────────────────────────────────────────────────
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references public.profiles (id),
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════════
-- Helper: current user's role (security definer to avoid RLS recursion)
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.current_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- Row-Level Security
-- ════════════════════════════════════════════════════════════════════════════
alter table public.profiles    enable row level security;
alter table public.patients    enable row level security;
alter table public.devices     enable row level security;
alter table public.telemetry   enable row level security;
alter table public.alerts      enable row level security;
alter table public.doc_chunks  enable row level security;
alter table public.audit_log   enable row level security;

-- profiles: a user sees & edits their own row; admins see all.
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select
  using (id = auth.uid() or public.current_role() = 'admin');
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid());

-- patients / devices / telemetry: readable by any authenticated staff member
-- (shared monitoring console); writable by clinicians and admins.
drop policy if exists patients_read on public.patients;
create policy patients_read on public.patients for select
  using (auth.role() = 'authenticated');
drop policy if exists patients_write on public.patients;
create policy patients_write on public.patients for all
  using (public.current_role() in ('admin', 'clinician'))
  with check (public.current_role() in ('admin', 'clinician'));

drop policy if exists devices_read on public.devices;
create policy devices_read on public.devices for select
  using (auth.role() = 'authenticated');

drop policy if exists telemetry_read on public.telemetry;
create policy telemetry_read on public.telemetry for select
  using (auth.role() = 'authenticated');

-- alerts: authenticated staff read the fleet feed, log new detections,
-- acknowledge and clear them. (Anonymous callers are fully blocked by RLS.)
drop policy if exists alerts_read on public.alerts;
create policy alerts_read on public.alerts for select
  using (auth.role() = 'authenticated');
drop policy if exists alerts_insert on public.alerts;
create policy alerts_insert on public.alerts for insert
  with check (auth.role() = 'authenticated');
drop policy if exists alerts_update on public.alerts;
create policy alerts_update on public.alerts for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
drop policy if exists alerts_delete on public.alerts;
create policy alerts_delete on public.alerts for delete
  using (auth.role() = 'authenticated');

-- doc_chunks: readable by any authenticated user (non-PHI documentation).
-- Server-side RAG retrieval runs in an edge function with the service role.
drop policy if exists doc_chunks_read on public.doc_chunks;
create policy doc_chunks_read on public.doc_chunks for select
  using (auth.role() = 'authenticated');

-- audit_log: admins read; anyone authenticated inserts their own actions.
drop policy if exists audit_admin_read on public.audit_log;
create policy audit_admin_read on public.audit_log for select
  using (public.current_role() = 'admin');
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert
  with check (actor = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- Auto-create a profile row when a user signs up.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, avatar_color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'clinician'),
    coalesce(new.raw_user_meta_data ->> 'avatar_color', '#22d3ee')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Realtime: broadcast alert changes to subscribed dashboards.
do $$ begin
  alter publication supabase_realtime add table public.alerts;
exception when duplicate_object then null; end $$;
