-- Seed core master_options categories so they appear in the UI immediately.
-- Uses ON CONFLICT DO NOTHING to be safely re-runnable.
-- All rows scoped to the holding company (Werkudara Group).

DO $$
DECLARE
  v_company_id uuid := '055a3295-b583-4140-87f3-ed0783803c0b';
BEGIN

  -- lead_source
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('lead_source', 'Website',       'Website',       true, v_company_id),
    ('lead_source', 'Referral',      'Referral',      true, v_company_id),
    ('lead_source', 'Partner',       'Partner',       true, v_company_id),
    ('lead_source', 'Social Media',  'Social Media',  true, v_company_id),
    ('lead_source', 'Cold Call',     'Cold Call',      true, v_company_id),
    ('lead_source', 'Exhibition',    'Exhibition',    true, v_company_id),
    ('lead_source', 'Repeat Client', 'Repeat Client', true, v_company_id)
  ON CONFLICT DO NOTHING;

  -- stream_type
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('stream_type', 'Corporate',   'Corporate',   true, v_company_id),
    ('stream_type', 'Government',  'Government',  true, v_company_id),
    ('stream_type', 'Association', 'Association', true, v_company_id),
    ('stream_type', 'BUMN',        'BUMN',        true, v_company_id),
    ('stream_type', 'Private',     'Private',     true, v_company_id)
  ON CONFLICT DO NOTHING;

  -- business_purpose
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('business_purpose', 'Incentive',    'Incentive',    true, v_company_id),
    ('business_purpose', 'Meeting',      'Meeting',      true, v_company_id),
    ('business_purpose', 'Conference',   'Conference',   true, v_company_id),
    ('business_purpose', 'Exhibition',   'Exhibition',   true, v_company_id),
    ('business_purpose', 'Gala Dinner',  'Gala Dinner',  true, v_company_id),
    ('business_purpose', 'Product Launch','Product Launch',true, v_company_id),
    ('business_purpose', 'Team Building','Team Building', true, v_company_id)
  ON CONFLICT DO NOTHING;

  -- tipe
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('tipe', 'Inbound',  'Inbound',  true, v_company_id),
    ('tipe', 'Outbound', 'Outbound', true, v_company_id),
    ('tipe', 'Existing', 'Existing', true, v_company_id)
  ON CONFLICT DO NOTHING;

  -- sector
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('sector', 'Banking & Finance', 'Banking & Finance', true, v_company_id),
    ('sector', 'Technology',        'Technology',        true, v_company_id),
    ('sector', 'Healthcare',        'Healthcare',        true, v_company_id),
    ('sector', 'Manufacturing',     'Manufacturing',     true, v_company_id),
    ('sector', 'Government',        'Government',        true, v_company_id),
    ('sector', 'Education',         'Education',         true, v_company_id),
    ('sector', 'Oil & Gas',         'Oil & Gas',         true, v_company_id)
  ON CONFLICT DO NOTHING;

  -- grade_lead
  INSERT INTO public.master_options (option_type, label, value, is_active, company_id)
  VALUES
    ('grade_lead', 'A', 'A', true, v_company_id),
    ('grade_lead', 'B', 'B', true, v_company_id),
    ('grade_lead', 'C', 'C', true, v_company_id),
    ('grade_lead', 'D', 'D', true, v_company_id)
  ON CONFLICT DO NOTHING;

END $$;;
