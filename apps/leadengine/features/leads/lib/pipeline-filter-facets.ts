/**
 * The Pipeline's filter rules (`PipelineFilterState` in
 * `features/leads/components/pipeline-filters.tsx`: field, operator, values)
 * read and written one field at a time, the way the phone's Filter sheet
 * shows them: one facet per field, the rule for that field set from its
 * own sheet. The desk's popover and `applyFilters` are untouched; this only
 * reads and writes the same state.
 */
import { format, isValid, parseISO } from "date-fns"

export type FacetType = "enum" | "person" | "number" | "date" | "text"

export interface FacetRule {
    id: string
    field: string
    operator: string
    value: string[]
}

export interface FacetState {
    rules: FacetRule[]
}

/** The sheet's sections, in order. */
export const FACET_GROUPS = ["People", "Details", "Amounts", "Dates", "Text"] as const
export type FacetGroup = (typeof FACET_GROUPS)[number]

/** Fields of a list type that are months, so they sit with the dates. */
const MONTH_FIELDS = new Set(["month_event", "received_month"])

/** Which section of the sheet a field sits in. */
export function facetGroup(field: { key: string; type: FacetType }): FacetGroup {
    if (MONTH_FIELDS.has(field.key)) return "Dates"
    switch (field.type) {
        case "person":
            return "People"
        case "number":
            return "Amounts"
        case "date":
            return "Dates"
        case "text":
            return "Text"
        default:
            return "Details"
    }
}

/** A rule narrows the leads once it has a value, as the desk counts it. */
export function isAppliedRule(rule: FacetRule): boolean {
    return rule.value.length > 0
}

export function appliedRules<S extends FacetState>(state: S): S["rules"] {
    return state.rules.filter(isAppliedRule)
}

/** The rule a field's facet edits: the first for that field (the desk can add a second). */
export function ruleForField<S extends FacetState>(state: S, field: string): S["rules"][number] | undefined {
    return state.rules.find((rule) => rule.field === field)
}

/**
 * Sets a field's rule from its facet: updates the first rule for the field,
 * or adds one with `newId`; with no value left, that rule goes, so the
 * desk's popover never shows an empty row the phone left behind.
 */
export function setFieldRule<S extends FacetState>(
    state: S,
    field: string,
    operator: string,
    value: string[],
    newId: string,
): S {
    const index = state.rules.findIndex((rule) => rule.field === field)
    if (value.length === 0) {
        if (index < 0) return state
        return { ...state, rules: state.rules.filter((_, i) => i !== index) }
    }
    if (index < 0) return { ...state, rules: [...state.rules, { id: newId, field, operator, value }] }
    return { ...state, rules: state.rules.map((rule, i) => (i === index ? { ...rule, operator, value } : rule)) }
}

/** Removes every rule for a field (its facet's "Clear"). */
export function clearField<S extends FacetState>(state: S, field: string): S {
    return { ...state, rules: state.rules.filter((rule) => rule.field !== field) }
}

/** Removes one rule (its chip's ✕). */
export function removeRule<S extends FacetState>(state: S, id: string): S {
    return { ...state, rules: state.rules.filter((rule) => rule.id !== id) }
}

function day(value: string): string {
    const date = parseISO(value)
    return isValid(date) ? format(date, "d MMM yyyy") : value
}

/**
 * What a rule reads as after its field's name, on its chip ("Grade: A, B")
 * and under its facet ("A, B"), in the lists' words: a negation says so
 * ("not Hot", "without bank"), more than two values are counted ("3
 * selected"), an amount has its separators, a day is written out.
 */
export function ruleValueLabel(rule: FacetRule, type: FacetType, operatorLabel: string): string {
    const values = rule.value
    if (type === "enum" || type === "person") {
        const list = values.length <= 2 ? values.join(", ") : `${values.length} selected`
        return rule.operator === "is_none_of" ? `not ${list}` : list
    }
    const first = values[0] ?? ""
    if (type === "number") {
        const n = Number(first)
        return `${operatorLabel} ${Number.isFinite(n) ? n.toLocaleString("en-US") : first}`
    }
    if (type === "date") return `${operatorLabel} ${day(first)}`
    if (rule.operator === "not_contains") return `without “${first}”`
    if (rule.operator === "eq") return `is “${first}”`
    return `“${first}”`
}
