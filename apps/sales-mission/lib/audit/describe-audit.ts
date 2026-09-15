import { STATUS_LABELS, type LabelledStatus } from "@/lib/missions/status-labels"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

/**
 * Turn an audit row into a sentence.
 *
 * The database records the truth (table, operation, changed columns). This
 * turns that into what an admin scans for: who, did what, to which mission.
 * Pure, so the wording is tested rather than eyeballed, and so the same
 * sentence appears wherever the log is shown.
 */

export type AuditAction = "INSERT" | "UPDATE" | "DELETE"

export interface AuditRow {
  id: number
  actorId: string | null
  actorName: string | null
  tableName: string
  action: AuditAction
  entityId: string
  missionId: string | null
  entityLabel: string | null
  /** UPDATE: {column: {from, to}}. INSERT: {to: row}. DELETE: {from: row}. */
  changes: Record<string, unknown>
  txId: number
  createdAt: string
}

export type AuditTone = "create" | "update" | "delete" | "neutral"

export interface AuditDescription {
  /** Without the actor: "membuat mission ke PT Arunika". */
  sentence: string
  tone: AuditTone
  /** Field-level lines for the expandable detail, already labelled. */
  details: Array<{ field: string; from: string; to: string }>
}

const TABLE_LABELS: Record<string, string> = {
  missions: "mission",
  assignments: "penugasan",
  visit_reports: "laporan kunjungan",
  report_contacts: "kontak laporan",
  supporting_notes: "catatan pendukung",
  reschedule_requests: "usulan jadwal",
  mission_settings: "aturan mission",
  form_fields: "field form",
  board_tokens: "tautan papan",
  lead_pushes: "kiriman lead",
  mission_field_values: "isian field tambahan",
  prospects: "prospek",
  prospect_attempts: "kontak prospek",
  prospect_statuses: "status prospek",
}

export const AUDIT_TABLE_LABELS = TABLE_LABELS

const COLUMN_LABELS: Record<string, string> = {
  status: "status",
  deleted_at: "sampah",
  deleted_by: "dihapus oleh",
  scheduled_start: "jam mulai",
  scheduled_end: "jam selesai",
  location: "lokasi",
  objective: "tujuan",
  client_company_name_snapshot: "perusahaan",
  client_company_id: "tautan CRM",
  mission_type: "jenis",
  allow_join: "terbuka untuk join",
  response: "jawaban",
  assignment_role: "peran",
  contact_name: "nama kontak",
  contact_phone: "telepon kontak",
  contact_email: "email kontak",
  contact_job_title: "jabatan kontak",
  contact_division: "divisi kontak",
  contact_salutation: "sapaan",
  building: "gedung",
  address: "alamat",
  appointment_notes: "catatan janji temu",
  visit_outcome: "hasil kunjungan",
  interest_level: "tingkat minat",
  meeting_summary: "ringkasan",
  next_action_type: "tindak lanjut",
  follow_up_date: "tanggal tindak lanjut",
  estimated_value: "estimasi nilai",
  reason: "alasan",
  decision_note: "catatan keputusan",
  proposed_start: "usulan mulai",
  proposed_end: "usulan selesai",
  require_assignment_confirmation: "sales harus mengonfirmasi",
  primary_can_reschedule: "sales utama bisa memindahkan jadwal",
  conflict_check_enabled: "periksa bentrok",
  default_travel_buffer_minutes: "jeda perjalanan",
  allow_same_location_back_to_back: "tanpa jeda di lokasi sama",
  max_supporting_per_mission: "maks sales pendukung",
  label: "label",
  is_required: "wajib diisi",
  is_active: "aktif",
  display_order: "urutan",
  options: "pilihan",
  placeholder: "placeholder",
  help_text: "petunjuk",
  revoked_at: "dicabut",
  expires_at: "kedaluwarsa",
  full_name: "nama",
  client_company_name: "perusahaan",
  owner_id: "pemegang",
  status_id: "status",
  next_contact_at: "hubungi lagi pada",
  lost_reason: "alasan",
  industry: "industri",
  website: "website",
  notes: "catatan",
  channel: "saluran",
  outcome: "hasil",
  note: "catatan",
  kind: "jenis",
  color: "warna",
  source: "sumber",
  job_title: "jabatan",
  is_decision_maker: "pengambil keputusan",
  body: "isi",
  value: "isi",
}

