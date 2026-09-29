import { describe, expect, it } from "vitest"
import {
  customAnswersFromDraft,
  draftList,
  draftText,
  FORM_DRAFT_MAX_AGE_MS,
  FORM_DRAFT_PREFIX,
  formDraftKey,
  formValuesFromEntries,
  mergeDraftValues,
  parseFormDraft,
  sameFormValues,
  serializeFormDraft,
  staleFormDraftKeys,
} from "./form-draft"

const NOW = Date.UTC(2026, 8, 29, 12, 0, 0)
const DAY = 24 * 60 * 60_000

describe("formDraftKey", () => {
  it("names the person, the form and the record", () => {
    expect(formDraftKey("u1", "lead", "new")).toBe(`${FORM_DRAFT_PREFIX}u1:lead:new`)
    expect(formDraftKey("u1", "lead", "m-42")).toBe(`${FORM_DRAFT_PREFIX}u1:lead:m-42`)
  })

  it("keeps one person's draft apart from another's and one record from the next", () => {
    const keys = new Set([
      formDraftKey("u1", "lead", "new"),
      formDraftKey("u2", "lead", "new"),
      formDraftKey("u1", "lead", "m-1"),
      formDraftKey("u1", "composer", "new"),
    ])
    expect(keys.size).toBe(4)
  })

  it("escapes the separator, so parts cannot run into each other", () => {
    expect(formDraftKey("a:b", "c", "d")).not.toBe(formDraftKey("a", "b:c", "d"))
    expect(formDraftKey("a:b", "c", "d")).toBe(`${FORM_DRAFT_PREFIX}a%3Ab:c:d`)
  })

  it("is null without an owner, a form or a record", () => {
    expect(formDraftKey(null, "lead", "new")).toBeNull()
    expect(formDraftKey("", "lead", "new")).toBeNull()
    expect(formDraftKey("u1", " ", "new")).toBeNull()
    expect(formDraftKey("u1", "lead", "")).toBeNull()
  })
})

describe("serializeFormDraft and parseFormDraft", () => {
  it("round-trips answers by field key", () => {
    const values = { objective: "Annual meeting, 300 pax", supportingSalesIds: ["u2", "u3"], custom__budget: "150000000" }
    const raw = serializeFormDraft(values, NOW)
    expect(parseFormDraft(raw, NOW + 1000)).toEqual({ values, savedAt: NOW })
  })

  it("keeps a draft up to seven days and drops it after", () => {
    const raw = serializeFormDraft({ a: "1" }, NOW)
    expect(parseFormDraft(raw, NOW + FORM_DRAFT_MAX_AGE_MS)).not.toBeNull()
    expect(parseFormDraft(raw, NOW + FORM_DRAFT_MAX_AGE_MS + 1)).toBeNull()
    expect(parseFormDraft(raw, NOW + 7 * DAY + 1)).toBeNull()
  })

  it("does not trust a draft stamped more than a day in the future", () => {
    expect(parseFormDraft(serializeFormDraft({ a: "1" }, NOW + 2 * DAY), NOW)).toBeNull()
    expect(parseFormDraft(serializeFormDraft({ a: "1" }, NOW + 60_000), NOW)).not.toBeNull()
  })

  it("reads anything malformed or from another format as no draft", () => {
    expect(parseFormDraft(null, NOW)).toBeNull()
    expect(parseFormDraft("", NOW)).toBeNull()
    expect(parseFormDraft("{not json", NOW)).toBeNull()
    expect(parseFormDraft(JSON.stringify({ v: 2, savedAt: NOW, values: {} }), NOW)).toBeNull()
    expect(parseFormDraft(JSON.stringify({ v: 1, savedAt: "today", values: {} }), NOW)).toBeNull()
    expect(parseFormDraft(JSON.stringify({ v: 1, savedAt: NOW, values: "x" }), NOW)).toBeNull()
    expect(parseFormDraft(JSON.stringify({ v: 1, savedAt: NOW }), NOW)).toBeNull()
  })
})

describe("staleFormDraftKeys", () => {
  it("lists this app's expired and broken drafts and leaves every other key alone", () => {
    const fresh = serializeFormDraft({ a: "1" }, NOW - DAY)
    const old = serializeFormDraft({ a: "1" }, NOW - 8 * DAY)
    const entries: Array<[string, string | null]> = [
      [`${FORM_DRAFT_PREFIX}u1:lead:new`, fresh],
      [`${FORM_DRAFT_PREFIX}u1:lead:m-1`, old],
      [`${FORM_DRAFT_PREFIX}u1:composer:new`, "garbage"],
      ["sidebar-collapsed", "true"],
      ["le-hint:foo", old],
    ]
    expect(staleFormDraftKeys(entries, NOW)).toEqual([`${FORM_DRAFT_PREFIX}u1:lead:m-1`, `${FORM_DRAFT_PREFIX}u1:composer:new`])
  })
})

