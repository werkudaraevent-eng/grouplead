import { MISSION_TIME_ZONE, type MissionListItem } from "@/lib/missions/mission-schema"
import type { VisitReportRecord } from "@/lib/missions/mission-queries"
import { labelOf, type ChoiceSet } from "@/lib/missions/report-choices"
import { formatNumber } from "@/lib/format/number"

/**
 * The visit report as a WhatsApp message.
 *
 * Teams post every visit to a group by hand, in a format that drifts from
 * one person to the next. WhatsApp has no official way for a product to post
 * into a group, so the app does what Strava or Google Photos do: it composes
 * the message from the report and hands it to the phone's share sheet, and
 * the rep picks the group. The format belongs to the unit's admin: one
 * template (Pengaturan → Aturan aktivitas), placeholders in the team's words,
 * empty means this default, which mirrors the format the group already uses.
 *
 * Rules a template can rely on: a line whose placeholders all came back empty
 * is dropped (no "Jabatan :" with nothing after it); a placeholder the app
 * does not know is left as typed; {foto} adds the report's first photo to the
 * share instead of text. Pure, so the settings preview and the button agree.
 */
export const DEFAULT_REPORT_SHARE_TEMPLATE = [
  "WSM | {tanggal} | {jam}",
  "Company : {klien}",
  "Nama PIC : {pic}",
  "Jabatan : {jabatan}",
  "",
  "{ringkasan}",
  "{foto}",
].join("\n")

export const REPORT_SHARE_PLACEHOLDERS: ReadonlyArray<{ token: string; means: string }> = [
  { token: "{tanggal}", means: "tanggal kunjungan, misalnya 21 Sep 2026" },
  { token: "{hari}", means: "nama hari, misalnya Senin" },
  { token: "{jam}", means: "jam mulai sesuai jadwal, misalnya 11.00" },
  { token: "{jam_selesai}", means: "jam selesai sesuai jadwal" },
  { token: "{jam_aktual}", means: "jam mulai dan selesai yang dicatat di laporan" },
  { token: "{klien}", means: "nama klien" },
  { token: "{industri}", means: "industri klien" },
  { token: "{lokasi}", means: "lokasi kunjungan" },
  { token: "{alamat}", means: "alamat" },
  { token: "{jenis}", means: "jenis kunjungan" },
  { token: "{tujuan}", means: "tujuan kunjungan" },
  { token: "{sales}", means: "sales utama" },
  { token: "{tim}", means: "semua sales yang hadir" },
  { token: "{pic}", means: "orang yang ditemui, yang pertama di laporan" },
  { token: "{jabatan}", means: "jabatannya" },
  { token: "{semua_pic}", means: "semua yang ditemui, dengan jabatan" },
  { token: "{hasil}", means: "hasil kunjungan" },
  { token: "{minat}", means: "tingkat minat" },
  { token: "{peluang}", means: "Ada peluang, atau Belum ditandai bila centangnya kosong" },
  { token: "{nilai}", means: "perkiraan nilai" },
  { token: "{next_action}", means: "next action, penanggung jawab, dan tanggalnya" },
  { token: "{ringkasan}", means: "ringkasan pertemuan" },
  { token: "{kebutuhan}", means: "kebutuhan klien" },
  { token: "{produk}", means: "produk yang diminati" },
  { token: "{kompetitor}", means: "kompetitor yang disebut" },
  { token: "{foto}", means: "menyertakan foto pertama laporan; WhatsApp memakai teksnya sebagai keterangan foto" },
]

export type ReportShareValues = Record<string, string>

export interface ReportShare {
  text: string
  /** The template asked for {foto}: attach the report's first photo. */
  withPhoto: boolean
}

const PLACEHOLDER = /\{([a-z_]+)\}/g

export function renderReportShare(template: string | null | undefined, values: ReportShareValues): ReportShare {
  const source = template?.trim() || DEFAULT_REPORT_SHARE_TEMPLATE
  let withPhoto = false
  const lines: string[] = []
  for (const line of source.split(/\r?\n/)) {
    let asked = false
    let filled = false
    const out = line.replace(PLACEHOLDER, (match, key: string) => {
      if (key === "foto") {
        withPhoto = true
        asked = true
        return ""
      }
      if (!(key in values)) return match
      asked = true
      const value = values[key].trim()
      if (value) filled = true
      return value
    })
    if (asked && !filled) continue
    lines.push(out.replace(/[ \t]+$/, ""))
  }
  return { text: lines.join("\n").replace(/\n{3,}/g, "\n\n").trim(), withPhoto }
}

