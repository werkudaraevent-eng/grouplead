import Link from "next/link"
import { ArrowUpRight, CalendarDays, ClipboardList, MapPinned, Plus } from "lucide-react"

const missionRows = [
  { time: "09:30", client: "PT Arunika Kreasi", place: "South Jakarta", status: "Scheduled", tone: "blue" },
  { time: "13:00", client: "Bina Ruang Nusantara", place: "Tangerang", status: "Assigned", tone: "amber" },
  { time: "16:30", client: "Karsa Eventworks", place: "Central Jakarta", status: "Draft", tone: "slate" },
]

export default function MissionHomePage() {
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
        <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-icon-blue"><ClipboardList size={17} /></span><div><p>Open missions</p><strong>12</strong></div><small>+3 this week</small></article>
        <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-icon-amber"><CalendarDays size={17} /></span><div><p>Today</p><strong>4</strong></div><small>1 awaiting response</small></article>
        <article className="workspace-metric"><span className="workspace-metric-icon workspace-metric-icon-green"><MapPinned size={17} /></span><div><p>Completed</p><strong>28</strong></div><small>91% result submitted</small></article>
      </section>

      <section className="workspace-dashboard-grid">
        <article className="workspace-panel workspace-panel-wide">
          <div className="workspace-panel-header"><div><p className="workspace-section-kicker">Field schedule</p><h2>Today&apos;s missions</h2></div><Link href="/workspace/calendar" className="workspace-text-link">Open calendar <ArrowUpRight size={14} /></Link></div>
          <div className="workspace-mission-list">
            {missionRows.map((mission) => <div className="workspace-mission-row" key={mission.client}><div className="workspace-mission-time">{mission.time}</div><div className="workspace-mission-mark"><span /></div><div className="workspace-mission-copy"><strong>{mission.client}</strong><span>{mission.place}</span></div><span className={`workspace-status workspace-status-${mission.tone}`}>{mission.status}</span></div>)}
          </div>
        </article>
        <article className="workspace-panel workspace-panel-side">
          <div className="workspace-panel-header"><div><p className="workspace-section-kicker">Quick start</p><h2>Keep moving</h2></div></div>
          <div className="workspace-quick-list"><Link href="/workspace/missions/new"><span className="workspace-quick-icon workspace-quick-icon-blue"><Plus size={16} /></span><span><strong>Plan a mission</strong><small>Schedule a confirmed visit</small></span><ArrowUpRight size={14} /></Link><Link href="/workspace/assignments"><span className="workspace-quick-icon workspace-quick-icon-amber"><ClipboardList size={16} /></span><span><strong>Review assignments</strong><small>Respond to pending work</small></span><ArrowUpRight size={14} /></Link><Link href="/workspace/calendar"><span className="workspace-quick-icon workspace-quick-icon-green"><CalendarDays size={16} /></span><span><strong>View calendar</strong><small>See your field schedule</small></span><ArrowUpRight size={14} /></Link></div>
        </article>
      </section>
    </main>
  )
}
