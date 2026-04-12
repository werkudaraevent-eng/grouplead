-- Add virtual_platform column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS virtual_platform text;

-- Seed event_city master options (major Indonesian cities for event management)
DO $$
DECLARE
  v_company_id uuid := '055a3295-b583-4140-87f3-ed0783803c0b';
BEGIN
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('event_city', 'Jakarta',    'Jakarta',    true, v_company_id),
    ('event_city', 'Surabaya',   'Surabaya',   true, v_company_id),
    ('event_city', 'Bandung',    'Bandung',    true, v_company_id),
    ('event_city', 'Bali',       'Bali',       true, v_company_id),
    ('event_city', 'Yogyakarta', 'Yogyakarta', true, v_company_id),
    ('event_city', 'Semarang',   'Semarang',   true, v_company_id),
    ('event_city', 'Medan',      'Medan',      true, v_company_id),
    ('event_city', 'Makassar',   'Makassar',   true, v_company_id),
    ('event_city', 'Malang',     'Malang',     true, v_company_id),
    ('event_city', 'Lombok',     'Lombok',     true, v_company_id),
    ('event_city', 'Batam',      'Batam',      true, v_company_id),
    ('event_city', 'Palembang',  'Palembang',  true, v_company_id)
  ON CONFLICT DO NOTHING;
END $$;;
