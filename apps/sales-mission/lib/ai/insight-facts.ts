/**
 * The facts an insight is written from.
 *
 * Two kinds of fact, and the difference is the whole guardrail. Every
 * number is computed here, by the app, and handed over named, so a
 * sentence like "laporan turun 30% dari minggu lalu" can only come from a
 * number that is also on a widget where it can be checked; the model never
 * receives rows to count. Everything qualitative — what the meeting was
 * about, what the client asked for, which competitor came up, who was met
 * and how to talk to them — is handed over as the reps' own text, because
 * that is the part a brief is supposed to synthesise.
 *
 * `assembleFacts` is pure and tested; `loadInsightFacts` fetches the rows
 * with the service client and, as everywhere that client is used, filters
 * by company_id explicitly.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { formatNumber } from "@/lib/format/number"
import { discCode, normalizeDisc } from "@/lib/contacts/disc"

export interface PersonCount {
  name: string
  count: number
}

/** Someone met on a visit. DISC only when the unit uses it. */
export interface ContactFact {
  name: string
  jobTitle: string | null
  decisionMaker: boolean
  /** "DI", "S", or null when nothing was assessed. */
  disc: string | null
  discNote: string | null
}

/** The visit before today's to the same client, so a change can be named. */
export interface PreviousVisit {
  day: string
  outcome: string | null
  interest: string | null
  opportunity: boolean
}

export interface ReportFact {
  /** The activity this report belongs to; the brief may link back to it. */
  missionId: string
  client: string
  sales: string
  outcome: string | null
  interest: string | null
  /** The locked kind behind the interest label (hql, hot, warm, cold, none). */
  interestKind: string | null
  opportunity: boolean
  estimatedValue: number | null
  /** The same money as text, and the only form a sentence may use. */
  estimatedValueText: string | null
  /** Whether the opportunity already reached LeadEngine. */
  sentToCrm: boolean
  clientNeeds: string[]
  productInterest: string[]
  competitor: string | null
  nextAction: string | null
  nextActionOwner: string | null
  followUpDate: string | null
  contacts: ContactFact[]
  summary: string | null
  previousVisit: PreviousVisit | null
}

/** A report from earlier in the week: enough to spot a theme, not the whole text. */
export interface WeekReportFact {
  day: string
  client: string
  sales: string
  outcome: string | null
  interest: string | null
  interestKind: string | null
  opportunity: boolean
  estimatedValue: number | null
  estimatedValueText: string | null
  clientNeeds: string[]
  productInterest: string[]
  competitor: string | null
  summary: string | null
}

export interface LateFollowUpFact {
  client: string
  action: string
  owner: string
  dueDate: string
  daysLate: number
}

export interface OverdueProspectFact {
  client: string
  owner: string
  daysOverdue: number
}

export interface InsightFacts {
  /** The day the insight is about, YYYY-MM-DD in WIB. */
  day: string
  /** Names the facts are limited to; null for the whole unit. */
  people: string[] | null
  today: {
    scheduled: number
    scheduledByPerson: PersonCount[]
    /** "10.00" style labels, busiest first. */
    byHour: PersonCount[]
    byIndustry: PersonCount[]
    reportsSubmitted: number
    reports: ReportFact[]
  }
  tomorrow: { scheduled: number; byPerson: PersonCount[]; byHour: PersonCount[]; byIndustry: PersonCount[] }
  /** The seven days after today. */
  nextWeek: { scheduled: number; byPerson: PersonCount[]; byIndustry: PersonCount[]; byDay: PersonCount[] }
  pending: {
    /** Past visits without a sent report. */
    count: number
    byPerson: PersonCount[]
    oldestDays: number | null
  }
  followUps: {
    open: number
    late: number
    openByPerson: PersonCount[]
    lateByPerson: PersonCount[]
    lateList: LateFollowUpFact[]
  }
  prospects: {
    /** Open prospects whose "hubungi lagi" date has arrived. */
    overdue: number
    byPerson: PersonCount[]
    list: OverdueProspectFact[]
  }
  week: {
    reports: number
    reportsPreviousWeek: number
    /** True when the previous week's number is 0: there is nothing to compare against. */
    reportsBaseline: boolean
    appointments: number
    appointmentsPreviousWeek: number
    appointmentsBaseline: boolean
    opportunities: number
    /** Opportunities this week that have not been pushed to LeadEngine. */
    opportunitiesNotSentToCrm: number
    estimatedValue: number
    estimatedValueText: string
    reportsByPerson: PersonCount[]
    reportsByIndustry: PersonCount[]
    appointmentsByIndustry: PersonCount[]
    appointmentsByHour: PersonCount[]
    byOutcome: PersonCount[]
    byInterest: PersonCount[]
    topClients: PersonCount[]
    /** The week's reports in the reps' own words, most recent first. */
    recentReports: WeekReportFact[]
  }
}

