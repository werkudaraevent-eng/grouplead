"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, BarChart3 } from "lucide-react"
import { NodeBreakdownWidget } from "@/features/goals/components/dashboard/node-breakdown-widget"
import type { GoalV2 } from "@/types/goals"

export function GoalBreakdown({
  goals,
  onGoalsChange,
}: {
  goals: GoalV2[]
  onGoalsChange?: () => void
}) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("")

  useEffect(() => {
    if (goals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goals[0].id)
    }
  }, [goals, selectedGoalId])

  if (goals.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Goal Breakdown
            </CardTitle>
            <CardDescription>
              See how attainment breaks down by goal node hierarchy.
            </CardDescription>
          </div>
          {goals.length > 1 && (
            <Select
              value={selectedGoalId}
              onValueChange={(v) => setSelectedGoalId(v)}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs">
                <SelectValue placeholder="Select goal" />
              </SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {selectedGoalId ? (
          <NodeBreakdownWidget
            goalId={selectedGoalId}
            loading={false}
            onDrillDown={() => {}}
          />
        ) : (
          <div className="text-center py-8">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Select a goal to view breakdown.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
