-- Core mission fields were seeded with English labels while the rest of the
-- interface is Indonesian, so the mission form read "Mission type" and
-- "Location" next to Indonesian headings.
--
-- Only rows still holding the exact seeded English label are touched. An admin
-- who has already relabelled a field through the form builder keeps their
-- wording — their rename is their data, not ours to overwrite.

update sales_mission.form_fields set label = 'Perusahaan klien'
  where is_core and reporting_key = 'client_company' and label = 'Client company';
update sales_mission.form_fields set label = 'Jenis mission'
  where is_core and reporting_key = 'mission_type' and label = 'Mission type';
update sales_mission.form_fields set label = 'Lokasi'
  where is_core and reporting_key = 'location' and label = 'Location';
update sales_mission.form_fields set label = 'Tanggal'
  where is_core and reporting_key = 'date' and label = 'Date';
update sales_mission.form_fields set label = 'Jam mulai'
  where is_core and reporting_key = 'start_time' and label = 'Start time';
update sales_mission.form_fields set label = 'Jam selesai'
  where is_core and reporting_key = 'end_time' and label = 'End time';
update sales_mission.form_fields set label = 'Tujuan kunjungan'
  where is_core and reporting_key = 'objective' and label = 'Objective';
update sales_mission.form_fields set label = 'Sales utama'
  where is_core and reporting_key = 'primary_sales' and label = 'Primary sales';
update sales_mission.form_fields set label = 'Sales pendukung'
  where is_core and reporting_key = 'supporting_sales' and label = 'Supporting sales';
