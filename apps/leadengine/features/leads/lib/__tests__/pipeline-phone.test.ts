import { describe, it, expect } from "vitest"
import {
    dateFactWord,
    dayKeyOf,
    defaultStageId,
    formatDay,
    gradeTone,
    leadChips,
    leadDateFact,
    leadInStage,
    localDayKey,
    readStageParam,
    resolveStageId,
    scrollLeftToCenter,
    stageCountLabel,
    stageOutcome,
    summarizeStages,
    temperatureTone,
    withStageParam,
} from "../pipeline-phone"
import type { PipelineStage } from "@/types"

const stage = (id: string, overrides: Partial<PipelineStage> = {}): PipelineStage => ({
    id,
    name: `Stage ${id}`,
    color: "blue",
    sort_order: 1,
    is_default: false,
    stage_type: "open",
    created_at: "",
    ...overrides,
})

const lead = (stageId: string | null, value: number | null = null, status: string | null = null) => ({
    pipeline_stage_id: stageId,
    status,
    estimated_value: value,
})

describe("leadInStage", () => {
    it("matches by stage id", () => {
        expect(leadInStage(lead("a"), stage("a"))).toBe(true)
        expect(leadInStage(lead("b"), stage("a"))).toBe(false)
    })

    it("falls back to the status name, without case, when a lead has no stage id", () => {
        expect(leadInStage(lead(null, null, "proposal sent"), stage("a", { name: "Proposal Sent" }))).toBe(true)
        expect(leadInStage(lead(null, null, null), stage("a", { name: "Proposal Sent" }))).toBe(false)
    })

    it("does not use the status once a stage id is set", () => {
        expect(leadInStage(lead("b", null, "Stage a"), stage("a"))).toBe(false)
    })
})

describe("summarizeStages", () => {
    it("counts each stage's leads and adds up their estimated values", () => {
        const stages = [stage("a"), stage("b"), stage("c")]
        const summaries = summarizeStages(stages, [lead("a", 100), lead("a", null), lead("b", 250), lead("a", 50)])
        expect(summaries.get("a")).toEqual({ count: 3, total: 150 })
        expect(summaries.get("b")).toEqual({ count: 1, total: 250 })
        expect(summaries.get("c")).toEqual({ count: 0, total: 0 })
    })

    it("ignores leads of stages outside the pipeline", () => {
        const summaries = summarizeStages([stage("a")], [lead("zzz", 999)])
        expect(summaries.get("a")).toEqual({ count: 0, total: 0 })
        expect(summaries.has("zzz")).toBe(false)
    })
})

describe("defaultStageId", () => {
    const stages = [
        stage("new"),
        stage("proposal"),
        stage("won", { stage_type: "closed", closed_status: "won" }),
        stage("lost", { stage_type: "closed", closed_status: "lost" }),
    ]

    it("opens on the first open stage with leads", () => {
        const summaries = summarizeStages(stages, [lead("proposal"), lead("won")])
        expect(defaultStageId(stages, summaries)).toBe("proposal")
    })

    it("prefers the first open stage when it has leads", () => {
        const summaries = summarizeStages(stages, [lead("new"), lead("proposal")])
        expect(defaultStageId(stages, summaries)).toBe("new")
    })

    it("falls back to the first stage with leads when no open stage has any", () => {
        const summaries = summarizeStages(stages, [lead("lost")])
        expect(defaultStageId(stages, summaries)).toBe("lost")
    })

    it("falls back to the first open stage when the pipeline is empty", () => {
        const summaries = summarizeStages(stages, [])
        expect(defaultStageId(stages, summaries)).toBe("new")
    })

    it("uses the first stage when every stage is closed and empty, and null with no stages", () => {
        const closed = [stage("x", { stage_type: "closed" }), stage("y", { stage_type: "closed" })]
        expect(defaultStageId(closed, summarizeStages(closed, []))).toBe("x")
        expect(defaultStageId([], new Map())).toBeNull()
    })
})

describe("resolveStageId", () => {
    const stages = [stage("a"), stage("b")]
    const summaries = summarizeStages(stages, [lead("b")])

    it("keeps a chosen stage of this pipeline", () => {
        expect(resolveStageId(stages, "a", summaries)).toBe("a")
    })

    it("gives a missing or foreign stage way to the default", () => {
        expect(resolveStageId(stages, null, summaries)).toBe("b")
        expect(resolveStageId(stages, "from-another-pipeline", summaries)).toBe("b")
    })
})

