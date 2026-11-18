-- Business rules live here (see docs/coding_style/CAMSKYNET_ADDENDUM.md §1).
-- Public RPCs take one `payload jsonb` with camelCase keys and return camelCase jsonb (Exception B).
-- Errors: message = machine code (e.g. 'venue_not_found'), hint = human-readable text.

-------------------------------------------------------------------------------
-- Private helpers (not exposed through the API)
-------------------------------------------------------------------------------

create or replace function private.raise_error(p_code text, p_hint text, p_errcode text default 'P0001')
returns void
language plpgsql
as $$
begin
  raise exception using message = p_code, hint = p_hint, errcode = p_errcode;
end;
$$;

create or replace function private.log_event(
  p_venue_id uuid,
  p_actor_type public.actor_type,
  p_action text,
  p_submission_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (organization_id, venue_id, actor_type, actor_user_id, action, submission_id, details)
  select v.organization_id, v.id, p_actor_type, auth.uid(), p_action, p_submission_id, p_details
  from public.venues v
  where v.id = p_venue_id;
$$;

create or replace function private.require_venue_staff(p_venue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform private.raise_error('not_authenticated', 'Please log in again.', '28000');
  end if;

  if not exists (
    select 1
    from public.staff_members sm
    join public.venues v on v.organization_id = sm.organization_id
    where v.id = p_venue_id and sm.user_id = auth.uid()
  ) then
    perform private.raise_error('forbidden', 'You are not staff of this venue.', '42501');
  end if;
end;
$$;

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

create or replace function private.screen_state_json(p_venue_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'serverNow', now(),
    'startedAt', st.started_at,
    'endsAt', st.ends_at,
    'current', case when st.current_submission_id is null then null
                    else private.submission_json(st.current_submission_id) end,
    'queueLength', (
      select count(*) from public.submissions s
      where s.venue_id = p_venue_id and s.status = 'approved'
    )
  )
  from (select p_venue_id as venue_id) v
  left join public.screen_state st on st.venue_id = v.venue_id;
$$;

-- Idempotent and safe to call from any screen at any time: the row lock on
-- screen_state serialises concurrent callers, so an item can never play twice.
create or replace function private.advance_queue(p_venue_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state public.screen_state;
  v_next_id uuid;
  v_next_seconds integer;
begin
  insert into public.screen_state (venue_id) values (p_venue_id)
  on conflict (venue_id) do nothing;

  select * into v_state from public.screen_state where venue_id = p_venue_id for update;

  if v_state.current_submission_id is not null and v_state.ends_at > now() then
    return;
  end if;

  if v_state.current_submission_id is not null then
    update public.submissions
    set status = 'played', ended_at = now()
    where id = v_state.current_submission_id and status = 'playing';

    if found then
      perform private.log_event(p_venue_id, 'system', 'submission_played', v_state.current_submission_id);
    end if;
  end if;

  -- Don't start a guest's time when no screen is showing it (e.g. approved before the screen is on).
  if not exists (
    select 1 from public.screens
    where venue_id = p_venue_id and last_seen_at > now() - interval '60 seconds'
  ) then
    v_next_id := null;
  else
    select s.id, t.duration_seconds
    into v_next_id, v_next_seconds
    from public.submissions s
    join public.tiers t on t.id = s.tier_id
    where s.venue_id = p_venue_id and s.status = 'approved'
    order by s.approved_at, s.id
    limit 1
    for update of s skip locked;
  end if;

  if v_next_id is null then
    -- Only write when something changes, so idle venues don't spam realtime.
    if v_state.current_submission_id is not null then
      update public.screen_state
      set current_submission_id = null, started_at = null, ends_at = null, updated_at = now()
      where venue_id = p_venue_id;
    end if;
    return;
  end if;

  update public.submissions set status = 'playing', started_at = now() where id = v_next_id;

  update public.screen_state
  set current_submission_id = v_next_id,
      started_at = now(),
      ends_at = now() + make_interval(secs => v_next_seconds),
      updated_at = now()
  where venue_id = p_venue_id;

  perform private.log_event(p_venue_id, 'system', 'submission_started', v_next_id);
end;
$$;

-- Ends the current item early (skip/remove) and moves the queue on.
create or replace function private.end_current(p_venue_id uuid, p_new_status public.submission_status, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid;
begin
  select current_submission_id into v_current
  from public.screen_state where venue_id = p_venue_id for update;

  if v_current is null then
    return;
  end if;

  update public.submissions set status = p_new_status, ended_at = now() where id = v_current;

  update public.screen_state
  set current_submission_id = null, started_at = null, ends_at = null, updated_at = now()
  where venue_id = p_venue_id;

  perform private.log_event(p_venue_id, 'staff', p_action, v_current);
  perform private.advance_queue(p_venue_id);
end;
$$;

-------------------------------------------------------------------------------
-- Guest RPCs (anon)
-------------------------------------------------------------------------------

create or replace function public.get_venue_public(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue public.venues;
begin
  select * into v_venue from public.venues where slug = payload ->> 'venueSlug';

  if v_venue.id is null then
    perform private.raise_error('venue_not_found', 'This venue does not exist.', 'P0002');
  end if;

  return jsonb_build_object(
    'id', v_venue.id,
    'slug', v_venue.slug,
    'name', v_venue.name,
    'serviceType', v_venue.service_type,
    'isAccepting', v_venue.is_accepting,
    'tiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'label', t.label,
        'durationSeconds', t.duration_seconds,
        'priceSatang', t.price_satang
      ) order by t.sort_order, t.duration_seconds)
      from public.tiers t
      where t.venue_id = v_venue.id and t.is_active
    ), '[]'::jsonb)
  );
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
  v_photo_path text := nullif(payload ->> 'photoPath', '');
  v_device_id text := nullif(payload ->> 'deviceId', '');
  v_open_count integer;
  v_submission public.submissions;
begin
  select * into v_venue from public.venues where slug = payload ->> 'venueSlug';

  if v_venue.id is null then
    perform private.raise_error('venue_not_found', 'This venue does not exist.', 'P0002');
  end if;

  if not v_venue.is_accepting then
    perform private.raise_error('venue_closed', 'This screen is not accepting messages right now.');
  end if;

  -- Phase 2 adds payments; until then only free event submissions are allowed.
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

  -- The photo must be one our API issued an upload URL for, inside this venue's folder.
  if v_photo_path is not null and v_photo_path not like v_venue.id::text || '/%' then
    perform private.raise_error('invalid_photo', 'Photo upload is invalid. Please try again.');
  end if;

  select count(*) into v_open_count
  from public.submissions
  where venue_id = v_venue.id
    and device_id = v_device_id
    and status in ('pending_approval', 'approved');

  if v_open_count >= 3 then
    perform private.raise_error('too_many_pending', 'You already have 3 messages waiting. Please wait for them to show.', 'P0001');
  end if;

  insert into public.submissions (venue_id, tier_id, message, instagram, photo_path, device_id)
  values (v_venue.id, v_tier_id, v_message, v_instagram, v_photo_path, v_device_id)
  returning * into v_submission;

  perform private.log_event(v_venue.id, 'guest', 'submission_received', v_submission.id,
    jsonb_build_object('deviceId', v_device_id));

  return jsonb_build_object('publicToken', v_submission.public_token, 'status', v_submission.status);
end;
$$;

create or replace function public.get_submission_status(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions;
  v_position integer;
  v_ends_at timestamptz;
begin
  select * into v_submission from public.submissions where public_token = payload ->> 'publicToken';

  if v_submission.id is null then
    perform private.raise_error('submission_not_found', 'We could not find this message.', 'P0002');
  end if;

  if v_submission.status = 'approved' then
    select count(*) + 1 into v_position
    from public.submissions s
    where s.venue_id = v_submission.venue_id
      and s.status = 'approved'
      and (s.approved_at, s.id) < (v_submission.approved_at, v_submission.id);
  end if;

  if v_submission.status = 'playing' then
    select ends_at into v_ends_at from public.screen_state where venue_id = v_submission.venue_id;
  end if;

  return private.submission_json(v_submission.id) || jsonb_build_object(
    'venueId', v_submission.venue_id,
    'queuePosition', v_position,
    'endsAt', v_ends_at,
    'serverNow', now()
  );
end;
$$;

-------------------------------------------------------------------------------
-- Screen RPCs (anon, authorised by screen token)
-------------------------------------------------------------------------------

-- Called on load, on every realtime signal, when the current item ends, and as a heartbeat.
create or replace function public.screen_sync(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_screen public.screens;
  v_venue public.venues;
begin
  select * into v_screen from public.screens where token = payload ->> 'screenToken';

  if v_screen.id is null then
    perform private.raise_error('screen_not_found', 'This screen link is invalid or was revoked.', 'P0002');
  end if;

  if v_screen.last_seen_at is null or v_screen.last_seen_at < now() - interval '60 seconds' then
    perform private.log_event(v_screen.venue_id, 'screen', 'screen_connected', null,
      jsonb_build_object('screenId', v_screen.id, 'screenName', v_screen.name));
  end if;

  update public.screens set last_seen_at = now() where id = v_screen.id;

  perform private.advance_queue(v_screen.venue_id);

  select * into v_venue from public.venues where id = v_screen.venue_id;

  return private.screen_state_json(v_venue.id) || jsonb_build_object(
    'venue', jsonb_build_object('id', v_venue.id, 'slug', v_venue.slug, 'name', v_venue.name),
    'screenName', v_screen.name
  );
end;
$$;

-------------------------------------------------------------------------------
-- Staff RPCs (authenticated)
-------------------------------------------------------------------------------

create or replace function public.list_my_venues(payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    perform private.raise_error('not_authenticated', 'Please log in again.', '28000');
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', v.id,
      'slug', v.slug,
      'name', v.name,
      'serviceType', v.service_type,
      'role', sm.role
    ) order by v.name)
    from public.staff_members sm
    join public.venues v on v.organization_id = sm.organization_id
    where sm.user_id = auth.uid()
  ), '[]'::jsonb);
