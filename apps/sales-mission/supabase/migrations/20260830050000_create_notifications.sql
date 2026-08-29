-- In-app notifications.
--
-- Delivery is in-app only for now. Email and WhatsApp are in the spec but each
-- needs a provider, a template approval and an audit trail — none of which
-- should be half-built behind a table that pretends to send them.

BEGIN;

CREATE TABLE IF NOT EXISTS sales_mission.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  event_type text NOT NULL,
  title text NOT NULL,
  body text,

  -- Where the notification takes you. Nullable because not every event will be
  -- about a specific mission.
  mission_id uuid REFERENCES sales_mission.missions(id) ON DELETE CASCADE,

  -- Who caused it, so the UI can say "Nadia joined" rather than "someone did".
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT notifications_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT notifications_event_check CHECK (event_type IN (
    'MISSION_ASSIGNED',
    'MISSION_JOINED',
    'MISSION_LEFT',
    'ASSIGNMENT_ACCEPTED',
    'ASSIGNMENT_REJECTED',
    'RESCHEDULE_REQUESTED',
    'RESCHEDULE_APPROVED',
    'RESCHEDULE_REJECTED',
    'RESULT_SUBMITTED',
    'NEEDS_CLARIFICATION',
    'LEAD_PUSHED'
  ))
);

-- The unread badge is the hottest read in the app, so it gets its own index.
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON sales_mission.notifications(recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_inbox_idx
  ON sales_mission.notifications(recipient_id, created_at DESC);

ALTER TABLE sales_mission.notifications ENABLE ROW LEVEL SECURITY;

-- You read your own notifications and nobody else's, even inside your tenant.
CREATE POLICY notifications_select ON sales_mission.notifications
  FOR SELECT USING (recipient_id = auth.uid());

-- Anyone in the tenant may create one for a colleague: accepting an assignment
-- notifies the primary, joining notifies them too. The recipient is not the
-- author, so this cannot be `recipient_id = auth.uid()`.
CREATE POLICY notifications_insert ON sales_mission.notifications
  FOR INSERT WITH CHECK (sales_mission.user_has_company_access(company_id));

-- Marking as read is the only update, and only on your own row.
CREATE POLICY notifications_update ON sales_mission.notifications
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

COMMIT;
