import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { getActiveCompany } from "@/utils/company"
import { GoalConfigurationPage } from "@/features/goals/components/settings/goal-configuration-page"
import { getDimensionRegistry } from "@/config/dimension-registry"
import type { GoalV2 } from "@/types/goals"

export default async function GoalSettingsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const supabase = await createClient()
  const { slug } = await params
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  // Get active company to scope slug lookup (avoids conflicts across companies)
  const activeCompany = await getActiveCompany()

  let query = supabase
    .from("goals_v2")
    .select("*")
    .eq("slug", slug)

  if (activeCompany?.id) {
    query = query.eq("company_id", activeCompany.id)
  }

  const { data: goal } = await query.maybeSingle()

  if (!goal) redirect("/settings/goals")

  const dimensions = await getDimensionRegistry(supabase, goal.company_id)

  return <GoalConfigurationPage goal={goal as GoalV2} dimensions={dimensions} />
}
