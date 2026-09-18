import { redirect } from "next/navigation"
import { canPerform, getReadScope, getSalesMissionAccess, resolveScope } from "@/lib/sales-mission-access"
import { describeReadScope } from "@/lib/access/record-scope"
import { canAssignOthers, canAssignTo, toProspectViewer } from "@/lib/prospects/prospect-access"
import { requireModule } from "@/lib/missions/nav-access"
import { getMissionSettings, listTenantSales } from "@/lib/missions/mission-queries"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { listProspectStatuses } from "@/lib/prospects/prospect-status-queries"
import { listImportBatches } from "@/lib/prospects/prospect-queries"
import { countProspects, listProspectsPage } from "@/lib/prospects/prospect-page-queries"
import { EMPTY_PROSPECT_QUERY, isEmptyProspectQuery, parseProspectQuery } from "@/lib/prospects/prospect-filter"
import { parseProspectPageParams } from "@/lib/prospects/prospect-paging"
import { WorkspacePage } from "@/app/workspace/workspace-page"
import { RememberView } from "@/components/remember-view"
import { rememberedView } from "@/lib/remembered-view"
import { paths } from "@/lib/paths"
import { ProspectFilterBar } from "./prospect-filter-bar"
import { ProspectTable } from "./prospect-table"
import { ImportProspects } from "./import-prospects"
import { ProspectsPhoneMenu } from "./prospects-phone-menu"
import { SelectionModeProvider } from "@/components/selection-mode"

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
  const remembered = await rememberedView("prospects", params)
  if (remembered) redirect(paths.prospectList(remembered))
  const now = new Date()
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(now)
  const query = parseProspectQuery(params)
  const { page, size, sort } = parseProspectPageParams(params)

  const [statuses, people, batches, canCreate, canUpdate, canDelete, canCreateMission, scope, settings] = await Promise.all([
    listProspectStatuses(access, { includeArchived: true }),
    listTenantSales(access),
    listImportBatches(access),
    canPerform(access, "sales_mission_prospect", "create"),
    canPerform(access, "sales_mission_prospect", "update"),
    canPerform(access, "sales_mission_prospect", "delete"),
    canPerform(access, "sales_mission_mission", "create"),
    resolveScope(access, "sales_mission_prospect"),
    getMissionSettings(access),
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
      eyebrow="Sales Activity / Prospek"
      title="Prospek"
      description={[describeReadScope(await getReadScope(access, "sales_mission_prospect"), "prospek"), "Calon klien yang belum jadi kunjungan. Catat setiap kontak; begitu janji temu disepakati, jadwalkan kunjungannya dari sini."].filter(Boolean).join(" ")}
      // The empty state teaches what this sentence says; on a phone the
      // list opens on its records, and Import waits in the overflow menu.
      phoneDescription={false}
      phoneAction={false}
      action={
        <>
          {canCreate && <ImportProspects people={assignable} canAssignOthers={canAssignOthers(viewer)} viewerId={access.userId} />}
        </>
      }
      primaryAction={canCreate ? { href: "/workspace/prospects/new", label: "Prospek baru" } : undefined}
    >
      <RememberView list="prospects" />
      <SelectionModeProvider>
      <ProspectsPhoneMenu canCreate={canCreate} canSelect={canUpdate || canDelete} people={assignable} canAssignOthers={canAssignOthers(viewer)} viewerId={access.userId} />
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
        viewerName={access.displayName}
        companyName={access.companyName}
        whatsappGreeting={settings.whatsappGreeting}
      />
      </SelectionModeProvider>
    </WorkspacePage>
  )
}
