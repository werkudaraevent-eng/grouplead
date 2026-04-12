-- 1. Add main_stream column to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS main_stream text;

-- 2. Add parent_value to master_options for cascading taxonomy
ALTER TABLE public.master_options ADD COLUMN IF NOT EXISTS parent_value text;

-- 3. Seed main_stream options
DO $$
DECLARE
  v_cid uuid := '055a3295-b583-4140-87f3-ed0783803c0b';
BEGIN

  -- main_stream (top-level)
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('main_stream', 'MICE',      'MICE',      true, v_cid, null),
    ('main_stream', 'Non-MICE',  'Non-MICE',  true, v_cid, null),
    ('main_stream', 'Digital',   'Digital',   true, v_cid, null)
  ON CONFLICT DO NOTHING;

  -- Update existing stream_type rows with parent_value
  UPDATE public.master_options SET parent_value = 'MICE'
  WHERE option_type = 'stream_type' AND value IN ('Corporate', 'Government', 'Association', 'BUMN');

  UPDATE public.master_options SET parent_value = 'Non-MICE'
  WHERE option_type = 'stream_type' AND value = 'Private';

  -- Add Digital stream_type children
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('stream_type', 'Virtual Event', 'Virtual Event', true, v_cid, 'Digital'),
    ('stream_type', 'Webinar',       'Webinar',       true, v_cid, 'Digital')
  ON CONFLICT DO NOTHING;

  -- Update existing business_purpose rows with parent_value (stream_type parent)
  UPDATE public.master_options SET parent_value = 'Corporate'
  WHERE option_type = 'business_purpose' AND value IN ('Incentive', 'Meeting', 'Conference', 'Exhibition', 'Gala Dinner', 'Product Launch', 'Team Building');

  -- Add Government-specific business purposes
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('business_purpose', 'Seminar',       'Seminar',       true, v_cid, 'Government'),
    ('business_purpose', 'Workshop',      'Workshop',      true, v_cid, 'Government'),
    ('business_purpose', 'Forum',         'Forum',         true, v_cid, 'Government')
  ON CONFLICT DO NOTHING;

  -- Add Association-specific
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('business_purpose', 'Annual Meeting',  'Annual Meeting',  true, v_cid, 'Association'),
    ('business_purpose', 'Congress',        'Congress',        true, v_cid, 'Association')
  ON CONFLICT DO NOTHING;

  -- Add BUMN-specific
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('business_purpose', 'Rapat Kerja',    'Rapat Kerja',    true, v_cid, 'BUMN'),
    ('business_purpose', 'Anniversary',    'Anniversary',    true, v_cid, 'BUMN')
  ON CONFLICT DO NOTHING;

  -- Add Private-specific
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('business_purpose', 'Wedding',        'Wedding',        true, v_cid, 'Private'),
    ('business_purpose', 'Birthday',       'Birthday',       true, v_cid, 'Private'),
    ('business_purpose', 'Celebration',    'Celebration',    true, v_cid, 'Private')
  ON CONFLICT DO NOTHING;

  -- Add Digital-specific
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id, parent_value)
  VALUES
    ('business_purpose', 'Live Streaming', 'Live Streaming', true, v_cid, 'Virtual Event'),
    ('business_purpose', 'Hybrid Event',   'Hybrid Event',   true, v_cid, 'Virtual Event'),
    ('business_purpose', 'Online Seminar', 'Online Seminar', true, v_cid, 'Webinar')
  ON CONFLICT DO NOTHING;

  -- Seed nationality options
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('nationality', 'Indonesian',  'Indonesian',  true, v_cid),
    ('nationality', 'Malaysian',   'Malaysian',   true, v_cid),
    ('nationality', 'Singaporean', 'Singaporean', true, v_cid),
    ('nationality', 'Thai',        'Thai',        true, v_cid),
    ('nationality', 'Filipino',    'Filipino',    true, v_cid),
    ('nationality', 'Japanese',    'Japanese',    true, v_cid),
    ('nationality', 'Korean',      'Korean',      true, v_cid),
    ('nationality', 'Chinese',     'Chinese',     true, v_cid),
    ('nationality', 'Indian',      'Indian',      true, v_cid),
    ('nationality', 'Australian',  'Australian',  true, v_cid),
    ('nationality', 'American',    'American',    true, v_cid),
    ('nationality', 'European',    'European',    true, v_cid),
    ('nationality', 'Other',       'Other',       true, v_cid)
  ON CONFLICT DO NOTHING;

  -- Seed area options (Indonesian regions)
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('area', 'Jabodetabek',     'Jabodetabek',     true, v_cid),
    ('area', 'Jawa Barat',      'Jawa Barat',      true, v_cid),
    ('area', 'Jawa Tengah',     'Jawa Tengah',     true, v_cid),
    ('area', 'Jawa Timur',      'Jawa Timur',      true, v_cid),
    ('area', 'Bali & NTB',      'Bali & NTB',      true, v_cid),
    ('area', 'Sumatera',        'Sumatera',        true, v_cid),
    ('area', 'Kalimantan',      'Kalimantan',      true, v_cid),
    ('area', 'Sulawesi',        'Sulawesi',        true, v_cid),
    ('area', 'Papua & Maluku',  'Papua & Maluku',  true, v_cid),
    ('area', 'International',   'International',   true, v_cid)
  ON CONFLICT DO NOTHING;

END $$;;