export interface MissionRow {
  id: string
  client: string
  scheduledStart: string
  status: string
  primaryId: string | null
  industry: string | null
}

export interface ReportRow {
  id: string
  missionId: string
  status: string
  submittedAt: string | null
  visitOutcome: string | null
  interestLevel: string | null
  opportunityExists: boolean
  estimatedValue: number | null
  nextActionType: string | null
  nextActionOwnerId: string | null
  followUpDate: string | null
  meetingSummary: string | null
  clientNeeds: string[]
  productInterest: string[]
  competitorMentioned: string | null
  crmSyncedAt: string | null
}

export interface ContactRow {
  reportId: string
  name: string
  jobTitle: string | null
  decisionMaker: boolean
  discPrimary: string | null
  discSecondary: string | null
  discNote: string | null
}

export interface FollowUpRow {
  missionId: string
  client: string
  actionType: string
  ownerId: string | null
  dueDate: string | null
  status: string
}

export interface ProspectRow {
  client: string
  ownerId: string | null
  nextContactAt: string | null
  statusKind: string
}

/** A visit to a client before today, for the history line of a client visited today. */
export interface HistoryRow {
  client: string
  day: string
  outcome: string | null
  interest: string | null
  opportunity: boolean
}

export interface FactInput {
  day: string
  now: Date
  missions: MissionRow[]
  reports: ReportRow[]
  contacts: ContactRow[]
  followUps: FollowUpRow[]
  prospects: ProspectRow[]
  history: HistoryRow[]
  names: ReadonlyMap<string, string>
  /** Labels for outcome and interest codes. */
  labels: ReadonlyMap<string, string>
  /** Labels for next_action_type codes (the report's next action, a follow-up's action). */
  actionLabels: ReadonlyMap<string, string>
  /** The locked kind behind an interest code, so "panas" and "HQL" are recognisable whatever the label says. */
  kinds: ReadonlyMap<string, string>
  /** Whether the unit assesses DISC on the people met; off means the chips are not part of the report. */
  discEnabled: boolean
  /** Limit to these people (primary sales, prospect owners); null for everyone. */
  salesIds: ReadonlySet<string> | null
}

const WIB_OFFSET = "+07:00"

/** How much of one report's text the model gets: enough to reason over, not the whole transcript. */
const TODAY_SUMMARY_CHARS = 1500
const WEEK_SUMMARY_CHARS = 400
const TODAY_REPORTS = 20
const WEEK_REPORTS = 40
const LATE_FOLLOW_UPS = 15
const OVERDUE_PROSPECTS = 10
const CONTACTS_PER_REPORT = 6
const TAGS_PER_REPORT = 8

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

/** Whole days from one YYYY-MM-DD to another; negative when `to` is earlier. */
export function dayGap(from: string, to: string): number {
  return Math.round((wibDayStart(to).getTime() - wibDayStart(from).getTime()) / 86_400_000)
}

/** Money as the product writes it. The prompt may use this string and never the raw number. */
export function rupiah(value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return `Rp ${formatNumber(value)}`
}

function tally(ids: Array<string | null>, names: ReadonlyMap<string, string>): PersonCount[] {
  return tallyLabels(ids.map((id) => (id ? (names.get(id) ?? "Tanpa nama") : "Belum ditugaskan")))
}