const dateFormat = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, ...options })

function at(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

const clock = (date: Date | null) => (date ? dateFormat({ hour: "2-digit", minute: "2-digit" }).format(date) : "")

/** "2026-09-30" as the team writes dates: "30 Sep 2026". */
function calendarDay(day: string | null | undefined): string {
  if (!day) return ""
  const date = new Date(`${day}T00:00:00+07:00`)
  return Number.isNaN(date.getTime()) ? day : dateFormat({ day: "numeric", month: "short", year: "numeric" }).format(date)
}

/** Every placeholder's value for one visit, from the mission, its report and the tenant's choice labels. */
export function reportShareValues({
  mission,
  report,
  choices,
  team,
}: {
  mission: MissionListItem
  report: VisitReportRecord
  choices: ChoiceSet | null
  /** Names of everyone on the visit, primary first. */
  team: string[]
}): ReportShareValues {
  const start = at(mission.scheduledStart)
  const end = at(mission.scheduledEnd)
  const actualStart = at(report.actualStart)
  const actualEnd = at(report.actualEnd)
  const first = report.contacts[0]
  const nextActionType = report.nextActionType === "NONE" ? "" : labelOf(choices, "next_action_type", report.nextActionType)
  const people = team.length > 0 ? team : [mission.primarySalesName, ...mission.supportingSalesNames].filter((name): name is string => Boolean(name))

  return {
    tanggal: start ? dateFormat({ day: "numeric", month: "short", year: "numeric" }).format(start) : "",
    hari: start ? dateFormat({ weekday: "long" }).format(start) : "",
    jam: clock(start),
    jam_selesai: clock(end),
    jam_aktual: actualStart ? [clock(actualStart), clock(actualEnd)].filter(Boolean).join("–") : "",
    klien: mission.clientCompanyName,
    industri: mission.industry ?? "",
    lokasi: mission.location ?? "",
    alamat: mission.address ?? "",
    jenis: mission.missionType,
    tujuan: mission.objective ?? "",
    sales: people[0] ?? "",
    tim: people.join(", "),
    pic: first?.fullName || mission.appointment.name || "",
    jabatan: first?.jobTitle || (first ? "" : mission.appointment.jobTitle || ""),
    semua_pic: report.contacts.map((contact) => (contact.jobTitle ? `${contact.fullName} (${contact.jobTitle})` : contact.fullName)).join(", "),
    hasil: report.visitOutcome ? labelOf(choices, "visit_outcome", report.visitOutcome) : "",
    minat: report.interestLevel ? labelOf(choices, "interest_level", report.interestLevel) : "",
    peluang: report.opportunityExists ? "Ada peluang" : "Belum ditandai",
    nilai: report.estimatedValue !== null && report.estimatedValue > 0 ? formatNumber(report.estimatedValue) : "",
    next_action: [nextActionType, report.nextActionOwner ?? "", calendarDay(report.followUpDate)].filter(Boolean).join(" · "),
    ringkasan: report.meetingSummary.trim(),
    kebutuhan: report.clientNeeds.join(", "),
    produk: report.productInterest.join(", "),
    kompetitor: report.competitorMentioned.trim(),
  }
}

/** What the settings preview renders, so the admin sees a real-looking message while editing. */
export const SAMPLE_REPORT_SHARE_VALUES: ReportShareValues = {
  tanggal: "21 Sep 2026",
  hari: "Senin",
  jam: "11.00",
  jam_selesai: "12.00",
  jam_aktual: "11.05–11.50",
  klien: "Prime Travelindo",
  industri: "Travel",
  lokasi: "Jakarta Selatan",
  alamat: "Jl. Sudirman Kav. 1",
  jenis: "Meeting",
  tujuan: "Perkenalan dan penawaran paket outing",
  sales: "Ananda Putri",
  tim: "Ananda Putri, Dita Rahma",
  pic: "Pak Budi",
  jabatan: "Operations Manager",
  semua_pic: "Pak Budi (Operations Manager)",
  hasil: "Bertemu pengambil keputusan",
  minat: "Hangat",
  peluang: "Ada peluang",
  nilai: "150.000.000",
  next_action: "Kirim proposal · Ananda Putri · 28 Sep 2026",
  ringkasan: "Prime Travelindo saat ini fokus ke ticketing pesawat; permintaan LA dilempar ke rekanan. Sedang menangani outing 400-an pax ke Belitung.",
  kebutuhan: "Paket outing, tiket grup",
  produk: "Outing Belitung",
  kompetitor: "",
}
