import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { CalendarDays, MapPin, UsersRound } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission } from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import { BackLink, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

export default async function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const { missionId } = await params
  const mission = await getMission(access, missionId)
  // getMission is tenant-scoped, so a mission in another tenant is
  // indistinguishable from one that does not exist. That is the intent.
  if (!mission) notFound()

  const supporting = mission.supportingSalesNames

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission detail"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.location].filter(Boolean).join(" · ")}
      action={<BackLink />}
    >
      <section className="workspace-detail-grid">
        <article className="workspace-panel workspace-detail-panel">
          <div className="workspace-detail-status">
            <StatusBadge status={mission.status} />
            <span>Mission ID {mission.id}</span>
          </div>

          <div className="workspace-detail-facts">
            <div>
              <CalendarDays size={16} />
              <span><small>Schedule</small><strong>{formatMissionSchedule(mission.scheduledStart, new Date())}</strong></span>
            </div>
            <div>
              <MapPin size={16} />
              <span><small>Location</small><strong>{mission.location ?? "Belum diisi"}</strong></span>
            </div>
            <div>
              <UsersRound size={16} />
              <span><small>Primary sales</small><strong>{mission.primarySalesName ?? "Belum ditugaskan"}</strong></span>
            </div>
          </div>

          <div className="workspace-detail-copy">
            <p className="workspace-section-kicker">Objective</p>
            <h2>{mission.objective ?? "Objective belum diisi."}</h2>
            <p>Form hasil mission tersedia setelah kunjungan diterima dan diselesaikan.</p>
          </div>

          <div className="workspace-form-footer">
            <Link className="workspace-secondary-button" href="/workspace/missions">Back to missions</Link>
          </div>
        </article>

        <aside className="workspace-panel workspace-detail-side">
          <p className="workspace-section-kicker">Assignment</p>
          <h2>Supporting sales</h2>
          {supporting.length > 0 ? (
            <ul className="workspace-plain-list">
              {supporting.map((name) => <li key={name}>{name}</li>)}
            </ul>
          ) : (
            <p className="workspace-muted-note">Tidak ada sales pendukung untuk mission ini.</p>
          )}
        </aside>
      </section>
    </WorkspacePage>
  )
}
