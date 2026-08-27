import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowUpRight, Info } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listAssignments } from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import { EmptyState, NewMissionAction, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?"
}

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
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assignments.map((assignment) => (
            <Link
              key={assignment.id}
              href={`/workspace/missions/${assignment.missionId}`}
              className="group rounded-xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {initials(assignment.salesName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{assignment.salesName}</p>
                  <p className="text-xs text-muted-foreground">
                    {assignment.role === "PRIMARY" ? "Primary" : "Supporting"} sales
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>

              <div className="mt-4 border-t pt-4">
                <p className="truncate text-sm font-medium text-foreground">{assignment.clientCompanyName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{formatMissionSchedule(assignment.scheduledStart, now)}</p>
              </div>

              <div className="mt-4">
                <StatusBadge status={assignment.response} />
              </div>
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

      <section className="mt-4 flex items-start gap-3 rounded-xl border bg-card px-5 py-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="text-sm font-semibold text-foreground">Assignment rule</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Primary sales must accept before mission can move into field execution. Supporting sales can respond independently.
          </p>
        </div>
      </section>
    </WorkspacePage>
  )
}
