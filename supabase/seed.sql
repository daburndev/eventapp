-- Demo data for the spike. Run after the migrations.
-- Screens use fixed tokens so the demo URLs are easy to type; real screens get random tokens.

insert into public.organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Demo Organiser');

-- auto_approve: guest messages go straight into the queue (private wedding, no approval step).
insert into public.venues (id, organization_id, slug, name, service_type, auto_approve)
values ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'demo-event', 'Demo Event', 'event', true);

insert into public.tiers (venue_id, label, duration_seconds, sort_order) values
  ('00000000-0000-0000-0000-000000000010', '15 seconds', 15, 1),
  ('00000000-0000-0000-0000-000000000010', '30 seconds', 30, 2),
  ('00000000-0000-0000-0000-000000000010', '1 minute', 60, 3);

insert into public.screens (venue_id, name, token) values
  ('00000000-0000-0000-0000-000000000010', 'Main stage', 'demo-screen-1'),
  ('00000000-0000-0000-0000-000000000010', 'Bar', 'demo-screen-2');

-- After creating your staff login in Supabase (Authentication → Users → Add user),
-- replace the email below and run this to make that user an owner of the demo organiser:
--
-- insert into public.staff_members (user_id, organization_id, role)
-- select id, '00000000-0000-0000-0000-000000000001', 'owner'
-- from auth.users where email = 'you@example.com';
