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
