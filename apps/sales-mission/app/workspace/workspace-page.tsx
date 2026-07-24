import Link from "next/link"
import { ArrowLeft, ArrowUpRight, CalendarDays, ClipboardList, Plus } from "lucide-react"

export function WorkspacePage({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <main className="workspace-page">
      <header className="workspace-page-header">
        <div>
          <p className="workspace-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="workspace-page-description">{description}</p>
        </div>
        {action}
      </header>
      {children}
    </main>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="workspace-empty-state" role="status">
      <span className="workspace-empty-icon"><ClipboardList size={20} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  )
}

export const missionData = [
  { id: "mission-1", date: "Today, 09:30", client: "PT Arunika Kreasi", location: "South Jakarta", type: "Client visit", status: "SCHEDULED", owner: "Wg, Hanung" },
  { id: "mission-2", date: "Today, 13:00", client: "Bina Ruang Nusantara", location: "Tangerang", type: "Partnership meeting", status: "ASSIGNED", owner: "Nadia Prameswari" },
  { id: "mission-3", date: "Today, 16:30", client: "Karsa Eventworks", location: "Central Jakarta", type: "Follow-up visit", status: "DRAFT", owner: "Wg, Hanung" },
  { id: "mission-4", date: "Tomorrow, 10:00", client: "Langit Panggung Indonesia", location: "West Jakarta", type: "Proposal review", status: "ACCEPTED", owner: "Raka Adinata" },
]

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "SCHEDULED" || status === "ACCEPTED" ? "blue" : status === "ASSIGNED" ? "amber" : "slate"
  return <span className={`workspace-status workspace-status-${tone}`}>{status.replaceAll("_", " ")}</span>
}

export function MissionTable({ compact = false }: { compact?: boolean }) {
  const rows = compact ? missionData.slice(0, 3) : missionData
  return (
    <div className="workspace-table-wrap">
      <table className="workspace-table">
        <thead><tr><th>Mission</th><th>Schedule</th><th>Location</th><th>Status</th><th>Assigned to</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{rows.map((mission) => <tr key={mission.id}><td><strong>{mission.client}</strong><small>{mission.type}</small></td><td>{mission.date}</td><td>{mission.location}</td><td><StatusBadge status={mission.status} /></td><td>{mission.owner}</td><td><Link className="workspace-table-link" href={`/workspace/missions/${mission.id}`} aria-label={`Open ${mission.client}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody>
      </table>
    </div>
  )
}

export function NewMissionAction() {
  return <Link className="workspace-primary-button" href="/workspace/missions/new"><Plus size={16} /> New mission</Link>
}

export function BackLink({ href = "/workspace/missions" }: { href?: string }) {
  return <Link className="workspace-back-link" href={href}><ArrowLeft size={14} /> Back</Link>
}

export function CalendarPreview() {
  return <div className="workspace-calendar-preview"><div className="workspace-calendar-toolbar"><button type="button" aria-label="Previous month">‹</button><strong>July 2026</strong><button type="button" aria-label="Next month">›</button></div><div className="workspace-calendar-grid">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span className="workspace-calendar-day workspace-calendar-weekday" key={`${day}-${index}`}>{day}</span>)}{Array.from({ length: 31 }, (_, index) => <span className={`workspace-calendar-day ${index + 1 === 24 ? "workspace-calendar-today" : ""} ${[9, 13, 16, 24].includes(index + 1) ? "workspace-calendar-has-event" : ""}`} key={index}>{index + 1}</span>)}</div><div className="workspace-calendar-note"><CalendarDays size={15} /> 3 missions scheduled today <Link href="/workspace/missions">View missions</Link></div></div>
}