const HIDDEN_COLUMNS = new Set([
  "id",
  "company_id",
  "mission_id",
  "report_id",
  "created_by",
  "updated_by",
  "submitted_by",
  "requested_by",
  "decided_by",
  "pushed_by",
  "user_id",
  "field_id",
  "token_hash",
  "idempotency_key",
  "created_at",
  "updated_at",
  "responded_at",
  "submitted_at",
  "decided_at",
  "pushed_at",
  "last_used_at",
  "crm_synced_at",
  "crm_sync_error",
  "lead_engine_contact_id",
  "prospect_id",
  "import_batch_id",
  "client_company_name_norm",
  "contact_name_norm",
  "contact_phone_norm",
  "converted_at",
  "status_id_after",
  "attempted_at",
  "attempt_count",
  "last_contacted_at",
  "deleted_at",
  "deleted_by",
  "code",
  "lead_engine_lead_id",
  "pipeline_id",
  "pipeline_stage_id",
  "owner_user_id",
  "version",
])

function isIso(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
}

function formatValue(column: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "kosong"
  if (typeof value === "boolean") return value ? "ya" : "tidak"
  if (typeof value === "number") return String(value)
  if (Array.isArray(value)) return value.length ? value.map((item) => formatValue(column, item)).join(", ") : "kosong"
  if (typeof value === "object") return JSON.stringify(value)
  const text = String(value)
  if (column === "status" || column === "response") return STATUS_LABELS[text as LabelledStatus] ?? text
  if (isIso(text)) {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: MISSION_TIME_ZONE,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(text))
  }
  return text.length > 80 ? `${text.slice(0, 77)}…` : text
}

function fieldLabel(column: string): string {
  return COLUMN_LABELS[column] ?? column.replaceAll("_", " ")
}

function changedColumns(row: AuditRow): Array<{ column: string; from: unknown; to: unknown }> {
  if (row.action !== "UPDATE") return []
  return Object.entries(row.changes)
    .filter(([column]) => !HIDDEN_COLUMNS.has(column))
    .map(([column, diff]) => {
      const pair = diff as { from?: unknown; to?: unknown }
      return { column, from: pair?.from, to: pair?.to }
    })
}

function label(row: AuditRow): string {
  return row.entityLabel ?? "(tanpa nama)"
}