describe("the ?stage= parameter", () => {
    it("reads it with or without the question mark, blank as none", () => {
        expect(readStageParam("?pipeline=p1&stage=s1")).toBe("s1")
        expect(readStageParam("stage=s2")).toBe("s2")
        expect(readStageParam("?stage=")).toBeNull()
        expect(readStageParam("?stage=%20%20")).toBeNull()
        expect(readStageParam("")).toBeNull()
    })

    it("writes it beside the other parameters, in place", () => {
        expect(withStageParam("?pipeline=p1&view=kanban", "s1")).toBe("pipeline=p1&view=kanban&stage=s1")
        expect(withStageParam("?pipeline=p1&stage=s1&view=table", "s2")).toBe("pipeline=p1&stage=s2&view=table")
    })

    it("removes it for null and leaves an empty query when nothing else is there", () => {
        expect(withStageParam("?pipeline=p1&stage=s1", null)).toBe("pipeline=p1")
        expect(withStageParam("?stage=s1", null)).toBe("")
    })
})

describe("scrollLeftToCenter", () => {
    it("centres a tab in the middle of the row", () => {
        expect(scrollLeftToCenter({ itemLeft: 500, itemWidth: 100, viewWidth: 390, scrollWidth: 1200 })).toBe(355)
    })

    it("stays at the start for the first tabs", () => {
        expect(scrollLeftToCenter({ itemLeft: 0, itemWidth: 120, viewWidth: 390, scrollWidth: 1200 })).toBe(0)
    })

    it("stops at the end for the last tabs", () => {
        expect(scrollLeftToCenter({ itemLeft: 1100, itemWidth: 100, viewWidth: 390, scrollWidth: 1200 })).toBe(810)
    })

    it("keeps a centred tab clear of both 40px edge fades", () => {
        const left = scrollLeftToCenter({ itemLeft: 500, itemWidth: 224, viewWidth: 390, scrollWidth: 1200, fade: 40 })
        expect(500 - left).toBeGreaterThanOrEqual(40)
        expect(500 + 224 - left).toBeLessThanOrEqual(390 - 40)
    })

    it("keeps a tab near the start clear of the right fade (the left one is off at the start)", () => {
        const left = scrollLeftToCenter({ itemLeft: 110, itemWidth: 150, viewWidth: 390, scrollWidth: 1200, fade: 40 })
        expect(left).toBe(0)
        expect(110 + 150 - left).toBeLessThanOrEqual(390 - 40)
    })

    it("keeps the start of a tab wider than the clear middle out of the left fade", () => {
        expect(scrollLeftToCenter({ itemLeft: 500, itemWidth: 330, viewWidth: 390, scrollWidth: 1200, fade: 40 })).toBe(460)
        expect(scrollLeftToCenter({ itemLeft: 20, itemWidth: 330, viewWidth: 390, scrollWidth: 1200, fade: 40 })).toBe(0)
    })

    it("does not move a row that fits", () => {
        expect(scrollLeftToCenter({ itemLeft: 200, itemWidth: 100, viewWidth: 390, scrollWidth: 390 })).toBe(0)
    })
})

describe("stageOutcome", () => {
    it("reads the stage's closed status first", () => {
        expect(stageOutcome({ name: "Deal", closed_status: "won", stage_type: "closed" })).toBe("won")
        expect(stageOutcome({ name: "Deal", closed_status: "lost", stage_type: "closed" })).toBe("lost")
    })

    it("falls back to the name, as the board does", () => {
        expect(stageOutcome({ name: "Closed Won" })).toBe("won")
        expect(stageOutcome({ name: "Cancelled" })).toBe("lost")
        expect(stageOutcome({ name: "Postponed" })).toBe("lost")
    })

    it("tells a plain closed stage from an open one", () => {
        expect(stageOutcome({ name: "Archive", stage_type: "closed" })).toBe("closed")
        expect(stageOutcome({ name: "Proposal Sent", stage_type: "open" })).toBe("open")
        expect(stageOutcome(null)).toBe("open")
    })
})

describe("day keys", () => {
    it("keeps a bare date as the day it names", () => {
        expect(dayKeyOf("2026-09-12")).toBe("2026-09-12")
    })

    it("reads a timestamp as a local day", () => {
        const at = new Date(2026, 8, 12, 15, 30)
        expect(dayKeyOf(at.toISOString())).toBe("2026-09-12")
        expect(localDayKey(at)).toBe("2026-09-12")
    })

    it("refuses what is not a date", () => {
        expect(dayKeyOf("soon")).toBeNull()
    })

    it("formats a day the same wherever the phone is", () => {
        expect(formatDay("2026-09-12")).toBe("12 Sep 2026")
    })
})

