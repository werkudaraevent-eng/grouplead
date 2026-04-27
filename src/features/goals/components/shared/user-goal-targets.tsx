"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Target } from "lucide-react"
import type { GoalUserTarget, GoalNode, GoalV2 } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

interface UserGoalTargetsProps {
  userId: string
}

interface TargetDisplay {
  id: string
  goalName: string
  nodeName: string | null
  targetAmount: number
  period: string
}

/**
 * Displays goal_user_targets for a user with node name and path.
 * Shows personal target progress for sales users.
 */
export function UserGoalTargets({ userId }: UserGoalTargetsProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const { fmt } = useCurrency()
  const [targets, setTargets] = useState<TargetDisplay[]>([])

  useEffect(() => {
    if (!activeCompany?.id || !userId) return

    const load = async () => {
      const [targetsRes, goalsRes, nodesRes] = await Promise.all([
        supabase
          .from("goal_user_targets")
          .select("*")
          .eq("user_id", userId)
          .eq("company_id", activeCompany.id),
        supabase
          .from("goals_v2")
          .select("id, name")
          .eq("company_id", activeCompany.id)
          .eq("is_active", true),
        supabase
          .from("goal_nodes")
          .select("id, name")
          .eq("company_id", activeCompany.id),
      ])

      const userTargets = (targetsRes.data as GoalUserTarget[]) ?? []
      const goals = (goalsRes.data as Pick<GoalV2, "id" | "name">[]) ?? []
      const nodes = (nodesRes.data as Pick<GoalNode, "id" | "name">[]) ?? []

      const goalMap = new Map(goals.map((g) => [g.id, g.name]))
      const nodeMap = new Map(nodes.map((n) => [n.id, n.name]))

      const displays: TargetDisplay[] = userTargets.map((t) => ({
        id: t.id,
        goalName: goalMap.get(t.goal_id) ?? "Unknown Goal",
        nodeName: t.node_id ? (nodeMap.get(t.node_id) ?? null) : null,
        targetAmount: t.target_amount,
        period: `${t.period_start} – ${t.period_end}`,
      }))

      setTargets(displays)
    }

    load()
  }, [activeCompany?.id, userId, supabase])

  if (targets.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Target className="h-3.5 w-3.5" />
        Goal Targets
      </div>
      <div className="space-y-1.5">
        {targets.map((t) => (
          <div key={t.id} className="text-xs border rounded px-2 py-1.5 bg-slate-50">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t.goalName}</span>
              <span className="font-semibold">{fmt(t.targetAmount)}</span>
            </div>
            <div className="text-muted-foreground">
              {t.nodeName && <span>{t.nodeName} · </span>}
              {t.period}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
