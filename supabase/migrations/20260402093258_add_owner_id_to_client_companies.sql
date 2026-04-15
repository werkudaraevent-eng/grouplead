-- Add entity ownership column to client_companies
ALTER TABLE client_companies
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN client_companies.owner_id IS 'Record owner for RBAC "Own Records" logic';

NOTIFY pgrst, 'reload schema';;
