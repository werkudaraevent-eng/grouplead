import { createClient } from "@/utils/supabase/server"

/**
 * Vocabulary for the report's multi-select fields.
 *
 * Sourced from LeadEngine's `master_options`, which is global reference data
 * readable by any authenticated user. Sales Mission reads it and never writes
 * it — adding or renaming an option stays an admin action in LeadEngine's
 * Master Options settings, so both apps keep speaking the same vocabulary.
 *
 * The option types below do not exist yet. Until an admin creates them, the
 * starter lists keep the form usable: a required field with an empty picker
 * would make the report impossible to submit on day one. The form also accepts
 * a typed-in value, so nobody is ever blocked by a missing option.
 */

export const CLIENT_NEED_OPTION_TYPE = "client_need"
export const PRODUCT_INTEREST_OPTION_TYPE = "product_interest"

const CLIENT_NEED_FALLBACK = [
  "Corporate gathering",
  "Meeting / rapat",
  "Outbound / team building",
  "Exhibition / pameran",
  "Product launch",
  "Tour / travel",
  "Akomodasi",
  "Transportasi",
  "Katering",
]

const PRODUCT_INTEREST_FALLBACK = [
  "Event organizer",
  "Venue",
  "Akomodasi",
  "Transportasi",
  "Dokumentasi",
  "Produksi panggung",
]

async function loadOptions(optionType: string, fallback: string[]): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("master_options")
    .select("label")
    .eq("option_type", optionType)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true })

  if (error || !data?.length) return fallback

  const labels = data
    .map((row) => (row.label as string | null)?.trim())
    .filter((label): label is string => Boolean(label))

  return labels.length > 0 ? labels : fallback
}

export interface ReportOptions {
  clientNeeds: string[]
  productInterest: string[]
}

export async function getReportOptions(): Promise<ReportOptions> {
  const [clientNeeds, productInterest] = await Promise.all([
    loadOptions(CLIENT_NEED_OPTION_TYPE, CLIENT_NEED_FALLBACK),
    loadOptions(PRODUCT_INTEREST_OPTION_TYPE, PRODUCT_INTEREST_FALLBACK),
  ])

  return { clientNeeds, productInterest }
}
