-- Guest status page shows the venue name in its header.

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
    'venueName', (select v.name from public.venues v where v.id = v_submission.venue_id),
    'queuePosition', v_position,
    'endsAt', v_ends_at,
    'serverNow', now()
  );
end;
$$;
