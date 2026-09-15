import { inScope, personInScope, prospectOwners, type RecordScope, type ScopeContext } from "@/lib/access/record-scope"

/**
 * Who may change a prospect. Shared list, one owner: the holder works it,
 * anyone whose Cakupan reaches the holder may step in, and a prospect nobody
 * holds can be taken by anyone allowed to update prospects at all.
 *
 * `subordinateIds` is an array rather than a Set so the viewer can cross into
 * client components unchanged.
 */
export interface ProspectViewer {
  userId: string
  scope: RecordScope
  subordinateIds: readonly string[]
}

/** The server's scope context, flattened for a page or a client component. */
export const toProspectViewer = (ctx: ScopeContext): ProspectViewer => ({
  userId: ctx.viewerId,
  scope: ctx.scope,
  subordinateIds: [...ctx.subordinateIds],
})

const toContext = (viewer: ProspectViewer): ScopeContext => ({
  scope: viewer.scope,
  viewerId: viewer.userId,
  subordinateIds: new Set(viewer.subordinateIds),
})

export function canEditProspect(prospect: { ownerId: string | null }, viewer: ProspectViewer): boolean {
  return inScope(toContext(viewer), prospectOwners(prospect))
}

/** May the viewer hand a prospect to this person? Null clears the holder, which only a wider Cakupan may do. */
export function canAssignTo(viewer: ProspectViewer, targetId: string | null): boolean {
  if (targetId === null) return viewer.scope !== "own"
  return personInScope(toContext(viewer), targetId)
}

/** Whether the "Tugaskan" controls are offered at all. */
export function canAssignOthers(viewer: ProspectViewer): boolean {
  return viewer.scope !== "own"
}
