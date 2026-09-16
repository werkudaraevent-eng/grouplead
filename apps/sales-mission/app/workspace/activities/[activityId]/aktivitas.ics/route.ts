import { NextResponse } from "next/server"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission } from "@/lib/missions/mission-queries"
import { buildCalendar, eventFromMission } from "@/lib/calendar/ics"
import { requestOrigin } from "@/lib/request-origin"
import { paths } from "@/lib/paths"
import { PRODUCT_NAME } from "@/lib/brand"

export const dynamic = "force-dynamic"

/**
 * One visit as a downloadable .ics, for "Tambah ke kalender" on the detail
 * page: the iPhone Calendar and Outlook open it as a new event. Reads
 * through the session, so it shows exactly what the page shows.
 */
export async function GET(_request: Request, context: { params: Promise<{ activityId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) return NextResponse.json({ error: "Not authorised" }, { status: 401 })

  const { activityId } = await context.params
  const mission = await getMission(access, activityId)
  if (!mission) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { origin, host } = await requestOrigin()
  const event = eventFromMission(mission, { url: `${origin}${paths.activity(mission.id)}`, host })
  if (!event) return NextResponse.json({ error: "Aktivitas ini belum punya jadwal." }, { status: 409 })

  const body = buildCalendar({ name: PRODUCT_NAME, events: [event], now: new Date() })
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="aktivitas-${mission.id.slice(0, 8)}.ics"`,
      "Cache-Control": "no-store",
    },
  })
}
