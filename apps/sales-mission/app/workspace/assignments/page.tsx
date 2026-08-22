import Link from "next/link"
import { redirect } from "next/navigation"
import { Check, UsersRound } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listAssignments } from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import { EmptyState, NewMissionAction, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

export default async function AssignmentsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const assignments = await listAssignments(access)
  const now = new Date()

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Assignments"
      title="Assignments"
      description="Review responses and keep every primary and supporting sales assignment clear."
    >
      {assignments.length > 0 ? (
        <section className="workspace-assignment-grid">
          {assignments.map((assignment) => (
            <Link className="workspace-assignment-card" key={assignment.id} href={`/workspace/missions/${assignment.missionId}`}>
              <div className="workspace-assignment-avatar"><UsersRound size={17} /></div>
              <div className="workspace-assignment-copy">
                <strong>{assignment.salesName}</strong>
                <small>{assignment.role === "PRIMARY" ? "Primary" : "Supporting"} sales</small>
                <p>{assignment.clientCompanyName}<br />{formatMissionSchedule(assignment.scheduledStart, now)}</p>
              </div>
              <StatusBadge status={assignment.response} />
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState
          title="Belum ada penugasan"
          description="Penugasan muncul otomatis begitu sebuah mission dibuat dan sales ditetapkan."
          action={<NewMissionAction />}
        />
      )}

      <section className="workspace-panel workspace-note-panel">
        <Check size={17} />
        <div>
          <strong>Assignment rule</strong>
          <p>Primary sales must accept before mission can move into field execution. Supporting sales can respond independently.</p>
        </div>
      </section>
    </WorkspacePage>
  )
}
