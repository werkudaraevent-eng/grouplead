-- 1. Inject JSONB column for dynamic custom field data
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_data JSONB DEFAULT '{}'::jsonb;

-- 2. Inject text columns for Scope & Brief tab (progressive disclosure)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS general_brief TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS production_sow TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS special_remarks TEXT;

-- 3. Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';;
