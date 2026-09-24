import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess, resolveScope } from "@/lib/sales-mission-access"
import { canAssignOthers, canAssignTo, toProspectViewer } from "@/lib/prospects/prospect-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { DEFAULT_CONTACT_SALUTATIONS, configuredOptions } from "@/lib/missions/form-fields"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { ProspectForm } from "../prospect-form"

export const dynamic = "force-dynamic"

export default async function NewProspectPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  if (!(await canPerform(access, "sales_mission_prospect", "create"))) redirect("/workspace/prospects")

  const [allSales, fields, prospectFields, scope] = await Promise.all([
    listTenantSales(access),
    listFormFields(access, "mission"),
    listFormFields(access, "prospect"),
    resolveScope(access, "sales_mission_prospect"),
  ])
  const viewer = toProspectViewer(scope)
  const salesOptions = allSales.filter((person) => canAssignTo(viewer, person.id))

  return (
    <WorkspacePage introKey={pageIntroKey("new-prospect")} eyebrow="Prospek" title="Prospek baru" description="Satu perusahaan dan satu orang yang akan dihubungi." action={<BackLink href="/workspace/prospects" />}>
      <ProspectForm fields={prospectFields} salesOptions={salesOptions} salutations={configuredOptions(fields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)} salutationsAllowOther={fields.find((field) => field.reportingKey === "contact_salutation")?.allowOther ?? false} viewerId={access.userId} canAssignOthers={canAssignOthers(viewer)} />
    </WorkspacePage>
  )
}
