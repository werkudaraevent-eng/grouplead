import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listAuditLog, type AuditFilter } from "@/lib/audit/audit-queries"
import { groupAuditEvents, type AuditAction } from "@/lib/audit/describe-audit"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { ActivityFilters, ActivityList } from "./activity-log"

export const dynamic = "force-dynamic"

const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Riwayat perubahan.
 *
 * The audit log, read the way Salesforce's Setup Audit Trail and HubSpot's
 * activity log present theirs: newest first, one line per action in plain
 * words, who and when beside it, and the field-level before/after a click
 * away. Filters for who, what kind of record, which operation, and when, all
 * in the URL so a finding can be linked.
 *
 * Admin only. The log names people and shows deleted content, which is the
 * point of it and also why it is not for everyone.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "read"))) {
    return (
      <WorkspacePage eyebrow="Pengaturan" title="Riwayat perubahan" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Riwayat perubahan hanya dapat dibaca oleh admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const params = await searchParams
  const action = params.action
  const filter: AuditFilter = {
    actorId: params.actor?.trim() || null,
    tableName: params.table?.trim() || null,
    action: action === "INSERT" || action === "UPDATE" || action === "DELETE" ? (action as AuditAction) : null,
    from: params.from && DAY.test(params.from) ? params.from : null,
    to: params.to && DAY.test(params.to) ? params.to : null,
    q: params.q?.trim() ?? "",
    missionId: null,
  }
  const page = Math.max(0, Number(params.page ?? 0) || 0)

  const [{ rows, hasMore }, people] = await Promise.all([listAuditLog(access, filter, page), listTenantSales(access)])
  const events = groupAuditEvents(rows)

  return (
    <WorkspacePage
      introKey={pageIntroKey("settings-history")}
      eyebrow="Pengaturan"
      title="Riwayat perubahan"
      description="Siapa membuat, mengubah, dan menghapus apa. Dicatat otomatis oleh database untuk setiap perubahan, jadi tidak ada yang bisa lolos."
      action={<BackLink href="/workspace/settings" />}
    >
      <ActivityFilters filter={filter} people={people.map((p) => ({ id: p.id, name: p.name }))} />
      <ActivityList events={events} page={page} hasMore={hasMore} />
    </WorkspacePage>
  )
}
