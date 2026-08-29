import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getBoardSnapshot } from "@/lib/board/board-queries"
import { BoardView } from "@/app/board/board-view"

export const dynamic = "force-dynamic"

/**
 * Internal board.
 *
 * Same layout as the TV, but client names are shown in full: everyone reaching
 * this page has already passed the Sales Mission access gate, so there is
 * nothing here they could not read on the missions list anyway.
 */
export default async function InternalBoardPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const now = new Date()
  const snapshot = await getBoardSnapshot(access.companyId, now, { masked: false })

  return (
    <>
      <meta httpEquiv="refresh" content="30" />
      <BoardView snapshot={snapshot} subtitle="Tampilan internal — nama klien ditampilkan" now={now} />
    </>
  )
}