export function describeAudit(row: AuditRow): AuditDescription {
  const changed = changedColumns(row)
  const details = changed.map((item) => ({
    field: fieldLabel(item.column),
    from: formatValue(item.column, item.from),
    to: formatValue(item.column, item.to),
  }))
  const what = TABLE_LABELS[row.tableName] ?? row.tableName
  const name = label(row)
  const has = (column: string) => changed.some((item) => item.column === column)
  const to = (column: string) => (row.changes[column] as { to?: unknown } | undefined)?.to
  const from = (column: string) => (row.changes[column] as { from?: unknown } | undefined)?.from
  const inserted = row.changes.to as Record<string, unknown> | undefined

  switch (row.tableName) {
    case "missions":
      if (row.action === "INSERT") return { sentence: `membuat mission ke ${name}`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `menghapus permanen mission ke ${name}`, tone: "delete", details }
      if (has("deleted_at")) {
        return to("deleted_at")
          ? { sentence: `memindahkan mission ke ${name} ke sampah`, tone: "delete", details }
          : { sentence: `memulihkan mission ke ${name} dari sampah`, tone: "create", details }
      }
      if (has("status")) {
        const next = to("status")
        if (next === "CANCELLED") return { sentence: `membatalkan mission ke ${name}`, tone: "delete", details }
        if (next === "COMPLETED") return { sentence: `menyelesaikan mission ke ${name}`, tone: "create", details }
        return {
          sentence: `mengubah status mission ke ${name}: ${formatValue("status", from("status"))} → ${formatValue("status", next)}`,
          tone: "update",
          details,
        }
      }
      if (has("scheduled_start") || has("scheduled_end")) {
        return { sentence: `memindahkan jadwal mission ke ${name}`, tone: "update", details }
      }
      if (has("allow_join")) {
        return { sentence: `${to("allow_join") ? "membuka" : "menutup"} mission ke ${name} untuk join`, tone: "update", details }
      }
      return { sentence: `mengubah ${details.map((d) => d.field).join(", ") || "detail"} pada mission ke ${name}`, tone: "update", details }

    case "prospects": {
      const source = inserted?.source
      if (row.action === "INSERT") return { sentence: source === "import" ? `mengimpor prospek ${name}` : `menambah prospek ${name}`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `menghapus permanen prospek ${name}`, tone: "delete", details }
      if ("deleted_at" in row.changes) {
        return to("deleted_at")
          ? { sentence: `memindahkan prospek ${name} ke sampah`, tone: "delete", details }
          : { sentence: `memulihkan prospek ${name} dari sampah`, tone: "create", details }
      }
      if ("mission_id" in row.changes && to("mission_id")) return { sentence: `menjadwalkan kunjungan dari prospek ${name}`, tone: "create", details }
      if (has("status_id")) return { sentence: `mengubah status prospek ${name}`, tone: "update", details }
      if (has("owner_id")) return { sentence: to("owner_id") ? `menugaskan prospek ${name}` : `melepas pemegang prospek ${name}`, tone: "update", details }
      return { sentence: `mengubah ${details.map((d) => d.field).join(", ") || "detail"} pada prospek ${name}`, tone: "update", details }
    }

    case "prospect_attempts":
      if (row.action === "INSERT") return { sentence: `mencatat kontak dengan prospek ${name}`, tone: "create", details }
      return { sentence: `mengubah catatan kontak prospek ${name}`, tone: "update", details }

    case "prospect_statuses":
      if (row.action === "INSERT") return { sentence: `menambah status prospek "${name}"`, tone: "create", details }
      if (has("is_active")) return to("is_active") ? { sentence: `memulihkan status prospek "${name}"`, tone: "create", details } : { sentence: `mengarsipkan status prospek "${name}"`, tone: "delete", details }
      return { sentence: `mengubah status prospek "${name}"`, tone: "update", details }

    case "assignments": {
      const role = (inserted?.assignment_role ?? from("assignment_role")) === "PRIMARY" ? "sales utama" : "sales pendukung"
      if (row.action === "INSERT") return { sentence: `ditugaskan sebagai ${role} pada mission ke ${name}`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `dikeluarkan dari mission ke ${name}`, tone: "delete", details }
      if (has("response")) {
        const next = to("response")
        const verb =
          next === "ACCEPTED" ? "menerima penugasan"
          : next === "REJECTED" ? "menolak penugasan"
          : next === "RESCHEDULE_REQUESTED" ? "mengusulkan jadwal lain untuk"
          : "menunggu jawaban ulang untuk"
        return { sentence: `${verb} mission ke ${name}`, tone: next === "REJECTED" ? "delete" : "update", details }
      }
      return { sentence: `mengubah penugasan pada mission ke ${name}`, tone: "update", details }
    }

    case "visit_reports":
      if (row.action === "INSERT") return { sentence: `mulai mengisi laporan kunjungan ${name}`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `menghapus laporan kunjungan ${name}`, tone: "delete", details }
      if (has("status") && to("status") === "SUBMITTED") return { sentence: `mengirim laporan kunjungan ${name}`, tone: "create", details }
      if (has("status") && to("status") === "NEEDS_CLARIFICATION") return { sentence: `meminta klarifikasi laporan ${name}`, tone: "update", details }
      return { sentence: `mengubah laporan kunjungan ${name}`, tone: "update", details }

    case "reschedule_requests":
      if (row.action === "INSERT") return { sentence: `mengusulkan jadwal lain untuk mission ke ${name}`, tone: "update", details }
      if (has("status")) {
        const next = to("status")
        return {
          sentence: `${next === "APPROVED" ? "menyetujui" : "menolak"} usulan jadwal untuk mission ke ${name}`,
          tone: next === "APPROVED" ? "create" : "delete",
          details,
        }
      }
      return { sentence: `mengubah usulan jadwal untuk mission ke ${name}`, tone: "update", details }

    case "mission_settings":
      return { sentence: `mengubah aturan mission: ${details.map((d) => `${d.field} ${d.from} → ${d.to}`).join("; ") || "pengaturan awal"}`, tone: "update", details }

    case "form_fields":
      if (row.action === "INSERT") return { sentence: `menambah field form “${name}”`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `menghapus field form “${name}”`, tone: "delete", details }
      if (has("is_active") && to("is_active") === false) return { sentence: `mengarsipkan field form “${name}”`, tone: "delete", details }
      return { sentence: `mengubah field form “${name}”: ${details.map((d) => d.field).join(", ")}`, tone: "update", details }

    case "board_tokens":
      if (row.action === "INSERT") return { sentence: `membuat tautan papan “${name}”`, tone: "create", details }
      if (has("revoked_at") && to("revoked_at")) return { sentence: `mencabut tautan papan “${name}”`, tone: "delete", details }
      return { sentence: `mengubah tautan papan “${name}”`, tone: "update", details }

    case "lead_pushes":
      return { sentence: `mengirim lead ke LeadEngine dari mission ke ${name}`, tone: "create", details }

    case "report_contacts":
      if (row.action === "INSERT") return { sentence: `menambah kontak di laporan ${name}`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `menghapus kontak dari laporan ${name}`, tone: "delete", details }
      return { sentence: `mengubah kontak di laporan ${name}`, tone: "update", details }

    case "supporting_notes":
      if (row.action === "INSERT") return { sentence: `menulis catatan pendukung pada mission ke ${name}`, tone: "create", details }
      if (row.action === "DELETE") return { sentence: `menghapus catatan pendukung pada mission ke ${name}`, tone: "delete", details }
      return { sentence: `mengubah catatan pendukung pada mission ke ${name}`, tone: "update", details }

    default: {
      const verb = row.action === "INSERT" ? "menambah" : row.action === "DELETE" ? "menghapus" : "mengubah"
      const tone: AuditTone = row.action === "INSERT" ? "create" : row.action === "DELETE" ? "delete" : "update"
      return { sentence: `${verb} ${what}${row.entityLabel ? ` (${name})` : ""}`, tone, details }
    }
  }
}

