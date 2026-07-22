-- Add structured geolocation & address columns to client_companies
ALTER TABLE client_companies
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS street_address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Indonesia';

-- Migrate existing address data into street_address for backward compat
UPDATE client_companies SET street_address = address WHERE address IS NOT NULL AND street_address IS NULL;

COMMENT ON COLUMN client_companies.area IS 'Regional territory from master_options (option_type=area)';
COMMENT ON COLUMN client_companies.street_address IS 'Street-level address line';
COMMENT ON COLUMN client_companies.city IS 'City name (free text)';
COMMENT ON COLUMN client_companies.postal_code IS 'Postal/ZIP code';
COMMENT ON COLUMN client_companies.country IS 'Country name, defaults to Indonesia';;
