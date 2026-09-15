import { cache } from "react"
import { createClient } from "@/utils/supabase/server"
import { inScope, isRecordScope, type RecordScope, type ScopeContext } from "@/lib/access/record-scope"

export type { RecordScope, ScopeContext } from "@/lib/access/record-scope"

export interface SalesMissionAccess {
  userId: string
  /**
   * Always the holding company. Missions are a group activity, so every row
   * Sales Mission writes is the holding's, and anyone who belongs to any unit
   * of the group acts in it. Row security agrees (see the holding_tenant
   * migration).
   */
  companyId: string
  companyName: string
  /**
   * Where a permission row may live, first match wins: the holding, then the
   * person's own units oldest first. The admin sets the matrix up from
   * whichever unit LeadEngine is showing, and both answers must keep working.
   */
  permissionScopes: string[]
  displayName: string
  /** Same `profiles.avatar_url` LeadEngine shows; the bucket is public. */
  avatarUrl: string | null
  /** Bypasses mission-level ownership checks. Sourced from `profiles.role`. */
  isSuperAdmin: boolean
  /**
   * What `canPerform` looks permissions up by, carried here so a sub-permission
   * check is one query rather than a fresh sign-in check plus a profile read.
   * `roleId` wins; `userType` is the legacy grant consulted only when there is
   * no role at all.
   */
  roleId: string | null
  userType: string | null
}

/**
 * Authenticates and authorizes access to Sales Mission.
 *
 * Authentication comes from shared Supabase Auth. App access comes from the
 * existing `sales_mission` permission module, so a valid sign-in alone never
 * grants access to this app — the session is shared with LeadEngine, the
 * authorization is not.
 *
 * Memoised per request with React `cache`. A page calls this once at the top
 * and then several helpers call it again; each call used to be a round trip to
 * the auth server plus two table reads, so a detail page paid for the same
 * answer four or five times before drawing anything.
 */
