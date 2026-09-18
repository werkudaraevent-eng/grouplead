-- Undo a join, quietly.
--
-- Join is one tap and easy to hit by accident while scrolling, so the app
-- offers "Batalkan" for a few seconds afterwards. Leaving normally would tell
-- the sales utama that someone joined and then left; an undo within the window
-- should leave no trace at all. That needs three deletes the caller's own
-- policies do not allow (notifications and status_history have no delete
-- policy), so they run here as one definer function, limited to the caller's
-- own very recent join.

BEGIN;

CREATE OR REPLACE FUNCTION sales_mission.fn_undo_join(p_mission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sales_mission, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_since timestamptz := timezone('utc', now()) - interval '2 minutes';
  v_deleted integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM sales_mission.assignments
  WHERE mission_id = p_mission_id
    AND user_id = v_user
    AND assignment_role = 'SUPPORTING'
    AND created_at >= v_since;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN
    RETURN false;
  END IF;

  DELETE FROM sales_mission.notifications
  WHERE mission_id = p_mission_id
    AND actor_id = v_user
    AND event_type = 'MISSION_JOINED'
    AND read_at IS NULL
    AND created_at >= v_since;

  DELETE FROM sales_mission.status_history
  WHERE mission_id = p_mission_id
    AND changed_by = v_user
    AND reason LIKE '% bergabung sebagai sales pendukung'
    AND created_at >= v_since;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION sales_mission.fn_undo_join(uuid) FROM public;
GRANT EXECUTE ON FUNCTION sales_mission.fn_undo_join(uuid) TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
