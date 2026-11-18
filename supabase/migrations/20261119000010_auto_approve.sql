-- Auto-approve: guest messages skip staff approval and go straight into the queue.
-- For private events like the #POPFOUNDHERPRINCE wedding, where every guest is invited.
-- Staff can still skip or remove a message from the approval page's queue controls.

alter table public.venues add column auto_approve boolean not null default false;

-- This deployment is dedicated to the wedding, so existing event venues stop asking for approval.
update public.venues set auto_approve = true where service_type = 'event';

create or replace function public.create_submission(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue public.venues;
  v_tier_id uuid;
  v_message text := btrim(coalesce(payload ->> 'message', ''));
  v_instagram text := nullif(ltrim(btrim(coalesce(payload ->> 'instagram', '')), '@'), '');
  v_photo_path text := nullif(payload ->> 'photoPath', '');
  v_device_id text := nullif(payload ->> 'deviceId', '');
  v_open_count integer;
  v_submission public.submissions;
begin
  -- Lock the venue row so concurrent submits can't all slip past the queue limit. The lock also
  -- serializes submits, so auto-approved messages get strictly increasing approved_at (queue order).
  select * into v_venue from public.venues where slug = payload ->> 'venueSlug' for update;

  if v_venue.id is null then
    perform private.raise_error('venue_not_found', 'This venue does not exist.', 'P0002');
  end if;

  if not v_venue.is_accepting then
    perform private.raise_error('venue_closed', 'This screen is not accepting messages right now.');
  end if;

  if v_venue.service_type <> 'event' then
    perform private.raise_error('payments_not_available', 'Paid submissions are not available yet.');
  end if;

  select t.id into v_tier_id
  from public.tiers t
  where t.id = (payload ->> 'tierId')::uuid and t.venue_id = v_venue.id and t.is_active;

  if v_tier_id is null then
    perform private.raise_error('invalid_tier', 'Please choose a display time.');
  end if;

  if char_length(v_message) not between 1 and 120 then
    perform private.raise_error('invalid_message', 'Message must be 1 to 120 characters.');
  end if;

  if v_instagram is not null and v_instagram !~ '^[A-Za-z0-9._]{1,30}$' then
    perform private.raise_error('invalid_instagram', 'Instagram handle looks invalid.');
  end if;

  if v_device_id is null then
    perform private.raise_error('invalid_device', 'Missing device id.');
  end if;

  if v_photo_path is not null and v_photo_path not like v_venue.id::text || '/%' then
    perform private.raise_error('invalid_photo', 'Photo upload is invalid. Please try again.');
  end if;

  select count(*) into v_open_count
  from public.submissions
  where venue_id = v_venue.id
    and device_id = v_device_id
    and status in ('pending_approval', 'approved');

  if v_open_count >= v_venue.max_open_per_device then
    perform private.raise_error('too_many_pending',
      format('You already have %s messages waiting. Please wait for them to show.', v_open_count));
  end if;

  if private.committed_queue_seconds(v_venue.id) >= v_venue.max_queue_seconds then
    perform private.raise_error('queue_full', 'The screen is busy right now. Please try again in a few minutes.');
  end if;

  insert into public.submissions (venue_id, tier_id, message, instagram, photo_path, device_id, status, approved_at, decided_at)
  values (
    v_venue.id, v_tier_id, v_message, v_instagram, v_photo_path, v_device_id,
    case when v_venue.auto_approve then 'approved' else 'pending_approval' end::public.submission_status,
    case when v_venue.auto_approve then clock_timestamp() end,
    case when v_venue.auto_approve then now() end
  )
  returning * into v_submission;

  perform private.log_event(v_venue.id, 'guest', 'submission_received', v_submission.id,
    jsonb_build_object('deviceId', v_device_id));

  if v_venue.auto_approve then
    perform private.log_event(v_venue.id, 'system', 'submission_approved', v_submission.id,
      jsonb_build_object('auto', true));
    -- Starts playing straight away if a screen is on and idle.
    perform private.advance_queue(v_venue.id);
  end if;

  return jsonb_build_object('publicToken', v_submission.public_token, 'status', v_submission.status);
end;
$$;
