import Link from "next/link"
import { ArrowLeft, CalendarDays, MapPin, UsersRound } from "lucide-react"
import { BackLink, StatusBadge, WorkspacePage, missionData } from "@/app/workspace/workspace-page"

export default async function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = await params
  const mission = missionData.find((item) => item.id === missionId) ?? missionData[0]
  return <WorkspacePage eyebrow="Sales Mission / Mission detail" title={mission.client} description={`${mission.type} · ${mission.location}`} action={<BackLink />}>
    <section className="workspace-detail-grid"><article className="workspace-panel workspace-detail-panel"><div className="workspace-detail-status"><StatusBadge status={mission.status} /><span>Mission ID {mission.id}</span></div><div className="workspace-detail-facts"><div><CalendarDays size={16} /><span><small>Schedule</small><strong>{mission.date}</strong></span></div><div><MapPin size={16} /><span><small>Location</small><strong>{mission.location}</strong></span></div><div><UsersRound size={16} /><span><small>Primary sales</small><strong>{mission.owner}</strong></span></div></div><div className="workspace-detail-copy"><p className="workspace-section-kicker">Objective</p><h2>Build a clear next step with client team.</h2><p>Mission result form will become available after the visit is accepted and completed.</p></div><div className="workspace-form-footer"><Link className="workspace-secondary-button" href="/workspace/missions">Back to missions</Link><button className="workspace-primary-button" type="button">Update mission</button></div></article><aside className="workspace-panel workspace-detail-side"><p className="workspace-section-kicker">Activity</p><h2>Mission history</h2><div className="workspace-activity"><div><span />Mission created<small>Today, 08:20</small></div><div><span />Assignment sent<small>Today, 08:22</small></div><div><span className="workspace-activity-muted" />Result pending<small>After field visit</small></div></div></aside></section>
  </WorkspacePage>
}
