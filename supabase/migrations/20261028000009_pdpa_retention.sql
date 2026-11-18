-- Thailand PDPA: personal data (photo, Instagram handle, message) is not kept.
--   Event type: scrubbed when the event ends (event_ends_at passes, or staff press "End event").
--   Venue type: scrubbed per submission once it is played, rejected or removed.
-- Photos live in Cloudflare R2, which Postgres can't reach, so their paths go into
-- photo_deletions and a Worker cron deletes them from R2 (claim → delete → confirm).
-- Counts in audit_log survive; "unique guests" relies on the anonymous device_id only.

alter table public.venues
  add column event_ends_at timestamptz,
  add column ended_at timestamptz;

alter table public.submissions
  add column personal_data_deleted_at timestamptz;

create table public.photo_deletions (
  id bigint generated always as identity primary key,
  photo_path text not null,
  submission_id uuid references public.submissions (id) on delete set null,
  queued_at timestamptz not null default now(),
  claimed_at timestamptz
);

alter table public.photo_deletions enable row level security;

-- Spike photos were in Supabase Storage, not R2. Forget their paths here and delete the
-- old 'submission-photos' bucket in the Supabase dashboard (Storage → bucket → Delete).
update public.submissions set photo_path = null where photo_path is not null;

-------------------------------------------------------------------------------
-- Scrubbing
-------------------------------------------------------------------------------

create or replace function private.scrub_submission(p_submission_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions;
begin
  select * into v_submission from public.submissions where id = p_submission_id for update;

  if v_submission.id is null or v_submission.personal_data_deleted_at is not null then
    return;
  end if;

  if v_submission.photo_path is not null then
    insert into public.photo_deletions (photo_path, submission_id) values (v_submission.photo_path, v_submission.id);
  end if;

  update public.submissions
  set photo_path = null, instagram = null, message = '[deleted]', personal_data_deleted_at = now()
  where id = v_submission.id;

  perform private.log_event(v_submission.venue_id, 'system', 'personal_data_deleted', v_submission.id,
    jsonb_build_object('reason', p_reason));
end;
$$;

-- Venue type: nothing to keep once the item is finished.
create or replace function private.scrub_finished_venue_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.venues v where v.id = new.venue_id and v.service_type = 'venue') then
    perform private.scrub_submission(new.id, 'finished');
  end if;
  return null;
end;
$$;

create trigger submissions_scrub_when_finished
after update of status on public.submissions
for each row
when (new.status in ('played', 'rejected', 'removed') and old.status is distinct from new.status)
execute function private.scrub_finished_venue_submission();

-------------------------------------------------------------------------------
-- Ending an event
-------------------------------------------------------------------------------

create or replace function private.end_event_internal(p_venue_id uuid, p_actor public.actor_type)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid;
  v_submission_id uuid;
begin
  update public.venues
  set ended_at = coalesce(ended_at, now()), is_accepting = false
  where id = p_venue_id;

  select current_submission_id into v_current
  from public.screen_state where venue_id = p_venue_id for update;

  if v_current is not null then
    update public.submissions set status = 'played', ended_at = now() where id = v_current and status = 'playing';
    update public.screen_state
    set current_submission_id = null, started_at = null, ends_at = null, updated_at = now()
    where venue_id = p_venue_id;
  end if;

  update public.submissions
  set status = 'removed', ended_at = now()
  where venue_id = p_venue_id and status in ('payment_pending', 'pending_approval', 'approved');

  for v_submission_id in
    select id from public.submissions
    where venue_id = p_venue_id and personal_data_deleted_at is null
  loop
    perform private.scrub_submission(v_submission_id, 'event_ended');
  end loop;

  perform private.log_event(p_venue_id, p_actor, 'event_ended');
end;
$$;

create or replace function public.end_event(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (payload ->> 'venueId')::uuid;
begin
  perform private.require_venue_staff(v_venue_id);
  perform private.end_event_internal(v_venue_id, 'staff');
  return jsonb_build_object('endedAt', (select ended_at from public.venues where id = v_venue_id));
end;
$$;

create or replace function private.end_due_events()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid;
begin
  for v_venue_id in
    select id from public.venues
    where service_type = 'event' and ended_at is null and event_ends_at <= now()
  loop
    perform private.end_event_internal(v_venue_id, 'system');
  end loop;
end;
$$;

-------------------------------------------------------------------------------
-- R2 deletion queue (service_role only: called by the Worker cron with the secret key)
-------------------------------------------------------------------------------

-- Claims are leased for 5 minutes; if the Worker dies before confirming, they're retried.
create or replace function public.claim_photo_deletions(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := least(greatest(coalesce((payload ->> 'limit')::integer, 200), 1), 500);
  v_claimed jsonb;
begin
  with claimed as (
    update public.photo_deletions d
    set claimed_at = now()
    where d.id in (
      select id from public.photo_deletions
      where claimed_at is null or claimed_at < now() - interval '5 minutes'
      order by id
      limit v_limit
      for update skip locked
    )
    returning d.id, d.photo_path
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'photoPath', photo_path) order by id), '[]'::jsonb)
  into v_claimed
  from claimed;

  return v_claimed;
end;
$$;

create or replace function public.confirm_photo_deletions(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.photo_deletions
  where id in (select (value #>> '{}')::bigint from jsonb_array_elements(coalesce(payload -> 'ids', '[]'::jsonb)));
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('confirmed', v_deleted);
end;
$$;

-------------------------------------------------------------------------------
-- Grants and schedule
-------------------------------------------------------------------------------

revoke execute on function
  private.scrub_submission(uuid, text),
  private.end_event_internal(uuid, public.actor_type),
  private.end_due_events()
from public, anon, authenticated;

revoke execute on function
  public.end_event(jsonb),
  public.claim_photo_deletions(jsonb),
  public.confirm_photo_deletions(jsonb)
from public, anon, authenticated;

grant execute on function public.end_event(jsonb) to authenticated;
grant execute on function public.claim_photo_deletions(jsonb), public.confirm_photo_deletions(jsonb) to service_role;

select cron.schedule('end-due-events', '* * * * *', $$select private.end_due_events()$$);
