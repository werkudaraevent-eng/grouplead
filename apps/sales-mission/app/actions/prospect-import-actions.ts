"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/utils/supabase/server"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { DEFAULT_CONTACT_SALUTATIONS, configuredOptions } from "@/lib/missions/form-fields"
import { searchClientCompanies } from "@/lib/leadengine/client"
import type { RawRow, RowIssue } from "@/lib/missions/mission-io"
import {
  OWNER_EMAIL_COLUMN,
  dedupeKeys,
  findExistingDuplicates,
  findInFileDuplicates,
  parseProspectRow,
  type ParsedProspect,
} from "@/lib/prospects/prospect-io"
import { findProspectDuplicates } from "@/lib/prospects/prospect-page-queries"
import { listProspectStatuses } from "@/lib/prospects/prospect-status-queries"
import { entryStatus } from "@/lib/prospects/prospect-status"

/**
 * Bulk creation of prospects from a spreadsheet: check first, write second,
 * exactly like the mission import. Duplicates are found within the file and
 * against the list, and reported as row issues so they are skipped, not
 * silently doubled.
 */

export interface ProspectImportCheck {
  ok: boolean
  error?: string
  totalRows: number
  validRows: ParsedProspect[]
  issues: RowIssue[]
  duplicates: number
  linkedCompanies: number
}

export interface ProspectImportResult {
  success: boolean
  error?: string
  created: number
  skipped: number
}

async function authorize() {
  const access = await getSalesMissionAccess()
  if (!access) return { error: "Anda tidak punya akses Sales Mission." as const }
  if (!(await canPerform(access, "sales_mission_prospect", "create"))) {
    return { error: "Anda tidak punya izin mengimpor prospek." as const }
  }
  return { access }
}

async function validate(rows: RawRow[]) {
  const guard = await authorize()
  if ("error" in guard) return { error: guard.error }
  const { access } = guard

  const [fields, sales] = await Promise.all([listFormFields(access, "mission"), listTenantSales(access)])
  const salutations = configuredOptions(fields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)
  const byEmail = new Map<string, string>()
  for (const person of sales) if (person.email) byEmail.set(person.email.toLowerCase(), person.id)

  const parsed: ParsedProspect[] = []
  const issues: RowIssue[] = []
  rows.forEach((raw, index) => {
    const rowNumber = index + 2
    const result = parseProspectRow(raw, rowNumber, { salutations })
    issues.push(...result.issues)
    if (result.row.ownerEmail && !byEmail.has(result.row.ownerEmail)) {
      issues.push({ row: rowNumber, column: OWNER_EMAIL_COLUMN, message: `"${result.row.ownerEmail}" bukan anggota unit bisnis ini.` })
    }
    parsed.push(result.row)
  })

  const inFile = findInFileDuplicates(parsed)
  const clean = parsed.filter((row) => !issues.some((issue) => issue.row === row.row) && !inFile.some((issue) => issue.row === row.row))
  const keys = clean.map(dedupeKeys)
  const existing = await findProspectDuplicates(access, {
    phones: [...new Set(keys.map((key) => key.phone).filter((phone): phone is string => Boolean(phone)))],
    pairs: [...new Set(clean.filter((row) => row.contactName).map((row) => dedupeKeys(row).pair))],
  })
  const against = findExistingDuplicates(clean, existing)
  const duplicates = [...inFile, ...against]

  const broken = new Set([...issues, ...duplicates].map((issue) => issue.row))
  return { access, byEmail, parsed, issues: [...issues, ...duplicates], duplicates: duplicates.length, valid: parsed.filter((row) => !broken.has(row.row)) }
}

