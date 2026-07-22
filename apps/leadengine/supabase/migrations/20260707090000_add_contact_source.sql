-- Add optional contact-level source/channel attribution.
-- This is user-facing CRM source (e.g. Event, Referral, Sales Mission),
-- separate from system provenance/audit metadata.

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS contact_source text;

COMMENT ON COLUMN public.contacts.contact_source IS
  'Optional contact acquisition/source channel, selected from master_options option_type=contact_source.';

-- Seed contact_source options from the existing lead_source taxonomy so admins
-- do not need to maintain a blank list on first deploy. Keep the values global
-- (company_id NULL) and avoid duplicates by normalized value.
INSERT INTO public.master_options (option_type, label, value, is_active, company_id, sort_order)
SELECT
  'contact_source' AS option_type,
  mo.label,
  mo.value,
  mo.is_active,
  NULL::uuid AS company_id,
  COALESCE(mo.sort_order, 0) AS sort_order
FROM public.master_options mo
WHERE mo.option_type = 'lead_source'
  AND mo.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.master_options existing
    WHERE existing.option_type = 'contact_source'
      AND lower(trim(existing.value)) = lower(trim(mo.value))
  );
