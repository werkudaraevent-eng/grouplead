"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { updateGoalV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { Loader2, Scale, RotateCcw } from "lucide-react"
import type { GoalV2, MonthlyWeights } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

interface MonthlyWeightsEditorProps {
  goal: GoalV2
  onSave?: () => void
}

export function MonthlyWeightsEditor({ goal, onSave }: MonthlyWeightsEditorProps) {
  const { fmt } = useCurrency()
  const existing = goal.monthly_weights ?? {}
  const initial: Record<string, number> = {}
  for (let m = 1; m <= 12; m++) {
    initial[String(m)] = existing[String(m)] ?? 1 / 12
  }

  const [weights, setWeights] = useState<Record<string, number>>(initial)
  const [saving, setSaving] = useState(false)

  const total = useMemo(
    () => Object.values(weights).reduce((a, b) => a + b, 0),
    [weights]
  )

  const totalPct = useMemo(() => (total * 100).toFixed(1), [total])
  const isValid = Math.abs(total - 1.0) <= 0.001
  const allNonNeg = Object.values(weights).every((w) => w >= 0)

  const handleWeightChange = useCallback((month: number, pctStr: string) => {
    const pct = parseFloat(pctStr)
    if (isNaN(pct)) return
    setWeights((prev) => ({ ...prev, [String(month)]: pct / 100 }))
  }, [])

  const handleEqualDistribution = useCallback(() => {
    const eq: Record<string, number> = {}
    for (let m = 1; m <= 12; m++) eq[String(m)] = 1 / 12
    setWeights(eq)
  }, [])

  const handleSave = useCallback(async () => {
    if (!isValid || !allNonNeg) {
      toast.error("Weights must sum to 100% and be non-negative")
      return
    }
    setSaving(true)
    const result = await updateGoalV2Action(goal.id, {
      monthly_weights: weights as MonthlyWeights,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Monthly weights saved")
      onSave?.()
    } else {
      toast.error(result.error ?? "Failed to save weights")
    }
  }, [goal.id, weights, isValid, allNonNeg, onSave])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-4 w-4" />
              Monthly Weights
            </CardTitle>
            <CardDescription>
              Distribute the annual target ({fmt(goal.target_amount)}) across months.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleEqualDistribution}
          >
            <RotateCcw className="h-3 w-3" /> Equal Distribution
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-6 gap-3">
          {MONTHS.map((label, i) => {
            const month = i + 1
            const w = weights[String(month)] ?? 0
            const pct = (w * 100).toFixed(2)
            const amount = goal.target_amount * w
            return (
              <div key={month} className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">{label}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={pct}
                    onChange={(e) => handleWeightChange(month, e.target.value)}
                    className="h-8 text-xs pr-6 tabular-nums"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  {fmt(amount)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Total:</span>
            <span className={`font-semibold ${isValid ? "text-emerald-600" : "text-amber-600"}`}>
              {totalPct}%
            </span>
            {!isValid && (
              <span className="text-amber-600 text-[11px]">
                ⚠ Must equal 100%
              </span>
            )}
            {!allNonNeg && (
              <span className="text-red-600 text-[11px]">
                ⚠ Negative weights not allowed
              </span>
            )}
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !isValid || !allNonNeg}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Save Weights
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
