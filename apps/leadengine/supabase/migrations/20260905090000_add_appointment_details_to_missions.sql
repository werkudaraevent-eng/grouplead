-- Appointment details on a mission.
--
-- A mission is often booked by the appointment team, not by the rep who will
-- walk into the room. Until now the rep left with a company name, an area and
-- an objective — not who they were meeting, how to reach them, which building,
-- or what had already been agreed on the phone.
--
-- Columns mirror sales_mission.report_contacts on purpose. That table records
-- who was *actually* met; these record who was *expected*. Keeping the shapes
-- aligned means the visit report can later be seeded from the appointment
-- instead of asking the rep to retype it.
--
-- Deliberately flat rather than a child table: an appointment is with one
-- primary contact. Everyone else who turns up is captured by report_contacts,
-- which already supports several.

alter table sales_mission.missions
  add column if not exists contact_salutation text,
  add column if not exists contact_name       text,
  add column if not exists contact_job_title  text,
  add column if not exists contact_division   text,
  add column if not exists contact_phone      text,
  add column if not exists contact_email      text,
  -- `location` now holds a city or kecamatan, filled from the same autocomplete
  -- LeadEngine uses. The street address, building and floor need their own room.
  add column if not exists building           text,
  -- What the person who booked the meeting already discussed with the client.
  -- Without it that context stays in someone's head or a chat thread.
  add column if not exists appointment_notes  text;

-- Free text everywhere else, but the salutation drives how a rep addresses
-- someone in the room; a typo there is worse than an empty field.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sales_mission_missions_salutation_check'
  ) then
    alter table sales_mission.missions
      add constraint sales_mission_missions_salutation_check
      check (contact_salutation is null or contact_salutation in ('Bapak', 'Ibu', 'Mr', 'Mrs', 'Ms'));
  end if;
end $$;

comment on column sales_mission.missions.contact_name is
  'Person the appointment was booked with. Who was actually met is in report_contacts.';
comment on column sales_mission.missions.appointment_notes is
  'Points already agreed between whoever booked the meeting and the client.';
