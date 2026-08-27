import Link from "next/link"
import { ArrowLeft, ArrowUpRight, ClipboardList, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatMissionSchedule, type MissionListItem } from "@/lib/missions/mission-schema"

/**
 * Shared page furniture, matching LeadEngine's list-page language: same
 * container padding, same header typography, same table and button primitives.
 */

export function WorkspacePage({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {eyebrow && <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>}
            <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      </div>
      <div className="custom-scrollbar flex-1 overflow-y-auto px-4 pb-8 sm:px-6 lg:px-8">{children}</div>
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center" role="status">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground">
        <ClipboardList className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

const STATUS_TONES: Record<string, string> = {
  ACCEPTED: "bg-[var(--success)] text-[var(--success-foreground)]",
  COMPLETED: "bg-[var(--success)] text-[var(--success-foreground)]",
  SCHEDULED: "bg-secondary text-secondary-foreground",
  IN_PROGRESS: "bg-secondary text-secondary-foreground",
  ASSIGNED: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  PENDING: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  RESCHEDULE_REQUESTED: "bg-[var(--warning)] text-[var(--warning-foreground)]",
  REJECTED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-destructive/10 text-destructive",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide",
        STATUS_TONES[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  )
}

export function NewMissionAction() {
  return (
    <Button asChild size="sm">
      <Link href="/workspace/missions/new">
        <Plus className="h-4 w-4" /> New mission
      </Link>
    </Button>
  )
}

export function BackLink({ href = "/workspace/missions" }: { href?: string }) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
    </Button>
  )
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
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Mission</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead className="w-10"><span className="sr-only">Open</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {missions.map((mission) => (
            <TableRow key={mission.id}>
              <TableCell>
                <span className="block font-semibold text-foreground">{mission.clientCompanyName}</span>
                <span className="block text-xs text-muted-foreground">{mission.missionType}</span>
              </TableCell>
              <TableCell className="text-sm">{formatMissionSchedule(mission.scheduledStart, now)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{mission.location ?? "—"}</TableCell>
              <TableCell><StatusBadge status={mission.status} /></TableCell>
              <TableCell className="text-sm">{mission.primarySalesName ?? <span className="text-muted-foreground">Belum ditugaskan</span>}</TableCell>
              <TableCell>
                <Link
                  href={`/workspace/missions/${mission.id}`}
                  aria-label={`Open ${mission.clientCompanyName}`}
                  className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
