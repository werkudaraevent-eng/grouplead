"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { getMissionSettings, listTenantSales } from "@/lib/missions/mission-queries"
import { initialResponse } from "@/lib/missions/assignment-workflow"
import { notify } from "@/lib/notifications/notification-queries"
import { MISSION_TYPES, toMissionTimestamp } from "@/lib/missions/mission-schema"
import { configuredOptions } from "@/lib/missions/form-fields"
import { searchClientCompanies } from "@/lib/leadengine/client"
import {
  SALES_EMAIL_COLUMN,
  SUPPORTING_EMAILS_COLUMN,
  buildImportColumns,
  findInFileClashes,
  parseRow,
  type ParsedRow,
  type RawRow,
  type RowIssue,
} from "@/lib/missions/mission-io"

/**
 * Bulk creation of missions from a spreadsheet.
 *
 * Two steps on purpose. `checkMissionImport` validates the whole file and
 * returns what it found; `commitMissionImport` writes only the rows the user
 * then confirmed. Uploading straight into the database would mean a typo in row
 * 40 is discovered after 39 real visits were already scheduled.
 *
 * Parsing happens on the client (the file never leaves the browser as bytes)
 * and the parsed rows are re-validated here, because a Server Action is a public
 * endpoint and the client's opinion of "valid" is not a guarantee.
 */

export interface ImportCheck {
  ok: boolean
  error?: string
  totalRows: number
  validRows: ParsedRow[]
  issues: RowIssue[]
  /** Rows whose company name matched a CRM record exactly. */
  linkedCompanies: number
}

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }
  if (!(await canPerform(access, "sales_mission_mission", "create"))) {
    return { error: "Anda tidak punya izin membuat mission." as const }
  }
  return { access }
}

/** Shared validation, so the preview and the write can never disagree. */
async function validate(rows: RawRow[]) {
  const guard = await authorize()
  if ("error" in guard) return { error: guard.error }
  const { access } = guard

  const [fields, sales] = await Promise.all([
    listFormFields(access, "mission"),
    listTenantSales(access),
  ])

  const columns = buildImportColumns(fields)
  const allowedTypes = configuredOptions(fields, "mission_type", MISSION_TYPES)

  // Email to user id, for this tenant only. An email that is not a member here
  // must not resolve, or an import could assign visits across companies.
  const byEmail = new Map<string, string>()
  for (const person of sales) {
    if (person.email) byEmail.set(person.email.toLowerCase(), person.id)
  }

  const parsed: ParsedRow[] = []
  const issues: RowIssue[] = []

  rows.forEach((raw, index) => {
    // +2: the header is row 1, so the first data row is row 2 in Excel.
    const rowNumber = index + 2
    const result = parseRow(raw, rowNumber, columns, fields, allowedTypes)
    issues.push(...result.issues)

    if (result.row.primarySalesEmail && !byEmail.has(result.row.primarySalesEmail)) {
      issues.push({
        row: rowNumber,
        column: SALES_EMAIL_COLUMN,
        message: `"${result.row.primarySalesEmail}" bukan anggota unit bisnis ini.`,
      })
    }
    for (const email of result.row.supportingSalesEmails) {
      if (!byEmail.has(email)) {
        issues.push({
          row: rowNumber,
          column: SUPPORTING_EMAILS_COLUMN,
          message: `"${email}" bukan anggota unit bisnis ini.`,
        })
      }
    }

    parsed.push(result.row)
  })

  issues.push(...findInFileClashes(parsed))

  const broken = new Set(issues.map((issue) => issue.row))
  return { access, byEmail, parsed, issues, valid: parsed.filter((row) => !broken.has(row.row)) }
}

/** Dry run. Nothing is written; the caller gets a preview to confirm. */
export async function checkMissionImport(rows: RawRow[]): Promise<ImportCheck> {
  const empty: ImportCheck = { ok: false, totalRows: 0, validRows: [], issues: [], linkedCompanies: 0 }

  const result = await validate(rows)
  if ("error" in result) return { ...empty, error: result.error }

  // Company matching is a lookup, never a creation: an import that invented CRM
  // companies would fill the master list with spreadsheet typos.
  let linkedCompanies = 0
  const names = [...new Set(result.valid.map((row) => row.clientCompanyName).filter(Boolean))]
  for (const name of names.slice(0, 40)) {
    try {
      const matches = await searchClientCompanies(name)
      if (matches.some((company) => company.name.toLowerCase() === name.toLowerCase())) {
        linkedCompanies += 1
      }
    } catch {
      // A CRM outage must not block an import. The missions land with a snapshot
      // name, exactly as a typed-in company does on the form.
    }
  }

  return {
    ok: result.valid.length > 0,
    totalRows: rows.length,
    validRows: result.valid,
    issues: result.issues,
    linkedCompanies,
  }
}

export interface ImportResult {
  success: boolean
  error?: string
  created: number
  failed: Array<{ row: number; message: string }>
}

