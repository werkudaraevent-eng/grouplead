import type { ScopeRelation } from "@/lib/access/record-scope"
import type { MissionStatus } from "./mission-schema"

/**
 * What a viewer may do to one mission, from the matrix and nothing else.
 *
 * Every input is a fact already decided elsewhere: the matrix grants
 * (`missionUpdate`, `resultCreate`), the scope relation to the mission's
 * owners and to the report's author, the viewer's seat on the team, and the
 * tenant setting for direct rescheduling. This function only combines them,
 * so the rule is one table of cases and the pages and actions cannot drift.
 */

export type MissionRole = "PRIMARY" | "SUPPORTING" | null

export interface MissionGateInput {
  status: MissionStatus
  role: MissionRole
  isCreator: boolean
  /** `canPerform(mission, "update")` */
  missionUpdate: boolean
  /** `relate(missionScope, missionOwners(mission))` */
  mission: ScopeRelation
  /** `canPerform(result, "create")` */
  resultCreate: boolean
  /** `relate(resultScope, reportOwners(mission))` */
  report: ScopeRelation
  /** Tenant setting: may the sales utama move their own visit directly. */
  primaryCanReschedule: boolean
}

export interface MissionGates {
  /** Change the details while the visit is still ahead. */
  canEdit: boolean
  /** Call it off before it happens. */
  canCancel: boolean
  /** Remove supporting sales, open or close joining, decide reschedule proposals. */
  canManageTeam: boolean
  /** Write the visit report, push the lead, retry the CRM sync. */
  canWriteReport: boolean
  /** Whether a schedule change lands directly or becomes a proposal. */
  scheduleMode: "move" | "propose"
}

const CLOSED: readonly MissionStatus[] = ["COMPLETED", "CANCELLED"]

export function missionGates(input: MissionGateInput): MissionGates {
  const updateInScope = input.missionUpdate && (input.mission.owns || input.mission.supervises)
  const open = !CLOSED.includes(input.status)
  // Direct moves: whoever scheduled it, anyone supervising it, and the sales
  // utama when the tenant allows. The setting binds exactly the person whose
  // only claim on the mission is being its sales utama.
  const mayMove =
    updateInScope &&
    (input.isCreator || input.mission.supervises || (input.role === "PRIMARY" && input.primaryCanReschedule))
  return {
    canEdit: open && updateInScope,
    canCancel: open && updateInScope,
    canManageTeam: updateInScope,
    canWriteReport: input.resultCreate && (input.report.owns || input.report.supervises),
    scheduleMode: mayMove ? "move" : "propose",
  }
}
