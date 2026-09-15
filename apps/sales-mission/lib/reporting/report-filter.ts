import { DATE_PRESETS, type DatePreset } from "@/lib/missions/mission-filter"
import { REPORT_STATUSES, type ReportStatus } from "@/lib/missions/visit-report-schema"

/**
 * The report list's filter, carried in the URL like the mission list's.
 * Facets OR within themselves and AND across. The date facet is the visit
 * day: the reported start, else the day it was sent, else the appointment.
 */

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Dikirim",
  NEEDS_CLARIFICATION: "Perlu klarifikasi",
}

/** "none" in the sales facet: reports whose mission has no primary. */
export const UNASSIGNED_SALES = "none"
export const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

/** The presets this list offers; the parser still accepts every preset so a pasted link never breaks. */
export const REPORT_DATE_PRESETS: readonly DatePreset[] = ["today", "week", "month", "custom"]

/** Yes / no / don't care, for the two boolean facets. */
export type TriState = boolean | null

export interface ReportQuery {
  /** Matches client company, location and primary sales name. */
  q: string
  status: ReportStatus[]
  outcome: string[]
  interest: string[]
  nextAction: string[]
  /** Primary sales user ids, or UNASSIGNED_SALES. */
  sales: string[]
  opportunity: TriState
  pushed: TriState
  date: DatePreset | null
  /** YYYY-MM-DD, mission time. Only read when `date` is "custom". */
  from: string | null
  to: string | null
}

export const EMPTY_REPORT_QUERY: ReportQuery = {
  q: "",
  status: [],
  outcome: [],
  interest: [],
  nextAction: [],
  sales: [],
  opportunity: null,
  pushed: null,
  date: null,
  from: null,
  to: null,
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const CODE = /^[A-Z][A-Z0-9_]*$/

type Params = Record<string, string | string[] | undefined>

function list(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "")
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))]
}

function tri(value: string): TriState {
  return value === "1" ? true : value === "0" ? false : null
}

/** Read the query off `?q=&status=a,b&opp=1&pushed=0&date=month…`. Unknown values are dropped, never thrown. */
export function parseReportQuery(params: Params): ReportQuery {
  const one = (key: string) => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
  }
  const dateRaw = one("date")
  const from = one("from")
  const to = one("to")
  const hasBounds = DAY.test(from) || DAY.test(to)
  return {
    q: one("q").slice(0, 120),
    status: list(params.status).filter((value): value is ReportStatus => (REPORT_STATUSES as readonly string[]).includes(value)),
    outcome: list(params.outcome).filter((code) => CODE.test(code)),
    interest: list(params.interest).filter((code) => CODE.test(code)),
    nextAction: list(params.action).filter((code) => CODE.test(code)),
    sales: list(params.sales),
    opportunity: tri(one("opp")),
    pushed: tri(one("pushed")),
    // A bare from/to (the old KPI links) reads as a custom range.
    date: (DATE_PRESETS as readonly string[]).includes(dateRaw) ? (dateRaw as DatePreset) : hasBounds ? "custom" : null,
    from: DAY.test(from) ? from : null,
    to: DAY.test(to) ? to : null,
  }
}

/** The inverse of parseReportQuery, for building links. Empty facets are omitted. */
export function serializeReportQuery(query: ReportQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status.length) params.set("status", query.status.join(","))
  if (query.outcome.length) params.set("outcome", query.outcome.join(","))
  if (query.interest.length) params.set("interest", query.interest.join(","))
  if (query.nextAction.length) params.set("action", query.nextAction.join(","))
  if (query.sales.length) params.set("sales", query.sales.join(","))
  if (query.opportunity !== null) params.set("opp", query.opportunity ? "1" : "0")
  if (query.pushed !== null) params.set("pushed", query.pushed ? "1" : "0")
  if (query.date) params.set("date", query.date)
  if (query.date === "custom") {
    if (query.from) params.set("from", query.from)
    if (query.to) params.set("to", query.to)
  }
  return params
}

/** How many facets are narrowing the list. A facet counts once however many values it holds. */
export function countActiveReportFacets(query: ReportQuery): number {
  return (
    (query.q ? 1 : 0) +
    (query.status.length ? 1 : 0) +
    (query.outcome.length ? 1 : 0) +
    (query.interest.length ? 1 : 0) +
    (query.nextAction.length ? 1 : 0) +
    (query.sales.length ? 1 : 0) +
    (query.opportunity !== null ? 1 : 0) +
    (query.pushed !== null ? 1 : 0) +
    (query.date ? 1 : 0)
  )
}

export function isEmptyReportQuery(query: ReportQuery): boolean {
  return countActiveReportFacets(query) === 0
}
