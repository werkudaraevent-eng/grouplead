import { redirect } from "next/navigation"
import { canPerform, type SalesMissionAccess, type SalesMissionModule, type ModuleAction } from "@/lib/sales-mission-access"

/**
 * Refuse a route the viewer's role does not hold.
 *
 * Hiding a menu item only removes the invitation. The URL still resolves, and a
 * page already open when permission is revoked keeps working on every later
 * render — which is exactly how a rep stayed on Settings after Settings was
 * taken away from their role.
 *
 * Sends them to "Hari ini", which every role that passed the app gate can open,
 * rather than to an error screen: being out of scope is not a failure.
 */
export async function requireModule(
  access: SalesMissionAccess,
  moduleId: SalesMissionModule,
  action: ModuleAction = "read"
): Promise<void> {
  if (!(await canPerform(access, moduleId, action))) {
    redirect("/workspace")
  }
}

/**
 * What this viewer may reach inside Sales Mission.
 *
 * The sidebar used to be a static array with no permission check at all, so a
 * role configured to only respond to missions still saw every menu and a
 * "Mission baru" button. The server action refused the write, but only after
 * the rep had filled in the form — the app looked open and behaved closed.
 *
 * Resolved once per request in the workspace layout and passed down, rather
 * than each nav item asking on its own: four round trips to build one sidebar
 * is a cost paid on every page load, on a field connection.
 */
export interface NavAccess {
  /** Missions, calendar, live board — the scheduling side of the app. */
  missions: boolean
  /** Whether the "Mission baru" affordance is offered at all. */
  createMission: boolean
  /** Reporting screens built on submitted visit reports. */
  reports: boolean
  /** The Administration group. */
  settings: boolean
  /** The prospect list, the stage before a mission. */
  prospects: boolean
  createProspect: boolean
}

export async function resolveNavAccess(access: SalesMissionAccess): Promise<NavAccess> {
  const [missions, createMission, reports, settings, prospects, createProspect] = await Promise.all([
    canPerform(access, "sales_mission_mission", "read"),
    canPerform(access, "sales_mission_mission", "create"),
    canPerform(access, "sales_mission_result", "read"),
    canPerform(access, "sales_mission_settings", "read"),
    canPerform(access, "sales_mission_prospect", "read"),
    canPerform(access, "sales_mission_prospect", "create"),
  ])

  return { missions, createMission, reports, settings, prospects, createProspect }
}
