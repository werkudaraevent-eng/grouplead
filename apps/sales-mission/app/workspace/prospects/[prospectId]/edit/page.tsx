import { notFound, redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess, resolveScope } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { DEFAULT_CONTACT_SALUTATIONS, configuredOptions } from "@/lib/missions/form-fields"
import { getProspect } from "@/lib/prospects/prospect-queries"
import { canAssignOthers, canAssignTo, canEditProspect, toProspectViewer } from "@/lib/prospects/prospect-access"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { ProspectForm } from "../../prospect-form"

export const dynamic = "force-dynamic"

export default async function EditProspectPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const { prospectId } = await params
  if (!(await canPerform(access, "sales_mission_prospect", "update"))) redirect(`/workspace/prospects/${prospectId}`)

  const [prospect, allSales, fields, prospectFields, scope] = await Promise.all([
    getProspect(access, prospectId),
    listTenantSales(access),
    listFormFields(access, "mission"),
    listFormFields(access, "prospect"),
    resolveScope(access, "sales_mission_prospect"),
  ])
  if (!prospect) notFound()
  const viewer = toProspectViewer(scope)
  if (!canEditProspect(prospect, viewer)) redirect(`/workspace/prospects/${prospectId}`)
  // The current holder stays in the list even when out of reach, so the form
  // shows who holds it; the server refuses a move to anyone out of reach.
  const salesOptions = allSales.filter((person) => canAssignTo(viewer, person.id) || person.id === prospect.ownerId)

  return (
    <WorkspacePage introKey={pageIntroKey("edit-prospect")} eyebrow="Prospek" title={`Ubah ${prospect.clientCompanyName}`} description="Perbaiki data perusahaan atau kontaknya. Status dan catatan kontak diubah dari halaman prospek." action={<BackLink href={`/workspace/prospects/${prospectId}`} />}>
      <ProspectForm fields={prospectFields} salesOptions={salesOptions} salutations={configuredOptions(fields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)} salutationsAllowOther={fields.find((field) => field.reportingKey === "contact_salutation")?.allowOther ?? false} viewerId={access.userId} canAssignOthers={canAssignOthers(viewer)} prospect={prospect} />
    </WorkspacePage>
  )
}
