import { redirect } from "next/navigation"
import { createClient } from "@/utils/supabase/server"
import { resolveProviderDisplayName } from "@/lib/auth"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"
import { WorkspaceShell } from "./workspace-shell"

export const dynamic = "force-dynamic"

export default async function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const displayName = resolveProviderDisplayName(user?.user_metadata ?? {})

  return <WorkspaceShell displayName={displayName}>{children}</WorkspaceShell>
}
