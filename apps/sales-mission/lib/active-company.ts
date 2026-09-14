/**
 * Which of a person's business units they are working in right now.
 *
 * LeadEngine keeps the choice in an `active_company` cookie (a company slug,
 * or "holding" for the group-wide view) and falls back to the oldest
 * membership. Sales Mission follows the same cookie and the same fallback,
 * so switching units in one app switches both, and a person with two
 * memberships never sees a different unit here than there.
 */

export const ACTIVE_COMPANY_COOKIE = "active_company"

export interface CompanyMembership {
  companyId: string
  slug: string
  name: string
  isHolding: boolean
  userType: string | null
  /** ISO timestamp the membership row was created; the oldest is the default. */
  createdAt: string
}

export function pickActiveMembership(
  memberships: CompanyMembership[],
  cookie: string | null | undefined
): CompanyMembership | null {
  if (memberships.length === 0) return null
  const ordered = [...memberships].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const wanted = cookie?.trim()
  if (wanted === "holding") {
    return ordered.find((membership) => membership.isHolding) ?? ordered[0]
  }
  if (wanted) {
    const match = ordered.find((membership) => membership.slug === wanted)
    if (match) return match
  }
  return ordered[0]
}

/**
 * The domain a cross-app cookie should be set on. Explicit configuration
 * wins; otherwise the parent of a three-label host ("mission.werkudara.group"
 * → ".werkudara.group") so the two apps on sibling subdomains share it.
 * Localhost and bare domains get no domain attribute at all.
 */
export function sharedCookieDomain(host: string | null | undefined, configured?: string | null): string | undefined {
  const explicit = configured?.trim()
  if (explicit) return explicit
  const hostname = (host ?? "").split(":")[0].trim().toLowerCase()
  if (!hostname || hostname === "localhost" || /^[\d.]+$/.test(hostname)) return undefined
  const labels = hostname.split(".")
  if (labels.length < 3) return undefined
  return `.${labels.slice(-2).join(".")}`
}
