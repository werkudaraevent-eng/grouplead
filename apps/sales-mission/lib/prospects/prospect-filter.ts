/**
 * The prospect list's filter, carried in the URL like the mission list's.
 * Facets OR within themselves and AND across. "state:" values in the status
 * facet name the mission-derived states of converted prospects.
 */

/** Sentinel for "no owner" in the owner facet and "manual" in the source facet. */
export const UNASSIGNED = "none"
export const MANUAL_SOURCE = "manual"
export const ZERO_UUID = "00000000-0000-0000-0000-000000000000"

export const STATE_PREFIX = "state:"

export interface ProspectQuery {
  q: string
  /** Status ids, or "state:<derived state>" entries. */
  status: string[]
  owner: string[]
  batch: string[]
  /** Only prospects whose next contact date has arrived. */
  due: boolean
}

export const EMPTY_PROSPECT_QUERY: ProspectQuery = { q: "", status: [], owner: [], batch: [], due: false }

const list = (value: string | string[] | undefined): string[] => {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "")
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))]
}

export function parseProspectQuery(params: Record<string, string | string[] | undefined>): ProspectQuery {
  const one = (key: string) => {
    const value = params[key]
    return (Array.isArray(value) ? value[0] : value) ?? ""
  }
  return {
    q: one("q").trim().slice(0, 120),
    status: list(params.status),
    owner: list(params.owner),
    batch: list(params.batch),
    due: one("due") === "1",
  }
}

export function serializeProspectQuery(query: ProspectQuery): URLSearchParams {
  const params = new URLSearchParams()
  if (query.q) params.set("q", query.q)
  if (query.status.length) params.set("status", query.status.join(","))
  if (query.owner.length) params.set("owner", query.owner.join(","))
  if (query.batch.length) params.set("batch", query.batch.join(","))
  if (query.due) params.set("due", "1")
  return params
}

export function isEmptyProspectQuery(query: ProspectQuery): boolean {
  return countActiveProspectFacets(query) === 0
}

export function countActiveProspectFacets(query: ProspectQuery): number {
  return (query.q ? 1 : 0) + query.status.length + query.owner.length + query.batch.length + (query.due ? 1 : 0)
}

/** Split the status facet into stored ids and derived states for the RPC. */
export function splitStatusFacet(values: string[]): { statusIds: string[]; states: string[] } {
  const statusIds: string[] = []
  const states: string[] = []
  for (const value of values) {
    if (value.startsWith(STATE_PREFIX)) states.push(value.slice(STATE_PREFIX.length))
    else statusIds.push(value)
  }
  return { statusIds, states }
}
