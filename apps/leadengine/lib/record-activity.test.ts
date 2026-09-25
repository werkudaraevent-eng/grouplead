import { describe, expect, it } from "vitest"
import {
    activityColumns,
    activityPeopleIds,
    canCompleteFollowUp,
    canManageActivity,
    canManageNote,
    combineLocal,
    COMPOSER_KINDS,
    composerSchema,
    draftFromActivity,
    dueAtFromDay,
    emptyDraft,
    isAdminRole,
    isLoggedActivity,
    isOpenFollowUp,
    localDay,
    localTime,
    normalizeMeetingUrl,
    notePlaceholder,
    parseDraft,
    shiftDay,
    visibleErrors,
    withCurrentTime,
    type ActivityRow,
    type ComposerDraft,
    type LoggedInput,
} from "./record-activity"

const now = new Date(2026, 8, 25, 14, 5)
const draft = (patch: Partial<ComposerDraft> = {}): ComposerDraft => ({ ...emptyDraft(now, "u1"), ...patch })

describe("the composer's kinds", () => {
    it("are Note, Log call, Log meeting, Log email and Follow-up, each with its button", () => {
        // "Log …", never the header's Call or Send email, which reach the person.
        expect(COMPOSER_KINDS.map((kind) => kind.label)).toEqual(["Note", "Log call", "Log meeting", "Log email", "Follow-up"])
        expect(COMPOSER_KINDS.map((kind) => kind.action)).toEqual(["Save note", "Log call", "Log meeting", "Log email", "Add follow-up"])
    })

    it("prompts a note about the person or the company", () => {
        expect(notePlaceholder("Abdan")).toBe("Write a note about Abdan — meeting summary, preferences…")
        expect(notePlaceholder(" ")).toBe("Write a note about them — meeting summary, preferences…")
    })
})

describe("days and times", () => {
    it("read the reader's own day and clock", () => {
        expect(localDay(now)).toBe("2026-09-25")
        expect(localTime(now)).toBe("14:05")
        expect(shiftDay("2026-09-30", 2)).toBe("2026-10-02")
        expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28")
    })

    it("join a day and a time, and refuse what is not one", () => {
        expect(combineLocal("2026-09-25", "14:05")?.getTime()).toBe(now.getTime())
        expect(combineLocal("2026-02-30", "10:00")).toBeNull()
        expect(combineLocal("2026-09-25", "25:00")).toBeNull()
        expect(combineLocal("", "10:00")).toBeNull()
        expect(dueAtFromDay("2026-09-26")?.getHours()).toBe(12)
    })

    it("start a form now, due tomorrow, assigned to whoever writes it", () => {
        expect(emptyDraft(now, "u1")).toMatchObject({ date: "2026-09-25", time: "14:05", dueDate: "2026-09-26", assigneeId: "u1", whenTouched: false })
    })

    it("keep a chosen time and follow the clock otherwise", () => {
        const later = new Date(2026, 8, 25, 16, 40)
        expect(withCurrentTime(draft(), later)).toMatchObject({ time: "16:40" })
        expect(withCurrentTime(draft({ time: "09:00", whenTouched: true }), later)).toMatchObject({ time: "09:00" })
    })
})

