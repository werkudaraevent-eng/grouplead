/**
 * The rows Tanya AI may see, shaped for a model: short Indonesian keys,
 * dates and times in WIB, nothing a list page would not show. Pure, so
 * the shaping is tested without a database. Every list is capped, and a
 * capped list says so, so the model never mistakes a slice for the whole.
 */

import type { MissionListItem } from "@/lib/missions/mission-schema"
import type { ReportListItem } from "@/lib/reporting/report-list-queries"
import type { ProspectListItem } from "@/lib/prospects/prospect-schema"
import { wibDayOf, wibHourOf } from "./insight-facts"

export interface ActivityRow {
  tanggal: string
  /** "09.30" in WIB, or null when unscheduled. */
  jam: string | null
  klien: string
  sales: string | null
  pendamping?: string[]
  lokasi: string | null
  industri: string | null
  jenis: string
  status: string
  /** Whether what happened was written down. */
  laporan: "sudah" | "draf" | "perlu klarifikasi" | "belum"
  hasil?: string | null
}

export interface ReportRow {
  tanggal: string
  klien: string
  sales: string | null
  jenis: string
  hasil: string | null
  minat: string | null
  peluang: boolean
  nilai_estimasi: number | null
  next_action: string
  pemilik_next_action: string | null
  tanggal_follow_up: string | null
  status: string
}

export interface ProspectRow {
  klien: string
  pemilik: string | null
  status: string
  industri: string | null
  hubungi_lagi: string | null
  terlambat_hari: number | null
}

export interface CappedList<T> {
  baris: T[]
  total: number
  /** True when `baris` is a slice; the model is told to say so. */
  terpotong: boolean
}

const STATUS_WORDS: Record<string, string> = {
  DRAFT: "draf",
  SCHEDULED: "terjadwal",
  ASSIGNED: "terjadwal",
  ACCEPTED: "terjadwal",
  IN_PROGRESS: "berlangsung",
  COMPLETED: "selesai",
  CANCELLED: "dibatalkan",
  RESCHEDULE_REQUESTED: "minta jadwal ulang",
  REJECTED: "ditolak",
}

const REPORT_WORDS: Record<string, string> = {
  SUBMITTED: "terkirim",
  NEEDS_CLARIFICATION: "perlu klarifikasi",
  DRAFT: "draf",
  NONE: "belum ada",
}

export function wibTime(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const hour = wibHourOf(date)
  const minute = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", minute: "2-digit" }).format(date)
  return `${String(hour).padStart(2, "0")}.${minute.padStart(2, "0")}`
}

export function toActivityRow(mission: MissionListItem): ActivityRow {
  const laporan: ActivityRow["laporan"] =
    mission.reportStatus === "SUBMITTED" ? "sudah" : mission.reportStatus === "DRAFT" ? "draf" : mission.reportStatus === "NEEDS_CLARIFICATION" ? "perlu klarifikasi" : "belum"
  const row: ActivityRow = {
    tanggal: mission.scheduledStart ? wibDayOf(new Date(mission.scheduledStart)) : "belum dijadwalkan",
    jam: wibTime(mission.scheduledStart),
    klien: mission.clientCompanyName,
    sales: mission.primarySalesName,
    lokasi: mission.location,
    industri: mission.industry ?? null,
    jenis: mission.missionType,
    status: STATUS_WORDS[mission.status] ?? mission.status.toLowerCase(),
    laporan,
  }
  if (mission.supportingSalesNames.length) row.pendamping = mission.supportingSalesNames
  if (mission.visitOutcomeLabel ?? mission.visitOutcome) row.hasil = mission.visitOutcomeLabel ?? mission.visitOutcome
  return row
}

export function toReportRow(report: ReportListItem): ReportRow {
  const when = report.actualStart ?? report.scheduledStart
  return {
    tanggal: when ? wibDayOf(new Date(when)) : "tanpa tanggal",
    klien: report.clientCompanyName,
    sales: report.primarySalesName,
    jenis: report.missionType,
    hasil: report.visitOutcomeLabel ?? report.visitOutcome,
    minat: report.interestLevelLabel ?? report.interestLevel,
    peluang: report.opportunityExists,
    nilai_estimasi: report.estimatedValue,
    next_action: report.nextActionLabel,
    pemilik_next_action: report.nextActionOwnerName,
    tanggal_follow_up: report.followUpDate,
    status: REPORT_WORDS[report.status] ?? report.status.toLowerCase(),
  }
}

export function toProspectRow(prospect: ProspectListItem, today: string): ProspectRow {
  const due = prospect.nextContactAt
  const late = due ? Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86_400_000) : null
  return {
    klien: prospect.clientCompanyName,
    pemilik: prospect.ownerName,
    status: prospect.statusLabel,
    industri: prospect.industry,
    hubungi_lagi: due,
    terlambat_hari: late !== null && late > 0 ? late : null,
  }
}

/** The `limit` rows nearest to `today` (by the row's date), in date order; the rest are counted, not shown. */
export function capByNearestDay<T extends { tanggal: string }>(rows: T[], today: string, limit: number): CappedList<T> {
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const distance = (row: T) => {
    const ms = Date.parse(`${row.tanggal}T00:00:00Z`)
    return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : Math.abs(ms - todayMs)
  }
  const kept = [...rows]
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, limit)
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  return { baris: kept, total: rows.length, terpotong: rows.length > kept.length }
}

export function capList<T>(rows: T[], limit: number): CappedList<T> {
  return { baris: rows.slice(0, limit), total: rows.length, terpotong: rows.length > limit }
}

/** Activities per WIB hour ("09.00": 4), for "jam berapa" questions. */
export function hourBuckets(rows: ActivityRow[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    if (!row.jam) continue
    const key = `${row.jam.slice(0, 2)}.00`
    out[key] = (out[key] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)))
}
