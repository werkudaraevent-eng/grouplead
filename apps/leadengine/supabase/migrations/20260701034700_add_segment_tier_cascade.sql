-- ============================================================
--  Segment Tier — top-level cascade parent above Segment
--  New hierarchy:  Segment Tier -> Segment -> Line Industry
--
--  "Segment Tier" is a per-tenant company custom field with two
--  values: "Main Segment" (7 segments) and "Secondary Segment"
--  (4 segments). It becomes the cascade parent of Segment, which
--  is already the parent of Line Industry.
--
--  Tenant: Werkudara Group (company_id 055a3295-b583-4140-87f3-ed0783803c0b)
--  All statements are idempotent (safe to replay).
-- ============================================================

DO $$
DECLARE
  v_company_id uuid := '055a3295-b583-4140-87f3-ed0783803c0b';
BEGIN

  -- 1) master_options: the two tier values --------------------------------
  INSERT INTO master_options (option_type, label, value, is_active, company_id, sort_order)
  SELECT 'custom_companies__segment_tier', 'Main Segment', 'Main Segment', true, v_company_id, 0
  WHERE NOT EXISTS (
    SELECT 1 FROM master_options
    WHERE option_type = 'custom_companies__segment_tier' AND value = 'Main Segment' AND company_id = v_company_id
  );

  INSERT INTO master_options (option_type, label, value, is_active, company_id, sort_order)
  SELECT 'custom_companies__segment_tier', 'Secondary Segment', 'Secondary Segment', true, v_company_id, 1
  WHERE NOT EXISTS (
    SELECT 1 FROM master_options
    WHERE option_type = 'custom_companies__segment_tier' AND value = 'Secondary Segment' AND company_id = v_company_id
  );

  -- 2) form_schemas: Segment Tier dropdown (required) ---------------------
  INSERT INTO form_schemas (company_id, module_name, field_name, field_key, field_type, is_required, options_category, is_active, sort_order)
  SELECT v_company_id, 'companies', 'Segment Tier', 'segment_tier', 'dropdown', true, 'custom_companies__segment_tier', true, 2
  WHERE NOT EXISTS (
    SELECT 1 FROM form_schemas
    WHERE module_name = 'companies' AND field_key = 'segment_tier' AND company_id = v_company_id
  );

  -- 3) cascade_relations: register segment -> segment_tier ----------------
  --    `||` overwrites the key if present, so replay is safe.
  UPDATE master_options
  SET value = (value::jsonb || '{"custom_companies__segment":"custom_companies__segment_tier"}'::jsonb)::text
  WHERE option_type = 'system_setting' AND label = 'cascade_relations';

  -- 4) Backfill parent_value on the 11 segment rows -----------------------
  UPDATE master_options SET parent_value = 'Main Segment'
  WHERE option_type = 'custom_companies__segment' AND value IN (
    'BFSI (Banking, Financial Services, and Insurance)',
    'Mining, Metals, Downstream & Energy',
    'Healthcare, Pharmaceuticals & Medical Associations',
    'FMCG (Fast-Moving Consumer Goods) & Consumer Retail',
    'International Organizations & Associations',
    'Technology & Agribusiness',
    'Travel, PCO (Professional Conference Organizers) & Related Ecosystems'
  );

  UPDATE master_options SET parent_value = 'Secondary Segment'
  WHERE option_type = 'custom_companies__segment' AND value IN (
    'Built Environment & Industrial Services',
    'Embassies & Community Organizations',
    'Others',
    'Public Sector & Education'
  );

  -- 5) Backfill client_companies.custom_data.segment_tier -----------------
  -- 5a) Companies WITH a segment: derive tier from that segment's parent_value.
  UPDATE client_companies cc
  SET custom_data = COALESCE(cc.custom_data, '{}'::jsonb) || jsonb_build_object('segment_tier', seg.parent_value)
  FROM master_options seg
  WHERE seg.option_type = 'custom_companies__segment'
    AND seg.value = cc.custom_data->>'segment'
    AND seg.parent_value IS NOT NULL
    AND (cc.custom_data->>'segment') IS NOT NULL
    AND (cc.custom_data->>'segment') <> '';

  -- 5b) Companies WITHOUT a segment: default to Secondary Segment.
  UPDATE client_companies
  SET custom_data = COALESCE(custom_data, '{}'::jsonb) || '{"segment_tier":"Secondary Segment"}'::jsonb
  WHERE (custom_data->>'segment') IS NULL OR (custom_data->>'segment') = '';

  -- 6) Form layout: place Segment Tier before Segment + mark required -----
  --    Idempotent: skip if already inserted.
  UPDATE master_options
  SET value = '{"tabs":{"identity":["native:owner_id","native:name","native:parent_id","native:sector","custom:segment_tier","custom:segment","native:line_industry","custom:account"],"contact":["native:street_address","native:city","native:postal_code","native:country","native:phone","native:website"],"hidden":["native:account_status"]},"requiredOverrides":["native:name","native:sector","native:line_industry","native:street_address","native:city","native:postal_code","native:country","native:phone","custom:segment","custom:segment_tier","native:parent_id","custom:account"],"visibilityRules":{},"tabSettings":{"identity":{"label":"Identity","isHidden":false,"sortOrder":0},"contact":{"label":"Contact","isHidden":false,"sortOrder":1}}}'
  WHERE option_type = 'system_setting' AND label = 'form_layout_config_companies'
    AND value NOT LIKE '%segment_tier%';

END $$;
