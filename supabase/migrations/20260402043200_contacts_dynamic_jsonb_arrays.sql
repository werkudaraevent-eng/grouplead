
-- Migrate scalar secondary fields to JSONB arrays.
-- Keep old columns for backward-compat reads, but new code writes to JSONB arrays.
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS secondary_emails JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS secondary_phones JSONB DEFAULT '[]'::jsonb;

-- Migrate existing data from scalar columns into JSONB arrays where present
UPDATE contacts 
SET secondary_emails = jsonb_build_array(secondary_email)
WHERE secondary_email IS NOT NULL AND secondary_email != ''
  AND (secondary_emails IS NULL OR secondary_emails = '[]'::jsonb);

UPDATE contacts 
SET secondary_phones = jsonb_build_array(secondary_phone)
WHERE secondary_phone IS NOT NULL AND secondary_phone != ''
  AND (secondary_phones IS NULL OR secondary_phones = '[]'::jsonb);

-- Change social_urls default to array format for new rows
ALTER TABLE contacts ALTER COLUMN social_urls SET DEFAULT '[]'::jsonb;

-- Migrate existing social_urls objects to array format
-- e.g. {"other":"https://..."} -> [{"platform":"Other","url":"https://..."}]
UPDATE contacts
SET social_urls = (
    SELECT COALESCE(
        jsonb_agg(jsonb_build_object('platform', key, 'url', value)),
        '[]'::jsonb
    )
    FROM jsonb_each_text(social_urls)
)
WHERE social_urls IS NOT NULL 
  AND social_urls != '{}'::jsonb 
  AND social_urls != '[]'::jsonb
  AND jsonb_typeof(social_urls) = 'object';

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
;
