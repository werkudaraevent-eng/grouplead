"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { GitBranch } from "lucide-react"
import type { GoalNode } from "@/types/goals"

interface ContactGoalNodesProps {
  clientCompanyId: string | null
}

/**
 * Displays goal node associations inherited from a contact's client company.
 * Read-only. Shows nothing if contact has no linked client company.
 */
export function ContactGoalNodes({ clientCompanyId }: ContactGoalNodesProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const [nodes, setNodes] = useState<GoalNode[]>([])

  useEffect(() => {
    if (!activeCompany?.id || !clientCompanyId) { setNodes([]); return }

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

  if (!clientCompanyId) return null
  if (nodes.length === 0) return null

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <GitBranch className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div>
        <span className="font-medium">Goal nodes (via company):</span>
        {nodes.map((n) => (
          <div key={n.id} className="ml-2">{n.name}</div>
        ))}
      </div>
    </div>
  )
}
