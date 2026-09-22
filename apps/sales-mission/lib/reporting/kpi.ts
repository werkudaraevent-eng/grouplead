import { missionDayKey } from "@/lib/missions/mission-calendar"
import { isDecisionMakerOutcome, isNoAction, labelOf, type ChoiceSet } from "@/lib/missions/report-choices"
import { isOnTime, visitDurationMinutes } from "@/lib/missions/visit-time"
import type {
  InterestLevel,
  NextActionType,
  ReportStatus,
  VisitOutcome,
} from "@/lib/missions/visit-report-schema"

/**
 * Mission reporting.
 *
 * Everything here is a pure function over records the query layer fetched, for
 * two reasons. Reporting arithmetic is where quiet mistakes live — an
 * off-by-one on a date range or a timezone slip changes a number nobody can
 * verify by eye — and a wrong KPI is worse than a missing one, because someone
 * makes a decision on it.
 */

export interface ReportRecord {
  missionId: string
  missionType: string
  clientCompanyName: string
  primarySalesName: string | null
  reportStatus: ReportStatus
  visitOutcome: VisitOutcome | null
  interestLevel: InterestLevel | null
  opportunityExists: boolean
  estimatedValue: number | null
  nextActionType: NextActionType
  followUpDate: string | null
  submittedAt: string | null
  contactCount: number
  pushedLeadId: string | null
  /** The CRM category chosen when the lead was pushed; null before that existed. */
  pushedCategory?: string | null
  /** The appointment and the reported start, for the on-time rate. */
  scheduledStart?: string | null
  actualStart?: string | null
  actualEnd?: string | null
}

export interface KpiSummary {
  /** Reports actually submitted. Drafts are work in progress, not results. */
  resultsSubmitted: number
  opportunities: number
  estimatedValueTotal: number
  openNextActions: number
  overdueNextActions: number
  contactsDiscovered: number
  needsClarification: number
  leadsPushed: number
  /** Share of submitted visits that reached a decision maker, 0–100. */
  decisionMakerRate: number
  /** Share of visits with a reported start that began within the grace period, 0–100. Null when none reported a time. */
  onTimeRate: number | null
  /** Average reported length of a visit in minutes. Null when none reported an end. */
  averageVisitMinutes: number | null
}

export interface Breakdown {
  key: string
  label: string
  submitted: number
  opportunities: number
  estimatedValue: number
}

export interface KpiReport {
  summary: KpiSummary
  bySales: Breakdown[]
  byCompany: Breakdown[]
  byMissionType: Breakdown[]
  byInterest: Breakdown[]
  /** Leads sent to the CRM, by the category they were sent as. */
  byPushedCategory: Breakdown[]
}

export const UNASSIGNED_LABEL = "Belum ditugaskan"

/**
 * Keep only reports submitted inside an inclusive day range.
 *
 * Boundaries are compared as mission-time day strings rather than instants: a
 * report submitted at 23:30 WIB on the last day of the range belongs to that
 * day, even though it is already the next day in UTC.
 */
export function filterByRange(
  records: ReportRecord[],
  range: { from: string; to: string } | null
): ReportRecord[] {
  if (!range) return records

  return records.filter((record) => {
    if (!record.submittedAt) return false
    const submitted = new Date(record.submittedAt)
    if (Number.isNaN(submitted.getTime())) return false

    const day = missionDayKey(submitted)
    return day >= range.from && day <= range.to
  })
}

function accumulate(
  records: ReportRecord[],
  keyOf: (record: ReportRecord) => { key: string; label: string }
): Breakdown[] {
  const buckets = new Map<string, Breakdown>()

  for (const record of records) {
    const { key, label } = keyOf(record)
    const bucket = buckets.get(key) ?? { key, label, submitted: 0, opportunities: 0, estimatedValue: 0 }

    bucket.submitted += 1
    if (record.opportunityExists) bucket.opportunities += 1
    bucket.estimatedValue += record.estimatedValue ?? 0

    buckets.set(key, bucket)
  }

  // Busiest first, then alphabetical so equal rows do not shuffle between loads.
  return [...buckets.values()].sort(
    (a, b) => b.submitted - a.submitted || a.label.localeCompare(b.label)
  )
}

