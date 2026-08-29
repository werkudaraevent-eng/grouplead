/**
 * Notification content.
 *
 * Wording lives here, apart from the code that sends it, so a message can be
 * asserted in a test rather than read out of a server action. The rule the
 * tests protect: nobody is ever notified about their own action. A person who
 * just pressed accept does not need telling that they accepted.
 */

export const NOTIFICATION_EVENTS = [
  "MISSION_ASSIGNED",
  "MISSION_JOINED",
  "MISSION_LEFT",
  "ASSIGNMENT_ACCEPTED",
  "ASSIGNMENT_REJECTED",
  "RESCHEDULE_REQUESTED",
  "RESCHEDULE_APPROVED",
  "RESCHEDULE_REJECTED",
  "RESULT_SUBMITTED",
  "NEEDS_CLARIFICATION",
  "LEAD_PUSHED",
] as const

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]

export interface NotificationDraft {
  recipientId: string
  eventType: NotificationEvent
  title: string
  body: string | null
  missionId: string | null
}

export interface NotificationContext {
  actorId: string
  actorName: string
  missionId: string
  clientName: string
}

/** Message text per event. Kept short: a notification is a pointer, not a report. */
export function describeEvent(event: NotificationEvent, context: NotificationContext): { title: string; body: string } {
  const client = context.clientName

  switch (event) {
    case "MISSION_ASSIGNED":
      return { title: "Kamu ditugaskan pada mission baru", body: `${client} — ditugaskan oleh ${context.actorName}` }
    case "MISSION_JOINED":
      return { title: `${context.actorName} bergabung ke mission`, body: `${client}` }
    case "MISSION_LEFT":
      return { title: `${context.actorName} keluar dari mission`, body: `${client}` }
    case "ASSIGNMENT_ACCEPTED":
      return { title: `${context.actorName} menerima penugasan`, body: `${client}` }
    case "ASSIGNMENT_REJECTED":
      return { title: `${context.actorName} menolak penugasan`, body: `${client}` }
    case "RESCHEDULE_REQUESTED":
      return { title: `${context.actorName} meminta jadwal ulang`, body: `${client} — menunggu keputusan` }
    case "RESCHEDULE_APPROVED":
      return { title: "Jadwal mission diubah", body: `${client} — disetujui oleh ${context.actorName}` }
    case "RESCHEDULE_REJECTED":
      return { title: "Permintaan jadwal ulang ditolak", body: `${client} — diputuskan oleh ${context.actorName}` }
    case "RESULT_SUBMITTED":
      return { title: `${context.actorName} mengirim laporan kunjungan`, body: `${client}` }
    case "NEEDS_CLARIFICATION":
      return { title: "Laporan perlu klarifikasi", body: `${client} — diminta oleh ${context.actorName}` }
    case "LEAD_PUSHED":
      return { title: "Lead baru dari Sales Mission", body: `${client} — dikirim oleh ${context.actorName}` }
  }
}

/**
 * Build one notification per recipient, excluding the person who acted.
 *
 * Deduplicates too: someone who is both primary and next-action owner should
 * get one notification, not two.
 */
export function buildNotifications(
  event: NotificationEvent,
  recipientIds: string[],
  context: NotificationContext
): NotificationDraft[] {
  const { title, body } = describeEvent(event, context)

  const recipients = [...new Set(recipientIds)].filter(
    (id) => Boolean(id) && id !== context.actorId
  )

  return recipients.map((recipientId) => ({
    recipientId,
    eventType: event,
    title,
    body,
    missionId: context.missionId,
  }))
}
