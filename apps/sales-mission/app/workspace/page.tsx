import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, CalendarDays, ClipboardList, MapPinned, Plus } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMissionSummary, listMissions } from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import { StatusBadge } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

export default async function MissionHomePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const [summary, missions] = await Promise.all([getMissionSummary(access), listMissions(access)])
  const now = new Date()
  const upcoming = missions.filter((mission) => mission.scheduledStart).slice(0, 4)

  return (
    <main className="workspace-page">
      <header className="workspace-page-header">
        <div>
          <p className="workspace-eyebrow">Sales Mission / Overview</p>
          <h1>Mission workspace</h1>
          <p className="workspace-page-description">Plan confirmed visits, coordinate sales, and keep field results moving.</p>
        </div>
        <Link className="workspace-primary-button" href="/workspace/missions/new"><Plus size={16} /> New mission</Link>
      </header>

      <section className="workspace-metric-grid" aria-label="Mission summary">
        <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-icon-blue"><ClipboardList size={17} /></span><div><p>Open missions</p><strong>{summary.open}</strong></div></article>
        <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-icon-amber"><CalendarDays size={17} /></span><div><p>Today</p><strong>{summary.today}</strong></div></article>
        <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-icon-green"><MapPinned size={17} /></span><div><p>Completed</p><strong>{summary.completed}</strong></div></article>
      </section>

      <section className="workspace-dashboard-grid">
        <article className="workspace-panel workspace-panel-wide">
          <div className="workspace-panel-header">
            <div><p className="workspace-section-kicker">Field schedule</p><h2>Upcoming missions</h2></div>
            <Link href="/workspace/missions" className="workspace-text-link">All missions <ArrowUpRight size={14} /></Link>
          </div>
          {upcoming.length > 0 ? (
            <div className="workspace-mission-list">
              {upcoming.map((mission) => (
                <div className="workspace-mission-row" key={mission.id}>
                  <div className="workspace-mission-time">{formatMissionSchedule(mission.scheduledStart, now)}</div>
                  <div className="workspace-mission-mark"><span /></div>
                  <div className="workspace-mission-copy">
                    <strong>{mission.clientCompanyName}</strong>
                    <span>{[mission.location, mission.primarySalesName].filter(Boolean).join(" · ") || mission.missionType}</span>
                  </div>
                  <StatusBadge status={mission.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="workspace-muted-note">Belum ada mission terjadwal. Mulai dengan merencanakan kunjungan pertama.</p>
          )}
        </article>

        <article className="workspace-panel workspace-panel-side">
          <div className="workspace-panel-header"><div><p className="workspace-section-kicker">Quick start</p><h2>Keep moving</h2></div></div>
          <div className="workspace-quick-list">
            <Link href="/workspace/missions/new"><span className="workspace-quick-icon workspace-quick-icon-blue"><Plus size={16} /></span><span><strong>Plan a mission</strong><small>Schedule a confirmed visit</small></span><ArrowUpRight size={14} /></Link>
            <Link href="/workspace/missions"><span className="workspace-quick-icon workspace-quick-icon-amber"><ClipboardList size={16} /></span><span><strong>Review missions</strong><small>Track planned visits</small></span><ArrowUpRight size={14} /></Link>
            <Link href="/workspace/calendar"><span className="workspace-quick-icon workspace-quick-icon-green"><CalendarDays size={16} /></span><span><strong>View calendar</strong><small>See your field schedule</small></span><ArrowUpRight size={14} /></Link>
          </div>
        </article>
      </section>
    </main>
  )
}
