import { redirect } from "next/navigation"
import { getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getActiveCalendarTokens } from "@/lib/calendar/calendar-token-queries"
import { requestOrigin } from "@/lib/request-origin"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { PRODUCT_NAME } from "@/lib/brand"
import { paths } from "@/lib/paths"
import { FeedSetup } from "./feed-setup"

export const dynamic = "force-dynamic"

/**
 * "Kalender saya": subscribe the phone's calendar to your visits, and,
 * when your role sees beyond your own, to the team's. Two links, each
 * theirs alone: the personal one serves the visits you are on, the team
 * one every visit your read scope reaches.
 */
export default async function MyCalendarPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_mission")

  const [existing, { origin }, readScope] = await Promise.all([getActiveCalendarTokens(access), requestOrigin(), getReadScope(access, "sales_mission_mission")])
  const teamAllowed = readScope !== "own"

  return (
    <WorkspacePage
      eyebrow={`${PRODUCT_NAME} / Kalender saya`}
      title="Kalender saya"
      description="Jadwal kunjungan ikut ke Google Calendar, Kalender iPhone, atau Outlook lewat tautan langganan; tempel sebagai kalender dari URL, bukan impor berkas, supaya perubahan jadwal ikut. Pengingat dan tampilan mengikuti kalender ponsel."
      action={<BackLink href={paths.calendar} />}
    >
      <div className="max-w-3xl space-y-8">
        <section aria-labelledby="feed-own">
          <h2 id="feed-own" className="text-base font-semibold text-foreground">Kunjungan saya</h2>
          <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
            Aktivitas yang Anda ikuti sebagai sales utama atau pendukung. Bila Anda tidak ditugaskan ke aktivitas mana pun, kalender ini kosong.
          </p>
          <FeedSetup scope="own" existing={existing.own} origin={origin} />
        </section>
        {teamAllowed && (
          <section aria-labelledby="feed-team">
            <h2 id="feed-team" className="text-base font-semibold text-foreground">Kalender tim</h2>
            <p className="mb-3 mt-0.5 text-sm text-muted-foreground">
              {readScope === "all"
                ? "Semua aktivitas unit bisnis, dengan nama sales utama di depan judul acara. Tautan terpisah dari kalender pribadi dan bisa dicabut sendiri."
                : "Aktivitas Anda dan tim di bawah Anda, dengan nama sales utama di depan judul acara. Tautan terpisah dari kalender pribadi dan bisa dicabut sendiri."}
            </p>
            <FeedSetup scope="team" existing={existing.team} origin={origin} />
          </section>
        )}
      </div>
    </WorkspacePage>
  )
}
