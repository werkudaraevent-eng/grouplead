ALTER TABLE public.client_companies ADD COLUMN account_status text DEFAULT 'new';
COMMENT ON COLUMN public.client_companies.account_status IS 'Account relationship status: new, repeater, contracted';;
