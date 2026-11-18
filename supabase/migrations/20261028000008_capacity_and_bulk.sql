-- Capacity controls, guest ETA, bulk approval, paged pending list, and screen preload.

alter table public.venues
  add column max_open_per_device integer not null default 2 check (max_open_per_device between 1 and 20),
  add column max_queue_seconds integer not null default 2700 check (max_queue_seconds between 60 and 86400);

-------------------------------------------------------------------------------
-- Helpers
-------------------------------------------------------------------------------

-- Seconds of screen time already committed: what's left of the current item,
-- plus everything approved or waiting for approval.
create or replace function private.committed_queue_seconds(p_venue_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select greatest(0, extract(epoch from st.ends_at - now()))::integer
      from public.screen_state st
      where st.venue_id = p_venue_id and st.current_submission_id is not null
    ), 0)
    + coalesce((
      select sum(t.duration_seconds)::integer
      from public.submissions s
      join public.tiers t on t.id = s.tier_id
      where s.venue_id = p_venue_id and s.status in ('pending_approval', 'approved')
    ), 0)
  );
$$;

-------------------------------------------------------------------------------
-- Guest RPCs
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
    'isQueueFull', private.committed_queue_seconds(v_venue.id) >= v_venue.max_queue_seconds,
    'queueMinutes', ceil(private.committed_queue_seconds(v_venue.id) / 60.0)::integer,
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
  -- Lock the venue row so concurrent submits can't all slip past the queue limit.
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
  v_eta_seconds integer;
  v_ends_at timestamptz;
begin
  select * into v_submission from public.submissions where public_token = payload ->> 'publicToken';

  if v_submission.id is null then
    perform private.raise_error('submission_not_found', 'We could not find this message.', 'P0002');
  end if;

  if v_submission.status = 'approved' then
    select count(*) + 1, coalesce(sum(t.duration_seconds), 0)::integer
    into v_position, v_eta_seconds
    from public.submissions s
    join public.tiers t on t.id = s.tier_id
    where s.venue_id = v_submission.venue_id
      and s.status = 'approved'
      and (s.approved_at, s.id) < (v_submission.approved_at, v_submission.id);

    v_eta_seconds := v_eta_seconds + coalesce((
      select greatest(0, extract(epoch from st.ends_at - now()))::integer
      from public.screen_state st
      where st.venue_id = v_submission.venue_id and st.current_submission_id is not null
    ), 0);
  end if;

  if v_submission.status = 'playing' then
    select ends_at into v_ends_at from public.screen_state where venue_id = v_submission.venue_id;
  end if;

  return private.submission_json(v_submission.id) || jsonb_build_object(
    'venueId', v_submission.venue_id,
    'venueName', (select v.name from public.venues v where v.id = v_submission.venue_id),
    'queuePosition', v_position,
    'etaSeconds', v_eta_seconds,
    'endsAt', v_ends_at,
    'serverNow', now()
  );
end;
$$;

-------------------------------------------------------------------------------
-- Screen: include the next item so screens can preload its photo
-------------------------------------------------------------------------------

create or replace function public.screen_sync(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_screen public.screens;
  v_venue public.venues;
  v_next_id uuid;
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

  select s.id into v_next_id
  from public.submissions s
  where s.venue_id = v_venue.id and s.status = 'approved'
  order by s.approved_at, s.id
  limit 1;

  return private.screen_state_json(v_venue.id) || jsonb_build_object(
    'venue', jsonb_build_object('id', v_venue.id, 'slug', v_venue.slug, 'name', v_venue.name),
    'screenName', v_screen.name,
    'next', case when v_next_id is null then null else private.submission_json(v_next_id) end
  );
end;
$$;

-------------------------------------------------------------------------------
-- Staff: paged pending list and bulk approve
-------------------------------------------------------------------------------

create or replace function public.list_pending_submissions(payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (payload ->> 'venueId')::uuid;
  v_limit integer := least(greatest(coalesce((payload ->> 'limit')::integer, 40), 1), 100);
begin
  perform private.require_venue_staff(v_venue_id);

  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(private.submission_json(p.id) order by p.created_at)
      from (
        select s.id, s.created_at
        from public.submissions s
        where s.venue_id = v_venue_id and s.status = 'pending_approval'
        order by s.created_at
        limit v_limit
      ) p
    ), '[]'::jsonb),
    'total', (
      select count(*) from public.submissions s
      where s.venue_id = v_venue_id and s.status = 'pending_approval'
    )
  );
end;
$$;

-- Approves in the order given. now() is fixed for the whole transaction and clocks can
-- repeat a value, so each approved_at is forced strictly later than the previous one.
create or replace function public.approve_submissions(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_venue_id uuid := (payload ->> 'venueId')::uuid;
  v_submission_id uuid;
  v_approved uuid[] := '{}';
  v_approved_at timestamptz := clock_timestamp() - interval '1 microsecond';
begin
  perform private.require_venue_staff(v_venue_id);

  for v_submission_id in
    select (value #>> '{}')::uuid
    from jsonb_array_elements(coalesce(payload -> 'submissionIds', '[]'::jsonb)) with ordinality as ids(value, position)
    order by position
  loop
    v_approved_at := greatest(clock_timestamp(), v_approved_at + interval '1 microsecond');

    update public.submissions
    set status = 'approved', approved_at = v_approved_at, decided_at = now(), decided_by = auth.uid()
    where id = v_submission_id and venue_id = v_venue_id and status = 'pending_approval';

    if found then
      v_approved := v_approved || v_submission_id;
      perform private.log_event(v_venue_id, 'staff', 'submission_approved', v_submission_id);
    end if;
  end loop;

  perform private.advance_queue(v_venue_id);

  return jsonb_build_object(
    'approvedIds', to_jsonb(v_approved),
    'skippedCount', jsonb_array_length(coalesce(payload -> 'submissionIds', '[]'::jsonb)) - cardinality(v_approved)
  );
end;
$$;

revoke execute on function private.committed_queue_seconds(uuid) from public, anon, authenticated;
revoke execute on function public.approve_submissions(jsonb) from public, anon, authenticated;
grant execute on function public.approve_submissions(jsonb) to authenticated;
