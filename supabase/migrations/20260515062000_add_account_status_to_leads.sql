-- Adds a per-lead Account Status field so each lead carries its own
-- account-relationship status independently of its client_company. This
-- supports the workflow where the same client can present a "New" deal
-- alongside a "Repeater" deal, and frees Sales from having to ask another
-- rep for the company-wide history.
--
-- The companion `account_status_source` column tracks how the value got
-- there ('computed' from history, or 'manual' when a user explicitly set
-- it) so the UI can show a small affordance like "Auto-detected" vs
-- "Manually set".
--
-- Existing leads are backfilled from their client_company's account_status
-- so no record is left blank. Backfilled rows are flagged as 'manual' to
-- avoid overwriting them later if any future recompute job runs — they
-- represent a value that was effectively set by an earlier process and we
-- prefer to be conservative.

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS account_status text,
    ADD COLUMN IF NOT EXISTS account_status_source text;

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_account_status_source_check;

ALTER TABLE public.leads
    ADD CONSTRAINT leads_account_status_source_check
    CHECK (account_status_source IS NULL OR account_status_source IN ('computed', 'manual'));

COMMENT ON COLUMN public.leads.account_status IS
    'Per-lead account relationship status (new, repeater, contracted). Mirrors client_companies.account_status semantics but lives on the lead so the same client can have differently-classified deals.';

COMMENT ON COLUMN public.leads.account_status_source IS
    'How the account_status value was set: ''computed'' when populated from history at lead creation, ''manual'' when explicitly chosen by a user.';

-- Backfill existing leads from their client_company's status. Leads
-- without a client_company keep account_status = NULL.
UPDATE public.leads l
   SET account_status = cc.account_status,
       account_status_source = 'manual'
  FROM public.client_companies cc
 WHERE l.client_company_id = cc.id
   AND l.account_status IS NULL
   AND cc.account_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_account_status_idx
    ON public.leads (account_status);
