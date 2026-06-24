-- Drop all temporary diagnostic functions used to debug the client_companies
-- delete/RLS investigation. None belong in production.
DROP FUNCTION IF EXISTS public._diag_check_as_user2(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public._diag_recent_companies();
DROP FUNCTION IF EXISTS public._diag_try_soft_delete(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_try_soft_delete2(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_dump_update_policy();
DROP FUNCTION IF EXISTS public._diag_all_policies();
DROP FUNCTION IF EXISTS public._diag_triggers();
