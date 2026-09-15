import Link from "next/link"
import { redirect } from "next/navigation"
import { Plus } from "@/components/icons"
import { canPerform, getSalesMissionAccess, resolveScope } from "@/lib/sales-mission-access"
import { canAssignOthers, canAssignTo, toProspectViewer } from "@/lib/prospects/prospect-access"
import { requireModule } from "@/lib/missions/nav-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { listProspectStatuses } from "@/lib/prospects/prospect-status-queries"
import { listImportBatches } from "@/lib/prospects/prospect-queries"
import { countProspects, listProspectsPage } from "@/lib/prospects/prospect-page-queries"
import { EMPTY_PROSPECT_QUERY, isEmptyProspectQuery, parseProspectQuery } from "@/lib/prospects/prospect-filter"
import { parseProspectPageParams } from "@/lib/prospects/prospect-paging"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { ProspectFilterBar } from "./prospect-filter-bar"
import { ProspectTable } from "./prospect-table"
import { ImportProspects } from "./import-prospects"

export const dynamic = "force-dynamic"

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_prospect")

  const params = await searchParams
  const now = new Date()
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(now)
  const query = parseProspectQuery(params)
  const { page, size, sort } = parseProspectPageParams(params)

  const [statuses, people, batches, canCreate, canUpdate, canDelete, canCreateMission, scope] = await Promise.all([
    listProspectStatuses(access, { includeArchived: true }),
    listTenantSales(access),
    listImportBatches(access),
    canPerform(access, "sales_mission_prospect", "create"),
    canPerform(access, "sales_mission_prospect", "update"),
    canPerform(access, "sales_mission_prospect", "delete"),
    canPerform(access, "sales_mission_mission", "create"),
    resolveScope(access, "sales_mission_prospect"),
  ])
  // Whose prospects this viewer reaches, and whom they may hand one to.
  const viewer = toProspectViewer(scope)
  const assignable = people.filter((person) => canAssignTo(viewer, person.id))

  const base = { query, sort, today }
  const [pageResult, allCount, dueCount] = await Promise.all([
    listProspectsPage(access, { ...base, page, size }),
    isEmptyProspectQuery(query) ? Promise.resolve(null) : countProspects(access, { query: EMPTY_PROSPECT_QUERY, sort, today }),
    countProspects(access, { query: { ...EMPTY_PROSPECT_QUERY, due: true }, sort, today }),
  ])

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Prospek"
      title="Prospek"
      description="Calon klien yang belum jadi kunjungan. Catat setiap kontak; begitu janji temu disepakati, jadwalkan kunjungannya dari sini."
      action={
        <>
          {canCreate && <ImportProspects people={assignable} canAssignOthers={canAssignOthers(viewer)} viewerId={access.userId} />}
          {canCreate && (
            <Button asChild size="sm">
              <Link href="/workspace/prospects/new">
                <Plus className="h-4 w-4" /> Prospek baru
              </Link>
            </Button>
          )}
        </>
      }
    >
      <ProspectFilterBar
        query={query}
        statuses={statuses}
        people={people.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        batches={batches}
        total={allCount ?? pageResult.total}
        shown={pageResult.total}
        dueCount={dueCount}
      />
      <ProspectTable
        prospects={pageResult.items}
        statuses={statuses}
        people={assignable.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))}
        today={today}
        viewer={viewer}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        canCreateMission={canCreateMission}
        filtered={!isEmptyProspectQuery(query)}
        pagination={{ page, size, total: pageResult.total, sort }}
      />
    </WorkspacePage>
  )
}
