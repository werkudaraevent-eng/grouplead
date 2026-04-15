"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createGoalV2Action, updateGoalV2Action, deleteGoalV2Action } from "@/app/actions/goal-actions"
import { LEAD_FIELD_REGISTRY } from "@/config/lead-field-registry"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Trash2, Target, ArrowRight, X } from "lucide-react"
import type { GoalV2, BreakdownLevelConfig } from "@/types/goals"

const MAX_BREAKDOWN_LEVELS = 10

function formatIDR(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(0)}M`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface GoalSegmentOption {
  id: string
  name: string
}

interface BreakdownSelectorProps {
  levels: BreakdownLevelConfig[]
  onChange: (levels: BreakdownLevelConfig[]) => void
  segments: GoalSegmentOption[]
}

function BreakdownSelector({ levels, onChange, segments }: BreakdownSelectorProps) {
  const fieldOptions = LEAD_FIELD_REGISTRY.map((f) => ({ value: f.key, label: f.label }))
  const segmentOptions = segments.map((s) => ({ value: `segment:${s.id}`, label: `Segment: ${s.name}` }))
  const allOptions = [...fieldOptions, ...segmentOptions]

  const usedFields = new Set(levels.map((l) => l.field))

  const getAvailable = (currentField: string) =>
    allOptions.filter((o) => o.value === currentField || !usedFields.has(o.value))

  const handleChange = (index: number, fieldValue: string) => {
    const opt = allOptions.find((o) => o.value === fieldValue)
    if (!opt) return
    const next = [...levels]
    next[index] = { field: fieldValue, label: opt.label }
    onChange(next)
  }

  const handleAdd = () => {
    if (levels.length >= MAX_BREAKDOWN_LEVELS) return
    const available = allOptions.find((o) => !usedFields.has(o.value))
    if (!available) return
    onChange([...levels, { field: available.value, label: available.label }])
  }

  const handleRemove = (index: number) => {
    onChange(levels.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center flex-wrap gap-1.5">
        {levels.map((level, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            <div className="relative group">
              <Select value={level.field} onValueChange={(v) => handleChange(i, v)}>
                <SelectTrigger className="w-[160px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getAvailable(level.field).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          </div>
        ))}
        {levels.length < MAX_BREAKDOWN_LEVELS && (
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleAdd}>
            <Plus className="h-3 w-3" /> Add Level
          </Button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Up to {MAX_BREAKDOWN_LEVELS} levels. Defines how goal attainment is broken down.
      </p>
    </div>
  )
}

export function GoalManager({ onDataChange }: { onDataChange?: () => void } = {}) {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [goals, setGoals] = useState<GoalV2[]>([])
  const [segments, setSegments] = useState<GoalSegmentOption[]>([])
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createPeriodType, setCreatePeriodType] = useState<"monthly" | "quarterly" | "yearly">("yearly")
  const [createTarget, setCreateTarget] = useState("")
  const [createBreakdown, setCreateBreakdown] = useState<BreakdownLevelConfig[]>([])
  const [createWeightedForecast, setCreateWeightedForecast] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editGoal, setEditGoal] = useState<GoalV2 | null>(null)
  const [editName, setEditName] = useState("")
  const [editTarget, setEditTarget] = useState("")
  const [editBreakdown, setEditBreakdown] = useState<BreakdownLevelConfig[]>([])
  const [editWeightedForecast, setEditWeightedForecast] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<GoalV2 | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const [goalsRes, segmentsRes] = await Promise.all([
      supabase
        .from("goals_v2")
        .select("*")
        .eq("company_id", activeCompany.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_segments")
        .select("id, name")
        .eq("company_id", activeCompany.id)
        .order("name"),
    ])
    setGoals((goalsRes.data as GoalV2[]) ?? [])
    setSegments((segmentsRes.data as GoalSegmentOption[]) ?? [])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCreate = async () => {
    if (!activeCompany?.id || !createName.trim()) return
    setCreating(true)
    const result = await createGoalV2Action({
      company_id: activeCompany.id,
      name: createName.trim(),
      period_type: createPeriodType,
      target_amount: parseFloat(createTarget) || 0,
      is_active: true,
      attribution_basis: "event_date",
      monthly_cutoff_day: 25,
      per_month_cutoffs: null,
      weighted_forecast_enabled: createWeightedForecast,
      breakdown_config: createBreakdown,
      breakdown_targets: {},
      created_by: null,
    })
    setCreating(false)
    if (result.success) {
      toast.success("Goal created")
      setShowCreate(false)
      setCreateName("")
      setCreateTarget("")
      setCreateBreakdown([])
      setCreateWeightedForecast(false)
      loadData()
      onDataChange?.()
    } else {
      toast.error(result.error ?? "Failed to create goal")
    }
  }

  const openEdit = (goal: GoalV2) => {
    setEditGoal(goal)
    setEditName(goal.name)
    setEditTarget(String(goal.target_amount))
    setEditBreakdown(goal.breakdown_config ?? [])
    setEditWeightedForecast(goal.weighted_forecast_enabled)
  }

  const handleEdit = async () => {
    if (!editGoal) return
    setSaving(true)
    const result = await updateGoalV2Action(editGoal.id, {
      name: editName.trim(),
      target_amount: parseFloat(editTarget) || 0,
      breakdown_config: editBreakdown,
      weighted_forecast_enabled: editWeightedForecast,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Goal updated")
      setEditGoal(null)
      loadData()
      onDataChange?.()
    } else {
      toast.error(result.error ?? "Failed to update goal")
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteGoalV2Action(deleteTarget.id)
    setDeleting(false)
    if (result.success) {
      toast.success("Goal deleted")
      setDeleteTarget(null)
      loadData()
      onDataChange?.()
    } else {
      toast.error(result.error ?? "Failed to delete goal")
    }
  }

  const periodTypeLabel = (t: string) => {
    const labels: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" }
    return labels[t] ?? t
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Revenue Goals</CardTitle>
            <CardDescription>
              Define revenue targets with optional breakdown levels for attainment tracking.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Create Goal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-8">
            <Target className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No goals yet. Create your first revenue goal to get started.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Period Type</TableHead>
                <TableHead>Target Amount</TableHead>
                <TableHead>Breakdown Levels</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((goal) => (
                <TableRow key={goal.id}>
                  <TableCell className="font-medium">{goal.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700">
                      {periodTypeLabel(goal.period_type)}
                    </span>
                  </TableCell>
                  <TableCell>{formatIDR(goal.target_amount)}</TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {goal.breakdown_config?.length
                        ? goal.breakdown_config.map((l) => l.label).join(" → ")
                        : "None"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(goal)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(goal)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Goal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Revenue Goal</DialogTitle>
            <DialogDescription>Define a new revenue target for your company.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Goal Name</Label>
              <Input
                placeholder="e.g. 2026 Annual Revenue Target"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Period Type</Label>
              <Select
                value={createPeriodType}
                onValueChange={(v) => setCreatePeriodType(v as "monthly" | "quarterly" | "yearly")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Target Amount (IDR)</Label>
              <Input
                type="number"
                placeholder="e.g. 120000000000"
                value={createTarget}
                onChange={(e) => setCreateTarget(e.target.value)}
              />
              {createTarget && (
                <p className="text-xs text-muted-foreground">
                  {formatIDR(parseFloat(createTarget) || 0)}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Breakdown Levels</Label>
              <BreakdownSelector
                levels={createBreakdown}
                onChange={setCreateBreakdown}
                segments={segments}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createWeightedForecast}
                onCheckedChange={setCreateWeightedForecast}
              />
              <Label>Enable weighted forecast</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={!!editGoal} onOpenChange={(open) => { if (!open) setEditGoal(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>Update the goal name, target, and breakdown configuration.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Goal Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Target Amount (IDR)</Label>
              <Input
                type="number"
                value={editTarget}
                onChange={(e) => setEditTarget(e.target.value)}
              />
              {editTarget && (
                <p className="text-xs text-muted-foreground">
                  {formatIDR(parseFloat(editTarget) || 0)}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Breakdown Levels</Label>
              <BreakdownSelector
                levels={editBreakdown}
                onChange={setEditBreakdown}
                segments={segments}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editWeightedForecast}
                onCheckedChange={setEditWeightedForecast}
              />
              <Label>Enable weighted forecast</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGoal(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete goal &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this goal and all its breakdown targets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
