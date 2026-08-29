import { createClient } from "@/utils/supabase/server"
import type { SalesMissionAccess } from "@/lib/sales-mission-access"
import { buildNotifications, type NotificationContext, type NotificationEvent } from "./notifications"

export interface NotificationRow {
  id: string
  eventType: NotificationEvent
  title: string
  body: string | null
  missionId: string | null
  readAt: string | null
  createdAt: string
}

/**
 * Send a notification to everyone who should hear about an event.
 *
 * Best-effort on purpose: a mission that saved must not fail because a
 * notification could not be written. Silence is a smaller problem than a lost
 * mission, and the action that triggered this has already succeeded.
 */
export async function notify(
  access: SalesMissionAccess,
  event: NotificationEvent,
  recipientIds: string[],
  context: Omit<NotificationContext, "actorId" | "actorName">
): Promise<void> {
  const drafts = buildNotifications(event, recipientIds, {
    ...context,
    actorId: access.userId,
    actorName: access.displayName,
  })

  if (drafts.length === 0) return

  try {
    const supabase = await createClient()
    await supabase.schema("sales_mission").from("notifications").insert(
      drafts.map((draft) => ({
        company_id: access.companyId,
        recipient_id: draft.recipientId,
        event_type: draft.eventType,
        title: draft.title,
        body: draft.body,
        mission_id: draft.missionId,
        actor_id: access.userId,
      }))
    )
  } catch {
    // Deliberately swallowed — see the note above.
  }
}

/** Recent notifications for the signed-in user, newest first. */
export async function listNotifications(
  access: SalesMissionAccess,
  limit = 30
): Promise<NotificationRow[]> {
  const supabase = await createClient()

  const { data } = await supabase
    .schema("sales_mission")
    .from("notifications")
    .select("id, event_type, title, body, mission_id, read_at, created_at")
    .eq("recipient_id", access.userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  return (data ?? []).map((row) => ({
    id: row.id as string,
    eventType: row.event_type as NotificationEvent,
    title: row.title as string,
    body: (row.body as string | null) ?? null,
    missionId: (row.mission_id as string | null) ?? null,
    readAt: (row.read_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }))
}

/** Unread count for the sidebar badge. Head-only — no rows come back. */
export async function countUnreadNotifications(access: SalesMissionAccess): Promise<number> {
  const supabase = await createClient()

  const { count } = await supabase
    .schema("sales_mission")
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", access.userId)
    .is("read_at", null)

  return count ?? 0
}