/** Counts per label, largest first, capped so the model reads a list and not a table. */
function tallyLabels(labels: Array<string | null>, limit = 8): PersonCount[] {
  const counts = new Map<string, number>()
  for (const label of labels) {
    const key = label && label.trim() ? label.trim() : "Belum diisi"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** "10.00" for the WIB hour a visit starts, so "jam tersibuk" is a fact, not a guess. */
function hourLabel(iso: string): string {
  return `${String(wibHourOf(new Date(iso))).padStart(2, "0")}.00`
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

/** "Senin 22 Sep" for the WIB day a visit falls on. */
function dayLabel(iso: string): string {
  const instant = new Date(iso)
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(instant)
  const index = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday)
  const date = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }).format(instant)
  return `${index >= 0 ? DAY_NAMES[index] : ""} ${date}`.trim()
}

const between = (iso: string | null | undefined, from: Date, to: Date): boolean => {
  if (!iso) return false
  const t = new Date(iso).getTime()
  return t >= from.getTime() && t < to.getTime()
}

/** Whitespace collapsed and cut to a length, or null when there is nothing to say. */
function text(value: string | null | undefined, limit: number): string | null {
  if (!value) return null
  const clean = value.replace(/\s+/g, " ").trim()
  return clean ? clean.slice(0, limit) : null
}

function tags(values: string[] | null | undefined): string[] {
  return (values ?? [])
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, TAGS_PER_REPORT)
}

/** A client's name as a key: the same client written with different spacing or case is one client. */
const clientKey = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase()

