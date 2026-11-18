-- Fallback timer: screens normally advance the queue themselves (screen_sync when
-- an item ends). This catches the case where every screen's tab is frozen or offline
-- mid-item, but only for venues with a screen seen in the last minute, so we never
-- "play" messages to an empty room.

create extension if not exists pg_cron;

create or replace function private.advance_active_queues()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  for v_venue_id in
    select distinct sc.venue_id
    from public.screens sc
    where sc.last_seen_at > now() - interval '60 seconds'
  loop
    perform private.advance_queue(v_venue_id);
  end loop;
end;
$$;

revoke execute on function private.advance_active_queues() from public, anon, authenticated;

select cron.schedule('advance-active-queues', '5 seconds', $$select private.advance_active_queues()$$);
