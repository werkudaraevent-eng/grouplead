"use client"

import { useState, useCallback } from "react"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { updateGoalV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { GoalConfigOverview } from "./goal-config-overview"
import { GoalConfigHierarchy } from "./goal-config-hierarchy"
import { MonthlyWeightsEditor } from "@/features/goals/components/settings/monthly-weights-editor"
import type { GoalV2 } from "@/types/goals"

interface GoalConfigPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  goal: GoalV2
  onSave?: () => void
}

export function GoalConfigPanel({ open, onOpenChange, goal, onSave }: GoalConfigPanelProps) {
  const [editData, setEditData] = useState<{ name: string; period_type: string; year: number; target_amount: number }>({
    name: goal.name,
    period_type: goal.period_type,
    year: new Date().getFullYear(),
    target_amount: goal.target_amount,
  })
  const [saving, setSaving] = useState(false)

  // Reset edit data when goal changes
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setEditData({
        name: goal.name,
        period_type: goal.period_type,
        year: new Date().getFullYear(),
        target_amount: goal.target_amount,
      })
    }
    onOpenChange(isOpen)
  }

  const handleChange = useCallback(
    (data: Partial<{ name: string; period_type: string; year: number; target_amount: number }>) => {
      setEditData((prev) => ({ ...prev, ...data }))
    },
    []
  )

  const handleSave = async () => {
    setSaving(true)
    const result = await updateGoalV2Action(goal.id, {
      name: editData.name.trim(),
      period_type: editData.period_type as GoalV2["period_type"],
      target_amount: editData.target_amount,
    })
    setSaving(false)

    if (result.success) {
      toast.success("Goal configuration saved")
      onSave?.()
      onOpenChange(false)
    } else {
      toast.error(result.error ?? "Failed to save configuration")
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="w-[540px] sm:max-w-[540px] overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle>Goal Configuration</SheetTitle>
          <SheetDescription>
            Configure goal overview, monthly weights, and hierarchy levels.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-4 px-1">
          {/* Overview section */}
          <GoalConfigOverview
            goal={goal}
            editData={editData}
            onChange={handleChange}
          />

          <div className="border-t" />

          {/* Monthly Weights section */}
          <MonthlyWeightsEditor goal={goal} onSave={onSave} />

          <div className="border-t" />

          {/* Hierarchy section */}
          <GoalConfigHierarchy
            goalId={goal.id}
            companyId={goal.company_id}
          />
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !editData.name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
