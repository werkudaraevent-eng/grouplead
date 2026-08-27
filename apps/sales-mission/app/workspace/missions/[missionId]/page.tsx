import { notFound, redirect } from "next/navigation"
import { CalendarDays, MapPin, UsersRound } from "lucide-react"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { getMission } from "@/lib/missions/mission-queries"
import { formatMissionSchedule } from "@/lib/missions/mission-schema"
import { BackLink, StatusBadge, WorkspacePage } from "@/app/workspace/workspace-page"

export const dynamic = "force-dynamic"

function Fact({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 p-5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  )
}

export default async function MissionDetailPage({ params }: { params: Promise<{ missionId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const { missionId } = await params
  const mission = await getMission(access, missionId)
  // getMission is tenant-scoped, so a mission in another tenant is
  // indistinguishable from one that does not exist. That is the intent.
  if (!mission) notFound()

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Mission detail"
      title={mission.clientCompanyName}
      description={[mission.missionType, mission.location].filter(Boolean).join(" · ")}
      action={<BackLink />}
    >
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <article className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <StatusBadge status={mission.status} />
            <span className="font-mono text-[11px] text-muted-foreground">ID {mission.id}</span>
          </div>

          <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <Fact icon={CalendarDays} label="Schedule" value={formatMissionSchedule(mission.scheduledStart, new Date())} />
            <Fact icon={MapPin} label="Location" value={mission.location ?? "Belum diisi"} />
            <Fact icon={UsersRound} label="Primary sales" value={mission.primarySalesName ?? "Belum ditugaskan"} />
          </div>

          <div className="border-t px-5 py-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Objective</p>
            <h2 className="mt-2 text-base font-semibold leading-relaxed text-foreground">
              {mission.objective ?? "Objective belum diisi."}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Form hasil mission tersedia setelah kunjungan diterima dan diselesaikan.
            </p>
          </div>
        </article>

        <aside className="rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Assignment</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">Supporting sales</h2>
          </div>
          {mission.supportingSalesNames.length > 0 ? (
            <ul className="divide-y">
              {mission.supportingSalesNames.map((name) => (
                <li key={name} className="flex items-center gap-3 px-5 py-3.5 text-sm">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                    {name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2)}
                  </span>
                  <span className="truncate font-medium text-foreground">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Tidak ada sales pendukung untuk mission ini.</p>
          )}
        </aside>
      </section>
    </WorkspacePage>
  )
}
