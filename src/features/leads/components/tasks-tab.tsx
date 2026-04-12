"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Loader2, Plus, CheckCircle2, Circle, Trash2,
    CheckSquare, GripVertical,
} from "lucide-react"

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface ChecklistItem {
    id: string
    lead_id: number
    title: string
    is_completed: boolean
    sort_order: number
    completed_at: string | null
    created_at: string
}

interface TasksTabProps {
    leadId: number | string
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export function TasksTab({ leadId }: TasksTabProps) {
    const supabase = createClient()
    const router = useRouter()
    const [items, setItems] = useState<ChecklistItem[]>([])
    const [loading, setLoading] = useState(true)
    const [newTitle, setNewTitle] = useState("")
    const [adding, setAdding] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // ── Fetch ──────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        const { data, error } = await supabase
            .from("lead_checklists")
            .select("*")
            .eq("lead_id", leadId)
            .order("is_completed", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })

        if (error) {
            console.error("[TasksTab] Fetch error:", error.message)
        } else {
            setItems((data as ChecklistItem[]) ?? [])
        }
        setLoading(false)
    }, [leadId])

    useEffect(() => { fetchItems() }, [fetchItems])

    // ── Add Item ───────────────────────────────────────────
    const handleAdd = async () => {
        const title = newTitle.trim()
        if (!title) return
        setAdding(true)

        const nextOrder = items.length > 0
            ? Math.max(...items.map(i => i.sort_order)) + 1
            : 0

        const { error } = await supabase.from("lead_checklists").insert({
            lead_id: Number(leadId),
            title,
            is_completed: false,
            sort_order: nextOrder,
        })

        if (error) {
            toast.error(`Failed to add: ${error.message}`)
        } else {
            setNewTitle("")
            fetchItems()
        }
        setAdding(false)
        // Keep focus on input for rapid entry
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    // ── Toggle Complete ────────────────────────────────────
    const handleToggle = async (item: ChecklistItem) => {
        const nowCompleted = !item.is_completed

        // Optimistic update
        setItems(prev => prev.map(i =>
            i.id === item.id
                ? { ...i, is_completed: nowCompleted, completed_at: nowCompleted ? new Date().toISOString() : null }
                : i
        ))

        const { error } = await supabase
            .from("lead_checklists")
            .update({
                is_completed: nowCompleted,
                completed_at: nowCompleted ? new Date().toISOString() : null,
            })
            .eq("id", item.id)

        if (error) {
            toast.error("Failed to update")
            fetchItems() // revert
        }
    }

    // ── Delete ─────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        // Optimistic
        setItems(prev => prev.filter(i => i.id !== id))

        const { error } = await supabase
            .from("lead_checklists")
            .delete()
            .eq("id", id)

        if (error) {
            toast.error("Failed to delete")
            fetchItems()
        }
    }

    // ── Rename ─────────────────────────────────────────────
    const handleRename = async (id: string, newTitle: string) => {
        const trimmed = newTitle.trim()
        if (!trimmed) return

        // Optimistic
        setItems(prev => prev.map(i => i.id === id ? { ...i, title: trimmed } : i))

        const { error } = await supabase
            .from("lead_checklists")
            .update({ title: trimmed })
            .eq("id", id)

        if (error) {
            toast.error("Failed to rename")
            fetchItems()
        }
    }

    // ── Stats ──────────────────────────────────────────────
    const total = items.length
    const completed = items.filter(i => i.is_completed).length
    const pending = items.filter(i => !i.is_completed)
    const done = items.filter(i => i.is_completed)

    // ── Loading ────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
        )
    }

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* ── Header ──────────────────────────────────── */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-400" />
                    Checklist
                    {total > 0 && (
                        <span className="text-[11px] font-normal text-slate-400 ml-0.5">
                            {completed}/{total}
                        </span>
                    )}
                </h3>
                {total > 0 && (
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${(completed / total) * 100}%` }}
                            />
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400">
                            {Math.round((completed / total) * 100)}%
                        </span>
                    </div>
                )}
            </div>

            {/* ── Quick-Add Input ──────────────────────────── */}
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40">
                <div className="flex items-center gap-2">
                    <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                        <Plus className="h-4 w-4 text-slate-300" />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                handleAdd()
                            }
                        }}
                        placeholder="Add a checklist item and press Enter..."
                        className="flex-1 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 outline-none border-none p-0"
                        disabled={adding}
                    />
                    {adding && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin shrink-0" />}
                </div>
            </div>

            {/* ── Checklist Items ──────────────────────────── */}
            <div className="divide-y divide-slate-50">
                {/* Pending items first */}
                {pending.map((item) => (
                    <ChecklistRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item.id)}
                        onRename={(newTitle) => handleRename(item.id, newTitle)}
                    />
                ))}

                {/* Completed items — visually separated */}
                {done.length > 0 && pending.length > 0 && (
                    <div className="px-5 py-2 bg-slate-50/60">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Completed ({done.length})
                        </span>
                    </div>
                )}
                {done.map((item) => (
                    <ChecklistRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item.id)}
                        onRename={(newTitle) => handleRename(item.id, newTitle)}
                    />
                ))}

                {/* Empty state */}
                {total === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <CheckSquare className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-[13px] text-slate-500 font-medium mb-0.5">No items yet</p>
                        <p className="text-[12px] text-slate-400">
                            Type above and press Enter to add your first action item
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
//  CHECKLIST ROW
// ═══════════════════════════════════════════════════════════════

function ChecklistRow({ item, onToggle, onDelete, onRename }: {
    item: ChecklistItem
    onToggle: () => void
    onDelete: () => void
    onRename: (newTitle: string) => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(item.title)
    const editRef = useRef<HTMLInputElement>(null)

    const startEdit = () => {
        if (item.is_completed) return // Don't edit completed items
        setEditValue(item.title)
        setIsEditing(true)
        setTimeout(() => editRef.current?.focus(), 30)
    }

    const commitEdit = () => {
        setIsEditing(false)
        const trimmed = editValue.trim()
        if (trimmed && trimmed !== item.title) {
            onRename(trimmed)
        } else {
            setEditValue(item.title) // revert
        }
    }

    const cancelEdit = () => {
        setIsEditing(false)
        setEditValue(item.title)
    }

    return (
        <div className={`flex items-center gap-3 px-5 py-2.5 group hover:bg-slate-50/60 transition-colors ${item.is_completed ? "opacity-50" : ""}`}>
            {/* Checkbox */}
            <button
                onClick={onToggle}
                className="shrink-0 transition-transform active:scale-90"
                title={item.is_completed ? "Mark as incomplete" : "Mark as complete"}
            >
                {item.is_completed ? (
                    <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" />
                ) : (
                    <Circle className="h-[18px] w-[18px] text-slate-300 hover:text-blue-400 transition-colors cursor-pointer" />
                )}
            </button>

            {/* Title — click to edit */}
            {isEditing ? (
                <input
                    ref={editRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); commitEdit() }
                        if (e.key === "Escape") cancelEdit()
                    }}
                    className="flex-1 text-[13px] leading-snug text-slate-700 bg-white border border-blue-300 rounded px-1.5 py-0.5 outline-none ring-1 ring-blue-200"
                />
            ) : (
                <span
                    onClick={startEdit}
                    className={`flex-1 text-[13px] leading-snug rounded px-1.5 py-0.5 -mx-1.5 cursor-text ${
                        item.is_completed
                            ? "line-through text-slate-400"
                            : "text-slate-700 hover:bg-slate-100 transition-colors"
                    }`}
                    title={item.is_completed ? undefined : "Click to edit"}
                >
                    {item.title}
                </span>
            )}

            {/* Delete button — only on hover */}
            <button
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all shrink-0"
                title="Delete"
            >
                <Trash2 className="h-3.5 w-3.5" />
            </button>
        </div>
    )
}
