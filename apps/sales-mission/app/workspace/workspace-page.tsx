import Link from "next/link"
import { ArrowLeft, ArrowUpRight, ClipboardList, Plus } from "lucide-react"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"

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

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "SCHEDULED" || status === "ACCEPTED" ? "blue" : status === "ASSIGNED" ? "amber" : "slate"
  return <span className={`workspace-status workspace-status-${tone}`}>{status.replaceAll("_", " ")}</span>
}

export function MissionTable({ missions, now }: { missions: MissionListItem[]; now: Date }) {
  if (missions.length === 0) {
    return (
      <EmptyState
        title="Belum ada mission"
        description="Mission yang dibuat akan muncul di sini beserta jadwal dan sales yang ditugaskan."
        action={<NewMissionAction />}
      />
    )
  }

  return (
    <div className="workspace-table-wrap">
      <table className="workspace-table">
        <thead><tr><th>Mission</th><th>Schedule</th><th>Location</th><th>Status</th><th>Assigned to</th><th><span className="sr-only">Open</span></th></tr></thead>
        <tbody>{missions.map((mission) => <tr key={mission.id}><td><strong>{mission.clientCompanyName}</strong><small>{mission.missionType}</small></td><td>{formatMissionSchedule(mission.scheduledStart, now)}</td><td>{mission.location ?? "—"}</td><td><StatusBadge status={mission.status} /></td><td>{mission.primarySalesName ?? "Belum ditugaskan"}</td><td><Link className="workspace-table-link" href={`/workspace/missions/${mission.id}`} aria-label={`Open ${mission.clientCompanyName}`}><ArrowUpRight size={15} /></Link></td></tr>)}</tbody>
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

