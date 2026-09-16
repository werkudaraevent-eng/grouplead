import { redirect } from "next/navigation"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getActiveCalendarToken } from "@/lib/calendar/calendar-token-queries"
import { requestOrigin } from "@/lib/request-origin"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { PRODUCT_NAME } from "@/lib/brand"
import { paths } from "@/lib/paths"
import { FeedSetup } from "./feed-setup"

export const dynamic = "force-dynamic"

/**
 * "Kalender saya": subscribe the phone's calendar to your visits. Per
 * person, not admin: the link serves only the visits you are on.
 */
export default async function MyCalendarPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const [existing, { origin }] = await Promise.all([getActiveCalendarToken(access), requestOrigin()])

  return (
    <WorkspacePage
      eyebrow={`${PRODUCT_NAME} / Kalender saya`}
      title="Kalender saya"
      description="Jadwal kunjungan Anda ikut ke Google Calendar, Kalender iPhone, atau Outlook lewat satu tautan langganan. Pengingat dan tampilan mengikuti kalender ponsel."
      action={<BackLink href={paths.calendar} />}
    >
      <div className="max-w-3xl">
        <FeedSetup existing={existing} origin={origin} />
      </div>
    </WorkspacePage>
  )
}
