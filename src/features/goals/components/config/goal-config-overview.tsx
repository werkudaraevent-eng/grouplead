"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { CurrencyInput } from "@/components/shared/currency-input"
import type { GoalV2 } from "@/types/goals"

interface GoalConfigOverviewProps {
  goal: GoalV2
  editData: {
    name: string
    period_type: string
    year: number
    target_amount: number
  }
  onChange: (data: Partial<GoalConfigOverviewProps["editData"]>) => void
}

export function GoalConfigOverview({ goal, editData, onChange }: GoalConfigOverviewProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Overview</h3>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            goal.is_active
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {goal.is_active ? "Active" : "Inactive"}
        </span>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs">Goal Name</Label>
          <Input
            value={editData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Period Type</Label>
            <Select
              value={editData.period_type}
              onValueChange={(v) => onChange({ period_type: v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label className="text-xs">Year</Label>
            <Select
              value={String(editData.year)}
              onValueChange={(v) => onChange({ year: Number(v) })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs">Total Target (Rp)</Label>
          <CurrencyInput
            prefix="Rp"
            value={editData.target_amount}
            onChange={(v) => onChange({ target_amount: v ?? 0 })}
          />
        </div>
      </div>
    </div>
  )
}
