-- Split realtime signals by audience so a 500-guest burst of new submissions only
-- reaches staff, not screens. Guests no longer use Realtime at all (they poll).
--   venue:<id>:staff  → submission_changed + screen_state_changed
--   venue:<id>:screen → screen_state_changed

create or replace function private.broadcast_submission_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object('submissionId', new.id, 'status', new.status),
    'submission_changed',
    'venue:' || new.venue_id::text || ':staff',
    false
  );
  return null;
end;
$$;

create or replace function private.broadcast_screen_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payload jsonb := jsonb_build_object(
    'currentSubmissionId', new.current_submission_id,
    'endsAt', new.ends_at
  );
begin
  perform realtime.send(v_payload, 'screen_state_changed', 'venue:' || new.venue_id::text || ':staff', false);
  perform realtime.send(v_payload, 'screen_state_changed', 'venue:' || new.venue_id::text || ':screen', false);
  return null;
end;
$$;
