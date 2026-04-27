"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { GitBranch } from "lucide-react"
import type { GoalNode } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

interface CompanyGoalNodesProps {
  clientCompanyId: string
}

/**
 * Displays goal nodes that reference a specific client company.
 * Shows node name and target amount.
 */
export function CompanyGoalNodes({ clientCompanyId }: CompanyGoalNodesProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const { fmt } = useCurrency()
  const [nodes, setNodes] = useState<GoalNode[]>([])

  useEffect(() => {
    if (!activeCompany?.id || !clientCompanyId) return

    const load = async () => {
      const { data } = await supabase
        .from("goal_nodes")
        .select("*")
        .eq("company_id", activeCompany.id)
        .eq("reference_field", "client_company_id")
        .eq("reference_value", clientCompanyId)

      setNodes((data as GoalNode[]) ?? [])
    }

    load()
  }, [activeCompany?.id, clientCompanyId, supabase])

  if (nodes.length === 0) return null

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <GitBranch className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {nodes.map((n) => (
          <div key={n.id}>
            {n.name} — Target: {fmt(n.target_amount)}
          </div>
        ))}
      </div>
    </div>
  )
}
