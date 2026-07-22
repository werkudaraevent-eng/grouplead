"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { computeMonthlyTarget } from "@/features/goals/lib/target-calculator"
import type { GoalNodeTree, MonthlyWeights } from "@/types/goals"

interface GoalMatrixCellEditorProps {
  node: GoalNodeTree
  month: number
  monthlyWeights: MonthlyWeights | null
  parentTarget: number
  displayMetric: "nominal" | "percent" | "both"
  onSave: (nodeId: string, month: number, amount: number) => Promise<void>
  onCancel: () => void
  onTabNext: () => void
  onTabPrev: () => void
}

/**
 * Inline cell editor for the goal matrix grid.
 * - Auto-focus, select all text on mount
 * - Percentage mode: input with % suffix, auto-compute amount
 * - Absolute mode: input with Rp prefix, auto-compute percentage
 * - Enter = save + cascade, Escape = cancel, Tab = save + next cell
 * - Flash green highlight animation on save
 */
export function GoalMatrixCellEditor({
  node, month, monthlyWeights, parentTarget,
  displayMetric, onSave, onCancel, onTabNext, onTabPrev,
}: GoalMatrixCellEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const currentAmount = computeMonthlyTarget(
    node.target_amount, monthlyWeights, month, node.monthly_targets
  )

  useEffect(() => {
    setValue(String(Math.round(currentAmount)))
    // Auto-focus and select all
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }, [currentAmount])

  const handleSave = useCallback(async () => {
    const val = parseFloat(value)
    if (isNaN(val) || val < 0) { onCancel(); return }
    setSaving(true)
    await onSave(node.id, month, val)
    setSaving(false)
    setSaved(true)
    // Flash green then close
    setTimeout(() => setSaved(false), 600)
  }, [value, node.id, month, onSave, onCancel])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSave()
    } else if (e.key === "Escape") {
      e.preventDefault()
      onCancel()
    } else if (e.key === "Tab") {
      e.preventDefault()
      handleSave().then(() => {
        if (e.shiftKey) onTabPrev()
        else onTabNext()
      })
    }
  }

  return (
    <div className={`relative ${saved ? "animate-pulse bg-green-50" : ""}`}>
      <Input
        ref={inputRef}
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="h-7 text-xs tabular-nums w-full"
      />
    </div>
  )
}