export async function checkProspectImport(rows: RawRow[]): Promise<ProspectImportCheck> {
  const empty: ProspectImportCheck = { ok: false, totalRows: 0, validRows: [], issues: [], duplicates: 0, linkedCompanies: 0 }
  const result = await validate(rows)
  if ("error" in result) return { ...empty, error: result.error }

  let linkedCompanies = 0
  const names = [...new Set(result.valid.map((row) => row.clientCompanyName).filter(Boolean))]
  for (const name of names.slice(0, 40)) {
    try {
      const matches = await searchClientCompanies(name)
      if (matches.some((company) => company.name.toLowerCase() === name.toLowerCase())) linkedCompanies += 1
    } catch {
      // A CRM outage must not block an import; the rows land unlinked.
    }
  }

  return { ok: result.valid.length > 0, totalRows: rows.length, validRows: result.valid, issues: result.issues, duplicates: result.duplicates, linkedCompanies }
}

export async function commitProspectImport(rows: RawRow[], options: { defaultOwnerId: string | null; fileName: string }): Promise<ProspectImportResult> {
  const result = await validate(rows)
  if ("error" in result) return { success: false, error: result.error, created: 0, skipped: 0 }
  const { access, byEmail, valid } = result
  if (valid.length === 0) return { success: false, error: "Tidak ada baris yang bisa diimpor.", created: 0, skipped: rows.length }

  const defaultOwner = options.defaultOwnerId && /^[0-9a-f-]{36}$/i.test(options.defaultOwnerId) ? options.defaultOwnerId : null
  if (defaultOwner && ![...byEmail.values()].includes(defaultOwner)) {
    return { success: false, error: "Pemegang yang dipilih bukan anggota unit bisnis ini.", created: 0, skipped: 0 }
  }

  const statuses = await listProspectStatuses(access)
  const entry = entryStatus(statuses)
  if (!entry) return { success: false, error: "Belum ada status awal untuk prospek.", created: 0, skipped: 0 }

  // One lookup per distinct company name, capped; the rest land unlinked.
  const companyIds = new Map<string, string>()
  const names = [...new Set(valid.map((row) => row.clientCompanyName).filter(Boolean))]
  for (const name of names.slice(0, 100)) {
    try {
      const matches = await searchClientCompanies(name)
      const exact = matches.find((company) => company.name.toLowerCase() === name.toLowerCase())
      if (exact) companyIds.set(name, exact.id)
    } catch {
      // Left unlinked.
    }
  }

  const supabase = await createClient()
  const schema = supabase.schema("sales_mission")
  const { data: batch, error: batchError } = await schema
    .from("prospect_import_batches")
    .insert({ company_id: access.companyId, file_name: options.fileName.slice(0, 200) || "import.xlsx", row_count: valid.length, created_by: access.userId })
    .select("id")
    .single()
  if (batchError || !batch) return { success: false, error: "Impor gagal dimulai.", created: 0, skipped: 0 }

  let created = 0
  for (let start = 0; start < valid.length; start += 200) {
    const chunk = valid.slice(start, start + 200)
    const { data, error } = await schema
      .from("prospects")
      .insert(
        chunk.map((row) => ({
          company_id: access.companyId,
          status_id: entry.id,
          owner_id: (row.ownerEmail && byEmail.get(row.ownerEmail)) || defaultOwner,
          client_company_name: row.clientCompanyName,
          client_company_id: companyIds.get(row.clientCompanyName) ?? null,
          industry: row.industry || null,
          location: row.location || null,
          address: row.address || null,
          website: row.website || null,
          contact_salutation: row.contactSalutation || null,
          contact_name: row.contactName || null,
          contact_job_title: row.contactJobTitle || null,
          contact_division: row.contactDivision || null,
          contact_phone: row.contactPhone || null,
          contact_phone_norm: row.contactPhone || null,
          contact_email: row.contactEmail || null,
          notes: row.notes || null,
          source: "import",
          import_batch_id: batch.id,
          created_by: access.userId,
        }))
      )
      .select("id")
    if (!error) created += data?.length ?? 0
  }

  revalidatePath("/workspace/prospects")
  revalidatePath("/workspace")
  return { success: created > 0, created, skipped: rows.length - created, error: created === 0 ? "Tidak ada prospek yang tersimpan." : undefined }
}
