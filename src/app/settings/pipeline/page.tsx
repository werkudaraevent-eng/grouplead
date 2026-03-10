"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import type { PipelineStage } from "@/types/index"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Loader2, GripVertical } from "lucide-react"
import { toast } from "sonner"

const COLORS = [
    { value: "blue", label: "Blue", cls: "bg-blue-500" },
    { value: "amber", label: "Amber", cls: "bg-amber-500" },
    { value: "violet", label: "Violet", cls: "bg-violet-500" },
    { value: "emerald", label: "Emerald", cls: "bg-emerald-500" },
    { value: "red", label: "Red", cls: "bg-red-500" },
    { value: "gray", label: "Gray", cls: "bg-gray-500" },
    { value: "pink", label: "Pink", cls: "bg-pink-500" },
    { value: "cyan", label: "Cyan", cls: "bg-cyan-500" },
    { value: "orange", label: "Orange", cls: "bg-orange-500" },
    { value: "teal", label: "Teal", cls: "bg-teal-500" },
]

export default function PipelineSettingsPage() {
    const supabase = createClient()
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [editingStage, setEditingStage] = useState<PipelineStage | null>(null)
    const [deletingStage, setDeletingStage] = useState<PipelineStage | null>(null)
    const [formName, setFormName] = useState("")
    const [formColor, setFormColor] = useState("blue")

    const loadStages = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase.from("pipeline_stages").select("*").order("sort_order", { ascending: true })
        if (error) toast.error("Failed to load pipeline stages")
        else setStages(data ?? [])
        setLoading(false)
    }, [supabase])

    useEffect(() => { loadStages() }, [loadStages])

    const openAdd = () => { setEditingStage(null); setFormName(""); setFormColor("blue"); setDialogOpen(true) }
    const openEdit = (s: PipelineStage) => { setEditingStage(s); setFormName(s.name); setFormColor(s.color); setDialogOpen(true) }
    const openDelete = (s: PipelineStage) => { setDeletingStage(s); setDeleteDialogOpen(true) }

    const handleSave = async () => {
        if (!formName.trim()) { toast.error("Stage name is required"); return }
        setSaving(true)
        if (editingStage) {
            const { error } = await supabase.from("pipeline_stages").update({ name: formName.trim(), color: formColor }).eq("id", editingStage.id)
            if (error) toast.error("Failed to update stage")
            else toast.success("Stage updated")
        } else {
            const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.sort_order)) : 0
            const { error } = await supabase.from("pipeline_stages").insert({ name: formName.trim(), color: formColor, sort_order: maxOrder + 1, is_default: false })
            if (error) toast.error(error.message.includes("unique") ? "Stage name already exists" : "Failed to add stage")
            else toast.success("Stage added")
        }
        setSaving(false); setDialogOpen(false); loadStages()
    }

    const handleDelete = async () => {
        if (!deletingStage) return
        setSaving(true)
        const { count } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", deletingStage.name)
        if (count && count > 0) { toast.error(`Cannot delete — ${count} lead(s) are in this stage`); setSaving(false); setDeleteDialogOpen(false); return }
        const { error } = await supabase.from("pipeline_stages").delete().eq("id", deletingStage.id)
        if (error) toast.error("Failed to delete stage")
        else toast.success("Stage deleted")
        setSaving(false); setDeleteDialogOpen(false); loadStages()
    }

    const moveStage = async (stage: PipelineStage, dir: "up" | "down") => {
        const idx = stages.findIndex(s => s.id === stage.id)
        const swapIdx = dir === "up" ? idx - 1 : idx + 1
        if (swapIdx < 0 || swapIdx >= stages.length) return
        const other = stages[swapIdx]
        await Promise.all([
            supabase.from("pipeline_stages").update({ sort_order: other.sort_order }).eq("id", stage.id),
            supabase.from("pipeline_stages").update({ sort_order: stage.sort_order }).eq("id", other.id),
        ])
        loadStages()
    }

    const dot = (color: string) => {
        const c = COLORS.find(x => x.value === color)
        return <span className={`inline-block w-3 h-3 rounded-full ${c?.cls ?? "bg-gray-500"}`} />
    }

    return (
        <div className="p-6 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pipeline Settings</h1>
                    <p className="text-sm text-muted-foreground">Manage your Kanban pipeline stages and their display order.</p>
                </div>
                <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" /> Add Stage</Button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : stages.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">No pipeline stages found. Add one to get started.</div>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10">#</TableHead>
                                <TableHead>Stage Name</TableHead>
                                <TableHead className="w-24">Color</TableHead>
                                <TableHead className="w-20 text-center">Default</TableHead>
                                <TableHead className="w-28 text-center">Order</TableHead>
                                <TableHead className="w-24 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stages.map((stage, idx) => (
                                <TableRow key={stage.id}>
                                    <TableCell className="text-muted-foreground"><GripVertical className="h-4 w-4" /></TableCell>
                                    <TableCell className="font-medium">{stage.name}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            {dot(stage.color)}
                                            <span className="text-xs text-muted-foreground capitalize">{stage.color}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {stage.is_default && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">Default</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => moveStage(stage, "up")}><ArrowUp className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === stages.length - 1} onClick={() => moveStage(stage, "down")}><ArrowDown className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(stage)}><Pencil className="h-3.5 w-3.5" /></Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" disabled={stage.is_default} onClick={() => openDelete(stage)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>{editingStage ? "Edit Stage" : "Add Stage"}</DialogTitle>
                        <DialogDescription>{editingStage ? "Update the stage name or color." : "Create a new pipeline stage for your Kanban board."}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="stage-name">Stage Name</Label>
                            <Input id="stage-name" placeholder="e.g. Negotiation" value={formName} onChange={(e) => setFormName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} />
                        </div>
                        <div className="space-y-2">
                            <Label>Color</Label>
                            <Select value={formColor} onValueChange={setFormColor}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {COLORS.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>
                                            <div className="flex items-center gap-2">
                                                <span className={`w-3 h-3 rounded-full ${c.cls}`} />
                                                {c.label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                            {editingStage ? "Save Changes" : "Add Stage"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Delete Stage</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{deletingStage?.name}&quot;? This action cannot be undone. Stages with active leads cannot be deleted.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
