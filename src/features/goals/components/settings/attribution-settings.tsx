"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { updateGoalV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { GoalV2 } from "@/types/goals"

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

interface AttributionSettingsProps {
  goals: GoalV2[]
  onGoalsChange?: () => void
}

export function AttributionSettings({ goals, onGoalsChange }: AttributionSettingsProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [attributionBasis, setAttributionBasis] = useState<"event_date" | "closed_won_date">("event_date")
  const [cutoffDay, setCutoffDay] = useState(25)
  const [perMonthEnabled, setPerMonthEnabled] = useState(false)
  const [perMonthCutoffs, setPerMonthCutoffs] = useState<Record<string, number>>({})

  // Auto-select first goal
  useEffect(() => {
    if (goals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goals[0].id)
    }
  }, [goals, selectedGoalId])

  // Populate form when selected goal changes
  useEffect(() => {
    const goal = goals.find((g) => g.id === selectedGoalId)
    if (!goal) return
    setAttributionBasis(goal.attribution_basis)
    setCutoffDay(goal.monthly_cutoff_day ?? 25)
    const hasCutoffs =
      goal.per_month_cutoffs && Object.keys(goal.per_month_cutoffs).length > 0
    setPerMonthEnabled(!!hasCutoffs)
    setPerMonthCutoffs(goal.per_month_cutoffs ?? {})
  }, [selectedGoalId, goals])

  const handleSave = async () => {
    if (!selectedGoalId) return
    setSaving(true)
    const result = await updateGoalV2Action(selectedGoalId, {
      attribution_basis: attributionBasis,
      monthly_cutoff_day: cutoffDay,
      per_month_cutoffs: perMonthEnabled ? perMonthCutoffs : null,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Attribution settings saved")
      onGoalsChange?.()
    } else {
      toast.error(result.error ?? "Failed to save settings")
    }
  }

  const updateMonthCutoff = (month: number, value: number) => {
    setPerMonthCutoffs((prev) => ({
      ...prev,
      [String(month)]: Math.min(28, Math.max(1, value)),
    }))
  }

  if (goals.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground">
            Create a goal first to configure attribution settings.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attribution Settings</CardTitle>
        <CardDescription>
          Configure how leads are attributed to goal periods. Settings are stored per goal.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Goal selector */}
        {goals.length > 1 && (
          <div className="space-y-2">
            <Label>Apply to Goal</Label>
            <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
              <SelectTrigger className="w-[280px]">
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
          </div>
        )}

        {/* Attribution Basis */}
        <div className="space-y-3">
          <Label>Attribution Basis</Label>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="attribution_basis"
                value="event_date"
                checked={attributionBasis === "event_date"}
                onChange={() => setAttributionBasis("event_date")}
                className="accent-primary"
              />
              <div>
                <span className="text-sm font-medium">Event Date</span>
                <p className="text-xs text-muted-foreground">
                  Attribute leads based on event_date_end (fallback to event_date_start)
                </p>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="attribution_basis"
                value="closed_won_date"
                checked={attributionBasis === "closed_won_date"}
                onChange={() => setAttributionBasis("closed_won_date")}
                className="accent-primary"
              />
              <div>
                <span className="text-sm font-medium">Closed Won Date</span>
                <p className="text-xs text-muted-foreground">
                  Attribute leads based on the date they were marked as Closed Won
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Global Cutoff Day */}
        <div className="space-y-2">
          <Label>Global Cutoff Day (1–28)</Label>
          <Input
            type="number"
            min={1}
            max={28}
            value={cutoffDay}
            onChange={(e) =>
              setCutoffDay(Math.min(28, Math.max(1, Number(e.target.value))))
            }
            className="w-24"
          />
          <p className="text-xs text-muted-foreground">
            Leads with day &gt; cutoff are attributed to the next month&apos;s period
          </p>
        </div>

        {/* Per-Month Override */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={perMonthEnabled} onCheckedChange={setPerMonthEnabled} />
            <Label>Enable per-month cutoff overrides</Label>
          </div>

          {perMonthEnabled && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2">
              {MONTHS.map((name, idx) => {
                const monthKey = String(idx + 1)
                return (
                  <div key={monthKey} className="flex items-center gap-2">
                    <Label className="w-16 text-xs shrink-0">{name.slice(0, 3)}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={perMonthCutoffs[monthKey] ?? cutoffDay}
                      onChange={(e) => updateMonthCutoff(idx + 1, Number(e.target.value))}
                      className="w-20 h-8 text-sm"
                    />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={saving || !selectedGoalId}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Attribution Settings
        </Button>
      </CardContent>
    </Card>
  )
}
