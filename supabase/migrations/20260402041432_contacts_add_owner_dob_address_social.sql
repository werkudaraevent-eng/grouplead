
-- Add ownership, enrichment, and social fields to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS social_urls JSONB DEFAULT '{}'::jsonb;

-- Create index on owner_id for RLS performance
CREATE INDEX IF NOT EXISTS idx_contacts_owner_id ON contacts(owner_id);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
;
