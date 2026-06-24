-- Drop the temporary diagnostic functions used to debug the
-- client_companies RLS rejection. They exposed catalog/schema details to
-- authenticated users and must not linger in production.
DROP FUNCTION IF EXISTS public._diag_client_company_policies();
DROP FUNCTION IF EXISTS public._diag_client_company_columns();
DROP FUNCTION IF EXISTS public._diag_check_as_user(uuid, uuid, text, text);
