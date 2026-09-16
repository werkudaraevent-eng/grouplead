import { NextResponse } from "next/server"
import { hasServiceClientConfig } from "@/utils/supabase/service"
import { resolveCalendarToken } from "@/lib/calendar/calendar-token"
import { listMissionsForFeed } from "@/lib/calendar/calendar-feed-queries"
import { buildCalendar, eventFromMission, type CalendarEvent } from "@/lib/calendar/ics"
import { requestOrigin } from "@/lib/request-origin"
import { paths } from "@/lib/paths"
import { PRODUCT_NAME } from "@/lib/brand"

export const dynamic = "force-dynamic"

const DAY = 24 * 60 * 60 * 1000

/**
 * The calendar feed a person subscribes to: their visits, sixty days back
 * and a year ahead, as iCalendar. No session; the token in the path is the
 * credential (see lib/calendar/calendar-token.ts). Unknown or retired
 * tokens get a plain 404, and nothing here is indexable.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  if (!hasServiceClientConfig()) return new NextResponse("Feed belum dikonfigurasi.", { status: 503 })

  const { token } = await context.params
  const resolved = await resolveCalendarToken(token)
  if (!resolved) return new NextResponse("Not found", { status: 404, headers: { "X-Robots-Tag": "noindex" } })

  const now = new Date()
  const { missions, displayName } = await listMissionsForFeed(resolved.companyId, resolved.userId, {
    since: new Date(now.getTime() - 60 * DAY),
    until: new Date(now.getTime() + 365 * DAY),
  })
  const { origin, host } = await requestOrigin()
  const events = missions
    .map((mission) => eventFromMission(mission, { url: `${origin}${paths.activity(mission.id)}`, host }))
    .filter((event): event is CalendarEvent => event !== null)

  const body = buildCalendar({
    name: displayName ? `${PRODUCT_NAME} · ${displayName}` : PRODUCT_NAME,
    events,
    now,
  })

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="sales-activity.ics"',
      "Cache-Control": "private, max-age=300",
      "X-Robots-Tag": "noindex",
    },
  })
}
