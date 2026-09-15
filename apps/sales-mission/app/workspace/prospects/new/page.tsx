import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { DEFAULT_CONTACT_SALUTATIONS, configuredOptions } from "@/lib/missions/form-fields"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { ProspectForm } from "../prospect-form"

export const dynamic = "force-dynamic"

export default async function NewProspectPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  if (!(await canPerform(access, "sales_mission_prospect", "create"))) redirect("/workspace/prospects")

  const [salesOptions, fields, isAdmin] = await Promise.all([
    listTenantSales(access),
    listFormFields(access, "mission"),
    access.isSuperAdmin ? Promise.resolve(true) : canPerform(access, "sales_mission_settings", "update"),
  ])

  return (
    <WorkspacePage eyebrow="Sales Mission / Prospek" title="Prospek baru" description="Satu perusahaan dan satu orang yang akan dihubungi." action={<BackLink href="/workspace/prospects" />}>
      <ProspectForm salesOptions={salesOptions} salutations={configuredOptions(fields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)} viewerId={access.userId} canAssignOthers={isAdmin} />
    </WorkspacePage>
  )
}