export function assembleFacts(input: FactInput): InsightFacts {
  const { day, now, names, labels, actionLabels, kinds, discEnabled, salesIds } = input
  const dayStart = wibDayStart(day)
  const dayEnd = wibDayStart(shiftDay(day, 1))
  const tomorrowEnd = wibDayStart(shiftDay(day, 2))
  const nextWeekEnd = wibDayStart(shiftDay(day, 8))
  const weekStart = wibDayStart(shiftDay(day, -6))
  const prevWeekStart = wibDayStart(shiftDay(day, -13))

  const inScope = (id: string | null) => !salesIds || (id !== null && salesIds.has(id))
  const missions = input.missions.filter((m) => inScope(m.primaryId))
  const missionById = new Map(missions.map((m) => [m.id, m]))
  const sent = input.reports.filter((r) => r.status !== "DRAFT" && missionById.has(r.missionId))
  const sentByMission = new Set(sent.map((r) => r.missionId))
  const label = (code: string | null) => (code ? (labels.get(code) ?? code) : null)
  const actionLabel = (code: string | null) => (code && code !== "NONE" ? (actionLabels.get(code) ?? code) : null)
  const personName = (id: string | null) => (id ? (names.get(id) ?? "Tanpa nama") : null)

  const todayMissions = missions.filter((m) => between(m.scheduledStart, dayStart, dayEnd))
  const tomorrowMissions = missions.filter((m) => between(m.scheduledStart, dayEnd, tomorrowEnd))
  const nextWeekMissions = missions.filter((m) => between(m.scheduledStart, dayEnd, nextWeekEnd))
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

  // Contacts met, per report, DISC only where the unit assesses it.
  const contactsByReport = new Map<string, ContactFact[]>()
  for (const row of input.contacts) {
    const list = contactsByReport.get(row.reportId) ?? []
    if (list.length >= CONTACTS_PER_REPORT) continue
    const { primary, secondary } = normalizeDisc(row.discPrimary, row.discSecondary)
    const disc = discEnabled ? discCode(primary, secondary) : ""
    list.push({
      name: row.name,
      jobTitle: text(row.jobTitle, 120),
      decisionMaker: row.decisionMaker,
      disc: disc || null,
      discNote: discEnabled ? text(row.discNote, 300) : null,
    })
    contactsByReport.set(row.reportId, list)
  }

  // The newest visit before today per client, for the clients visited today.
  const previousByClient = new Map<string, PreviousVisit>()
  for (const row of input.history) {
    if (row.day >= day) continue
    const key = clientKey(row.client)
    const known = previousByClient.get(key)
    if (!known || row.day > known.day) {
      previousByClient.set(key, { day: row.day, outcome: label(row.outcome), interest: label(row.interest), opportunity: row.opportunity })
    }
  }

  const openFollowUps = input.followUps.filter((f) => f.status === "OPEN" && inScope(f.ownerId))
  const lateFollowUps = openFollowUps.filter((f) => f.dueDate !== null && f.dueDate < day)

  const overdue = input.prospects.filter(
    (p) => inScope(p.ownerId) && (p.statusKind === "open" || p.statusKind === "in_progress") && p.nextContactAt !== null && p.nextContactAt <= day
  )

  const weekValue = weekReports.reduce((sum, r) => sum + (r.estimatedValue ?? 0), 0)

  return {
    day,
    people: salesIds ? [...salesIds].map((id) => names.get(id) ?? "Tanpa nama") : null,
    today: {
      scheduled: todayMissions.length,
      scheduledByPerson: tally(todayMissions.map((m) => m.primaryId), names),
      byHour: tallyLabels(todayMissions.map((m) => hourLabel(m.scheduledStart))),
      byIndustry: tallyLabels(todayMissions.map((m) => m.industry)),
      reportsSubmitted: todayReports.length,
      reports: todayReports.slice(0, TODAY_REPORTS).map((r) => {
        const mission = missionById.get(r.missionId)!
        return {
          missionId: mission.id,
          client: mission.client,
          sales: personName(mission.primaryId) ?? "Belum ditugaskan",
          outcome: label(r.visitOutcome),
          interest: label(r.interestLevel),
          interestKind: r.interestLevel ? (kinds.get(r.interestLevel) ?? null) : null,
          opportunity: r.opportunityExists,
          estimatedValue: r.estimatedValue,
          estimatedValueText: rupiah(r.estimatedValue),
          sentToCrm: r.crmSyncedAt !== null,
          clientNeeds: tags(r.clientNeeds),
          productInterest: tags(r.productInterest),
          competitor: text(r.competitorMentioned, 200),
          nextAction: actionLabel(r.nextActionType),
          nextActionOwner: personName(r.nextActionOwnerId),
          followUpDate: r.followUpDate,
          contacts: contactsByReport.get(r.id) ?? [],
          summary: text(r.meetingSummary, TODAY_SUMMARY_CHARS),
          previousVisit: previousByClient.get(clientKey(mission.client)) ?? null,
        }
      }),
    },
    tomorrow: {
      scheduled: tomorrowMissions.length,
      byPerson: tally(tomorrowMissions.map((m) => m.primaryId), names),
      byHour: tallyLabels(tomorrowMissions.map((m) => hourLabel(m.scheduledStart))),
      byIndustry: tallyLabels(tomorrowMissions.map((m) => m.industry)),
    },
    nextWeek: {
      scheduled: nextWeekMissions.length,
      byPerson: tally(nextWeekMissions.map((m) => m.primaryId), names),
      byIndustry: tallyLabels(nextWeekMissions.map((m) => m.industry)),
      byDay: tallyLabels(nextWeekMissions.map((m) => dayLabel(m.scheduledStart))),
    },
    pending: {
      count: pendingMissions.length,
      byPerson: tally(pendingMissions.map((m) => m.primaryId), names),
      oldestDays: oldestPending,
    },
    followUps: {
      open: openFollowUps.length,
      late: lateFollowUps.length,
      openByPerson: tally(openFollowUps.map((f) => f.ownerId), names),
      lateByPerson: tally(lateFollowUps.map((f) => f.ownerId), names),
      lateList: [...lateFollowUps]
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, LATE_FOLLOW_UPS)
        .map((f) => ({
          client: f.client,
          action: actionLabel(f.actionType) ?? f.actionType,
          owner: personName(f.ownerId) ?? "Belum ditugaskan",
          dueDate: f.dueDate!,
          daysLate: dayGap(f.dueDate!, day),
        })),
    },
    prospects: {
      overdue: overdue.length,
      byPerson: tally(overdue.map((p) => p.ownerId), names),
      list: [...overdue]
        .sort((a, b) => (a.nextContactAt ?? "").localeCompare(b.nextContactAt ?? ""))
        .slice(0, OVERDUE_PROSPECTS)
        .map((p) => ({
          client: p.client,
          owner: personName(p.ownerId) ?? "Belum ditugaskan",
          daysOverdue: dayGap(p.nextContactAt!, day),
        })),
    },
    week: {
      reports: weekReports.length,
      reportsPreviousWeek: prevWeekReports.length,
      reportsBaseline: prevWeekReports.length === 0,
      appointments: weekAppointments.length,
      appointmentsPreviousWeek: prevWeekAppointments.length,
      appointmentsBaseline: prevWeekAppointments.length === 0,
      opportunities: weekReports.filter((r) => r.opportunityExists).length,
      opportunitiesNotSentToCrm: weekReports.filter((r) => r.opportunityExists && r.crmSyncedAt === null).length,
      estimatedValue: weekValue,
      estimatedValueText: rupiah(weekValue) ?? "Rp 0",
      reportsByPerson: tally(weekReports.map((r) => missionById.get(r.missionId)?.primaryId ?? null), names),
      reportsByIndustry: tallyLabels(weekReports.map((r) => missionById.get(r.missionId)?.industry ?? null)),
      appointmentsByIndustry: tallyLabels(weekAppointments.map((m) => m.industry)),
      appointmentsByHour: tallyLabels(weekAppointments.map((m) => hourLabel(m.scheduledStart)), 5),
      byOutcome: tallyLabels(weekReports.map((r) => label(r.visitOutcome))),
      byInterest: tallyLabels(weekReports.map((r) => label(r.interestLevel))),
      topClients: tallyLabels(weekReports.map((r) => missionById.get(r.missionId)?.client ?? null), 5),
      recentReports: [...weekReports]
        .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""))
        .slice(0, WEEK_REPORTS)
        .map((r) => {
          const mission = missionById.get(r.missionId)!
          return {
            day: r.submittedAt ? wibDayOf(new Date(r.submittedAt)) : day,
            client: mission.client,
            sales: personName(mission.primaryId) ?? "Belum ditugaskan",
            outcome: label(r.visitOutcome),
            interest: label(r.interestLevel),
            interestKind: r.interestLevel ? (kinds.get(r.interestLevel) ?? null) : null,
            opportunity: r.opportunityExists,
            estimatedValue: r.estimatedValue,
            estimatedValueText: rupiah(r.estimatedValue),
            clientNeeds: tags(r.clientNeeds),
            productInterest: tags(r.productInterest),
            competitor: text(r.competitorMentioned, 200),
            summary: text(r.meetingSummary, WEEK_SUMMARY_CHARS),
          }
        }),
    },
  }
}

