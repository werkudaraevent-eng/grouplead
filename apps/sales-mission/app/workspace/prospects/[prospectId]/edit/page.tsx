import { notFound, redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { DEFAULT_CONTACT_SALUTATIONS, configuredOptions } from "@/lib/missions/form-fields"
import { getProspect } from "@/lib/prospects/prospect-queries"
import { canEditProspect } from "@/lib/prospects/prospect-access"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { ProspectForm } from "../../prospect-form"

export const dynamic = "force-dynamic"

export default async function EditProspectPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  const { prospectId } = await params
  if (!(await canPerform(access, "sales_mission_prospect", "update"))) redirect(`/workspace/prospects/${prospectId}`)

  const [prospect, salesOptions, fields, prospectFields, isAdmin] = await Promise.all([
    getProspect(access, prospectId),
    listTenantSales(access),
    listFormFields(access, "mission"),
    listFormFields(access, "prospect"),
    access.isSuperAdmin ? Promise.resolve(true) : canPerform(access, "sales_mission_settings", "update"),
  ])
  if (!prospect) notFound()
  if (!canEditProspect(prospect, { userId: access.userId, isAdmin })) redirect(`/workspace/prospects/${prospectId}`)

  return (
    <WorkspacePage eyebrow="Sales Mission / Prospek" title={`Ubah ${prospect.clientCompanyName}`} description="Perbaiki data perusahaan atau kontaknya. Status dan catatan kontak diubah dari halaman prospek." action={<BackLink href={`/workspace/prospects/${prospectId}`} />}>
      <ProspectForm fields={prospectFields} salesOptions={salesOptions} salutations={configuredOptions(fields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)} viewerId={access.userId} canAssignOthers={isAdmin} prospect={prospect} />
    </WorkspacePage>
  )
}
