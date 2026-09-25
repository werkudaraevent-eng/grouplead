import { describe, expect, it } from "vitest"
import {
    activityKind,
    activityTime,
    activityTitle,
    buildFeed,
    buildUpcoming,
    dueLabel,
    emptyFieldsToggleLabel,
    externalHref,
    feedByline,
    feedFilterOptions,
    filterFeed,
    firstName,
    formatCalendarDay,
    formatDayTime,
    isBlank,
    isMirroredNote,
    joinFacts,
    lastActivityLabel,
    leadStanding,
    leadSummaryLabel,
    mailtoHref,
    readRecordTab,
    splitEmptyFields,
    summarizeLeads,
    telHref,
    websiteLabel,
    whatsAppHref,
    withRecordTab,
    type ActivityRow,
    type NoteRow,
} from "./record-page"

describe("tabs", () => {
    const ids = ["activity", "leads", "files"] as const

    it("open the tab the address names, an alias, or the first", () => {
        expect(readRecordTab("leads", ids)).toBe("leads")
        expect(readRecordTab(["files", "leads"], ids)).toBe("files")
        expect(readRecordTab("overview", ids, { overview: "activity" })).toBe("activity")
        expect(readRecordTab("nope", ids)).toBe("activity")
        expect(readRecordTab(undefined, ids)).toBe("activity")
    })

    it("keep the rest of the query and leave the default out", () => {
        expect(withRecordTab("?from=list", "leads", "activity")).toBe("from=list&tab=leads")
        expect(withRecordTab("tab=leads&from=list", "activity", "activity")).toBe("from=list")
    })
})

describe("empty fields", () => {
    it("knows what is blank", () => {
        expect(isBlank(null)).toBe(true)
        expect(isBlank("  ")).toBe(true)
        expect(isBlank([])).toBe(true)
        expect(isBlank(["", null])).toBe(true)
        expect(isBlank("Jakarta")).toBe(false)
        expect(isBlank(0)).toBe(false)
        expect(isBlank(["a@b.co"])).toBe(false)
    })

    it("shows the filled, folds the empty ones a person can fill, drops the rest, in order", () => {
        const fields = [
            { key: "name", empty: false, fillable: true },
            { key: "dob", empty: true, fillable: true },
            { key: "disc", empty: true, fillable: false },
            { key: "unit", empty: false, fillable: false },
            { key: "address", empty: true, fillable: true },
        ]
        const { filled, empty } = splitEmptyFields(fields)
        expect(filled.map((field) => field.key)).toEqual(["name", "unit"])
        expect(empty.map((field) => field.key)).toEqual(["dob", "address"])
    })

    it("words the toggle for one and for many", () => {
        expect(emptyFieldsToggleLabel(1, false)).toBe("Show 1 empty field")
        expect(emptyFieldsToggleLabel(4, false)).toBe("Show 4 empty fields")
        expect(emptyFieldsToggleLabel(4, true)).toBe("Hide empty fields")
        expect(emptyFieldsToggleLabel(1, true)).toBe("Hide the empty field")
    })
})

describe("words", () => {
    it("joins the facts that exist", () => {
        expect(joinFacts(["IT Services", null, " ", "Jakarta Selatan"])).toBe("IT Services · Jakarta Selatan")
        expect(joinFacts([null, undefined])).toBe("")
    })

    it("takes a first name", () => {
        expect(firstName(" Abdan Falaha ")).toBe("Abdan")
        expect(firstName(null)).toBe("")
    })
})

describe("days", () => {
    it("reads a calendar day as that day, with a short month", () => {
        expect(formatCalendarDay("2026-09-03")).toBe("3 Sep 2026")
        expect(formatCalendarDay("1990-12-31")).toBe("31 Dec 1990")
    })

    it("reads a timestamp in the reader's own time", () => {
        const at = new Date(2026, 8, 25, 9, 5)
        expect(formatCalendarDay(at.toISOString())).toBe("25 Sep 2026")
        expect(formatDayTime(at.toISOString())).toBe("25 Sep 2026, 09:05")
    })

    it("gives nothing for nothing or a non-date", () => {
        expect(formatCalendarDay(null)).toBeNull()
        expect(formatCalendarDay("soon")).toBeNull()
        expect(formatDayTime(undefined)).toBeNull()
    })
})