/**
 * Write the rows that passed. Re-validated from the raw file, not trusted from
 * the preview, because the preview travelled through the client.
 */
export async function commitMissionImport(rows: RawRow[]): Promise<ImportResult> {
  const result = await validate(rows)
  if ("error" in result) return { success: false, error: result.error, created: 0, failed: [] }

  const { access, byEmail, valid } = result
  if (valid.length === 0) {
    return { success: false, error: "Tidak ada baris yang bisa diimport.", created: 0, failed: [] }
  }

  const supabase = await createClient()
  const missions = supabase.schema("sales_mission")

  // Same policy as the form: imported assignments are accepted on the spot
  // unless the tenant asks reps to confirm.
  const settings = await getMissionSettings(access)
  const now = new Date().toISOString()
  const answerFor = (userId: string) => {
    const response = initialResponse(settings, { selfAssigned: userId === access.userId })
    return { response, responded_at: response === "ACCEPTED" ? now : null }
  }

  // Resolve every distinct company name once rather than per row.
  const companyIds = new Map<string, string>()
  for (const name of new Set(valid.map((row) => row.clientCompanyName).filter(Boolean))) {
    try {
      const matches = await searchClientCompanies(name)
      const exact = matches.find((company) => company.name.toLowerCase() === name.toLowerCase())
      if (exact) companyIds.set(name, exact.id)
    } catch {
      // Left unlinked, same as a typed company on the form.
    }
  }

  const failed: Array<{ row: number; message: string }> = []
  let created = 0

  for (const row of valid) {
    // Validation already refused unknown emails, so this only guards the type;
    // a row that somehow lost its primary must not become an orphan mission.
    const primaryId = byEmail.get(row.primarySalesEmail)
    if (!primaryId) {
      failed.push({ row: row.row, message: "Sales utama tidak dikenali." })
      continue
    }
    const supportingIds = row.supportingSalesEmails
      .map((email) => byEmail.get(email))
      .filter((id): id is string => Boolean(id))

    const { data: mission, error } = await missions
      .from("missions")
      .insert({
        company_id: access.companyId,
        client_company_name_snapshot: row.clientCompanyName,
        client_company_id: companyIds.get(row.clientCompanyName) ?? null,
        mission_type: row.missionType,
        status: answerFor(primaryId).response === "ACCEPTED" ? "ACCEPTED" : "ASSIGNED",
        objective: row.objective || null,
        location: row.location || null,
        scheduled_start: toMissionTimestamp(row.date, row.startTime),
        scheduled_end: row.endTime ? toMissionTimestamp(row.date, row.endTime) : null,
        contact_salutation: row.contactSalutation || null,
        contact_name: row.contactName || null,
        contact_job_title: row.contactJobTitle || null,
        contact_division: row.contactDivision || null,
        contact_phone: row.contactPhone || null,
        contact_email: row.contactEmail || null,
        building: row.building || null,
        address: row.address || null,
        appointment_notes: row.appointmentNotes || null,
        created_by: access.userId,
      })
      .select("id")
      .single()

    if (error || !mission) {
      failed.push({ row: row.row, message: "Mission gagal disimpan." })
      continue
    }

    const { error: assignmentError } = await missions.from("assignments").insert([
      { mission_id: mission.id, company_id: access.companyId, user_id: primaryId, assignment_role: "PRIMARY", ...answerFor(primaryId) },
      ...supportingIds.map((userId) => ({
        mission_id: mission.id, company_id: access.companyId, user_id: userId, assignment_role: "SUPPORTING", ...answerFor(userId),
      })),
    ])

    if (assignmentError) {
      // A mission with no primary sales is a broken state. Undo rather than
      // leave one behind, matching what createMission does.
      await missions.from("missions").delete().eq("id", mission.id)
      failed.push({ row: row.row, message: "Penugasan sales gagal. Baris dibatalkan." })
      continue
    }

    await notify(
      access,
      "MISSION_ASSIGNED",
      [primaryId, ...supportingIds].filter((id) => id !== access.userId),
      { missionId: mission.id as string, clientName: row.clientCompanyName }
    )

    const customEntries = Object.entries(row.custom)
    if (customEntries.length > 0) {
      const fields = await listFormFields(access, "mission")
      const byKey = new Map(fields.map((field) => [field.reportingKey, field.id]))
      const values = customEntries
        .filter(([key]) => byKey.has(key))
        .map(([key, value]) => ({
          mission_id: mission.id,
          company_id: access.companyId,
          field_id: byKey.get(key),
          reporting_key: key,
          value,
        }))
      if (values.length > 0) await missions.from("mission_field_values").insert(values)
    }

    created += 1
  }

  revalidatePath("/workspace/missions")
  revalidatePath("/workspace/calendar")
  revalidatePath("/workspace")

  return { success: created > 0, created, failed }
}
