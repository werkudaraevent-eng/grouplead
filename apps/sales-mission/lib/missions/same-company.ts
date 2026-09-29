/**
 * Which other activities are "at this company", for carrying what was learned
 * there (a DISC reading) into the next visit.
 *
 * Linked to a CRM company: the link decides, whatever the name was typed as.
 * Not linked: the same company name, case-insensitively and exactly. The
 * activity keeps that name in `client_company_name_snapshot`; the column
 * `client_company_name` exists only on prospects, and filtering activities by
 * it failed every time, so a company not yet in LeadEngine never got its
 * readings back.
 */
export type SameCompanyFilter =
  | { op: "eq"; column: "client_company_id"; value: string }
  | { op: "ilike"; column: "client_company_name_snapshot"; value: string }

export function sameCompanyFilter(mission: { clientCompanyId: string | null; clientCompanyName: string }): SameCompanyFilter {
  if (mission.clientCompanyId) return { op: "eq", column: "client_company_id", value: mission.clientCompanyId }
  return { op: "ilike", column: "client_company_name_snapshot", value: ilikeExact(mission.clientCompanyName.trim()) }
}

/**
 * A literal value as a PostgREST `ilike` pattern that matches only itself
 * (ignoring case).
 *
 * LIKE reads `%` and `_` as wildcards and `\` as its escape, so all three are
 * escaped; an unescaped `\` would swallow the character after it. PostgREST
 * also turns every `*` in a like pattern into `%`, and has no escape for it,
 * so a literal `*` becomes `_`: one character, which at worst also matches a
 * name differing only there, never every name.
 */
export function ilikeExact(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`).replace(/\*/g, "_")
}