describe("what each kind needs", () => {
    it("a note needs its words", () => {
        expect(parseDraft("note", draft({ text: "  " }), now).ok).toBe(false)
        expect(parseDraft("note", draft({ text: " Prefers WhatsApp " }), now)).toEqual({ ok: true, input: { kind: "note", text: "Prefers WhatsApp" } })
    })

    it("a call needs its outcome and a time that has passed", () => {
        expect(parseDraft("call", draft(), now)).toMatchObject({ ok: false, errors: { outcome: "Choose how the call went" } })
        const result = parseDraft("call", draft({ outcome: "connected", text: "Budget agreed" }), now)
        expect(result).toMatchObject({ ok: true, input: { kind: "call", outcome: "connected", notes: "Budget agreed" } })
        const future = parseDraft("call", draft({ outcome: "busy", time: "15:00", whenTouched: true }), now)
        expect(future).toMatchObject({ ok: false, errors: { when: "Can't be in the future" } })
        // The minute being typed in is not the future.
        expect(parseDraft("call", draft({ outcome: "busy", time: "14:06" }), now).ok).toBe(true)
    })

    it("a meeting needs in person or online; a link, when given, must be one", () => {
        expect(parseDraft("meeting", draft(), now)).toMatchObject({ ok: false, errors: { meetingMode: "Choose in person or online" } })
        expect(parseDraft("meeting", draft({ meetingMode: "in_person", location: "The Manhattan Square" }), now)).toMatchObject({
            ok: true, input: { kind: "meeting", mode: "in_person", location: "The Manhattan Square", meetingUrl: null },
        })
        expect(parseDraft("meeting", draft({ meetingMode: "online" }), now)).toMatchObject({ ok: true, input: { meetingUrl: null } })
        expect(parseDraft("meeting", draft({ meetingMode: "online", meetingUrl: "meet.google.com/abc-defg-hij" }), now)).toMatchObject({
            ok: true, input: { meetingUrl: "https://meet.google.com/abc-defg-hij" },
        })
        expect(parseDraft("meeting", draft({ meetingMode: "online", meetingUrl: "not a link" }), now)).toMatchObject({ ok: false, errors: { meetingUrl: expect.stringContaining("Enter a link") } })
        // A link typed before switching to in person is not checked or kept.
        expect(parseDraft("meeting", draft({ meetingMode: "in_person", meetingUrl: "not a link" }), now)).toMatchObject({ ok: true, input: { meetingUrl: null } })
    })

    it("an email needs its subject and a time that has passed", () => {
        expect(parseDraft("email", draft(), now)).toMatchObject({ ok: false, errors: { subject: "Write the subject" } })
        expect(parseDraft("email", draft({ subject: "Proposal v2" }), now)).toMatchObject({ ok: true, input: { kind: "email", subject: "Proposal v2", summary: "" } })
        expect(parseDraft("email", draft({ subject: "x", date: "2026-09-26", whenTouched: true }), now).ok).toBe(false)
    })

    it("a follow-up needs a title and a due day; the person is optional", () => {
        expect(parseDraft("follow_up", draft(), now)).toMatchObject({ ok: false, errors: { title: "Write what needs doing" } })
        expect(parseDraft("follow_up", draft({ title: "Send the proposal", dueDate: "" }), now)).toMatchObject({ ok: false, errors: { dueDate: "Choose the due date" } })
        const result = parseDraft("follow_up", draft({ title: "Send the proposal", assigneeId: null }), now)
        expect(result).toMatchObject({ ok: true, input: { kind: "follow_up", title: "Send the proposal", assigneeId: null } })
        // A due day in the past is allowed: it is simply overdue.
        expect(parseDraft("follow_up", draft({ title: "Late", dueDate: "2026-09-01" }), now).ok).toBe(true)
    })

    it("shows an error only on a field that holds something", () => {
        const empty = draft({ outcome: null })
        expect(visibleErrors(parseDraft("call", empty, now), empty)).toEqual({})
        const future = draft({ outcome: "busy", time: "18:00" })
        expect(visibleErrors(parseDraft("call", future, now), future)).toEqual({ when: "Can't be in the future" })
    })

    it("checks the saved shape against the same schema", () => {
        expect(composerSchema(now).safeParse({ kind: "call", outcome: "voicemail", occurredAt: now, notes: "" }).success).toBe(false)
        expect(composerSchema(now).safeParse({ kind: "note", text: "x".repeat(10_001) }).success).toBe(false)
    })
})

describe("links", () => {
    it("open with https when they name no scheme, and are refused when they are not links", () => {
        expect(normalizeMeetingUrl("meet.google.com/abc")).toBe("https://meet.google.com/abc")
        expect(normalizeMeetingUrl(" https://zoom.us/j/123?pwd=x ")).toBe("https://zoom.us/j/123?pwd=x")
        expect(normalizeMeetingUrl("javascript:alert(1)")).toBeNull()
        expect(normalizeMeetingUrl("ftp://files.example.com")).toBeNull()
        expect(normalizeMeetingUrl("hello")).toBeNull()
        expect(normalizeMeetingUrl("")).toBeNull()
    })
})

