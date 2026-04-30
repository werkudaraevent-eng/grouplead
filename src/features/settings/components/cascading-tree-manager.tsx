"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    ChevronRight, ChevronDown, Plus, Pencil, Trash2, Loader2,
    GitBranch, Circle, AlertTriangle, Check, Search,
} from "lucide-react"
import { toast } from "sonner"
import type { MasterOption } from "@/types"
import { cn } from "@/lib/utils"

interface CascadeLevel { optionType: string; label: string; parentType: string | null }
interface TreeNode { option: MasterOption; children: TreeNode[]; level: number; levelConfig: CascadeLevel }
interface CascadingTreeManagerProps {
    options: MasterOption[]; companyId: string | null; onRefresh: () => void
    cascadeRelations: Record<string, string>
}

function formatLabel(key: string): string {
    return key.replace(/^custom_[a-z]+__/, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

function deriveLevels(relations: Record<string, string>): CascadeLevel[] {
    const children = new Set(Object.keys(relations))
    const parents = new Set(Object.values(relations))
    const roots = [...parents].filter(p => !children.has(p))
    const levels: CascadeLevel[] = []
    const visited = new Set<string>()
    const queue = roots.map(r => ({ type: r, parentType: null as string | null }))
    while (queue.length > 0) {
        const { type, parentType } = queue.shift()!
        if (visited.has(type)) continue
        visited.add(type)
        levels.push({ optionType: type, label: formatLabel(type), parentType })
        for (const [child, parent] of Object.entries(relations)) {
            if (parent === type && !visited.has(child)) queue.push({ type: child, parentType: type })
        }
    }
    return levels
}

function buildTree(options: MasterOption[], levels: CascadeLevel[]): TreeNode[] {
    if (levels.length === 0) return []
    const byType = (type: string) => options.filter(o => o.option_type === type && o.is_active)
    function buildLevel(levelIdx: number, parentValue?: string): TreeNode[] {
        if (levelIdx >= levels.length) return []
        const level = levels[levelIdx]
        const items = byType(level.optionType)
        const filtered = level.parentType ? items.filter(o => o.parent_value === parentValue) : items
        const childLevelIdx = levels.findIndex((l, i) => i > levelIdx && l.parentType === level.optionType)
        return filtered.map(opt => ({
            option: opt, level: levelIdx, levelConfig: level,
            children: childLevelIdx >= 0 ? buildLevel(childLevelIdx, opt.value) : [],
        }))
    }
    return buildLevel(0)
}

function findOrphans(options: MasterOption[], levels: CascadeLevel[]): MasterOption[] {
    const active = options.filter(o => o.is_active)
    const orphans: MasterOption[] = []
    for (const level of levels) {
        if (!level.parentType) continue
        const parentValues = new Set(active.filter(o => o.option_type === level.parentType).map(o => o.value))
        orphans.push(...active.filter(o => o.option_type === level.optionType && (!o.parent_value || !parentValues.has(o.parent_value))))
    }
    return orphans
}

export function CascadingTreeManager({ options, companyId, onRefresh, cascadeRelations }: CascadingTreeManagerProps) {
    const supabase = createClient()
    const levels = useMemo(() => deriveLevels(cascadeRelations), [cascadeRelations])
    const rootLevel = levels[0] ?? null

    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [saving, setSaving] = useState(false)

    // Add new (for root level only)
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [addLevel, setAddLevel] = useState<CascadeLevel | null>(null)
    const [addParentValue, setAddParentValue] = useState("")
    const [addLabel, setAddLabel] = useState("")
    const [addValue, setAddValue] = useState("")

    // Picker (assign existing options to parent)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [pickerLevel, setPickerLevel] = useState<CascadeLevel | null>(null)
    const [pickerParentValue, setPickerParentValue] = useState("")
    const [pickerSelected, setPickerSelected] = useState<Set<number>>(new Set())
    const [pickerSearch, setPickerSearch] = useState("")

    // Edit
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [editOption, setEditOption] = useState<MasterOption | null>(null)
    const [editLabel, setEditLabel] = useState("")
    const [editValue, setEditValue] = useState("")
    const [editParentValue, setEditParentValue] = useState("")

    // Delete & Reassign
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [deleteOption, setDeleteOption] = useState<MasterOption | null>(null)
    const [reassignDialogOpen, setReassignDialogOpen] = useState(false)
    const [reassignOption, setReassignOption] = useState<MasterOption | null>(null)
    const [reassignNewParent, setReassignNewParent] = useState("")

    const tree = useMemo(() => buildTree(options, levels), [options, levels])
    const orphans = useMemo(() => findOrphans(options, levels), [options, levels])
    const chainLabel = levels.map(l => l.label).join(" → ")

    const toggleExpand = (key: string) => {
        setExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
    }
    const expandAll = () => {
        const keys = new Set<string>()
        const walk = (nodes: TreeNode[]) => { for (const n of nodes) { if (n.children.length > 0) { keys.add(`${n.levelConfig.optionType}:${n.option.value}`); walk(n.children) } } }
        walk(tree); setExpanded(keys)
    }
    const collapseAll = () => setExpanded(new Set())

    // ── Add (new option — for root or when no existing options) ──
    const openAdd = (level: CascadeLevel, parentValue?: string) => {
        // If this is a child level and there are existing unassigned options, open picker instead
        if (level.parentType) {
            const existingOpts = options.filter(o => o.option_type === level.optionType && o.is_active)
            if (existingOpts.length > 0) {
                openPicker(level, parentValue ?? "")
                return
            }
        }
        setAddLevel(level); setAddParentValue(parentValue ?? ""); setAddLabel(""); setAddValue("")
        setAddDialogOpen(true)
    }

    const handleAdd = async () => {
        if (!addLevel || !addLabel.trim()) { toast.error("Label is required"); return }
        setSaving(true)
        const val = addValue.trim() || addLabel.trim()
        const payload: Record<string, unknown> = { option_type: addLevel.optionType, label: addLabel.trim(), value: val, is_active: true, company_id: companyId }
        if (addLevel.parentType) payload.parent_value = addParentValue || null
        const { error } = await supabase.from("master_options").insert(payload)
        if (error) toast.error(error.message)
        else { toast.success(`${addLevel.label} "${addLabel.trim()}" added`); if (addLevel.parentType && addParentValue) setExpanded(prev => new Set([...prev, `${addLevel.parentType}:${addParentValue}`])) }
        setSaving(false); setAddDialogOpen(false); onRefresh()
    }

    // ── Picker (assign existing options to a parent) ──
    const openPicker = (level: CascadeLevel, parentValue: string) => {
        setPickerLevel(level); setPickerParentValue(parentValue)
        // Pre-select options already assigned to this parent
        const alreadyAssigned = options.filter(o => o.option_type === level.optionType && o.is_active && o.parent_value === parentValue)
        setPickerSelected(new Set(alreadyAssigned.map(o => o.id)))
        setPickerSearch("")
        setPickerOpen(true)
    }

    const pickerOptions = useMemo(() => {
        if (!pickerLevel) return []
        return options.filter(o => o.option_type === pickerLevel.optionType && o.is_active)
    }, [pickerLevel, options])

    const filteredPickerOptions = useMemo(() => {
        if (!pickerSearch) return pickerOptions
        const q = pickerSearch.toLowerCase()
        return pickerOptions.filter(o => o.label.toLowerCase().includes(q))
    }, [pickerOptions, pickerSearch])

    const handlePickerSave = async () => {
        if (!pickerLevel) return
        setSaving(true)
        const selectedIds = [...pickerSelected]
        const allIds = pickerOptions.map(o => o.id)

        // Options to assign to this parent (newly selected)
        const toAssign = selectedIds.filter(id => {
            const opt = pickerOptions.find(o => o.id === id)
            return opt && opt.parent_value !== pickerParentValue
        })
        // Options to unassign from this parent (were assigned, now unchecked)
        const toUnassign = allIds.filter(id => {
            if (pickerSelected.has(id)) return false
            const opt = pickerOptions.find(o => o.id === id)
            return opt && opt.parent_value === pickerParentValue
        })

        const promises: Promise<unknown>[] = []
        if (toAssign.length > 0) {
            promises.push(supabase.from("master_options").update({ parent_value: pickerParentValue }).in("id", toAssign))
        }
        if (toUnassign.length > 0) {
            promises.push(supabase.from("master_options").update({ parent_value: null }).in("id", toUnassign))
        }

        if (promises.length > 0) {
            await Promise.all(promises)
            const total = toAssign.length + toUnassign.length
            toast.success(`${total} option${total !== 1 ? "s" : ""} updated`)
        }

        // Auto-expand the parent
        if (pickerLevel.parentType) {
            setExpanded(prev => new Set([...prev, `${pickerLevel.parentType}:${pickerParentValue}`]))
        }
        setSaving(false); setPickerOpen(false); onRefresh()
    }

    // ── Edit ──
    const openEdit = (opt: MasterOption) => { setEditOption(opt); setEditLabel(opt.label); setEditValue(opt.value); setEditParentValue(opt.parent_value ?? ""); setEditDialogOpen(true) }
    const handleEdit = async () => {
        if (!editOption || !editLabel.trim()) { toast.error("Label is required"); return }
        setSaving(true)
        const oldValue = editOption.value; const newValue = editValue.trim() || editLabel.trim()
        const lc = levels.find(l => l.optionType === editOption.option_type)
        const payload: Record<string, unknown> = { label: editLabel.trim(), value: newValue }
        if (lc?.parentType) payload.parent_value = editParentValue || null
        const { error } = await supabase.from("master_options").update(payload).eq("id", editOption.id)
        if (error) { toast.error(error.message); setSaving(false); return }
        if (oldValue !== newValue) {
            const childLevel = levels.find(l => l.parentType === editOption.option_type)
            if (childLevel) await supabase.from("master_options").update({ parent_value: newValue }).eq("option_type", childLevel.optionType).eq("parent_value", oldValue)
        }
        toast.success("Option updated"); setSaving(false); setEditDialogOpen(false); onRefresh()
    }

    // ── Delete & Reassign ──
    const openDelete = (opt: MasterOption) => { setDeleteOption(opt); setDeleteDialogOpen(true) }
    const handleDelete = async () => {
        if (!deleteOption) return; setSaving(true)
        const { error } = await supabase.from("master_options").update({ is_active: false }).eq("id", deleteOption.id)
        if (error) toast.error(error.message); else toast.success(`"${deleteOption.label}" deactivated`)
        setSaving(false); setDeleteDialogOpen(false); onRefresh()
    }
    const openReassign = (opt: MasterOption) => { setReassignOption(opt); setReassignNewParent(""); setReassignDialogOpen(true) }
    const handleReassign = async () => {
        if (!reassignOption || !reassignNewParent) { toast.error("Please select a parent"); return }; setSaving(true)
        const { error } = await supabase.from("master_options").update({ parent_value: reassignNewParent }).eq("id", reassignOption.id)
        if (error) toast.error(error.message); else toast.success(`"${reassignOption.label}" reassigned`)
        setSaving(false); setReassignDialogOpen(false); onRefresh()
    }

    const getParentOptions = (lc: CascadeLevel): MasterOption[] => lc.parentType ? options.filter(o => o.option_type === lc.parentType && o.is_active) : []

    if (!rootLevel) return <div className="text-center py-8 text-muted-foreground text-sm">No cascade levels configured.</div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2"><GitBranch className="h-4 w-4 text-primary" /> Cascading Hierarchy</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{chainLabel}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={expandAll}>Expand All</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={collapseAll}>Collapse All</Button>
                    <Button size="sm" className="h-8" onClick={() => openAdd(rootLevel)}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Add {rootLevel.label}
                    </Button>
                </div>
            </div>

            <div className="border rounded-lg bg-background">
                {tree.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">No options yet. Add a {rootLevel.label} to get started.</div>
                ) : (
                    <div className="divide-y">
                        {tree.map(node => (
                            <GenericTreeNode key={node.option.id} node={node} levels={levels} expanded={expanded}
                                onToggle={toggleExpand} onAdd={openAdd} onEdit={openEdit} onDelete={openDelete} />
                        ))}
                    </div>
                )}
            </div>

            {orphans.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-medium text-amber-800">Unlinked Options ({orphans.length})</span>
                    </div>
                    <p className="text-xs text-amber-700 mb-3">These options don&apos;t have a valid parent and won&apos;t appear in cascading dropdowns.</p>
                    <div className="space-y-1.5">
                        {orphans.map(o => (
                            <div key={o.id} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-amber-200">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium uppercase">{levels.find(l => l.optionType === o.option_type)?.label ?? formatLabel(o.option_type)}</span>
                                    <span className="text-sm font-medium">{o.label}</span>
                                    {o.parent_value && <span className="text-xs text-muted-foreground">(parent: &quot;{o.parent_value}&quot; — not found)</span>}
                                </div>
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openReassign(o)}>Reassign</Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ═══ Add Dialog (new option — root level or when no existing options) ═══ */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Add {addLevel?.label}</DialogTitle>
                        <DialogDescription>
                            {addLevel?.parentType ? `Child of ${levels.find(l => l.optionType === addLevel.parentType)?.label ?? "parent"}.` : `Add a new ${addLevel?.label?.toLowerCase() ?? "option"}.`}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {addLevel?.parentType && (
                            <div className="space-y-2">
                                <Label>Parent: {levels.find(l => l.optionType === addLevel.parentType)?.label} *</Label>
                                <Select value={addParentValue || undefined} onValueChange={setAddParentValue}>
                                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select parent..." /></SelectTrigger>
                                    <SelectContent>{addLevel && getParentOptions(addLevel).map(o => (<SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Label *</Label>
                            <Input value={addLabel} onChange={e => { setAddLabel(e.target.value); setAddValue(e.target.value) }}
                                placeholder={`e.g. New ${addLevel?.label ?? "option"}`} onKeyDown={e => { if (e.key === "Enter") handleAdd() }} />
                        </div>
                        <div className="space-y-2">
                            <Label>Value</Label>
                            <Input value={addValue} onChange={e => setAddValue(e.target.value)} placeholder="Stored value (defaults to label)" className="font-mono text-sm" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleAdd} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Add</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Picker Dialog (assign existing options to parent) ═══ */}
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
                <DialogContent className="sm:max-w-[520px] max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Assign {pickerLevel?.label} to &quot;{pickerParentValue}&quot;</DialogTitle>
                        <DialogDescription>
                            Select which {pickerLevel?.label.toLowerCase()}s belong under this {levels.find(l => l.optionType === pickerLevel?.parentType)?.label.toLowerCase() ?? "parent"}.
                            Checked items will be assigned, unchecked items will be unlinked.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 flex flex-col gap-3">
                        <div className="relative flex-none">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)}
                                placeholder={`Search ${pickerLevel?.label.toLowerCase() ?? "options"}...`} className="h-8 pl-8 text-sm" />
                        </div>
                        <div className="flex-none flex items-center justify-between text-xs text-muted-foreground px-1">
                            <span>{pickerSelected.size} of {pickerOptions.length} selected</span>
                            <div className="flex gap-2">
                                <button type="button" className="hover:text-foreground" onClick={() => setPickerSelected(new Set(pickerOptions.map(o => o.id)))}>Select all</button>
                                <span>·</span>
                                <button type="button" className="hover:text-foreground" onClick={() => setPickerSelected(new Set())}>Clear</button>
                            </div>
                        </div>
                        <div className="border rounded-lg overflow-y-auto flex-1 min-h-0">
                            {filteredPickerOptions.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground text-sm">{pickerSearch ? "No matches." : "No options available."}</div>
                            ) : (
                                <div className="divide-y">
                                    {filteredPickerOptions.map(o => {
                                        const isChecked = pickerSelected.has(o.id)
                                        const assignedElsewhere = o.parent_value && o.parent_value !== pickerParentValue
                                        return (
                                            <label key={o.id} className={cn("flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors",
                                                isChecked ? "bg-primary/5" : "hover:bg-muted/30")}>
                                                <div className={cn("h-4 w-4 rounded border flex items-center justify-center flex-none transition-colors",
                                                    isChecked ? "bg-primary border-primary" : "border-gray-300")}>
                                                    {isChecked && <Check className="h-3 w-3 text-primary-foreground" />}
                                                </div>
                                                <input type="checkbox" checked={isChecked} className="sr-only"
                                                    onChange={e => { setPickerSelected(prev => { const n = new Set(prev); e.target.checked ? n.add(o.id) : n.delete(o.id); return n }) }} />
                                                <span className="text-sm flex-1">{o.label}</span>
                                                {o.parent_value === pickerParentValue && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">assigned</span>
                                                )}
                                                {assignedElsewhere && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium" title={`Currently under "${o.parent_value}"`}>
                                                        → {o.parent_value}
                                                    </span>
                                                )}
                                                {!o.parent_value && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">unassigned</span>
                                                )}
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPickerOpen(false)}>Cancel</Button>
                        <Button onClick={handlePickerSave} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save Assignment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Edit Dialog ═══ */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Edit Option</DialogTitle>
                        <DialogDescription>Editing &quot;{editOption?.label}&quot;. Value changes cascade to children.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {editOption && (() => {
                            const lc = levels.find(l => l.optionType === editOption.option_type)
                            if (!lc?.parentType) return null
                            return (
                                <div className="space-y-2">
                                    <Label>Parent: {levels.find(l => l.optionType === lc.parentType)?.label} *</Label>
                                    <Select value={editParentValue || undefined} onValueChange={setEditParentValue}>
                                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select parent..." /></SelectTrigger>
                                        <SelectContent>{getParentOptions(lc).map(o => (<SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            )
                        })()}
                        <div className="space-y-2"><Label>Label *</Label><Input value={editLabel} onChange={e => setEditLabel(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Value</Label><Input value={editValue} onChange={e => setEditValue(e.target.value)} className="font-mono text-sm" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleEdit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ Delete Dialog ═══ */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate &quot;{deleteOption?.label}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This option will no longer appear in dropdowns. Existing data is preserved.
                            {deleteOption && (() => {
                                const cl = levels.find(l => l.parentType === deleteOption.option_type)
                                if (!cl) return null
                                const cnt = options.filter(o => o.option_type === cl.optionType && o.parent_value === deleteOption.value && o.is_active).length
                                return cnt > 0 ? <span className="block mt-2 text-amber-600 font-medium">⚠ {cnt} child option{cnt !== 1 ? "s" : ""} will become unlinked.</span> : null
                            })()}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={e => { e.preventDefault(); handleDelete() }} disabled={saving} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ═══ Reassign Dialog ═══ */}
            <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Reassign &quot;{reassignOption?.label}&quot;</DialogTitle>
                        <DialogDescription>Choose a new parent for cascading dropdowns.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {reassignOption && (() => {
                            const lc = levels.find(l => l.optionType === reassignOption.option_type)
                            if (!lc?.parentType) return null
                            return (
                                <div className="space-y-2">
                                    <Label>New Parent: {levels.find(l => l.optionType === lc.parentType)?.label} *</Label>
                                    <Select value={reassignNewParent || undefined} onValueChange={setReassignNewParent}>
                                        <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select parent..." /></SelectTrigger>
                                        <SelectContent>{getParentOptions(lc).map(o => (<SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            )
                        })()}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleReassign} disabled={saving || !reassignNewParent}>{saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Reassign</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

// ═══ Generic Tree Node ═══
const LEVEL_COLORS = [
    { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
    { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200/60" },
    { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-200/60" },
    { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200/60" },
    { bg: "bg-amber-100", text: "text-amber-600", border: "border-amber-200/60" },
]

function GenericTreeNode({ node, levels, expanded, onToggle, onAdd, onEdit, onDelete }: {
    node: TreeNode; levels: CascadeLevel[]; expanded: Set<string>
    onToggle: (key: string) => void; onAdd: (level: CascadeLevel, parentValue?: string) => void
    onEdit: (opt: MasterOption) => void; onDelete: (opt: MasterOption) => void
}) {
    const key = `${node.levelConfig.optionType}:${node.option.value}`
    const isExpanded = expanded.has(key)
    const isLeaf = !levels.some(l => l.parentType === node.levelConfig.optionType)
    const childLevel = levels.find(l => l.parentType === node.levelConfig.optionType)
    const colors = LEVEL_COLORS[node.level % LEVEL_COLORS.length]
    const indent = node.level * 8

    if (isLeaf) {
        return (
            <div className="flex items-center gap-2 px-4 py-1.5 hover:bg-muted/10 group" style={{ marginLeft: `${indent}px` }}>
                <Check className={cn("h-3 w-3 flex-none", colors.text)} />
                <span className="text-sm text-foreground/80">{node.option.label}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(node.option)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => onDelete(node.option)}><Trash2 className="h-3 w-3" /></Button>
                </div>
            </div>
        )
    }

    const childCount = node.children.length
    const py = node.level === 0 ? "py-3" : "py-2.5"
    const textSize = node.level === 0 ? "text-sm font-semibold" : "text-sm font-medium"
    const iconSize = node.level === 0 ? "h-7 w-7 rounded-md" : "h-5 w-5 rounded"
    const iconTextSize = node.level === 0 ? "text-xs font-bold" : "text-[10px] font-bold"

    return (
        <div>
            <div className={cn("flex items-center gap-2 px-4 hover:bg-muted/30 group", py)} style={{ marginLeft: `${indent}px` }}>
                <button type="button" onClick={() => onToggle(key)} className="flex items-center justify-center h-6 w-6 rounded hover:bg-muted transition-colors">
                    {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </button>
                <div className={cn(iconSize, colors.bg, "flex items-center justify-center flex-none")}>
                    <span className={cn(iconTextSize, colors.text)}>{node.option.label.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <span className={textSize}>{node.option.label}</span>
                    {childLevel && <span className="text-xs text-muted-foreground ml-2">{childCount} {childLevel.label.toLowerCase()}{childCount !== 1 ? "s" : ""}</span>}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {childLevel && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => onAdd(childLevel, node.option.value)}>
                            <Plus className="h-3 w-3" /> {childLevel.label}
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node.option)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.option)}><Trash2 className="h-3 w-3" /></Button>
                </div>
            </div>
            {isExpanded && (
                <div className={cn("border-l-2 ml-7", colors.border)} style={{ marginLeft: `${indent + 28}px` }}>
                    {node.children.length === 0 ? (
                        <div className="flex items-center gap-2 px-4 py-2 ml-2">
                            <Circle className="h-2 w-2 text-muted-foreground/40" />
                            <span className="text-xs text-muted-foreground italic">No {childLevel?.label.toLowerCase()}s yet</span>
                            {childLevel && <Button variant="ghost" size="sm" className="h-6 text-[11px] text-primary ml-1" onClick={() => onAdd(childLevel, node.option.value)}><Plus className="h-3 w-3 mr-0.5" /> Add</Button>}
                        </div>
                    ) : (
                        node.children.map(child => (
                            <GenericTreeNode key={child.option.id} node={child} levels={levels} expanded={expanded}
                                onToggle={onToggle} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