export const getSalesMissionAccess = cache(async (): Promise<SalesMissionAccess | null> => {
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  const [profileResult, membershipResult, holdingResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("is_active, role, role_id, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("company_members")
      .select("company_id, user_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    supabase.schema("sales_mission").rpc("holding_company").maybeSingle(),
  ])

  const profile = profileResult.data
  if (profileResult.error || membershipResult.error || holdingResult.error || profile?.is_active !== true) {
    return null
  }

  // Belonging to any unit of the group is what admits a person; the holding
  // is then the tenant for everyone. No membership at all means no access.
  const memberships = (membershipResult.data ?? []).map((row) => ({
    companyId: row.company_id as string,
    userType: (row.user_type as string | null) ?? null,
  }))
  const holding = holdingResult.data as { id: string; name: string; slug: string } | null
  if (memberships.length === 0 || !holding) return null
  const membership = memberships[0]

  // The profile row is the only source for a person's name. Provider claims are
  // not used: a handed-down account would keep overwriting the corrected name
  // with the previous holder's.
  const displayName = profile.full_name?.trim() || user.email?.trim() || "Unknown user"
  const avatarUrl = profile.avatar_url?.trim() || null

  const globalRole = (profile.role ?? "").toLowerCase().replace(/\s+/g, "_")
  const isSuperAdmin = globalRole === "super_admin"
  const roleId = (profile.role_id as string | null) ?? null
  // Only a profile with no role at all consults the legacy user_type grants.
  // Falling back whenever the role happened to lack a row let a configured role
  // inherit access the permission matrix never showed and could not revoke.
  // Mirrors leadengine's require-permission.ts.
  const userType = roleId ? null : (membership.userType ?? globalRole ?? null) || null

  const access: SalesMissionAccess = {
    userId: user.id,
    companyId: holding.id,
    companyName: holding.name,
    permissionScopes: [holding.id, ...memberships.map((item) => item.companyId).filter((id) => id !== holding.id)],
    displayName,
    avatarUrl,
    isSuperAdmin,
    roleId,
    userType,
  }
  if (isSuperAdmin) return access

  const permission = await loadPermissionAcross(access, "sales_mission")
  return permission?.can_read && permission.can_read !== "none" ? access : null
})

/** The first permission row found across the scopes the person may be configured in. */
async function loadPermissionAcross(access: SalesMissionAccess, moduleId: string): Promise<ModulePermission | null> {
  for (const scope of access.permissionScopes) {
    const permission = await loadModulePermission(scope, access.roleId, access.userType, moduleId)
    if (permission) return permission
  }
  return null
}

/**
 * What each module governs, so the admin matrix and the code agree:
 *
 *   mission  — the mission record and its team. Every write in
 *              assignment-actions asks for `update`; only creating a mission
 *              asks for `create`.
 *   result   — the visit report on all four of its surfaces: the detail page,
 *              the reporting screen, the CSV export, and the LeadEngine push.
 *   contact  — reading client people: the appointment block and the "ketemu
 *              siapa" list. Writing them is deliberately NOT separate: contacts
 *              are collected inside the visit report, which requires at least
 *              one, so a role that could write reports but not contacts could
 *              never submit anything. Report writes answer to `result`.
 *   settings — the Pengaturan screen.
 */
export type SalesMissionModule =
  | "sales_mission_mission"
  | "sales_mission_result"
  | "sales_mission_contact"
  | "sales_mission_settings"
  | "sales_mission_prospect"

export type ModuleAction = "create" | "read" | "update" | "delete"

interface ModulePermission {
  can_create: boolean | null
  can_read: string | null
  can_update: boolean | null
  can_delete: boolean | null
  /** Whose records the writes reach; see lib/access/record-scope. */
  record_scope: string | null
  /** Whose records Lihat reaches. Enforced by row security; read here only to explain. */
  read_scope: string | null
}

/**
 * The one row that answers a permission question, memoised per request.
 *
 * A role answers for itself: with a role_id only that role's row is read,
 * and the legacy user_type row is consulted only for a profile with no role.
 * Keyed on primitives so React's cache dedupes the detail page's several
 * `canPerform` calls for the same module into one read.
 */
const loadModulePermission = cache(
  async (
    companyId: string,
    roleId: string | null,
    userType: string | null,
    moduleId: string
  ): Promise<ModulePermission | null> => {
    const supabase = await createClient()
    const columns = "can_create, can_read, can_update, can_delete, record_scope, read_scope"

    if (roleId) {
      const { data } = await supabase
        .from("role_permissions")
        .select(columns)
        .eq("role_id", roleId)
        .eq("company_id", companyId)
        .eq("module_id", moduleId)
        .maybeSingle()
      return (data as ModulePermission | null) ?? null
    }

    if (userType) {
      const { data } = await supabase
        .from("role_permissions")
        .select(columns)
        .eq("user_type", userType)
        .eq("company_id", companyId)
        .eq("module_id", moduleId)
        .maybeSingle()
      return (data as ModulePermission | null) ?? null
    }

    return null
  }
)

/**
 * Fine-grained permission inside Sales Mission.
 *
 * These are sub-permissions of an app the user already holds — they passed the
 * `sales_mission` gate to get here. So an unconfigured module means "not
 * restricted", not "denied": a tenant that has never opened the permission
 * matrix must not find the app broken. Admins tighten from there.
 *
 * Note this is deliberately weaker than the `sales_mission` gate itself, which
 * denies by default. Losing app access should lock you out; losing a
 * sub-permission that nobody has configured should not.
 *
 * Trusts the `access` it is handed. It used to re-verify the session and
 * re-read the profile on every call, three round trips to answer a question
 * the caller had already paid to answer; a screen with four checks spent more
 * time on permissions than on its own data.
 */
export async function canPerform(
  access: SalesMissionAccess,
  moduleId: SalesMissionModule,
  action: ModuleAction
): Promise<boolean> {
  if (access.isSuperAdmin) return true

  const permission = await loadPermissionAcross(access, moduleId)

  // Unconfigured module — see the note above. Deleting is the exception:
  // an unconfigured tenant should find the app working, not find that
  // everyone can remove every mission. That grant is given on purpose.
  if (!permission) return action !== "delete"

  if (action === "read") {
    const scope = permission.can_read
    return Boolean(scope) && scope !== "none"
  }

  return permission[`can_${action}`] === true
}

/**
 * Whose records this role's writes reach on a module: the Cakupan column of
 * the matrix. Super admin reaches everything. No row follows the same rule as
 * `canPerform`: an unconfigured module is unrestricted. Since the integrity
 * migration every role × module has a row, so that branch is reached only by
 * a profile with no role and no legacy grant.
 */
export async function getRecordScope(access: SalesMissionAccess, moduleId: SalesMissionModule): Promise<RecordScope> {
  if (access.isSuperAdmin) return "all"
  const permission = await loadPermissionAcross(access, moduleId)
  if (!permission) return "all"
  return isRecordScope(permission.record_scope) ? permission.record_scope : "own"
}

/**
 * Whose records this role's Lihat reaches. The database enforces it (row
 * security on missions, visit_reports, prospects reads the same row); the
 * app reads it only to say so on the screen, so a short list is explained
 * rather than mistaken for missing data.
 */
export async function getReadScope(access: SalesMissionAccess, moduleId: SalesMissionModule): Promise<RecordScope> {
  if (access.isSuperAdmin) return "all"
  const permission = await loadPermissionAcross(access, moduleId)
  if (!permission) return "all"
  return isRecordScope(permission.read_scope) ? permission.read_scope : "all"
}

/**
 * Everyone below this person in the reports_to chain, once per request. The
 * function is bounded and cycle-safe on the database side, and answers only
 * for the signed-in person.
 */
const loadSubordinateIds = cache(async (_userId: string): Promise<ReadonlySet<string>> => {
  const supabase = await createClient()
  const { data, error } = await supabase.schema("sales_mission").rpc("fn_my_subordinate_ids")
  if (error) {
    console.error("[loadSubordinateIds]", error.code, error.message)
    return new Set()
  }
  const rows = (data ?? []) as Array<string | { fn_my_subordinate_ids?: string }>
  return new Set(rows.map((row) => (typeof row === "string" ? row : (row.fn_my_subordinate_ids as string))).filter(Boolean))
})

/**
 * The scope a record check needs: which reach the role has on the module, and
 * who counts as the person's team when that reach is "team". The chain is read
 * only when it matters.
 */
export async function resolveScope(access: SalesMissionAccess, moduleId: SalesMissionModule): Promise<ScopeContext> {
  const scope = await getRecordScope(access, moduleId)
  const subordinateIds = scope === "team" ? await loadSubordinateIds(access.userId) : new Set<string>()
  return { scope, viewerId: access.userId, subordinateIds }
}

/**
 * The matrix grant and the record reach, together: the one question every
 * record-bound action asks. `ownerIds` comes from the owner helpers in
 * lib/access/record-scope so that "whose record" is defined in one place.
 */
export async function canPerformOn(
  access: SalesMissionAccess,
  moduleId: SalesMissionModule,
  action: ModuleAction,
  record: { ownerIds: ReadonlyArray<string | null | undefined> }
): Promise<boolean> {
  if (!(await canPerform(access, moduleId, action))) return false
  const ctx = await resolveScope(access, moduleId)
  return inScope(ctx, record.ownerIds)
}

/**
 * "Admin" inside Sales Mission means one thing: Ubah on Pengaturan mission.
 * It opens the settings screens, the recycle bin, and tenant configuration.
 * It is not a record scope; those come from each module's own Cakupan.
 * `canPerform` already answers true for a super admin.
 */
export function isSettingsAdmin(access: SalesMissionAccess): Promise<boolean> {
  return canPerform(access, "sales_mission_settings", "update")
}
