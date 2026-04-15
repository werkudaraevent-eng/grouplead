-- Add lost reason fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason_details text;

-- Seed default lost_reason master options
INSERT INTO master_options (option_type, label, value, is_active, sort_order)
VALUES
  ('lost_reason', 'Budget Constraints', 'Budget Constraints', true, 1),
  ('lost_reason', 'Competitor Won', 'Competitor Won', true, 2),
  ('lost_reason', 'No Response / Ghosted', 'No Response / Ghosted', true, 3),
  ('lost_reason', 'Project Cancelled', 'Project Cancelled', true, 4),
  ('lost_reason', 'Timing Not Right', 'Timing Not Right', true, 5),
  ('lost_reason', 'Price Too High', 'Price Too High', true, 6),
  ('lost_reason', 'Scope Mismatch', 'Scope Mismatch', true, 7),
  ('lost_reason', 'Internal Decision', 'Internal Decision', true, 8),
  ('lost_reason', 'Other', 'Other', true, 99)
ON CONFLICT DO NOTHING;;
