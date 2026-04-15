-- Add FK from lead_activities.user_id → profiles.id (profiles mirrors auth.users.id)
ALTER TABLE lead_activities
  ADD CONSTRAINT lead_activities_profile_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id)
  ON DELETE SET NULL;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';;
