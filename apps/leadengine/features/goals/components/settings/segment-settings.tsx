"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import {
  upsertGoalSegmentAction,
  updateGoalSegmentAction,
  deleteGoalSegmentAction,
} from "@/app/actions/goal-actions"
import { LEAD_FIELD_REGISTRY } from "@/config/lead-field-registry"
import { detectSegmentOverlapsV2 } from "@/features/goals/lib/classification-engine"
import { FieldValueSelector } from "@/components/shared/field-value-selector"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Loader2, Plus, Pencil, Trash2, Tags, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import type { GoalSegment, SegmentMappingEntry } from "@/types/goals"

// Only fields that support segmentation
const SEGMENTABLE_FIELDS = LEAD_FIELD_REGISTRY.filter((f) => f.supportsSegmentation)

export function SegmentSettings() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [segments, setSegments] = useState<GoalSegment[]>([])
  const [loading, setLoading] = useState(true)

  // Create/Edit segment dialog
  const [showDialog, setShowDialog] = useState(false)
  const [editingSegment, setEditingSegment] = useState<GoalSegment | null>(null)
  const [segName, setSegName] = useState("")
  const [segSourceField, setSegSourceField] = useState("")
  const [segFallback, setSegFallback] = useState("Other")
  const [segMappings, setSegMappings] = useState<SegmentMappingEntry[]>([])
  const [dialogSaving, setDialogSaving] = useState(false)

  // Inline mapping editor state
  const [newMappingName, setNewMappingName] = useState("")
  const [newMappingValues, setNewMappingValues] = useState<string[]>([])

  // Edit existing mapping state (-1 = not editing)
  const [editingMappingIndex, setEditingMappingIndex] = useState(-1)
  const [editMappingName, setEditMappingName] = useState("")
  const [editMappingValues, setEditMappingValues] = useState<string[]>([])
  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<GoalSegment | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from("goal_segments")
      .select("*")
      .eq("company_id", activeCompany.id)
      .order("name")
    setSegments((data as GoalSegment[]) ?? [])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openCreate = () => {
    setEditingSegment(null)
    setSegName("")
    setSegSourceField(SEGMENTABLE_FIELDS[0]?.key ?? "")
    setSegFallback("Other")
    setSegMappings([])
    setNewMappingName("")
    setNewMappingValues([])
    setEditingMappingIndex(-1)
    setShowDialog(true)
  }

  const openEdit = (seg: GoalSegment) => {
    setEditingSegment(seg)
    setSegName(seg.name)
    setSegSourceField(seg.source_field)
    setSegFallback(seg.fallback_name)
    setSegMappings([...seg.mappings])
    setNewMappingName("")
    setNewMappingValues([])
    setEditingMappingIndex(-1)
    setShowDialog(true)
  }

  const addMapping = () => {
    if (!newMappingName.trim() || newMappingValues.length === 0) return
    setSegMappings((prev) => [
      ...prev,
      { segment_name: newMappingName.trim(), match_values: newMappingValues },
    ])
    setNewMappingName("")
    setNewMappingValues([])
  }

  const removeMapping = (index: number) => {
    setSegMappings((prev) => prev.filter((_, i) => i !== index))
    if (editingMappingIndex === index) setEditingMappingIndex(-1)
    else if (editingMappingIndex > index) setEditingMappingIndex((prev) => prev - 1)
  }

  const startEditMapping = (index: number) => {
    const m = segMappings[index]
    setEditingMappingIndex(index)
    setEditMappingName(m.segment_name)
    setEditMappingValues([...m.match_values])
  }

  const cancelEditMapping = () => {
    setEditingMappingIndex(-1)
    setEditMappingName("")
    setEditMappingValues([])
  }

  const saveEditMapping = () => {
    if (editingMappingIndex < 0 || !editMappingName.trim() || editMappingValues.length === 0) return
    setSegMappings((prev) =>
      prev.map((m, i) =>
        i === editingMappingIndex
          ? { segment_name: editMappingName.trim(), match_values: editMappingValues }
          : m
      )
    )
    setEditingMappingIndex(-1)
    setEditMappingName("")
    setEditMappingValues([])
  }

  const handleSave = async () => {
    if (!segName.trim() || !segSourceField || !activeCompany?.id) return
    setDialogSaving(true)

    if (editingSegment) {
      const result = await updateGoalSegmentAction(editingSegment.id, {
        name: segName.trim(),
        source_field: segSourceField,
        fallback_name: segFallback.trim() || "Other",
        mappings: segMappings,
      })
      setDialogSaving(false)
      if (result.success) {
        toast.success("Segment updated")
        setShowDialog(false)
        loadData()
      } else {
        toast.error(result.error ?? "Failed to update segment")
      }
    } else {
      const result = await upsertGoalSegmentAction({
        company_id: activeCompany.id,
        name: segName.trim(),
        source_field: segSourceField,
        fallback_name: segFallback.trim() || "Other",
        mappings: segMappings,
      })
      setDialogSaving(false)
      if (result.success) {
        toast.success("Segment created")
        setShowDialog(false)
        loadData()
      } else {
        toast.error(result.error ?? "Failed to create segment")
      }
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteGoalSegmentAction(deleteTarget.id)
    setDeleting(false)
    if (result.success) {
      toast.success("Segment deleted")
      setDeleteTarget(null)
      loadData()
    } else {
      toast.error(result.error ?? "Failed to delete segment")
    }
  }

  // Compute values already used in other mappings (for "used" indicator)
  const usedValuesInOtherMappings = useMemo(() => {
    const used = new Set<string>()
    for (let i = 0; i < segMappings.length; i++) {
      if (i === editingMappingIndex) continue // exclude the one being edited
      for (const v of segMappings[i].match_values) {
        used.add(v)
      }
    }
    return used
  }, [segMappings, editingMappingIndex])

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Define custom segments by grouping lead field values together. For example, group
        &quot;Banking&quot;, &quot;Finance&quot;, &quot;Insurance&quot; into a segment called &quot;BFSI&quot;.
      </p>

      {segments.length === 0 ? (
        <div className="text-center py-6 border border-dashed rounded-lg">
          <Tags className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-3">No segments defined yet.</p>
          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Segment
          </Button>
        </div>
      ) : (
        <>
          {segments.map((seg) => {
            const overlaps = detectSegmentOverlapsV2(seg.mappings)
            const fieldLabel =
              SEGMENTABLE_FIELDS.find((f) => f.key === seg.source_field)?.label ?? seg.source_field

            return (
              <div key={seg.id} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{seg.name}</h3>
                    <span className="text-xs text-muted-foreground">
                      Source: {fieldLabel}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Fallback: <em>{seg.fallback_name}</em>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(seg)}
                      title="Edit segment"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(seg)}
                      title="Delete segment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {overlaps.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">Overlap warning: </span>
                      {overlaps.map((w) => (
                        <span key={w.value}>
                          &quot;{w.value}&quot; appears in {w.segments.join(", ")};{" "}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {seg.mappings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No mappings defined.</p>
                ) : (
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium text-xs">Segment Name</th>
                          <th className="text-left px-3 py-2 font-medium text-xs">Values</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seg.mappings.map((m, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-3 py-2.5 font-medium">{m.segment_name}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {m.match_values.map((v) => (
                                  <span
                                    key={v}
                                    className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                                  >
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          <Button size="sm" variant="outline" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Segment
          </Button>
        </>
      )}

      {/* Create/Edit Segment Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSegment ? "Edit Segment" : "New Segment"}</DialogTitle>
            <DialogDescription>
              {editingSegment
                ? "Update the segment definition and its mappings."
                : "Create a new segment by defining its source field and value mappings."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-2">
              <Label>Segment Name</Label>
              <Input
                placeholder="e.g. Industry Segment"
                value={segName}
                onChange={(e) => setSegName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Source Field</Label>
              <Select value={segSourceField} onValueChange={setSegSourceField}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select a field" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTABLE_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Fallback Name</Label>
              <Input
                placeholder="Other"
                value={segFallback}
                onChange={(e) => setSegFallback(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Leads that don&apos;t match any mapping will be grouped under this name.
              </p>
            </div>

            {/* Existing mappings */}
            {segMappings.length > 0 && (
              <div className="space-y-2">
                <Label>Mappings</Label>
                {segMappings.map((m, i) => {
                  const overlapCheck = detectSegmentOverlapsV2(segMappings)
                  const hasOverlap = overlapCheck.some((w) => w.segments.includes(m.segment_name))
                  const isEditing = editingMappingIndex === i

                  if (isEditing) {
                    return (
                      <div key={i} className="rounded-md border border-blue-300 bg-blue-50/50 p-3 space-y-2">
                        <Input
                          value={editMappingName}
                          onChange={(e) => setEditMappingName(e.target.value)}
                          className="h-8 text-xs"
                          placeholder="Segment name"
                        />
                        {segSourceField && activeCompany?.id && (
                          <FieldValueSelector
                            fieldKey={segSourceField}
                            companyId={activeCompany.id}
                            selectedValues={editMappingValues}
                            onChange={setEditMappingValues}
                            placeholder="Select matching values"
                            allowCustom
                            usedValues={usedValuesInOtherMappings}
                          />
                        )}
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={saveEditMapping}
                            disabled={!editMappingName.trim() || editMappingValues.length === 0}
                            className="h-7 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelEditMapping}
                            className="h-7 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-md border p-2 ${hasOverlap ? "border-amber-300 bg-amber-50" : ""}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{m.segment_name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.match_values.map((v) => (
                            <span
                              key={v}
                              className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600"
                            >
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => startEditMapping(i)}
                        title="Edit mapping"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => removeMapping(i)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add new mapping */}
            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
              <Label className="text-xs font-medium">Add New Mapping</Label>
              <div className="grid gap-2">
                <Input
                  placeholder="Segment name (e.g. BFSI)"
                  value={newMappingName}
                  onChange={(e) => setNewMappingName(e.target.value)}
                  className="h-8 text-xs"
                />
                {segSourceField && activeCompany?.id ? (
                  <FieldValueSelector
                    fieldKey={segSourceField}
                    companyId={activeCompany.id}
                    selectedValues={newMappingValues}
                    onChange={setNewMappingValues}
                    placeholder="Select matching values"
                    allowCustom
                    usedValues={usedValuesInOtherMappings}
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">Select a source field first.</p>
                )}
                {newMappingName.trim() && newMappingValues.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={addMapping}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add to List
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      Then click Save below to persist changes
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={dialogSaving || !segName.trim() || !segSourceField}
            >
              {dialogSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editingSegment ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete segment &quot;{deleteTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this segment definition. Goals using this segment in their
              breakdown config will need to be updated.
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
    </div>
  )
}