describe("leadDateFact", () => {
    const base = { target_close_date: null, closed_won_date: null, closed_lost_date: null, updated_at: "2026-09-01T03:00:00Z" }
    const open = { name: "Proposal Sent", stage_type: "open" as const }
    const today = "2026-09-24"

    it("gives an open lead its closing date, overdue once the day has passed", () => {
        const fact = leadDateFact({ ...base, target_close_date: "2026-09-23" }, open, today)
        expect(fact).toMatchObject({ kind: "closing", day: "2026-09-23", urgency: "overdue" })
        expect(dateFactWord(fact)).toBe("Overdue")
    })

    it("marks today and the next three days as soon, later as normal", () => {
        expect(leadDateFact({ ...base, target_close_date: "2026-09-24" }, open, today).urgency).toBe("soon")
        expect(leadDateFact({ ...base, target_close_date: "2026-09-27" }, open, today).urgency).toBe("soon")
        const later = leadDateFact({ ...base, target_close_date: "2026-09-28" }, open, today)
        expect(later.urgency).toBe("normal")
        expect(dateFactWord(later)).toBe("Closing")
    })

    it("says nothing for an open lead without a closing date", () => {
        expect(leadDateFact(base, open, today)).toMatchObject({ kind: "none", day: null })
        expect(dateFactWord(leadDateFact(base, open, today))).toBeNull()
    })

    it("gives a won lead the day it was won, else its last update", () => {
        const won = { name: "Closed Won", stage_type: "closed" as const, closed_status: "won" as const }
        expect(leadDateFact({ ...base, closed_won_date: "2026-09-10T02:00:00Z", target_close_date: "2026-01-01" }, won, today)).toMatchObject({ kind: "won" })
        expect(leadDateFact(base, won, today)).toMatchObject({ kind: "updated", value: base.updated_at })
    })

    it("gives any other closed lead the day it was closed", () => {
        const lost = { name: "Postponed", stage_type: "closed" as const }
        const fact = leadDateFact({ ...base, closed_lost_date: "2026-09-05" }, lost, today)
        expect(fact).toMatchObject({ kind: "lost", day: "2026-09-05" })
        expect(dateFactWord(fact)).toBe("Closed")
    })
})

describe("leadChips", () => {
    const chipLead = {
        company: { name: "WG Events" },
        grade_lead: "A",
        category: "Hot",
        lead_source: "Referral",
        main_stream: "MICE",
        event_format: null,
    }

    it("shows the chosen badges the lead has a value for, in the card's order", () => {
        expect(leadChips(chipLead, ["category", "subsidiary", "grade_lead", "event_format"])).toEqual([
            { key: "subsidiary", label: "WG Events", tone: "neutral" },
            { key: "grade_lead", label: "A", tone: "success" },
            { key: "category", label: "Hot", tone: "danger" },
        ])
    })

    it("draws the other badges in the neutral tone", () => {
        expect(leadChips(chipLead, ["lead_source", "main_stream"])).toEqual([
            { key: "lead_source", label: "Referral", tone: "neutral" },
            { key: "main_stream", label: "MICE", tone: "neutral" },
        ])
    })

    it("shows nothing when nothing is chosen", () => {
        expect(leadChips(chipLead, [])).toEqual([])
    })
})

describe("chip tones", () => {
    it("tones grades", () => {
        expect(gradeTone("A+")).toBe("success")
        expect(gradeTone("b")).toBe("warning")
        expect(gradeTone("C")).toBe("warning")
        expect(gradeTone("D")).toBe("danger")
        expect(gradeTone("Cold")).toBe("info")
        expect(gradeTone("Z")).toBe("neutral")
    })

    it("tones temperatures", () => {
        expect(temperatureTone("Hot Lead")).toBe("danger")
        expect(temperatureTone("warm")).toBe("warning")
        expect(temperatureTone("Cold")).toBe("info")
        expect(temperatureTone("Unknown")).toBe("neutral")
    })
})

describe("stageCountLabel", () => {
    it("says what it counts", () => {
        expect(stageCountLabel("Proposal Sent", 12, 1245)).toBe("12 in Proposal Sent · 1,245 in all stages")
    })
})
