import { z } from "zod"
import { createClient } from "@/utils/supabase/server"

/**
 * Client for LeadEngine's `/api/v1`.
 *
 * Server-side only. The caller's Supabase access token is forwarded, so
 * LeadEngine evaluates the request as that person — same RLS, same permission
 * grants. Keeping this off the browser also sidesteps CORS entirely and keeps
 * the token out of client bundles.
 *
 * Every response is parsed with zod. LeadEngine is a separate deployment that
 * can ship independently, so its payloads are treated as untrusted input rather
 * than assumed to match our types.
 */

const BASE_URL = process.env.LEADENGINE_API_URL?.trim().replace(/\/$/, "") || null

export class LeadEngineError extends Error {
  constructor(public code: string, message: string, public status?: number) {
    super(message)
    this.name = "LeadEngineError"
  }
}

const errorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
})

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  if (!BASE_URL) {
    throw new LeadEngineError(
      "not_configured",
      "Integrasi LeadEngine belum dikonfigurasi. Set LEADENGINE_API_URL."
    )
  }

  const supabase = await createClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  if (!token) {
    throw new LeadEngineError("no_session", "Sesi tidak ditemukan. Masuk ulang lalu coba lagi.")
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })
  } catch {
    // A field rep should be told the other system is unreachable, not shown a
    // raw network error.
    throw new LeadEngineError("unreachable", "LeadEngine tidak dapat dihubungi. Coba lagi sebentar lagi.")
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const parsed = errorSchema.safeParse(body)
    throw new LeadEngineError(
      parsed.success ? parsed.data.error.code : "http_error",
      parsed.success ? parsed.data.error.message : `LeadEngine menolak permintaan (${response.status}).`,
      response.status
    )
  }

  const body = await response.json().catch(() => null)
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    throw new LeadEngineError("unexpected_response", "Balasan LeadEngine tidak sesuai kontrak.")
  }

  return parsed.data
}

const stageSchema = z.object({
  id: z.string(),
  name: z.string(),
  sortOrder: z.number().nullable().optional(),
  isDefault: z.boolean().optional(),
})

const pipelinesSchema = z.object({
  pipelines: z.array(z.object({ id: z.string(), name: z.string(), stages: z.array(stageSchema) })),
})

export type LeadEnginePipeline = z.infer<typeof pipelinesSchema>["pipelines"][number]

export async function fetchPipelines(): Promise<LeadEnginePipeline[]> {
  const data = await request("/api/v1/pipelines", pipelinesSchema)
  return data.pipelines
}

const companiesSchema = z.object({
  companies: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      industry: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
    })
  ),
})

export type LeadEngineCompany = z.infer<typeof companiesSchema>["companies"][number]

export async function searchClientCompanies(search: string): Promise<LeadEngineCompany[]> {
  const query = new URLSearchParams({ search, pageSize: "20" })
  const data = await request(`/api/v1/client-companies?${query}`, companiesSchema)
  return data.companies
}

const contactsSchema = z.object({
  contacts: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      jobTitle: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
    })
  ),
})

export type LeadEngineContact = z.infer<typeof contactsSchema>["contacts"][number]

/**
 * The people the CRM already knows at this company.
 *
 * Only called once a mission has a `clientCompanyId`: a typed-in company name
 * has nobody attached to it yet, and asking for contacts by name would be
 * guessing.
 */
export async function fetchCompanyContacts(clientCompanyId: string): Promise<LeadEngineContact[]> {
  const query = new URLSearchParams({ clientCompanyId })
  const data = await request(`/api/v1/contacts?${query}`, contactsSchema)
  return data.contacts
}

const createdContactSchema = z.object({
  contact: z.object({
    id: z.string(),
    fullName: z.string(),
    jobTitle: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  }),
  created: z.boolean(),
})

export type CreatedContact = z.infer<typeof createdContactSchema>

export interface CreateContactPayload {
  clientCompanyId: string
  fullName: string
  jobTitle?: string | null
  phone?: string | null
  email?: string | null
  /** Record owner when the contact is new. Ignored when they already exist. */
  ownerId?: string | null
}

/**
 * Register someone met in the field. Find-or-create on the LeadEngine side, so
 * calling it twice for the same person returns the same contact rather than a
 * second copy. An existing contact has their blank fields filled and nothing
 * else touched.
 */