const EMPTY_ROWS = Promise.resolve({ data: [] as Array<Record<string, unknown>> })

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
  const toIso = wibDayStart(shiftDay(day, 8)).toISOString()
  const dayStartIso = wibDayStart(day).toISOString()
  const dayEndIso = wibDayStart(shiftDay(day, 1)).toISOString()

  const [{ data: missionRows }, { data: prospectRows }, { data: statusRows }, { data: choiceRows }, { data: settingsRow }] = await Promise.all([
    missions
      .from("missions")
      .select("id, client_company_name_snapshot, scheduled_start, status, industry")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("status", "in", "(CANCELLED,REJECTED)")
      .gte("scheduled_start", fromIso)
      .lt("scheduled_start", toIso)
      .limit(2000),
    missions
      .from("prospects")
      .select("client_company_name, owner_id, next_contact_at, status_id")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .not("next_contact_at", "is", null)
      .lte("next_contact_at", day)
      .limit(2000),
    missions.from("prospect_statuses").select("id, kind").eq("company_id", companyId),
    missions
      .from("report_choices")
      .select("code, label, kind, field_key")
      .eq("company_id", companyId)
      .in("field_key", ["visit_outcome", "interest_level", "next_action_type"]),
    missions.from("mission_settings").select("contact_disc_enabled").eq("company_id", companyId).maybeSingle(),
  ])

  const missionIds = (missionRows ?? []).map((row) => row.id as string)
  const [{ data: assignmentRows }, { data: reportRows }, { data: followUpRows }] = await Promise.all([
    missionIds.length ? missions.from("assignments").select("mission_id, user_id").eq("assignment_role", "PRIMARY").in("mission_id", missionIds) : EMPTY_ROWS,
    missionIds.length
      ? missions
          .from("visit_reports")
          .select(
            "id, mission_id, status, submitted_at, visit_outcome, interest_level, opportunity_exists, estimated_value, next_action_type, next_action_owner, follow_up_date, meeting_summary, client_needs, product_interest, competitor_mentioned, crm_synced_at"
          )
          .eq("company_id", companyId)
          .in("mission_id", missionIds)
      : EMPTY_ROWS,
    missions
      .from("follow_ups")
      .select("mission_id, action_type, owner_id, due_date, status")
      .eq("company_id", companyId)
      .eq("status", "OPEN")
      .limit(500),
  ])

  // Who was met today, and what the same clients did last time: both hang
  // off today's reports, so they are a second round trip.
  const todayReportRows = (reportRows ?? []).filter(
    (row) => row.status !== "DRAFT" && typeof row.submitted_at === "string" && row.submitted_at >= dayStartIso && row.submitted_at < dayEndIso
  )
  const todayReportIds = todayReportRows.map((row) => row.id as string).slice(0, 40)
  const missionClient = new Map((missionRows ?? []).map((row) => [row.id as string, (row.client_company_name_snapshot as string | null) ?? "Klien"]))
  const todayClients = [...new Set(todayReportRows.map((row) => missionClient.get(row.mission_id as string)).filter((name): name is string => Boolean(name)))].slice(0, 25)
  const followUpMissionIds = [...new Set((followUpRows ?? []).map((row) => row.mission_id as string))].filter((id) => !missionClient.has(id))

  const [{ data: contactRows }, { data: pastMissionRows }, { data: followUpMissionRows }] = await Promise.all([
    todayReportIds.length
      ? missions
          .from("report_contacts")
          .select("report_id, full_name, job_title, is_decision_maker, disc_primary, disc_secondary, disc_note")
          .eq("company_id", companyId)
          .in("report_id", todayReportIds)
          .order("created_at")
          .limit(200)
      : EMPTY_ROWS,
    todayClients.length
      ? missions
          .from("missions")
          .select("id, client_company_name_snapshot, scheduled_start")
          .eq("company_id", companyId)
          .is("deleted_at", null)
          .in("client_company_name_snapshot", todayClients)
          .lt("scheduled_start", dayStartIso)
          .order("scheduled_start", { ascending: false })
          .limit(150)
      : EMPTY_ROWS,
    followUpMissionIds.length
      ? missions.from("missions").select("id, client_company_name_snapshot").eq("company_id", companyId).in("id", followUpMissionIds).limit(500)
      : EMPTY_ROWS,
  ])

  const pastMissionIds = (pastMissionRows ?? []).map((row) => row.id as string)
  const { data: pastReportRows } = pastMissionIds.length
    ? await missions
        .from("visit_reports")
        .select("mission_id, visit_outcome, interest_level, opportunity_exists")
        .eq("company_id", companyId)
        .neq("status", "DRAFT")
        .in("mission_id", pastMissionIds)
    : await EMPTY_ROWS

  const primaryByMission = new Map<string, string>()
  for (const row of assignmentRows ?? []) primaryByMission.set(row.mission_id as string, row.user_id as string)
  const kindByStatus = new Map<string, string>()
  for (const row of statusRows ?? []) kindByStatus.set(row.id as string, row.kind as string)
  for (const row of followUpMissionRows ?? []) missionClient.set(row.id as string, (row.client_company_name_snapshot as string | null) ?? "Klien")

  const userIds = new Set<string>()
  for (const id of primaryByMission.values()) userIds.add(id)
  for (const row of prospectRows ?? []) if (row.owner_id) userIds.add(row.owner_id as string)
  for (const row of followUpRows ?? []) if (row.owner_id) userIds.add(row.owner_id as string)
  for (const row of reportRows ?? []) if (row.next_action_owner) userIds.add(row.next_action_owner as string)
  if (salesIds) for (const id of salesIds) userIds.add(id)
  const names = new Map<string, string>()
  if (userIds.size) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", [...userIds])
    for (const row of profiles ?? []) if (row.full_name) names.set(row.id as string, row.full_name as string)
  }
  const labels = new Map<string, string>()
  const actionLabels = new Map<string, string>()
  const kinds = new Map<string, string>()
  for (const row of choiceRows ?? []) {
    const code = row.code as string
    if (row.field_key === "next_action_type") actionLabels.set(code, row.label as string)
    else labels.set(code, row.label as string)
    if (row.field_key === "interest_level") kinds.set(code, row.kind as string)
  }

  const pastMissionById = new Map((pastMissionRows ?? []).map((row) => [row.id as string, row]))

  return assembleFacts({
    day,
    now,
    names,
    labels,
    actionLabels,
    kinds,
    discEnabled: Boolean(settingsRow?.contact_disc_enabled),
    salesIds,
    missions: (missionRows ?? []).map((row) => ({
      id: row.id as string,
      client: (row.client_company_name_snapshot as string | null) ?? "Klien",
      scheduledStart: row.scheduled_start as string,
      status: row.status as string,
      primaryId: primaryByMission.get(row.id as string) ?? null,
      industry: (row.industry as string | null) ?? null,
    })),
    reports: (reportRows ?? []).map((row) => ({
      id: row.id as string,
      missionId: row.mission_id as string,
      status: row.status as string,
      submittedAt: (row.submitted_at as string | null) ?? null,
      visitOutcome: (row.visit_outcome as string | null) ?? null,
      interestLevel: (row.interest_level as string | null) ?? null,
      opportunityExists: Boolean(row.opportunity_exists),
      estimatedValue: row.estimated_value === null || row.estimated_value === undefined ? null : Number(row.estimated_value),
      nextActionType: (row.next_action_type as string | null) ?? null,
      nextActionOwnerId: (row.next_action_owner as string | null) ?? null,
      followUpDate: (row.follow_up_date as string | null) ?? null,
      meetingSummary: (row.meeting_summary as string | null) ?? null,
      clientNeeds: (row.client_needs as string[] | null) ?? [],
      productInterest: (row.product_interest as string[] | null) ?? [],
      competitorMentioned: (row.competitor_mentioned as string | null) ?? null,
      crmSyncedAt: (row.crm_synced_at as string | null) ?? null,
    })),
    contacts: (contactRows ?? []).map((row) => ({
      reportId: row.report_id as string,
      name: row.full_name as string,
      jobTitle: (row.job_title as string | null) ?? null,
      decisionMaker: Boolean(row.is_decision_maker),
      discPrimary: (row.disc_primary as string | null) ?? null,
      discSecondary: (row.disc_secondary as string | null) ?? null,
      discNote: (row.disc_note as string | null) ?? null,
    })),
    followUps: (followUpRows ?? []).map((row) => ({
      missionId: row.mission_id as string,
      client: missionClient.get(row.mission_id as string) ?? "Klien",
      actionType: row.action_type as string,
      ownerId: (row.owner_id as string | null) ?? null,
      dueDate: (row.due_date as string | null) ?? null,
      status: row.status as string,
    })),
    prospects: (prospectRows ?? []).map((row) => ({
      client: (row.client_company_name as string | null) ?? "Prospek",
      ownerId: (row.owner_id as string | null) ?? null,
      nextContactAt: (row.next_contact_at as string | null) ?? null,
      statusKind: kindByStatus.get(row.status_id as string) ?? "open",
    })),
    history: (pastReportRows ?? []).flatMap((row) => {
      const mission = pastMissionById.get(row.mission_id as string)
      if (!mission) return []
      return [
        {
          client: (mission.client_company_name_snapshot as string | null) ?? "Klien",
          day: wibDayOf(new Date(mission.scheduled_start as string)),
          outcome: (row.visit_outcome as string | null) ?? null,
          interest: (row.interest_level as string | null) ?? null,
          opportunity: Boolean(row.opportunity_exists),
        },
      ]
    }),
  })
}
