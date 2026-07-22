"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { GripVertical, Plus, Trash2, Loader2 } from "lucide-react"
import { getDimensionRegistry, type DimensionOption } from "@/config/dimension-registry"
import type { GoalNode } from "@/types/goals"

interface GoalConfigHierarchyProps {
  goalId: string
  companyId: string
}

interface DimensionLevel {
  id: string
  dimension_type: string
  reference_field: string
  count: number
}



export function GoalConfigHierarchy({ goalId, companyId }: GoalConfigHierarchyProps) {
  const supabase = createClient()
  const [levels, setLevels] = useState<DimensionLevel[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteLevel, setDeleteLevel] = useState<DimensionLevel | null>(null)
  const [dimensionOptions, setDimensionOptions] = useState<DimensionOption[]>([])

  const loadDimensions = useCallback(async () => {
    const dims = await getDimensionRegistry(supabase, companyId)
    setDimensionOptions(dims)
  }, [supabase, companyId])

  useEffect(() => { loadDimensions() }, [loadDimensions])

  const loadLevels = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("goal_nodes")
      .select("id, dimension_type, reference_field, parent_node_id")
      .eq("goal_id", goalId)

    const nodes = (data as GoalNode[]) ?? []

    // Group by dimension_type to get unique levels
    const levelMap = new Map<string, DimensionLevel>()
    for (const node of nodes) {
      if (!node.parent_node_id) {
        // Root-level nodes define L1
        const key = node.dimension_type
        const existing = levelMap.get(key)
        if (existing) {
          existing.count++
        } else {
          levelMap.set(key, {
            id: node.id,
            dimension_type: node.dimension_type,
            reference_field: node.reference_field,
            count: 1,
          })
        }
      }
    }

    setLevels(Array.from(levelMap.values()))
    setLoading(false)
  }, [goalId, supabase])

  useEffect(() => {
    loadLevels()
  }, [loadLevels])

  const handleAddLevel = () => {
    const usedFields = new Set(levels.map((l) => l.reference_field))
    const available = dimensionOptions.find((o) => !usedFields.has(o.field))
    if (!available) return

    setLevels((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        dimension_type: available.value,
        reference_field: available.field,
        count: 0,
      },
    ])
  }

  const handleChangeDimension = (index: number, value: string) => {
    const opt = dimensionOptions.find((o) => o.value === value)
    if (!opt) return
    setLevels((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], dimension_type: value, reference_field: opt.field }
      return next
    })
  }

  const handleRemoveLevel = (level: DimensionLevel) => {
    if (level.count > 0) {
      setDeleteLevel(level)
    } else {
      setLevels((prev) => prev.filter((l) => l.id !== level.id))
    }
  }

  const confirmDelete = () => {
    if (deleteLevel) {
      setLevels((prev) => prev.filter((l) => l.id !== deleteLevel.id))
      setDeleteLevel(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Hierarchy Levels</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleAddLevel}
        >
          <Plus className="h-3 w-3" /> Add Level
        </Button>
      </div>

      {levels.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No hierarchy levels configured. Add levels to define the breakdown structure.
        </p>
      ) : (
        <div className="space-y-1.5">
          {levels.map((level, i) => (
            <div
              key={level.id}
              className="flex items-center gap-2 rounded-lg border bg-white px-2 py-1.5"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
              <span className="text-xs font-semibold text-muted-foreground w-6 shrink-0">
                L{i + 1}
              </span>
              <Select
                value={level.dimension_type}
                onValueChange={(v) => handleChangeDimension(i, v)}
              >
                <SelectTrigger className="h-7 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dimensionOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {level.count > 0 && (
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {level.count} nodes
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleRemoveLevel(level)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteLevel} onOpenChange={(open) => { if (!open) setDeleteLevel(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove level?</AlertDialogTitle>
            <AlertDialogDescription>
              This level has {deleteLevel?.count ?? 0} existing nodes. Removing it will require
              deleting those nodes separately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