/**
 * Rows written in one transaction were one action. A deleted mission drags
 * its assignments and report along; showing six lines for one click buries
 * the click. The mission row leads, the rest are folded under it.
 */
export interface AuditEvent {
  lead: AuditRow
  folded: AuditRow[]
}

const TABLE_RANK: Record<string, number> = {
  missions: 0,
  visit_reports: 1,
  reschedule_requests: 2,
  assignments: 3,
  report_contacts: 4,
  supporting_notes: 5,
  lead_pushes: 6,
  mission_field_values: 7,
  prospects: 8,
  prospect_attempts: 9,
  prospect_statuses: 10,
}

export function groupAuditEvents(rows: AuditRow[]): AuditEvent[] {
  const byTx = new Map<number, AuditRow[]>()
  const order: number[] = []
  for (const row of rows) {
    const list = byTx.get(row.txId)
    if (list) list.push(row)
    else {
      byTx.set(row.txId, [row])
      order.push(row.txId)
    }
  }
  return order.map((txId) => {
    const group = [...(byTx.get(txId) ?? [])].sort(
      (a, b) => (TABLE_RANK[a.tableName] ?? 99) - (TABLE_RANK[b.tableName] ?? 99) || a.id - b.id
    )
    const [lead, ...folded] = group
    return { lead, folded }
  })
}