/**
 * Build the KPI report.
 *
 * Only submitted reports count. A draft is someone still typing, and counting
 * it would inflate today's numbers and deflate them again when it is finished.
 */
export function buildKpiReport(
  records: ReportRecord[],
  now: Date,
  range: { from: string; to: string } | null = null,
  /** The tenant's report choices, so the kinds and labels are theirs. The seed when omitted. */
  choices: ChoiceSet | null = null
): KpiReport {
  const inRange = filterByRange(records, range)
  const submitted = inRange.filter((record) => record.reportStatus !== "DRAFT")

  const today = missionDayKey(now)

  const openNextActions = submitted.filter((record) => !isNoAction(record.nextActionType, choices))
  const overdue = openNextActions.filter(
    (record) => record.followUpDate !== null && record.followUpDate < today
  )

  const decisionMakerVisits = submitted.filter(
    (record) => isDecisionMakerOutcome(record.visitOutcome, choices)
  ).length

  const summary: KpiSummary = {
    resultsSubmitted: submitted.length,
    opportunities: submitted.filter((record) => record.opportunityExists).length,
    estimatedValueTotal: submitted.reduce((total, record) => total + (record.estimatedValue ?? 0), 0),
    openNextActions: openNextActions.length,
    overdueNextActions: overdue.length,
    contactsDiscovered: submitted.reduce((total, record) => total + record.contactCount, 0),
    needsClarification: submitted.filter((record) => record.reportStatus === "NEEDS_CLARIFICATION").length,
    leadsPushed: submitted.filter((record) => record.pushedLeadId !== null).length,
    decisionMakerRate:
      submitted.length === 0 ? 0 : Math.round((decisionMakerVisits / submitted.length) * 100),
    onTimeRate: (() => {
      const judged = submitted.map((record) => isOnTime(record.actualStart, record.scheduledStart)).filter((value): value is boolean => value !== null)
      return judged.length === 0 ? null : Math.round((judged.filter(Boolean).length / judged.length) * 100)
    })(),
    averageVisitMinutes: (() => {
      const lengths = submitted.map((record) => visitDurationMinutes(record.actualStart, record.actualEnd)).filter((value): value is number => value !== null)
      return lengths.length === 0 ? null : Math.round(lengths.reduce((total, value) => total + value, 0) / lengths.length)
    })(),
  }

  return {
    summary,
    bySales: accumulate(submitted, (record) => ({
      key: record.primarySalesName ?? UNASSIGNED_LABEL,
      label: record.primarySalesName ?? UNASSIGNED_LABEL,
    })),
    byCompany: accumulate(submitted, (record) => ({
      key: record.clientCompanyName,
      label: record.clientCompanyName,
    })),
    byMissionType: accumulate(submitted, (record) => ({
      key: record.missionType,
      label: record.missionType,
    })),
    byInterest: accumulate(submitted, (record) => ({
      key: record.interestLevel ?? "UNSET",
      label: record.interestLevel ? labelOf(choices, "interest_level", record.interestLevel) : "Belum diisi",
    })),
    byPushedCategory: accumulate(
      submitted.filter((record) => record.pushedLeadId !== null),
      (record) => ({
        key: record.pushedCategory ?? "UNSET",
        label: record.pushedCategory ?? "Tanpa kategori",
      })
    ),
  }
}

/** Default range: the current mission-time month, inclusive. */
export function currentMonthRange(now: Date): { from: string; to: string } {
  const today = missionDayKey(now)
  const [year, month] = today.split("-").map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()

  return {
    from: `${today.slice(0, 7)}-01`,
    to: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`,
  }
}

/**
 * Serialise rows to CSV.
 *
 * Quotes every field rather than only the ones that need it. Company names
 * carry commas often enough that conditional quoting is a bug waiting for the
 * first "PT Maju, Jaya".
 */
export function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\r\n")
}
