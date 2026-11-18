-- Thailand PDPA: delete a guest's personal data as soon as their slot on the screen is over,
-- for every venue (events included), instead of keeping it until the event ends.
--   When a submission becomes played (time up or skipped), removed or rejected, its photo path
--   is queued for deletion from R2 (the Worker cron deletes it within about a minute) and its
--   message, Instagram handle and LINE ID are cleared.
--   "End event" / event_ends_at (0009) still scrub whatever is left in the queue.
-- Counts in audit_log are unaffected.

drop trigger submissions_scrub_when_finished on public.submissions;
drop function private.scrub_finished_venue_submission();

create or replace function private.scrub_finished_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.scrub_submission(new.id, 'finished');
  return null;
end;
$$;

revoke execute on function private.scrub_finished_submission() from public, anon, authenticated;

create trigger submissions_scrub_when_finished
after update of status on public.submissions
for each row
when (new.status in ('played', 'rejected', 'removed') and old.status is distinct from new.status)
execute function private.scrub_finished_submission();

-- Messages that already finished before this migration: scrub them now, so their photos
-- leave R2 on the next cron run.
select private.scrub_submission(s.id, 'finished')
from public.submissions s
where s.status in ('played', 'rejected', 'removed')
  and s.personal_data_deleted_at is null;
