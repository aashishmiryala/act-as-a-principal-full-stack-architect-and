-- ════════════════════════════════════════════════════════════════════════════
-- AIoT HealthGuard — telemetry persistence + realtime
-- ----------------------------------------------------------------------------
-- 0001 wired alert persistence + Realtime. This migration lets the browser
-- (acting as the ESP32 "gateway") write time-series frames for the featured
-- device to `public.telemetry`, exposes fleet-wide reads to the monitoring
-- console, and publishes telemetry row-changes over Supabase Realtime.
-- Apply with:
--   POST https://api.supabase.com/v1/projects/<ref>/database/query
-- ════════════════════════════════════════════════════════════════════════════

-- Gateway insert (authenticated clients stream telemetry frames).
drop policy if exists telemetry_insert on public.telemetry;
create policy telemetry_insert on public.telemetry
  for insert to authenticated with check (true);

-- Fleet-wide read for the monitoring console.
drop policy if exists telemetry_read_all on public.telemetry;
create policy telemetry_read_all on public.telemetry
  for select to authenticated using (true);

-- Realtime: full row images + publish telemetry changes.
alter table public.telemetry replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'telemetry'
  ) then
    alter publication supabase_realtime add table public.telemetry;
  end if;
end $$;
