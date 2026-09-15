/**
 * Who may change a prospect. Shared list, one owner: the owner works it,
 * an admin may do anything, and a prospect nobody holds can be taken by
 * anyone allowed to update prospects at all.
 */
export function canEditProspect(prospect: { ownerId: string | null }, viewer: { userId: string; isAdmin: boolean }): boolean {
  if (viewer.isAdmin) return true
  return prospect.ownerId === null || prospect.ownerId === viewer.userId
}

export function canClaimProspect(prospect: { ownerId: string | null }, viewer: { userId: string }): boolean {
  return prospect.ownerId === null || prospect.ownerId !== viewer.userId
}
