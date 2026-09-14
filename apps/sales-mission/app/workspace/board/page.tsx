import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getBoardSnapshot } from "@/lib/board/board-queries"
import { BoardView } from "@/app/board/board-view"
import { AutoRefresh } from "./auto-refresh"
import { hasServiceClientConfig } from "@/utils/supabase/service"
import { EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

/**
 * Internal board.
 *
 * Same layout as the TV, but client names are shown in full — which is why it
 * asks for the mission module and not just the app gate. The old reasoning
 * ("nothing here they could not read on the missions list") stopped holding the
 * moment the missions list itself became gated: this page reads the whole
 * tenant through a service-role client, so it would have been the way around
 * that guard.
 *
 * The TV board at /board is a different audience with its own signed token and
 * masked names, and is unaffected.
 */
export default async function InternalBoardPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  // The board reads the whole tenant through the service key, the one secret
  // this app needs beyond the public Supabase pair. Without it there is
  // nothing to draw, and the right message is "configure this", not "check
  // your connection".
  if (!hasServiceClientConfig()) {
    return (
      <WorkspacePage eyebrow="Sales Mission / Papan live" title="Papan live">
        <EmptyState
          title="Papan live belum dikonfigurasi"
          description="Variabel SUPABASE_SERVICE_ROLE_KEY belum diset di deployment Sales Mission. Tambahkan di Vercel → Project → Settings → Environment Variables, lalu deploy ulang."
        />
      </WorkspacePage>
    )
  }

  const now = new Date()
  const snapshot = await getBoardSnapshot(access.companyId, now, { masked: false })

  return (
    <>
      <BoardView snapshot={snapshot} subtitle="Tampilan internal — nama klien ditampilkan" now={now} />
      <AutoRefresh />
    </>
  )
}
