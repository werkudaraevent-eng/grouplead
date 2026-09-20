/**
 * The numbers an insight is written from.
 *
 * The model is never handed rows and asked to count; the app counts and
 * hands over a small, named set of facts, so a sentence like "laporan turun
 * 30% dari minggu lalu" can only come from a number that is also on the
 * screen. `assembleFacts` is pure and tested; `loadInsightFacts` fetches the
 * rows with the service client and, as everywhere that client is used,
 * filters by company_id explicitly.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface PersonCount {
  name: string
  count: number
}

export interface ReportFact {
  client: string
  sales: string
  outcome: string | null
  interest: string | null
  opportunity: boolean
  estimatedValue: number | null
  nextAction: string | null
  followUpDate: string | null
  summary: string | null
}

export interface InsightFacts {
  /** The day the insight is about, YYYY-MM-DD in WIB. */
  day: string
  /** Names the facts are limited to; null for the whole unit. */
  people: string[] | null
  today: {
    scheduled: number
    scheduledByPerson: PersonCount[]
    reportsSubmitted: number
    reports: ReportFact[]
  }
  tomorrow: { scheduled: number }
  pending: {
    /** Past visits without a sent report. */
    count: number
    byPerson: PersonCount[]
    oldestDays: number | null
  }
  prospects: {
    /** Open prospects whose "hubungi lagi" date has arrived. */
    overdue: number
    byPerson: PersonCount[]
  }
  week: {
    reports: number
    reportsPreviousWeek: number
    appointments: number
    appointmentsPreviousWeek: number
    opportunities: number
    estimatedValue: number
    reportsByPerson: PersonCount[]
  }
}

export interface MissionRow {
  id: string
  client: string
  scheduledStart: string
  status: string
  primaryId: string | null
}

export interface ReportRow {
  missionId: string
  status: string
  submittedAt: string | null
  visitOutcome: string | null
  interestLevel: string | null
  opportunityExists: boolean
  estimatedValue: number | null
  nextActionType: string | null
  followUpDate: string | null
  meetingSummary: string | null
}

export interface ProspectRow {
  ownerId: string | null
  nextContactAt: string | null
  statusKind: string
}

export interface FactInput {
  day: string
  now: Date
  missions: MissionRow[]
  reports: ReportRow[]
  prospects: ProspectRow[]
  names: ReadonlyMap<string, string>
  /** Labels for outcome and interest codes. */
  labels: ReadonlyMap<string, string>
  /** Limit to these people (primary sales, prospect owners); null for everyone. */
  salesIds: ReadonlySet<string> | null
}

const WIB_OFFSET = "+07:00"

/** WIB midnight of a YYYY-MM-DD day as an instant. */
export function wibDayStart(day: string): Date {
  return new Date(`${day}T00:00:00${WIB_OFFSET}`)
}

/** The YYYY-MM-DD of an instant in WIB. */
export function wibDayOf(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(instant)
}

/** The hour of an instant in WIB, 0 to 23. */
export function wibHourOf(instant: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", hourCycle: "h23" }).format(instant))
}

export function shiftDay(day: string, days: number): string {
  const date = wibDayStart(day)
  date.setUTCDate(date.getUTCDate() + days)
  return wibDayOf(date)
}

