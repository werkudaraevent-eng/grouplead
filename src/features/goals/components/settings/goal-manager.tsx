"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
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
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Trash2, Target } from "lucide-react"
import type { GoalV2 } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

export function GoalManager({ onDataChange }: { onDataChange?: () => void } = {}) {
  const supabase = createClient()
  const router = useRouter()
  const { activeCompany } = useCompany()
  const { fmt } = useCurrency()

  const [goals, setGoals] = useState<GoalV2[]>([])
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createPeriodType, setCreatePeriodType] = useState<"monthly" | "quarterly" | "yearly">("yearly")
  const [createTarget, setCreateTarget] = useState("")
  const [createWeightedForecast, setCreateWeightedForecast] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editGoal, setEditGoal] = useState<GoalV2 | null>(null)
  const [editName, setEditName] = useState("")
  const [editTarget, setEditTarget] = useState("")
  const [editWeightedForecast, setEditWeightedForecast] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<GoalV2 | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const goalsRes = await supabase
      .from("goals_v2")
      .select("*")
      .eq("company_id", activeCompany.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
    setGoals((goalsRes.data as GoalV2[]) ?? [])
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
      breakdown_config: [],
      breakdown_targets: {},
      monthly_weights: {},
      created_by: null,
      period_start: null,
      period_end: null,
    })
    setCreating(false)
    if (result.success) {
      toast.success("Goal created")
      setShowCreate(false)
      setCreateName("")
      setCreateTarget("")
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
    setEditWeightedForecast(goal.weighted_forecast_enabled)
  }

  const handleEdit = async () => {
    if (!editGoal) return
    setSaving(true)
    const result = await updateGoalV2Action(editGoal.id, {
      name: editName.trim(),
      target_amount: parseFloat(editTarget) || 0,
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
                  <TableCell>{fmt(goal.target_amount)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => router.push(`/settings/goals/${goal.slug}`)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Configure
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
                  {fmt(parseFloat(createTarget) || 0)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createWeightedForecast}
                onCheckedChange={setCreateWeightedForecast}
              />
              <Label>Enable weighted forecast</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configure hierarchy levels and monthly weights in the Goal Matrix after creation.
            </p>
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
                  {fmt(parseFloat(editTarget) || 0)}
                </p>
              )}
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
