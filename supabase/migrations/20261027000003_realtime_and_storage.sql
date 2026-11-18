-- Realtime signals (Broadcast from Database) and the photo bucket.
-- Signals carry ids and status only. Clients refetch real data through app/api
-- (CAMSKYNET_ADDENDUM.md Exception A), so the public channel leaks nothing sensitive.
-- Topic per venue: 'venue:<venueId>'.

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
    'venue:' || new.venue_id::text,
    false
  );
  return null;
end;
$$;

create trigger submissions_broadcast
after insert or update of status on public.submissions
for each row execute function private.broadcast_submission_change();

create or replace function private.broadcast_screen_state_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'currentSubmissionId', new.current_submission_id,
      'endsAt', new.ends_at
    ),
    'screen_state_changed',
    'venue:' || new.venue_id::text,
    false
  );
  return null;
end;
$$;

create trigger screen_state_broadcast
after insert or update on public.screen_state
for each row execute function private.broadcast_screen_state_change();

-- Public read so screens and admin can show photos by URL. Paths are
-- '<venueId>/<random uuid>.jpg', so they can't be guessed or listed.
-- Uploads only happen through signed upload URLs issued by our API.
-- Later: switch to a private bucket + signed read URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submission-photos', 'submission-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