function tally(ids: Array<string | null>, names: ReadonlyMap<string, string>): PersonCount[] {
  const counts = new Map<string, number>()
  for (const id of ids) {
    const name = id ? (names.get(id) ?? "Tanpa nama") : "Belum ditugaskan"
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

const between = (iso: string | null | undefined, from: Date, to: Date): boolean => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t < to.getTime()
}

export function assembleFacts(input: FactInput): InsightFacts {
  const { day, now, names, labels, salesIds } = input
  const dayStart = wibDayStart(day)
  const dayEnd = wibDayStart(shiftDay(day, 1))
  const tomorrowEnd = wibDayStart(shiftDay(day, 2))
  const weekStart = wibDayStart(shiftDay(day, -6))
  const prevWeekStart = wibDayStart(shiftDay(day, -13))

  const inScope = (id: string | null) => !salesIds || (id !== null && salesIds.has(id))
  const missions = input.missions.filter((m) => inScope(m.primaryId))
  const missionById = new Map(missions.map((m) => [m.id, m]))
  const sent = input.reports.filter((r) => r.status !== "DRAFT" && missionById.has(r.missionId))
  const sentByMission = new Set(sent.map((r) => r.missionId))
  const label = (code: string | null) => (code ? (labels.get(code) ?? code) : null)

  const todayMissions = missions.filter((m) => between(m.scheduledStart, dayStart, dayEnd))
  const todayReports = sent.filter((r) => between(r.submittedAt, dayStart, dayEnd))
  const pendingMissions = missions.filter((m) => new Date(m.scheduledStart) < now && !sentByMission.has(m.id) && m.status !== "COMPLETED")
  const oldestPending = pendingMissions.reduce<number | null>((oldest, m) => {
    const days = Math.floor((now.getTime() - new Date(m.scheduledStart).getTime()) / 86_400_000)
    return oldest === null || days > oldest ? days : oldest
  }, null)

  const weekReports = sent.filter((r) => between(r.submittedAt, weekStart, dayEnd))
  const prevWeekReports = sent.filter((r) => between(r.submittedAt, prevWeekStart, weekStart))
  const weekAppointments = missions.filter((m) => between(m.scheduledStart, weekStart, dayEnd))
  const prevWeekAppointments = missions.filter((m) => between(m.scheduledStart, prevWeekStart, weekStart))

  const overdue = input.prospects.filter(
    (p) => inScope(p.ownerId) && (p.statusKind === "open" || p.statusKind === "in_progress") && p.nextContactAt !== null && p.nextContactAt <= day
  )

  return {
    day,
    people: salesIds ? [...salesIds].map((id) => names.get(id) ?? "Tanpa nama") : null,
    today: {
      scheduled: todayMissions.length,
      scheduledByPerson: tally(todayMissions.map((m) => m.primaryId), names),
      reportsSubmitted: todayReports.length,
      reports: todayReports.slice(0, 12).map((r) => {
        const mission = missionById.get(r.missionId)!
        return {
          client: mission.client,
          sales: mission.primaryId ? (names.get(mission.primaryId) ?? "Tanpa nama") : "Belum ditugaskan",
          outcome: label(r.visitOutcome),
          interest: label(r.interestLevel),
          opportunity: r.opportunityExists,
          estimatedValue: r.estimatedValue,
          nextAction: r.nextActionType && r.nextActionType !== "NONE" ? r.nextActionType : null,
          followUpDate: r.followUpDate,
          summary: r.meetingSummary ? r.meetingSummary.replace(/\s+/g, " ").trim().slice(0, 240) : null,
        }
      }),
    },
    tomorrow: { scheduled: missions.filter((m) => between(m.scheduledStart, dayEnd, tomorrowEnd)).length },
    pending: {
      count: pendingMissions.length,
      byPerson: tally(pendingMissions.map((m) => m.primaryId), names),
      oldestDays: oldestPending,
    },
    prospects: {
      overdue: overdue.length,
      byPerson: tally(overdue.map((p) => p.ownerId), names),
    },
    week: {
      reports: weekReports.length,
      reportsPreviousWeek: prevWeekReports.length,
      appointments: weekAppointments.length,
      appointmentsPreviousWeek: prevWeekAppointments.length,
      opportunities: weekReports.filter((r) => r.opportunityExists).length,
      estimatedValue: weekReports.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0),
      reportsByPerson: tally(weekReports.map((r) => missionById.get(r.missionId)?.primaryId ?? null), names),
    },
  }
}

/**
 * Fetch the rows for one unit and one day and assemble the facts. Service
 * client: the cron route has no session, and a person-scoped insight must
 * still see the whole team's numbers to compare against. Every query
 * filters by company_id.
 */