describe("formValuesFromEntries", () => {
  it("keeps answers by input name, a repeated name as a list", () => {
    const values = formValuesFromEntries([
      ["objective", "Annual meeting"],
      ["supportingSalesIds", "u2"],
      ["supportingSalesIds", "u3"],
      ["custom__venue", "Ballroom"],
    ])
    expect(values).toEqual({ objective: "Annual meeting", supportingSalesIds: ["u2", "u3"], custom__venue: "Ballroom" })
  })

  it("never keeps a file, React's own action fields, or a skipped name", () => {
    const file = { name: "foto.jpg", size: 10 }
    const values = formValuesFromEntries(
      [["$ACTION_ID_abc", ""], ["$ACTION_KEY", "k"], ["photo", file], ["objective", "x"], ["scheduleReason", "y"]],
      (name) => name === "scheduleReason"
    )
    expect(values).toEqual({ objective: "x" })
  })
})

describe("sameFormValues", () => {
  it("ignores key order but not list order", () => {
    expect(sameFormValues({ a: "1", b: ["x", "y"] }, { b: ["x", "y"], a: "1" })).toBe(true)
    expect(sameFormValues({ b: ["x", "y"] }, { b: ["y", "x"] })).toBe(false)
  })

  it("treats a missing list as an empty one and a single answer as a list of one", () => {
    expect(sameFormValues({ a: "1" }, { a: "1", b: [] })).toBe(true)
    expect(sameFormValues({ a: "1" }, { a: ["1"] })).toBe(true)
    expect(sameFormValues({ a: "1" }, { a: "2" })).toBe(false)
    expect(sameFormValues({ a: "1" }, {})).toBe(false)
  })
})

describe("reading a draft back by field key", () => {
  const values = { objective: "Annual meeting", supportingSalesIds: ["u2", "u3"], custom__pax: "40", custom__vip: "true", custom__menu: ["Lunch", "Coffee"] }

  it("gives one answer as text and a list as a list", () => {
    expect(draftText(values, "objective")).toBe("Annual meeting")
    expect(draftText(values, "missing")).toBeUndefined()
    expect(draftList(values, "supportingSalesIds")).toEqual(["u2", "u3"])
    expect(draftList(values, "objective")).toEqual(["Annual meeting"])
    expect(draftList(values, "missing")).toEqual([])
  })

  it("maps the admin's fields by reporting key, whatever order or label they have now", () => {
    const fields = [
      { reportingKey: "menu", fieldType: "MULTI_SELECT" },
      { reportingKey: "vip", fieldType: "BOOLEAN" },
      { reportingKey: "pax", fieldType: "NUMBER" },
      { reportingKey: "added_later", fieldType: "TEXT" },
      { reportingKey: "guest", fieldType: "BOOLEAN" },
    ]
    expect(customAnswersFromDraft(values, fields)).toEqual({ menu: ["Lunch", "Coffee"], vip: true, pax: "40", added_later: "", guest: false })
  })
})

describe("mergeDraftValues", () => {
  const base = { meetingSummary: "", clientNeeds: [] as string[], visitOutcome: null as string | null, estimatedValue: null as number | null, opportunityExists: false, custom: {} as Record<string, unknown> }

  it("takes the stored answers for the keys the form has", () => {
    const merged = mergeDraftValues(base, { meetingSummary: "Asked for a proposal", clientNeeds: ["Hotel"], visitOutcome: "MET", estimatedValue: 150_000_000, opportunityExists: true, custom: { budget: 5 } })
    expect(merged).toEqual({ meetingSummary: "Asked for a proposal", clientNeeds: ["Hotel"], visitOutcome: "MET", estimatedValue: 150_000_000, opportunityExists: true, custom: { budget: 5 } })
  })

  it("drops keys the form no longer has and values of the wrong shape", () => {
    const merged = mergeDraftValues(base, { removedField: "x", meetingSummary: 12, clientNeeds: "Hotel", opportunityExists: "yes", custom: ["x"], visitOutcome: { code: "MET" } })
    expect(merged).toEqual(base)
  })

  it("keeps the fresh form for anything that is not a stored object", () => {
    expect(mergeDraftValues(base, null)).toBe(base)
    expect(mergeDraftValues(base, "draft")).toBe(base)
    expect(mergeDraftValues(base, [1, 2])).toBe(base)
  })
})
