-- Optional LINE ID on guest submissions, alongside the Instagram handle.
-- Same lifecycle as Instagram: shown with the message, scrubbed under the PDPA retention rules (0009).

-- LINE IDs: 4–20 characters, lowercase letters, digits, "." "-" "_".
alter table public.submissions
  add column line_id text check (line_id is null or line_id ~ '^[a-z0-9._-]{4,20}$');

create or replace function private.submission_json(p_submission_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'message', s.message,
    'instagram', s.instagram,
    'lineId', s.line_id,
    'photoPath', s.photo_path,
    'tierLabel', t.label,
    'durationSeconds', t.duration_seconds,
    'createdAt', s.created_at,
    'approvedAt', s.approved_at,
    'startedAt', s.started_at,
    'rejectionReason', s.rejection_reason
  )
  from public.submissions s
  join public.tiers t on t.id = s.tier_id
  where s.id = p_submission_id;
$$;

-- PDPA: the LINE ID is personal data too, so it's cleared with the photo, Instagram handle and message.
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
  set photo_path = null, instagram = null, line_id = null, message = '[deleted]', personal_data_deleted_at = now()
  where id = v_submission.id;

  perform private.log_event(v_submission.venue_id, 'system', 'personal_data_deleted', v_submission.id,
    jsonb_build_object('reason', p_reason));
end;
$$;

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
  -- LINE IDs are case-insensitive; store them lowercase without a leading @.
  v_line_id text := lower(nullif(ltrim(btrim(coalesce(payload ->> 'lineId', '')), '@'), ''));
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

  if v_line_id is not null and v_line_id !~ '^[a-z0-9._-]{4,20}$' then
    perform private.raise_error('invalid_line_id', 'LINE ID looks invalid.');
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

  insert into public.submissions (venue_id, tier_id, message, instagram, line_id, photo_path, device_id, status, approved_at, decided_at)
  values (
    v_venue.id, v_tier_id, v_message, v_instagram, v_line_id, v_photo_path, v_device_id,
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
