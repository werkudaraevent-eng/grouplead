import { describe, expect, it } from "vitest"
import {
  NOTIFICATION_EVENTS,
  buildNotifications,
  describeEvent,
  type NotificationContext,
} from "./notifications"

const ACTOR = "11111111-1111-4111-8111-111111111111"
const PRIMARY = "22222222-2222-4222-8222-222222222222"
const SUPPORT = "33333333-3333-4333-8333-333333333333"

const context: NotificationContext = {
  actorId: ACTOR,
  actorName: "Nadia Prameswari",
  missionId: "mission-1",
  clientName: "PT Arunika Kreasi",
}

describe("describeEvent", () => {
  it("produces a non-empty title and body for every event", () => {
    for (const event of NOTIFICATION_EVENTS) {
      const { title, body } = describeEvent(event, context)
      expect(title.trim().length).toBeGreaterThan(0)
      expect(body.trim().length).toBeGreaterThan(0)
    }
  })

  it("names the client so the notification is actionable without opening it", () => {
    for (const event of NOTIFICATION_EVENTS) {
      const { title, body } = describeEvent(event, context)
      expect(`${title} ${body}`).toContain("PT Arunika Kreasi")
    }
  })

  it("names the actor on events caused by a person", () => {
    expect(describeEvent("MISSION_JOINED", context).title).toContain("Nadia Prameswari")
    expect(describeEvent("ASSIGNMENT_ACCEPTED", context).title).toContain("Nadia Prameswari")
  })
})

describe("buildNotifications", () => {
  it("never notifies the person who acted", () => {
    const drafts = buildNotifications("MISSION_JOINED", [PRIMARY, ACTOR], context)
    expect(drafts.map((draft) => draft.recipientId)).toEqual([PRIMARY])
  })

  it("deduplicates a recipient listed twice", () => {
    const drafts = buildNotifications("RESULT_SUBMITTED", [PRIMARY, PRIMARY, SUPPORT], context)
    expect(drafts).toHaveLength(2)
  })

  it("drops blank recipient ids rather than writing an orphan row", () => {
    const drafts = buildNotifications("MISSION_ASSIGNED", [PRIMARY, ""], context)
    expect(drafts).toHaveLength(1)
  })

  it("returns nothing when the only recipient is the actor", () => {
    expect(buildNotifications("ASSIGNMENT_ACCEPTED", [ACTOR], context)).toEqual([])
  })

  it("attaches the mission so the notification can link somewhere", () => {
    const [draft] = buildNotifications("MISSION_JOINED", [PRIMARY], context)
    expect(draft.missionId).toBe("mission-1")
    expect(draft.eventType).toBe("MISSION_JOINED")
  })

  it("gives every recipient the same wording", () => {
    const drafts = buildNotifications("RESCHEDULE_REQUESTED", [PRIMARY, SUPPORT], context)
    expect(new Set(drafts.map((draft) => draft.title)).size).toBe(1)
  })
})
