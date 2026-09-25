import { describe, expect, it } from "vitest"
import {
    activityKind,
    activityTime,
    activityTitle,
    buildFeed,
    COMPOSER_KINDS,
    composerPlaceholder,
    emptyFieldsToggleLabel,
    externalHref,
    feedFilterOptions,
    feedHeadline,
    filterFeed,
    firstName,
    formatCalendarDay,
    formatDayTime,
    isBlank,
    isMirroredNote,
    joinFacts,
    lastActivityLabel,
    revealScrollTop,
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
    const ids = ["overview", "activity", "leads"] as const

    it("open the tab the address names, an alias, or the first", () => {
        expect(readRecordTab("leads", ids)).toBe("leads")
        expect(readRecordTab(["activity", "leads"], ids)).toBe("activity")
        expect(readRecordTab("timeline", ids, { timeline: "activity" })).toBe("activity")
        expect(readRecordTab("nope", ids)).toBe("overview")
        expect(readRecordTab(undefined, ids)).toBe("overview")
    })

    it("keep the rest of the query and leave the default out", () => {
        expect(withRecordTab("?from=list", "leads", "overview")).toBe("from=list&tab=leads")
        expect(withRecordTab("tab=leads&from=list", "overview", "overview")).toBe("from=list")
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
    const row = (id: string, action_type: string, description: string, hours: number, who: string | null = "Hanung Prasetyo"): ActivityRow => ({
        id, action_type, description, created_at: hoursAgo(hours), profile: who ? { full_name: who } : null,
    })

    it("names each kind of timeline row", () => {
        expect(activityKind("Call")).toBe("call")
        expect(activityKind("Meeting")).toBe("meeting")
        expect(activityKind("meeting")).toBe("meeting")
        expect(activityKind("Email")).toBe("email")
        expect(activityKind("Task")).toBe("task")
        expect(activityKind("note")).toBe("note")
        expect(activityKind("File Uploaded")).toBe("file")
        expect(activityKind("File Deleted")).toBe("file")
        expect(activityKind("update")).toBe("update")
        expect(activityKind("delete")).toBe("delete")
        expect(activityKind("Stage Change")).toBe("stage")
        expect(activityKind("merge")).toBe("other")
        expect(activityTitle("call")).toBe("Call logged")
        expect(activityTitle("file", "File Uploaded")).toBe("File uploaded")
    })

    it("knows the database's copy of a note", () => {
        expect(isMirroredNote({ action_type: "note", description: 'Added a note: "Prefers WhatsApp"' })).toBe(true)
        expect(isMirroredNote({ action_type: "Note", description: "Logged by hand" })).toBe(false)
        expect(isMirroredNote({ action_type: "delete", description: "Deleted a note" })).toBe(false)
    })

    it("merges the notes in place of their copies, newest first", () => {
        const notes: NoteRow[] = [{ id: "n1", content: "Prefers WhatsApp over email.", author_name: "Rini", user_id: "u2", created_at: hoursAgo(5) }]
        const feed = buildFeed([
            row("a1", "note", 'Added a note: "Prefers WhatsApp over email."', 5, "Rini"),
            row("a2", "Call", "Send the proposal by Friday.", 48),
            row("a3", "update", "Changed record owner", 1, null),
            row("a4", "Note", "Old note from the dialog", 200),
        ], notes)
        expect(feed.map((item) => item.key)).toEqual(["a:a3", "n:n1", "a:a2", "a:a4"])
        expect(feed[1]).toMatchObject({ kind: "note", actor: "Rini", detail: "Prefers WhatsApp over email.", note: { id: "n1", userId: "u2" } })
        expect(feed[0]).toMatchObject({ kind: "update", title: "Details updated", actor: null, note: null })
        expect(feedHeadline(feed[2])).toBe("Call logged by Hanung Prasetyo")
        expect(feedHeadline(feed[0])).toBe("Details updated")
        expect(feedHeadline(feed[2], true)).toBe("Call · Hanung P.")
        expect(feedHeadline(feed[1], true)).toBe("Note · Rini")
        expect(feedHeadline(feed[0], true)).toBe("Updated")
    })

    it("says when, relative for a week and then the day; compact on a phone", () => {
        expect(activityTime(hoursAgo(0), now)).toBe("just now")
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

    it("counts only contact with someone as the last activity", () => {
        const feed = buildFeed([
            row("a1", "update", "Changed record owner", 1),
            row("a2", "File Uploaded", 'Uploaded file "deck.pdf"', 2),
            row("a3", "Call", "Send the proposal by Friday.", 48),
        ])
        expect(lastActivityLabel(feed, now)).toBe("Call · 2 days ago")
        expect(lastActivityLabel(buildFeed([row("a1", "update", "x", 1)]), now)).toBeNull()
    })

    it("filters the feed and offers only the filters with something in them", () => {
        const feed = buildFeed([
            row("a1", "update", "Changed record owner", 1),
            row("a2", "Call", "Proposal", 2),
            row("a3", "Meeting", "Kick-off", 3),
        ])
        expect(filterFeed(feed, "call").map((item) => item.key)).toEqual(["a:a2"])
        expect(filterFeed(feed, "changes").map((item) => item.key)).toEqual(["a:a1"])
        expect(filterFeed(feed, "all")).toHaveLength(3)
        expect(feedFilterOptions(feed).map((filter) => filter.id)).toEqual(["all", "call", "meeting", "changes"])
    })
})

describe("the composer", () => {
    it("logs a note and the kinds the Log Activity dialog wrote, plus calls", () => {
        expect(COMPOSER_KINDS.map((kind) => kind.label)).toEqual(["Note", "Log call", "Log email", "Log meeting", "Task"])
        expect(COMPOSER_KINDS.map((kind) => kind.actionType)).toEqual([null, "Call", "Email", "Meeting", "Task"])
        expect(COMPOSER_KINDS.every((kind) => kind.actionType === null || activityKind(kind.actionType) === kind.id)).toBe(true)
    })

    it("prompts about the person or the company", () => {
        expect(composerPlaceholder("note", "Abdan")).toBe("Write a note about Abdan — meeting summary, preferences…")
        expect(composerPlaceholder("call", "Elitery")).toContain("the call with Elitery")
        expect(composerPlaceholder("note", " ")).toBe("Write a note about them — meeting summary, preferences…")
    })
})

describe("scrolling", () => {
    // A 900px scroller with the tabs (43px) pinned at its top.
    const view = { viewHeight: 900, pinned: 43 }

    it("leaves the page where it is when the target already shows whole", () => {
        expect(revealScrollTop({ ...view, scrollTop: 0, top: 267, height: 186 })).toBeNull()
        expect(revealScrollTop({ ...view, scrollTop: 150, top: 267, height: 186 })).toBeNull()
    })

    it("brings a target hidden under the pinned tabs to just below them", () => {
        // Scrolled so the composer's top is behind the tabs.
        expect(revealScrollTop({ ...view, scrollTop: 250, top: 267, height: 186 })).toBe(267 - 43 - 16)
    })

    it("brings a target below the fold up to just below the tabs", () => {
        expect(revealScrollTop({ ...view, scrollTop: 0, top: 1400, height: 186 })).toBe(1400 - 43 - 16)
        // Cut by the foot of the view.
        expect(revealScrollTop({ ...view, scrollTop: 0, top: 800, height: 186 })).toBe(800 - 43 - 16)
    })

    it("shows the top of a target taller than the view", () => {
        expect(revealScrollTop({ ...view, scrollTop: 0, top: 300, height: 2000 })).toBe(300 - 43 - 16)
    })

    it("never goes above the page's top, and takes its own gap", () => {
        expect(revealScrollTop({ ...view, scrollTop: 40, top: 20, height: 100 })).toBe(0)
        expect(revealScrollTop({ ...view, scrollTop: 600, top: 500, height: 100, gap: 0 })).toBe(457)
    })
})