describe("quick actions", () => {
    it("mails and calls only with a value", () => {
        expect(mailtoHref(" ana@x.co ")).toBe("mailto:ana@x.co")
        expect(mailtoHref("")).toBeNull()
        expect(telHref("+62 811-2836-676")).toBe("tel:+628112836676")
        expect(telHref("12")).toBeNull()
        expect(telHref(null)).toBeNull()
    })

    it("opens WhatsApp with the country code and no plus", () => {
        expect(whatsAppHref("+628112836676")).toBe("https://wa.me/628112836676")
        expect(whatsAppHref("0811-2836-676")).toBe("https://wa.me/628112836676")
        expect(whatsAppHref("+1 415 555 1234")).toBe("https://wa.me/14155551234")
        expect(whatsAppHref("123")).toBeNull()
        expect(whatsAppHref(undefined)).toBeNull()
    })

    it("opens an address without a scheme as https, and names it without one", () => {
        expect(externalHref("ana.id")).toBe("https://ana.id")
        expect(externalHref("http://ana.id")).toBe("http://ana.id")
        expect(websiteLabel("https://www.bankmandiri.co.id/")).toBe("www.bankmandiri.co.id")
        expect(websiteLabel("bankmandiri.co.id")).toBe("bankmandiri.co.id")
        expect(websiteLabel("  ")).toBeNull()
    })
})

describe("leads", () => {
    const money = (amount: number) => `Rp ${(amount / 1e9).toFixed(1)}B`
    const leads = [
        { estimated_value: 700_000_000, pipeline_stage: { name: "Proposal Sent", stage_type: "open" } },
        { estimated_value: 500_000_000, pipeline_stage: { name: "Negotiation" } },
        { estimated_value: 300_000_000, pipeline_stage: { name: "Closed Won", closed_status: "won" } },
        { estimated_value: null, pipeline_stage: { name: "Closed Lost", closed_status: "lost" } },
    ]

    it("stand where the stage's closed status says, then its name", () => {
        expect(leadStanding({ name: "Deal", stage_type: "closed", closed_status: "won" })).toBe("won")
        expect(leadStanding({ name: "Closed Won", stage_type: "closed", closed_status: "lost" })).toBe("lost")
        expect(leadStanding({ name: "Archived", stage_type: "closed", closed_status: null })).toBe("closed")
        expect(leadStanding({ name: "Turndown" })).toBe("lost")
        expect(leadStanding({ name: "Proposal Sent" })).toBe("open")
        expect(leadStanding(null)).toBe("open")
    })

    it("count the open ones, their value and the won ones, as one line", () => {
        expect(summarizeLeads(leads)).toEqual({ total: 4, open: 2, won: 1, openValue: 1_200_000_000 })
        expect(leadSummaryLabel(summarizeLeads(leads), money)).toBe("2 open · Rp 1.2B · 1 won")
    })

    it("leave out a zero value and no wins, and say nothing without leads", () => {
        expect(leadSummaryLabel(summarizeLeads([{ estimated_value: null, pipeline_stage: { name: "Lead Masuk" } }]), money)).toBe("1 open")
        expect(leadSummaryLabel(summarizeLeads([{ estimated_value: 5, pipeline_stage: { name: "Closed Lost" } }]), money)).toBe("0 open")
        expect(leadSummaryLabel(summarizeLeads([]), money)).toBeNull()
    })
})

