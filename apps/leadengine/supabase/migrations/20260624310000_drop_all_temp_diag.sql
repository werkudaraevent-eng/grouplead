-- Clean up ALL temporary diagnostic objects from the client_companies /
-- contacts RLS investigation. Restores production to a clean state.
DROP FUNCTION IF EXISTS public._diag_check_as_user2(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public._diag_recent_companies();
DROP FUNCTION IF EXISTS public._diag_try_soft_delete(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_try_soft_delete2(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_dump_update_policy();
DROP FUNCTION IF EXISTS public._diag_all_policies();
DROP FUNCTION IF EXISTS public._diag_triggers();
DROP FUNCTION IF EXISTS public._diag_rls_update(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_helper_as_auth(uuid);
DROP FUNCTION IF EXISTS public._diag_rls_full(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_helper_src();
DROP FUNCTION IF EXISTS public._diag_matrix_log(uuid, text, text);
DROP FUNCTION IF EXISTS public._diag_rls_commit(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_grants();
DROP FUNCTION IF EXISTS public._diag_variants(uuid, uuid);
DROP FUNCTION IF EXISTS public._diag_compare(uuid, bigint, uuid);
DROP FUNCTION IF EXISTS public._diag_all3();
DROP TABLE IF EXISTS public._diag_capture;
