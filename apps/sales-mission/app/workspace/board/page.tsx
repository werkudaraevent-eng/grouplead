import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { canPerform, getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getBoardSnapshot } from "@/lib/board/board-queries"
import { parseBoardOptions } from "@/lib/board/board-options"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listMissionFacets } from "@/lib/missions/mission-page-queries"
import { EMPTY_AUDIT_FILTER, listAuditLog } from "@/lib/audit/audit-queries"
import { hasServiceClientConfig } from "@/utils/supabase/service"
import { EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { BoardActions, BoardToolbar } from "./board-controls"
import { BoardDashboard } from "./board-dashboard"

export const dynamic = "force-dynamic"

/**
 * Papan live, inside the app.
 *
 * A dashboard on the app's own surfaces, with a control bar whose settings
 * are exactly what a screen link carries. The old page rendered the TV
 * component inside the workspace: a dark, room-sized layout at desk
 * distance, with the screen link three menus away in Pengaturan.
 *
 * Reads the whole tenant through the service client, so it asks for the
 * mission module and not just the app gate.
 */
export default async function InternalBoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

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

  // The wall shows the whole unit through the service client, so it is for
  // people whose Cakupan lihat is the whole unit. A narrower reach gets an
  // explanation, not a wall that contradicts their own list.
  if ((await getReadScope(access, "sales_mission_mission")) !== "all") {
    return (
      <WorkspacePage eyebrow="Sales Mission / Papan live" title="Papan live">
        <EmptyState
          title="Papan live menampilkan seluruh unit bisnis"
          description="Cakupan lihat peran Anda pada Mission bukan Semua, jadi papan tidak ditampilkan. Minta admin melebarkannya di Role & Izin bila Anda perlu melihat papan."
        />
      </WorkspacePage>
    )
  }

  const params = await searchParams
  const options = parseBoardOptions(params)
  const now = new Date()

  const [snapshot, people, facets, isAdmin, activity, headerList] = await Promise.all([
    getBoardSnapshot(access.companyId, now, {
      masked: false,
      range: options.range,
      sales: options.sales,
      location: options.location,
    }),
    listTenantSales(access),
    listMissionFacets(access),
    canPerform(access, "sales_mission_settings", "update"),
    options.panels.includes("activity")
      ? listAuditLog(access, EMPTY_AUDIT_FILTER, 0, 24).then((result) => result.rows)
      : Promise.resolve([]),
    headers(),
  ])

  // Built from the request so a copied link works in whatever environment
  // the admin is actually using, rather than a hardcoded production host.
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001"
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Papan live"
      title="Papan live"
      description="Siapa di mana hari ini. Atur di sini, lalu kirim tampilan yang sama ke layar kantor."
      action={<BoardActions options={options} isAdmin={isAdmin} baseUrl={`${proto}://${host}`} />}
    >
      <BoardToolbar
        options={options}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        locations={facets.locations}
      />
      <BoardDashboard
        snapshot={snapshot}
        panels={options.panels}
        activity={activity}
        people={people.map((person) => ({ name: person.name, avatarUrl: person.avatarUrl }))}
        now={now}
      />
    </WorkspacePage>
  )
}