export async function loadInsightFacts(
  supabase: SupabaseClient,
  companyId: string,
  day: string,
  now: Date,
  salesIds: ReadonlySet<string> | null
): Promise<InsightFacts> {
  const missions = supabase.schema("sales_mission")
  const fromIso = wibDayStart(shiftDay(day, -13)).toISOString()
  const toIso = wibDayStart(shiftDay(day, 2)).toISOString()

  const [{ data: missionRows }, { data: prospectRows }, { data: statusRows }, { data: choiceRows }] = await Promise.all([
    missions
      .from("missions")
      .select("id, client_company_name_snapshot, scheduled_start, status")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("status", "in", "(CANCELLED,REJECTED)")
      .gte("scheduled_start", fromIso)
      .lt("scheduled_start", toIso)
      .limit(2000),
    missions
      .from("prospects")
      .select("owner_id, next_contact_at, status_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("next_contact_at", "is", null)
      .lte("next_contact_at", day)
      .limit(2000),
    missions.from("prospect_statuses").select("id, kind").eq("company_id", companyId),
    missions.from("report_choices").select("code, label").eq("company_id", companyId).in("field_key", ["visit_outcome", "interest_level"]),
  ])

  const missionIds = (missionRows ?? []).map((row) => row.id as string)
  const [{ data: assignmentRows }, { data: reportRows }] = await Promise.all([
    missionIds.length
      ? missions.from("assignments").select("mission_id, user_id").eq("assignment_role", "PRIMARY").in("mission_id", missionIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    missionIds.length
      ? missions
          .from("visit_reports")
          .select("mission_id, status, submitted_at, visit_outcome, interest_level, opportunity_exists, estimated_value, next_action_type, follow_up_date, meeting_summary")
          .eq("company_id", companyId)
          .in("mission_id", missionIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  const primaryByMission = new Map<string, string>()
  for (const row of assignmentRows ?? []) primaryByMission.set(row.mission_id as string, row.user_id as string)
  const kindByStatus = new Map<string, string>()
  for (const row of statusRows ?? []) kindByStatus.set(row.id as string, row.kind as string)

  const userIds = new Set<string>()
  for (const id of primaryByMission.values()) userIds.add(id)
  for (const row of prospectRows ?? []) if (row.owner_id) userIds.add(row.owner_id as string)
  if (salesIds) for (const id of salesIds) userIds.add(id)
  const names = new Map<string, string>()
  if (userIds.size) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", [...userIds])
    for (const row of profiles ?? []) if (row.full_name) names.set(row.id as string, row.full_name as string)
  }
  const labels = new Map<string, string>()
  for (const row of choiceRows ?? []) labels.set(row.code as string, row.label as string)

  return assembleFacts({
    day,
    now,
    names,
    labels,
    salesIds,
    missions: (missionRows ?? []).map((row) => ({
      id: row.id as string,
      client: (row.client_company_name_snapshot as string | null) ?? "Klien",
      scheduledStart: row.scheduled_start as string,
      status: row.status as string,
      primaryId: primaryByMission.get(row.id as string) ?? null,
    })),
    reports: (reportRows ?? []).map((row) => ({
      missionId: row.mission_id as string,
      status: row.status as string,
      submittedAt: (row.submitted_at as string | null) ?? null,
      visitOutcome: (row.visit_outcome as string | null) ?? null,
      interestLevel: (row.interest_level as string | null) ?? null,
      opportunityExists: Boolean(row.opportunity_exists),
      estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? null : Number(row.estimated_value),
      nextActionType: (row.next_action_type as string | null) ?? null,
      followUpDate: (row.follow_up_date as string | null) ?? null,
      meetingSummary: (row.meeting_summary as string | null) ?? null,
    })),
    prospects: (prospectRows ?? []).map((row) => ({
      ownerId: (row.owner_id as string | null) ?? null,
      nextContactAt: (row.next_contact_at as string | null) ?? null,
      statusKind: kindByStatus.get(row.status_id as string) ?? "open",
    })),
  })
}
