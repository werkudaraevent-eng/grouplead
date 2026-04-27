-- Company-level settings (general purpose)
-- First use case: currency display format
CREATE TABLE IF NOT EXISTS public.company_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    -- Currency display settings
    currency_format text NOT NULL DEFAULT 'compact',       -- 'compact' (M/B/T) or 'full' (all digits)
    currency_prefix text NOT NULL DEFAULT 'Rp',            -- 'Rp', 'IDR', or '' (none)
    UNIQUE(company_id)
);

-- RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view settings for their companies"
    ON public.company_settings FOR SELECT
    USING (company_id = ANY(public.fn_user_company_ids()));

CREATE POLICY "Users can manage settings for their companies"
    ON public.company_settings FOR ALL
    USING (company_id = ANY(public.fn_user_company_ids()))
    WITH CHECK (company_id = ANY(public.fn_user_company_ids()));
