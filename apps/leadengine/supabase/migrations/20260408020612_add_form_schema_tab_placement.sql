-- Add tab_placement to form_schemas
ALTER TABLE form_schemas ADD COLUMN IF NOT EXISTS tab_placement varchar(50) DEFAULT 'custom';