export async function createContact(payload: CreateContactPayload): Promise<CreatedContact> {
  return request(`/api/v1/contacts`, createdContactSchema, {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

const enrichedContactSchema = z.object({
  contact: z.object({ id: z.string() }),
  /** Which columns were actually written. Empty when the CRM had them all. */
  filled: z.array(z.string()),
})

export interface EnrichContactPayload {
  contactId: string
  jobTitle?: string | null
  phone?: string | null
  email?: string | null
}

/**
 * Close gaps on a contact the CRM already has.
 *
 * The endpoint fills blanks only and never overwrites, so calling this with a
 * stale job title cannot damage a good one. See the route for why that rule,
 * rather than the caller's good intentions, is what makes this safe.
 */
export async function enrichContact(payload: EnrichContactPayload) {
  const { contactId, ...fields } = payload
  return request(`/api/v1/contacts/${contactId}`, enrichedContactSchema, {
    method: "PATCH",
    body: JSON.stringify(fields),
  })
}

const citiesSchema = z.object({
  cities: z.array(
    z.object({
      value: z.string(),
      label: z.string(),
      country: z.string().nullable().optional(),
    })
  ),
})

export type LeadEngineCity = z.infer<typeof citiesSchema>["cities"][number]

/**
 * Location autocomplete, served by the same provider as LeadEngine's Event City
 * field so both apps store the same spelling for the same place.
 *
 * `country` biases the ranking towards Indonesia; it does not restrict to it.
 * Sales go abroad too.
 */
export async function searchCities(query: string): Promise<LeadEngineCity[]> {
  const params = new URLSearchParams({ q: query, country: "ID" })
  const data = await request(`/api/v1/cities/search?${params}`, citiesSchema)
  return data.cities
}

const createCompanySchema = z.object({
  company: z.object({
    id: z.string(),
    name: z.string(),
    industry: z.string().nullable().optional(),
    needsEnrichment: z.boolean().optional(),
  }),
  created: z.boolean(),
})

export type CreatedClientCompany = z.infer<typeof createCompanySchema>

export interface CreateClientCompanyPayload {
  name: string
  /** Record owner when the company is new. Ignored when it already exists. */
  ownerId?: string | null
  /** City when the company is new. Ignored when it already exists. */
  city?: string | null
}

/**
 * Register a company the CRM has never seen, or return the existing match.
 *
 * LeadEngine matches on the normalised name ("PT X" and "X Tbk" are one
 * company) inside a single database function, so calling this twice, or from
 * two reps in the same second, returns the same row. The visit report submit
 * and the lead push both call it.
 */
export async function createClientCompany(
  payload: string | CreateClientCompanyPayload
): Promise<CreatedClientCompany> {
  const body = typeof payload === "string" ? { name: payload } : payload
  return request(`/api/v1/client-companies`, createCompanySchema, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

export interface RecordVisitPayload {
  clientCompanyId: string
  missionId: string
  visitedOn: string
  salesName: string
  outcome: string
  contactNames: string[]
  city?: string | null
}

/**
 * Put a field visit on the company's CRM timeline, so LeadEngine can answer
 * "when were we last there" for accounts that never produced a lead.
 * Idempotent per mission.
 */
export async function recordCompanyVisit(payload: RecordVisitPayload): Promise<void> {
  const { clientCompanyId, ...body } = payload
  await request(
    `/api/v1/client-companies/${clientCompanyId}/visits`,
    z.object({ recorded: z.boolean() }),
    { method: "POST", body: JSON.stringify(body) }
  )
}

const contextSchema = z.object({
  company: z.object({ id: z.string(), name: z.string() }),
  currentOwner: z.object({ userId: z.string(), name: z.string() }).nullable(),
  openLeads: z.array(
    z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      projectName: z.string(),
      pipelineId: z.string().nullable().optional(),
      stageName: z.string().nullable(),
      ownerName: z.string().nullable(),
    })
  ),
})

export type ClientCompanyContext = z.infer<typeof contextSchema>

/** Owner and open leads — the two facts the push modal warns about. */
export async function fetchCompanyContext(companyId: string): Promise<ClientCompanyContext> {
  return request(`/api/v1/client-companies/${companyId}/context`, contextSchema)
}

const createdLeadSchema = z.object({
  lead: z.object({ id: z.union([z.string(), z.number()]).transform(String) }),
})

export interface CreateLeadPayload {
  clientCompanyId: string | null
  clientCompanyName: string
  projectName: string
  pipelineId: string
  pipelineStageId: string | null
  ownerUserId: string
  estimatedValue: number | null
  remark: string | null
  source: string
}

export async function createLead(payload: CreateLeadPayload): Promise<{ id: string }> {
  const data = await request("/api/v1/leads", createdLeadSchema, {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return data.lead
}

/** Whether the integration is configured at all, for gating the UI. */
export function isLeadEngineConfigured(): boolean {
  return BASE_URL !== null
}