describe("saving", () => {
    const at = new Date("2026-09-25T07:05:00.000Z")

    it("writes each kind with its action type and only its own columns", () => {
        const call: LoggedInput = { kind: "call", outcome: "no_answer", occurredAt: at, notes: " Try again Monday " }
        expect(activityColumns(call)).toEqual({
            action_type: "call", description: "Try again Monday", occurred_at: at.toISOString(), outcome: "no_answer",
            meeting_mode: null, location: null, meeting_url: null, subject: null, due_at: null, assignee_id: null,
        })
        const meeting: LoggedInput = { kind: "meeting", mode: "online", location: "Lobby", meetingUrl: "https://meet.google.com/x", occurredAt: at, summary: "" }
        expect(activityColumns(meeting)).toMatchObject({ action_type: "meeting", meeting_mode: "online", location: null, meeting_url: "https://meet.google.com/x", description: "" })
        const visit: LoggedInput = { kind: "meeting", mode: "in_person", location: " HQ ", meetingUrl: null, occurredAt: at, summary: "Agreed" }
        expect(activityColumns(visit)).toMatchObject({ meeting_mode: "in_person", location: "HQ", meeting_url: null })
        const email: LoggedInput = { kind: "email", subject: "Proposal v2", occurredAt: at, summary: "" }
        expect(activityColumns(email)).toMatchObject({ action_type: "email", subject: "Proposal v2", occurred_at: at.toISOString() })
        const followUp: LoggedInput = { kind: "follow_up", title: "Send it", dueAt: at, assigneeId: "u3", notes: "" }
        expect(activityColumns(followUp)).toMatchObject({ action_type: "follow_up", subject: "Send it", due_at: at.toISOString(), assignee_id: "u3", occurred_at: null })
    })

    it("opens a saved row back as its form", () => {
        const base: ActivityRow = { id: "a1", action_type: "call", description: "Budget agreed", created_at: now.toISOString(), occurred_at: new Date(2026, 8, 23, 9, 30).toISOString(), outcome: "connected" }
        expect(draftFromActivity(base, "u1")).toMatchObject({ kind: "call", draft: { outcome: "connected", text: "Budget agreed", date: "2026-09-23", time: "09:30", whenTouched: true } })
        // A call logged before outcomes asks for one.
        expect(draftFromActivity({ ...base, action_type: "Call", outcome: null, occurred_at: null }, "u1")).toMatchObject({ kind: "call", draft: { outcome: null, date: "2026-09-25", time: "14:05" } })
        expect(draftFromActivity({ ...base, action_type: "meeting", meeting_mode: "online", meeting_url: "https://x.co" }, "u1")).toMatchObject({ kind: "meeting", draft: { meetingMode: "online", meetingUrl: "https://x.co" } })
        expect(draftFromActivity({ ...base, action_type: "follow_up", subject: "Send it", due_at: new Date(2026, 9, 2, 12).toISOString(), assignee_id: "u3" }, "u1")).toMatchObject({
            kind: "follow_up", draft: { title: "Send it", dueDate: "2026-10-02", assigneeId: "u3" },
        })
        expect(draftFromActivity({ ...base, action_type: "update" }, "u1")).toBeNull()
    })
})

describe("the people a timeline names", () => {
    it("are its assignees and who ticked a follow-up done, each once", () => {
        expect(activityPeopleIds([
            { assignee_id: "u3", completed_by: null },
            { assignee_id: "u3", completed_by: "u2" },
            { assignee_id: null, completed_by: undefined },
        ])).toEqual(["u3", "u2"])
    })
})

describe("who may change what", () => {
    const viewer = { id: "u1", isAdmin: false }
    const admin = { id: "u9", isAdmin: true }
    const call = { action_type: "call", field_name: null, user_id: "u1" }

    it("is an admin as the database says it", () => {
        expect(isAdminRole("Super Admin")).toBe(true)
        expect(isAdminRole("admin")).toBe(true)
        expect(isAdminRole("sales")).toBe(false)
        expect(isAdminRole(null)).toBe(false)
    })

    it("lets the author or an admin change what a person logged, and nobody the history the system wrote", () => {
        expect(isLoggedActivity(call)).toBe(true)
        expect(isLoggedActivity({ action_type: "Task", field_name: null })).toBe(true)
        expect(isLoggedActivity({ action_type: "update", field_name: "owner_id" })).toBe(false)
        expect(isLoggedActivity({ action_type: "note", field_name: null })).toBe(false)
        expect(isLoggedActivity({ action_type: "File Uploaded", field_name: null })).toBe(false)
        // A Sales Activity visit carries its mission.
        expect(isLoggedActivity({ action_type: "meeting", field_name: "sales_mission:m1" })).toBe(false)
        expect(canManageActivity(call, viewer)).toBe(true)
        expect(canManageActivity({ ...call, user_id: "u2" }, viewer)).toBe(false)
        expect(canManageActivity({ ...call, user_id: "u2" }, admin)).toBe(true)
        expect(canManageActivity({ action_type: "update", field_name: null, user_id: "u9" }, admin)).toBe(false)
        expect(canManageActivity(call, { id: null, isAdmin: true })).toBe(false)
    })

    it("lets the person a follow-up is for tick it", () => {
        const followUp = { action_type: "follow_up", field_name: null, user_id: "u2", assignee_id: "u1", due_at: now.toISOString() }
        expect(canCompleteFollowUp(followUp, viewer)).toBe(true)
        expect(canCompleteFollowUp({ ...followUp, assignee_id: "u3" }, viewer)).toBe(false)
        expect(canCompleteFollowUp({ ...followUp, assignee_id: "u3" }, admin)).toBe(true)
        expect(canCompleteFollowUp({ ...followUp, due_at: null }, viewer)).toBe(false)
        expect(isOpenFollowUp({ action_type: "follow_up", due_at: now.toISOString(), completed_at: null })).toBe(true)
        expect(isOpenFollowUp({ action_type: "follow_up", due_at: now.toISOString(), completed_at: now.toISOString() })).toBe(false)
    })

    it("lets a note's author or an admin change it", () => {
        expect(canManageNote({ userId: "u1" }, viewer)).toBe(true)
        expect(canManageNote({ userId: "u2" }, viewer)).toBe(false)
        expect(canManageNote({ userId: "u2" }, admin)).toBe(true)
    })
})
