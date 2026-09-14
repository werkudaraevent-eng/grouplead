import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { listMissions } from "@/lib/missions/mission-queries"
import { annotateJoinStatus } from "@/lib/missions/mission-join"
import { getMissionSettings } from "@/lib/missions/mission-queries"
import { applyMissionQuery, filterMissions, parseMissionQuery, resolveMissionFilter } from "@/lib/missions/mission-filter"
import { buildImportColumns, toExportRows } from "@/lib/missions/mission-io"

export const dynamic = "force-dynamic"

/**
 * XLSX export of the mission list.
 *
 * Columns match the import template exactly, so an export can be edited and fed
 * straight back in. Status is appended read-only: it is derived from the team's
 * answers and is not something an import may set.
 *
 * Guarded on mission `read`, the same grant the list screen needs. An export is
 * a bulk read of every client name and schedule in the tenant, which makes it
 * the wrong place to be more generous than the page that links to it.
 */
export async function GET(request: Request) {
  const access = await getSalesMissionAccess()
  if (!access) return NextResponse.json({ error: "Not authorised" }, { status: 401 })

  if (!(await canPerform(access, "sales_mission_mission", "read"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [missions, fields, settings] = await Promise.all([
    listMissions(access),
    listFormFields(access, "mission"),
    getMissionSettings(access),
  ])

  // The same lens the list is showing, so "export" means "export what I see"
  // rather than silently handing back everything.
  const url = new URL(request.url)
  const filter = resolveMissionFilter(url.searchParams.get("filter"))
  const query = parseMissionQuery(Object.fromEntries(url.searchParams))
  const visible = applyMissionQuery(
    filterMissions(annotateJoinStatus(missions, settings), filter, settings),
    query,
    new Date()
  )

  const columns = buildImportColumns(fields)
  const rows = toExportRows(visible, columns)
  const headers = [...columns.map((column) => column.header), "Status"]

  const sheet = XLSX.utils.json_to_sheet(rows, { header: headers })
  sheet["!cols"] = headers.map((header) => ({
    wch: Math.max(header.length + 2, 18),
  }))

  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, sheet, "Mission")
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer

  const stamp = new Date().toISOString().slice(0, 10)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mission-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