describe("activity", () => {
    const now = new Date("2026-09-25T10:00:00Z")
    const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600_000).toISOString()
    const row = (id: string, action_type: string, description: string, hours: number, who: string | null = "Hanung Prasetyo", extra: Partial<ActivityRow> = {}): ActivityRow => ({
        id, action_type, description, created_at: hoursAgo(hours), profile: who ? { full_name: who } : null, ...extra,
    })
    const people = {
        u2: { full_name: "Setyorini Dewi", avatar_url: null },
        u3: { full_name: "Bagus Wicaksono", avatar_url: "https://x.co/b.png" },
    }

    it("names each kind of timeline row, old words and new", () => {
        expect(activityKind("Call")).toBe("call")
        expect(activityKind("call")).toBe("call")
        expect(activityKind("Meeting")).toBe("meeting")
        expect(activityKind("meeting")).toBe("meeting")
        expect(activityKind("Email")).toBe("email")
        expect(activityKind("Task")).toBe("follow_up")
        expect(activityKind("follow_up")).toBe("follow_up")
        expect(activityKind("note")).toBe("note")
        expect(activityKind("Note")).toBe("note")
        expect(activityKind("File Uploaded")).toBe("file")
        expect(activityKind("File Deleted")).toBe("file")
        expect(activityKind("update")).toBe("update")
        expect(activityKind("delete")).toBe("delete")
        expect(activityKind("Stage Change")).toBe("stage")
        expect(activityKind("merge")).toBe("other")
    })

    it("titles a row by what it holds", () => {
        expect(activityTitle({ action_type: "call", outcome: "connected" })).toBe("Call · Connected")
        expect(activityTitle({ action_type: "call", outcome: "call_back" })).toBe("Call · Call back requested")
        expect(activityTitle({ action_type: "Call" })).toBe("Call")
        expect(activityTitle({ action_type: "meeting", meeting_mode: "in_person", location: "The Manhattan Square" })).toBe("Meeting · In person · The Manhattan Square")
        expect(activityTitle({ action_type: "meeting", meeting_mode: "in_person", location: null })).toBe("Meeting · In person")
        // A location left from before the mode changed is not said.
        expect(activityTitle({ action_type: "meeting", meeting_mode: "online", location: "Lobby" })).toBe("Meeting · Online")
        expect(activityTitle({ action_type: "meeting" })).toBe("Meeting")
        expect(activityTitle({ action_type: "email", subject: "Proposal v2" })).toBe("Email · Proposal v2")
        expect(activityTitle({ action_type: "Email" })).toBe("Email")
        expect(activityTitle({ action_type: "follow_up", subject: "Send the proposal", due_at: hoursAgo(-24), completed_at: hoursAgo(1) })).toBe("Follow-up done · Send the proposal")
        expect(activityTitle({ action_type: "follow_up", subject: "Send the proposal", due_at: hoursAgo(-24) })).toBe("Follow-up · Send the proposal")
        expect(activityTitle({ action_type: "Task" })).toBe("Task")
        expect(activityTitle({ action_type: "File Uploaded" })).toBe("File uploaded")
        expect(activityTitle({ action_type: "update" })).toBe("Details updated")
    })

    it("knows the database's copy of a note", () => {
        expect(isMirroredNote({ action_type: "note", description: 'Added a note: "Prefers WhatsApp"' })).toBe(true)
        expect(isMirroredNote({ action_type: "Note", description: "Logged by hand" })).toBe(false)
        expect(isMirroredNote({ action_type: "delete", description: "Deleted a note" })).toBe(false)
    })

    it("merges the notes in place of their copies, newest first, by when it happened", () => {
        const notes: NoteRow[] = [{ id: "n1", content: "Prefers WhatsApp over email.", author_name: "Rini", user_id: "u2", created_at: hoursAgo(5) }]
        const feed = buildFeed([
            row("a1", "note", 'Added a note: "Prefers WhatsApp over email."', 5, "Rini"),
            // Logged just now, for a call two days ago.
            row("a2", "call", "Send the proposal by Friday.", 0, "Hanung Prasetyo", { outcome: "connected", occurred_at: hoursAgo(48) }),
            row("a3", "update", "Changed record owner", 1, null),
            row("a4", "Note", "Old note from the dialog", 200),
        ], notes)
        expect(feed.map((item) => item.key)).toEqual(["a:a3", "n:n1", "a:a2", "a:a4"])
        expect(feed[1]).toMatchObject({ kind: "note", actor: "Rini", detail: "Prefers WhatsApp over email.", note: { id: "n1", userId: "u2" }, row: null })
        expect(feed[0]).toMatchObject({ kind: "update", title: "Details updated", actor: null, note: null })
        expect(feed[2]).toMatchObject({ title: "Call · Connected", at: hoursAgo(48), row: { id: "a2" } })
        expect(feedByline(feed[2])).toBe("Hanung Prasetyo")
        expect(feedByline(feed[2], true)).toBe("Hanung P.")
        expect(feedByline(feed[0])).toBeNull()
    })

    it("keeps open follow-ups out of History and puts a done one in, when it was done, by who did it", () => {
        const feed = buildFeed([
            row("f1", "follow_up", "", 30, "Hanung Prasetyo", { subject: "Send the proposal", due_at: hoursAgo(-24), assignee_id: "u3" }),
            row("f2", "follow_up", "Sent by email", 30, "Hanung Prasetyo", { subject: "Call back Rudi", due_at: hoursAgo(10), assignee_id: "u3", completed_at: hoursAgo(2), completed_by: "u2" }),
            row("t1", "Task", "Prepare venue options", 60),
        ], [], people)
        expect(feed.map((item) => item.key)).toEqual(["a:f2", "a:t1"])
        expect(feed[0]).toMatchObject({ kind: "follow_up", title: "Follow-up done · Call back Rudi", actor: "Setyorini Dewi", at: hoursAgo(2), detail: "Sent by email" })
        expect(feed[1]).toMatchObject({ kind: "follow_up", title: "Task", actor: "Hanung Prasetyo" })
    })

    it("carries an online meeting's link", () => {
        const [item] = buildFeed([row("m1", "meeting", "", 1, "Hanung Prasetyo", { meeting_mode: "online", meeting_url: "https://meet.google.com/abc-defg-hij" })])
        expect(item).toMatchObject({ title: "Meeting · Online", link: "https://meet.google.com/abc-defg-hij" })
    })

    it("lists the open follow-ups, the one due first on top, with who they are for", () => {
        const upcoming = buildUpcoming([
            row("f1", "follow_up", "", 30, "Hanung Prasetyo", { subject: "Send the proposal", due_at: hoursAgo(-48), assignee_id: "u3" }),
            row("f2", "follow_up", "Bring the rate card", 30, "Hanung Prasetyo", { subject: "Visit the GA team", due_at: hoursAgo(24), assignee_id: "u2" }),
            row("f3", "follow_up", "", 30, "Hanung Prasetyo", { subject: " ", due_at: hoursAgo(-48), assignee_id: "gone" }),
            row("f4", "follow_up", "", 30, "Hanung Prasetyo", { subject: "Done already", due_at: hoursAgo(48), completed_at: hoursAgo(1) }),
            row("t1", "Task", "Old task", 60),
        ], people)
        expect(upcoming.map((item) => item.key)).toEqual(["a:f2", "a:f1", "a:f3"])
        expect(upcoming[0]).toMatchObject({ title: "Visit the GA team", detail: "Bring the rate card", assignee: { id: "u2", name: "Setyorini Dewi", avatarUrl: null } })
        expect(upcoming[1].assignee).toEqual({ id: "u3", name: "Bagus Wicaksono", avatarUrl: "https://x.co/b.png" })
        expect(upcoming[2]).toMatchObject({ title: "Follow-up", assignee: null })
    })

    it("says when a follow-up is due, and when it is overdue", () => {
        const at = new Date(2026, 8, 25, 9, 0)
        const day = (offset: number) => new Date(2026, 8, 25 + offset, 12, 0).toISOString()
        expect(dueLabel(day(0), at)).toEqual({ text: "Due today", overdue: false })
        expect(dueLabel(day(1), at)).toEqual({ text: "Due tomorrow", overdue: false })
        expect(dueLabel(day(8), at)).toEqual({ text: "Due 3 Oct", overdue: false })
        expect(dueLabel(day(-5), at)).toEqual({ text: "Overdue · 20 Sep", overdue: true })
        expect(dueLabel(new Date(2027, 0, 4, 12).toISOString(), at)).toEqual({ text: "Due 4 Jan 2027", overdue: false })
        expect(dueLabel("soon", at)).toEqual({ text: "", overdue: false })
    })

    it("says when, relative for a week and then the day; compact on a phone", () => {
        expect(activityTime(hoursAgo(0), now)).toBe("just now")
        expect(activityTime(hoursAgo(-0.01), now)).toBe("just now")
        expect(activityTime(hoursAgo(3), now)).toBe("3 hours ago")
        expect(activityTime(hoursAgo(48), now)).toBe("2 days ago")
        expect(activityTime(hoursAgo(24 * 13), now)).toBe(formatCalendarDay(hoursAgo(24 * 13)))
        expect(activityTime(hoursAgo(0), now, true)).toBe("now")
        expect(activityTime(hoursAgo(3), now, true)).toBe("3h")
        expect(activityTime(hoursAgo(48), now, true)).toBe("2d")
        expect(activityTime(hoursAgo(24 * 13), now, true)).toBe("12 Sep")
        expect(activityTime(hoursAgo(24 * 400), now, true)).toMatch(/ 2025$/)
        expect(activityTime("not a date", now)).toBe("")
    })

    it("counts only a note, a call, a meeting or an email as the last activity", () => {
        const feed = buildFeed([
            row("a1", "update", "Changed record owner", 1),
            row("a2", "File Uploaded", 'Uploaded file "deck.pdf"', 2),
            row("a4", "follow_up", "", 3, "Hanung Prasetyo", { subject: "Send it", due_at: hoursAgo(20), completed_at: hoursAgo(3), completed_by: "u2" }),
            row("a3", "call", "Send the proposal by Friday.", 48, "Hanung Prasetyo", { outcome: "busy" }),
        ], [], people)
        expect(lastActivityLabel(feed, now)).toBe("Call · 2 days ago")
        expect(lastActivityLabel(buildFeed([row("a1", "update", "x", 1)]), now)).toBeNull()
    })

    it("filters History and offers only the filters with something in them", () => {
        const feed = buildFeed([
            row("a1", "update", "Changed record owner", 1),
            row("a2", "call", "Proposal", 2, "Hanung Prasetyo", { outcome: "connected" }),
            row("a3", "Meeting", "Kick-off", 3),
            row("a4", "follow_up", "", 4, "Hanung Prasetyo", { subject: "Done", due_at: hoursAgo(4), completed_at: hoursAgo(4) }),
        ])
        expect(filterFeed(feed, "call").map((item) => item.key)).toEqual(["a:a2"])
        expect(filterFeed(feed, "follow_up").map((item) => item.key)).toEqual(["a:a4"])
        expect(filterFeed(feed, "changes").map((item) => item.key)).toEqual(["a:a1"])
        expect(filterFeed(feed, "all")).toHaveLength(4)
        expect(feedFilterOptions(feed).map((filter) => filter.label)).toEqual(["All", "Calls", "Meetings", "Follow-ups", "Changes"])
    })
})