end;
$$;

create or replace function public.list_pending_submissions(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (payload ->> 'venueId')::uuid;
begin
  perform private.require_venue_staff(v_venue_id);

  return coalesce((
    select jsonb_agg(private.submission_json(s.id) order by s.created_at)
    from public.submissions s
    where s.venue_id = v_venue_id and s.status = 'pending_approval'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_queue(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (payload ->> 'venueId')::uuid;
begin
  perform private.require_venue_staff(v_venue_id);

  return jsonb_build_object(
    'nowPlaying', private.screen_state_json(v_venue_id),
    'upNext', coalesce((
      select jsonb_agg(private.submission_json(s.id) order by s.approved_at, s.id)
      from public.submissions s
      where s.venue_id = v_venue_id and s.status = 'approved'
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.approve_submission(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions;
begin
  select * into v_submission from public.submissions
  where id = (payload ->> 'submissionId')::uuid
  for update;

  if v_submission.id is null then
    perform private.raise_error('submission_not_found', 'This message no longer exists.', 'P0002');
  end if;

  perform private.require_venue_staff(v_submission.venue_id);

  if v_submission.status <> 'pending_approval' then
    perform private.raise_error('invalid_status', 'This message was already handled.');
  end if;

  update public.submissions
  set status = 'approved', approved_at = now(), decided_at = now(), decided_by = auth.uid()
  where id = v_submission.id;

  perform private.log_event(v_submission.venue_id, 'staff', 'submission_approved', v_submission.id);

  -- Starts playing straight away if the screen is idle.
  perform private.advance_queue(v_submission.venue_id);

  return private.submission_json(v_submission.id);
end;
$$;

create or replace function public.reject_submission(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions;
  v_reason text := nullif(btrim(coalesce(payload ->> 'reason', '')), '');
begin
  select * into v_submission from public.submissions
  where id = (payload ->> 'submissionId')::uuid
  for update;

  if v_submission.id is null then
    perform private.raise_error('submission_not_found', 'This message no longer exists.', 'P0002');
  end if;

  perform private.require_venue_staff(v_submission.venue_id);

  if v_submission.status <> 'pending_approval' then
    perform private.raise_error('invalid_status', 'This message was already handled.');
  end if;

  update public.submissions
  set status = 'rejected', rejection_reason = v_reason, decided_at = now(), decided_by = auth.uid()
  where id = v_submission.id;

  perform private.log_event(v_submission.venue_id, 'staff', 'submission_rejected', v_submission.id,
    jsonb_build_object('reason', v_reason));

  return private.submission_json(v_submission.id);
end;
$$;

create or replace function public.skip_current(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (payload ->> 'venueId')::uuid;
begin
  perform private.require_venue_staff(v_venue_id);
  perform private.end_current(v_venue_id, 'played', 'submission_skipped');
  return private.screen_state_json(v_venue_id);
end;
$$;

create or replace function public.remove_submission(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions;
  v_current uuid;
begin
  select * into v_submission from public.submissions where id = (payload ->> 'submissionId')::uuid;

  if v_submission.id is null then
    perform private.raise_error('submission_not_found', 'This message no longer exists.', 'P0002');
  end if;

  perform private.require_venue_staff(v_submission.venue_id);

  select current_submission_id into v_current from public.screen_state where venue_id = v_submission.venue_id;

  if v_current = v_submission.id then
    perform private.end_current(v_submission.venue_id, 'removed', 'submission_removed');
  elsif v_submission.status = 'approved' then
    update public.submissions set status = 'removed', ended_at = now() where id = v_submission.id;
    perform private.log_event(v_submission.venue_id, 'staff', 'submission_removed', v_submission.id);
  else
    perform private.raise_error('invalid_status', 'Only queued or playing messages can be removed.');
  end if;

  return private.submission_json(v_submission.id);
end;
$$;

-------------------------------------------------------------------------------
-- Grants: nothing is callable unless granted below.
-------------------------------------------------------------------------------

revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function
  public.get_venue_public(jsonb),
  public.create_submission(jsonb),
  public.get_submission_status(jsonb),
  public.screen_sync(jsonb),
  public.list_my_venues(jsonb),
  public.list_pending_submissions(jsonb),
  public.get_queue(jsonb),
  public.approve_submission(jsonb),
  public.reject_submission(jsonb),
  public.skip_current(jsonb),
  public.remove_submission(jsonb)
from public, anon, authenticated;

grant execute on function
  public.get_venue_public(jsonb),
  public.create_submission(jsonb),
  public.get_submission_status(jsonb),
  public.screen_sync(jsonb)
to anon, authenticated;

grant execute on function
  public.list_my_venues(jsonb),
  public.list_pending_submissions(jsonb),
  public.get_queue(jsonb),
  public.approve_submission(jsonb),
  public.reject_submission(jsonb),
  public.skip_current(jsonb),
  public.remove_submission(jsonb)
to authenticated;
