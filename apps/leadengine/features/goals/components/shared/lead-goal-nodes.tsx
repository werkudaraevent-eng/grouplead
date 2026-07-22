"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { findLeadNodePaths, buildAncestorPath } from "@/features/goals/lib/node-attribution"
import { GitBranch } from "lucide-react"
import type { GoalNode, GoalSegment } from "@/types/goals"

interface LeadGoalNodesProps {
  lead: Record<string, unknown>
  clientCompany: Record<string, unknown> | null
}

/**
 * Displays which goal node(s) a lead contributes to.
 * Minimal text display showing node names with ancestor paths.
 */
export function LeadGoalNodes({ lead, clientCompany }: LeadGoalNodesProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const [paths, setPaths] = useState<string[]>([])

  useEffect(() => {
    if (!activeCompany?.id) return

    const load = async () => {
      const [nodesRes, segmentsRes] = await Promise.all([
        supabase.from("goal_nodes").select("*").eq("company_id", activeCompany.id),
        supabase.from("goal_segments").select("*").eq("company_id", activeCompany.id),
      ])

      const allNodes = (nodesRes.data as GoalNode[]) ?? []
      const segments = (segmentsRes.data as GoalSegment[]) ?? []

      if (allNodes.length === 0) return

      const matchedIds = findLeadNodePaths(lead, allNodes, segments, clientCompany)
      const nodeMap = new Map(allNodes.map((n) => [n.id, n]))

      const pathStrings = matchedIds.map((id) => {
        const ancestors = buildAncestorPath(id, allNodes)
        const names: string[] = []
        // Walk from root to leaf to build path
        let currentNodes = allNodes.filter((n) => !n.parent_node_id)
        for (const anc of ancestors) {
          const match = currentNodes.find(
            (n) => n.reference_field === anc.reference_field && n.reference_value === anc.reference_value
          )
          if (match) {
            names.push(match.name)
            currentNodes = allNodes.filter((n) => n.parent_node_id === match.id)
          }
        }
        return names.length > 0 ? names.join(" → ") : nodeMap.get(id)?.name ?? id
      })

      setPaths(pathStrings)
    }

    load()
  }, [activeCompany?.id, lead, clientCompany, supabase])

  if (paths.length === 0) return null

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <GitBranch className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <div className="space-y-0.5">
        {paths.map((p, i) => (
          <div key={i}>{p}</div>
        ))}
      </div>
    </div>
  )
}
