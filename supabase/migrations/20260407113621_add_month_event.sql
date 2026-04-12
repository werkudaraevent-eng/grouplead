-- Add Cut-Off Date settings to the companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS cut_off_date integer;

-- Add Month Event to the leads table (e.g. 'Jan-2026')
ALTER TABLE leads ADD COLUMN IF NOT EXISTS month_event varchar(8);
