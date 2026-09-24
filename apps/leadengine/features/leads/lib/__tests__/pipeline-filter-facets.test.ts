import { describe, expect, it } from "vitest"
import {
    appliedRules,
    clearField,
    facetGroup,
    removeRule,
    ruleForField,
    ruleValueLabel,
    setFieldRule,
    type FacetState,
} from "../pipeline-filter-facets"

const state = (rules: FacetState["rules"]): FacetState => ({ rules })

describe("facetGroup", () => {
    it("sorts fields into the sheet's sections", () => {
        expect(facetGroup({ key: "pic_sales", type: "person" })).toBe("People")
        expect(facetGroup({ key: "grade_lead", type: "enum" })).toBe("Details")
        expect(facetGroup({ key: "estimated_value", type: "number" })).toBe("Amounts")
        expect(facetGroup({ key: "target_close_date", type: "date" })).toBe("Dates")
        expect(facetGroup({ key: "project_name", type: "text" })).toBe("Text")
    })

    it("puts the month lists with the dates", () => {
        expect(facetGroup({ key: "month_event", type: "enum" })).toBe("Dates")
        expect(facetGroup({ key: "received_month", type: "enum" })).toBe("Dates")
    })
})

describe("setFieldRule", () => {
    it("adds a rule for a field that has none", () => {
        const next = setFieldRule(state([]), "grade_lead", "is_any_of", ["A"], "r1")
        expect(next.rules).toEqual([{ id: "r1", field: "grade_lead", operator: "is_any_of", value: ["A"] }])
    })

    it("updates the field's first rule and keeps the others", () => {
        const start = state([
            { id: "a", field: "grade_lead", operator: "is_any_of", value: ["A"] },
            { id: "b", field: "category", operator: "is_any_of", value: ["Hot"] },
            { id: "c", field: "grade_lead", operator: "is_none_of", value: ["D"] },
        ])
        const next = setFieldRule(start, "grade_lead", "is_none_of", ["A", "B"], "new")
        expect(next.rules).toEqual([
            { id: "a", field: "grade_lead", operator: "is_none_of", value: ["A", "B"] },
            { id: "b", field: "category", operator: "is_any_of", value: ["Hot"] },
            { id: "c", field: "grade_lead", operator: "is_none_of", value: ["D"] },
        ])
    })

    it("drops the rule once its last value is taken off", () => {
        const start = state([{ id: "a", field: "grade_lead", operator: "is_any_of", value: ["A"] }])
        expect(setFieldRule(start, "grade_lead", "is_any_of", [], "new").rules).toEqual([])
    })

    it("changes nothing when an empty value meets no rule", () => {
        const start = state([])
        expect(setFieldRule(start, "grade_lead", "is_any_of", [], "new")).toBe(start)
    })
})

describe("clearField, removeRule, ruleForField, appliedRules", () => {
    const start = state([
        { id: "a", field: "grade_lead", operator: "is_any_of", value: ["A"] },
        { id: "b", field: "category", operator: "is_any_of", value: [] },
        { id: "c", field: "grade_lead", operator: "is_none_of", value: ["D"] },
    ])

    it("clears every rule of a field", () => {
        expect(clearField(start, "grade_lead").rules.map((r) => r.id)).toEqual(["b"])
    })

    it("removes one rule by id", () => {
        expect(removeRule(start, "c").rules.map((r) => r.id)).toEqual(["a", "b"])
    })

    it("finds the field's first rule", () => {
        expect(ruleForField(start, "grade_lead")?.id).toBe("a")
        expect(ruleForField(start, "pic_sales")).toBeUndefined()
    })

    it("counts only rules with a value, as the desk does", () => {
        expect(appliedRules(start).map((r) => r.id)).toEqual(["a", "c"])
    })
})

describe("ruleValueLabel", () => {
    const rule = (operator: string, value: string[]) => ({ id: "r", field: "f", operator, value })

    it("lists up to two values and counts more", () => {
        expect(ruleValueLabel(rule("is_any_of", ["A", "B"]), "enum", "is any of")).toBe("A, B")
        expect(ruleValueLabel(rule("is_any_of", ["A", "B", "C"]), "person", "is any of")).toBe("3 selected")
    })

    it("says a negation", () => {
        expect(ruleValueLabel(rule("is_none_of", ["Hot"]), "enum", "is none of")).toBe("not Hot")
    })

    it("writes an amount with separators after its comparison", () => {
        expect(ruleValueLabel(rule("gte", ["500000000"]), "number", "≥")).toBe("≥ 500,000,000")
    })

    it("writes a day out", () => {
        expect(ruleValueLabel(rule("after", ["2026-09-01"]), "date", "after")).toBe("after 1 Sep 2026")
    })

    it("quotes text, and says a negation or an exact match", () => {
        expect(ruleValueLabel(rule("contains", ["bank"]), "text", "contains")).toBe("“bank”")
        expect(ruleValueLabel(rule("not_contains", ["bank"]), "text", "does not contain")).toBe("without “bank”")
        expect(ruleValueLabel(rule("eq", ["Bank BCA"]), "text", "is")).toBe("is “Bank BCA”")
    })
})
