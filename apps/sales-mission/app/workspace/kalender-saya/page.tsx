import { redirect } from "next/navigation"
import { getReadScope, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getActiveCalendarTokens } from "@/lib/calendar/calendar-token-queries"
import { requestOrigin } from "@/lib/request-origin"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { PRODUCT_NAME } from "@/lib/brand"
import { paths } from "@/lib/paths"
import { FeedSetup, SubscribeSteps } from "./feed-setup"

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
      {/* Two links as two cards side by side on a wide window (M3 canonical
          layout: use the width, and peers are seen together, not behind a
          tab); the steps for each calendar app once, under both. */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FeedSetup
            scope="own"
            title="Kunjungan saya"
            description="Aktivitas yang Anda ikuti sebagai sales utama atau pendukung. Bila Anda tidak ditugaskan ke aktivitas mana pun, kalender ini kosong."
            existing={existing.own}
            origin={origin}
          />
          {teamAllowed ? (
            <FeedSetup
              scope="team"
              title="Kalender tim"
              description={
                readScope === "all"
                  ? "Semua aktivitas unit bisnis, dengan nama sales utama di depan judul acara. Tautan terpisah dari kalender pribadi dan bisa dicabut sendiri."
                  : "Aktivitas Anda dan tim di bawah Anda, dengan nama sales utama di depan judul acara. Tautan terpisah dari kalender pribadi dan bisa dicabut sendiri."
              }
              existing={existing.team}
              origin={origin}
            />
          ) : (
            <section className="rounded-xl border border-dashed bg-card/50 p-5 text-sm text-muted-foreground" aria-label="Kalender tim">
              <p className="font-semibold text-foreground">Kalender tim</p>
              <p className="mt-1">Tersedia untuk peran dengan cakupan lihat Tim atau Semua, berisi semua aktivitas yang boleh dilihat. Cakupan peran Anda hanya aktivitas sendiri.</p>
            </section>
          )}
        </div>
        <SubscribeSteps />
      </div>
    </WorkspacePage>
  )
}
