import { missionOwners, relate, reportOwners, type ScopeContext } from "@/lib/access/record-scope"
import { canPerform, resolveScope, type SalesMissionAccess } from "@/lib/sales-mission-access"
import { missionGates, type MissionGates, type MissionRole } from "./mission-gates"
import type { MissionListItem } from "./mission-schema"
import type { MissionSettings } from "./mission-queries"

/**
 * The server side of mission gates: gathers the matrix grants and the scope
 * relations for one mission, then hands them to the pure rule. Pages and
 * actions call this instead of spelling the rule out, so they cannot drift.
 */
export interface MissionRights extends MissionGates {
  missionCtx: ScopeContext
  resultCtx: ScopeContext
  /** Holds result:update and reaches the report's author as a supervisor. */
  supervisesReport: boolean
  /** The viewer is the mission's sales utama, the report's author. */
  isAuthor: boolean
}

export async function resolveMissionGates(
  access: SalesMissionAccess,
  mission: Pick<MissionListItem, "status" | "createdBy" | "primarySalesId">,
  role: MissionRole,
  settings: Pick<MissionSettings, "primaryCanReschedule">
): Promise<MissionRights> {
  const [missionUpdate, resultCreate, resultUpdate, missionCtx, resultCtx] = await Promise.all([
    canPerform(access, "sales_mission_mission", "update"),
    canPerform(access, "sales_mission_result", "create"),
    canPerform(access, "sales_mission_result", "update"),
    resolveScope(access, "sales_mission_mission"),
    resolveScope(access, "sales_mission_result"),
  ])
  const missionRelation = relate(missionCtx, missionOwners(mission))
  const reportRelation = relate(resultCtx, reportOwners(mission))
  const gates = missionGates({
    status: mission.status,
    role,
    isCreator: mission.createdBy === access.userId,
    missionUpdate,
    mission: missionRelation,
    resultCreate,
    report: reportRelation,
    primaryCanReschedule: settings.primaryCanReschedule,
  })
  return {
    ...gates,
    missionCtx,
    resultCtx,
    supervisesReport: resultUpdate && reportRelation.supervises,
    isAuthor: mission.primarySalesId !== null && mission.primarySalesId === access.userId,
  }
}

/**
 * Per-row report right for lists: may the viewer write this mission's report.
 * One grant read and one scope resolution for the whole page.
 */
export async function annotateReportRights<T extends { primarySalesId: string | null }>(
  access: SalesMissionAccess,
  items: T[]
): Promise<Array<T & { canReport: boolean }>> {
  const [resultCreate, ctx] = await Promise.all([
    canPerform(access, "sales_mission_result", "create"),
    resolveScope(access, "sales_mission_result"),
  ])
  return items.map((item) => {
    const relation = relate(ctx, reportOwners(item))
    return { ...item, canReport: resultCreate && (relation.owns || relation.supervises) }
  })
}
