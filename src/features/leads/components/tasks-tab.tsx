"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
    Loader2, Plus, CheckCircle2, Circle, Trash2,
    CheckSquare, User as UserIcon, CalendarDays, X,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import {
    createTaskAction,
    toggleTaskAction,
    renameTaskAction,
    deleteTaskAction,
    assignTaskAction,
    setTaskDueDateAction,
    listAssignableUsersForLeadAction,
    type AssignableUser,
} from "@/app/actions/task-actions"

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

interface TaskRow {
    id: string
    lead_id: number
    title: string
    is_completed: boolean
    sort_order: number
    completed_at: string | null
    created_at: string
    assignee_id: string | null
    due_date: string | null
    assignee?: { id: string; full_name: string | null; avatar_url: string | null } | null
}

interface TasksTabProps {
    leadId: number | string
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function getInitials(name: string | null | undefined): string {
    if (!name) return "?"
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

/** Parse a YYYY-MM-DD string as a local-time Date (avoids UTC shift). */
function parseDateLocal(value: string | null | undefined): Date | undefined {
    if (!value) return undefined
    const [y, m, d] = value.split("-").map(Number)
    if (!y || !m || !d) return undefined
    return new Date(y, m - 1, d)
}

/** Format a Date as YYYY-MM-DD in local time. */
function formatDateLocal(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

function formatDuePill(value: string | null): string {
    const d = parseDateLocal(value)
    if (!d) return "Due"
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

/** Returns "overdue", "soon" (<=3d), or null. Completed tasks always null. */
function dueState(value: string | null, isCompleted: boolean): "overdue" | "soon" | null {
    if (!value || isCompleted) return null
    const due = parseDateLocal(value)
    if (!due) return null
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const diffMs = due.getTime() - today.getTime()
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return "overdue"
    if (diffDays <= 3) return "soon"
    return null
}

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════

export function TasksTab({ leadId }: TasksTabProps) {
    const supabase = createClient()
    const router = useRouter()
    const [items, setItems] = useState<TaskRow[]>([])
    const [loading, setLoading] = useState(true)
    const [newTitle, setNewTitle] = useState("")
    const [adding, setAdding] = useState(false)
    const [assignableUsers, setAssignableUsers] = useState<AssignableUser[]>([])
    const inputRef = useRef<HTMLInputElement>(null)

    // ── Fetch ──────────────────────────────────────────────
    const fetchItems = useCallback(async () => {
        const { data, error } = await supabase
            .from("lead_checklists")
            .select("*, assignee:profiles!lead_checklists_assignee_id_fkey(id, full_name, avatar_url)")
            .eq("lead_id", leadId)
            .order("is_completed", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })

        if (error) {
            console.error("[TasksTab] Fetch error:", error.message)
        } else {
            setItems((data as TaskRow[]) ?? [])
        }
        setLoading(false)
    }, [leadId, supabase])

    useEffect(() => { fetchItems() }, [fetchItems])

    // ── Load assignable users (company-scoped via server action) ──
    useEffect(() => {
        listAssignableUsersForLeadAction(Number(leadId)).then(setAssignableUsers)
    }, [leadId])

    // ── Add Item ───────────────────────────────────────────
    const handleAdd = async () => {
        const title = newTitle.trim()
        if (!title) return
        setAdding(true)

        const nextOrder = items.length > 0
            ? Math.max(...items.map(i => i.sort_order)) + 1
            : 0

        const result = await createTaskAction({
            leadId: Number(leadId),
            title,
            sortOrder: nextOrder,
        })

        if (!result.success) {
            toast.error(`Failed to add: ${result.error ?? "Unknown error"}`)
        } else {
            setNewTitle("")
            await fetchItems()
            router.refresh()
        }
        setAdding(false)
        setTimeout(() => inputRef.current?.focus(), 50)
    }

    // ── Toggle Complete ────────────────────────────────────
    const handleToggle = async (item: TaskRow) => {
        const nextCompleted = !item.is_completed

        // Optimistic
        setItems(prev => prev.map(i =>
            i.id === item.id
                ? { ...i, is_completed: nextCompleted, completed_at: nextCompleted ? new Date().toISOString() : null }
                : i
        ))

        const result = await toggleTaskAction(item.id, nextCompleted)
        if (!result.success) {
            toast.error("Failed to update")
            await fetchItems() // revert
        } else {
            router.refresh()
        }
    }

    // ── Delete ─────────────────────────────────────────────
    const handleDelete = async (id: string) => {
        // Optimistic
        setItems(prev => prev.filter(i => i.id !== id))

        const result = await deleteTaskAction(id)
        if (!result.success) {
            toast.error("Failed to delete")
            await fetchItems()
        } else {
            router.refresh()
        }
    }

    // ── Rename ─────────────────────────────────────────────
    const handleRename = async (id: string, newTitle: string) => {
        const trimmed = newTitle.trim()
        if (!trimmed) return

        // Optimistic
        setItems(prev => prev.map(i => i.id === id ? { ...i, title: trimmed } : i))

        const result = await renameTaskAction(id, trimmed)
        if (!result.success) {
            toast.error("Failed to rename")
            await fetchItems()
        } else {
            router.refresh()
        }
    }

    // ── Assign / Unassign ──────────────────────────────────
    const handleAssign = async (id: string, assigneeId: string | null) => {
        const optimisticUser = assigneeId
            ? assignableUsers.find(u => u.id === assigneeId)
            : null

        setItems(prev => prev.map(i =>
            i.id === id
                ? {
                    ...i,
                    assignee_id: assigneeId,
                    assignee: optimisticUser
                        ? { id: optimisticUser.id, full_name: optimisticUser.full_name, avatar_url: optimisticUser.avatar_url }
                        : null,
                }
                : i
        ))

        const result = await assignTaskAction(id, assigneeId)
        if (!result.success) {
            toast.error("Failed to assign")
            await fetchItems()
        } else {
            router.refresh()
        }
    }

    // ── Set Due Date ───────────────────────────────────────
    const handleSetDue = async (id: string, dueDate: string | null) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, due_date: dueDate } : i))

        const result = await setTaskDueDateAction(id, dueDate)
        if (!result.success) {
            toast.error("Failed to update due date")
            await fetchItems()
        } else {
            router.refresh()
        }
    }

    // ── Stats ──────────────────────────────────────────────
    const total = items.length
    const completed = items.filter(i => i.is_completed).length
    const pending = items.filter(i => !i.is_completed)
    const done = items.filter(i => i.is_completed)

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
        )
    }

    return (
        <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden">
            {/* ── Header ──────────────────────────────────── */}
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-slate-400" />
                    Tasks
                    {total > 0 && (
                        <span className="text-[11px] font-normal text-slate-400 ml-0.5 tabular-nums">
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
                        <span className="text-[10px] font-semibold text-slate-400 tabular-nums">
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
                        placeholder="Add a task and press Enter…"
                        className="flex-1 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 outline-none border-none p-0"
                        disabled={adding}
                    />
                    {adding && <Loader2 className="h-3.5 w-3.5 text-slate-400 animate-spin shrink-0" />}
                </div>
            </div>

            {/* ── Task Items ──────────────────────────────── */}
            <div className="divide-y divide-slate-50">
                {pending.map((item) => (
                    <TaskRowItem
                        key={item.id}
                        item={item}
                        users={assignableUsers}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item.id)}
                        onRename={(t) => handleRename(item.id, t)}
                        onAssign={(uid) => handleAssign(item.id, uid)}
                        onSetDue={(d) => handleSetDue(item.id, d)}
                    />
                ))}

                {done.length > 0 && pending.length > 0 && (
                    <div className="px-5 py-2 bg-slate-50/60">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Completed ({done.length})
                        </span>
                    </div>
                )}
                {done.map((item) => (
                    <TaskRowItem
                        key={item.id}
                        item={item}
                        users={assignableUsers}
                        onToggle={() => handleToggle(item)}
                        onDelete={() => handleDelete(item.id)}
                        onRename={(t) => handleRename(item.id, t)}
                        onAssign={(uid) => handleAssign(item.id, uid)}
                        onSetDue={(d) => handleSetDue(item.id, d)}
                    />
                ))}

                {/* Empty state */}
                {total === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <CheckSquare className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-[13px] text-slate-500 font-medium mb-0.5">No tasks yet</p>
                        <p className="text-[12px] text-slate-400">
                            Type above and press Enter to add your first task
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
//  TASK ROW
// ═══════════════════════════════════════════════════════════════

function TaskRowItem({
    item, users, onToggle, onDelete, onRename, onAssign, onSetDue,
}: {
    item: TaskRow
    users: AssignableUser[]
    onToggle: () => void
    onDelete: () => void
    onRename: (newTitle: string) => void
    onAssign: (assigneeId: string | null) => void
    onSetDue: (dueDate: string | null) => void
}) {
    const [isEditing, setIsEditing] = useState(false)
    const [editValue, setEditValue] = useState(item.title)
    const editRef = useRef<HTMLInputElement>(null)

    const startEdit = () => {
        if (item.is_completed) return
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
            setEditValue(item.title)
        }
    }

    const cancelEdit = () => {
        setIsEditing(false)
        setEditValue(item.title)
    }

    const due = dueState(item.due_date, item.is_completed)
    const assigneeName = item.assignee?.full_name ?? null

    return (
        <div className={`flex items-center gap-3 px-5 py-2.5 group hover:bg-slate-50/60 transition-colors ${item.is_completed ? "opacity-60" : ""}`}>
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

            {/* Title */}
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
                    className={`flex-1 min-w-0 text-[13px] leading-snug rounded px-1.5 py-0.5 -mx-1.5 cursor-text truncate ${
                        item.is_completed
                            ? "line-through text-slate-400"
                            : "text-slate-700 hover:bg-slate-100 transition-colors"
                    }`}
                    title={item.is_completed ? item.title : "Click to edit"}
                >
                    {item.title}
                </span>
            )}

            {/* Right cluster */}
            <div className="flex items-center gap-1.5 shrink-0">
                <DuePopover value={item.due_date} state={due} onChange={onSetDue} />
                <AssigneePopover
                    assigneeName={assigneeName}
                    assigneeAvatar={item.assignee?.avatar_url ?? null}
                    users={users}
                    selectedId={item.assignee_id}
                    onChange={onAssign}
                />
                <button
                    onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
                    title="Delete"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════
//  ASSIGNEE POPOVER
// ═══════════════════════════════════════════════════════════════

function AssigneePopover({
    assigneeName, assigneeAvatar, users, selectedId, onChange,
}: {
    assigneeName: string | null
    assigneeAvatar: string | null
    users: AssignableUser[]
    selectedId: string | null
    onChange: (id: string | null) => void
}) {
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return users
        return users.filter(u => (u.full_name ?? "").toLowerCase().includes(q))
    }, [users, search])

    const triggerLabel = assigneeName ? (
        <span className="flex items-center gap-1.5">
            {assigneeAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={assigneeAvatar} alt={assigneeName} className="h-5 w-5 rounded-full object-cover" />
            ) : (
                <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[9px] font-bold">
                    {getInitials(assigneeName)}
                </span>
            )}
            <span className="text-[11px] font-medium text-slate-600 max-w-[110px] truncate">
                {assigneeName}
            </span>
        </span>
    ) : (
        <span className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors text-[11px]">
            <UserIcon className="h-3.5 w-3.5" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Assign</span>
        </span>
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="px-1.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                    title={assigneeName ? `Assigned to ${assigneeName}` : "Assign PIC"}
                >
                    {triggerLabel}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="end">
                <div className="p-2 border-b border-slate-100">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search user…"
                        className="w-full text-[12px] px-2 py-1.5 bg-slate-50 rounded outline-none focus:ring-1 focus:ring-blue-300"
                        autoFocus
                    />
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                    {selectedId && (
                        <button
                            onClick={() => { onChange(null); setOpen(false) }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                            <X className="h-3.5 w-3.5" /> Unassign
                        </button>
                    )}
                    {filtered.length === 0 && (
                        <div className="px-3 py-3 text-[12px] text-slate-400 text-center">
                            No users found
                        </div>
                    )}
                    {filtered.map(u => (
                        <button
                            key={u.id}
                            onClick={() => { onChange(u.id); setOpen(false) }}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 text-[12px] hover:bg-slate-50 transition-colors text-left ${
                                u.id === selectedId ? "bg-blue-50/40" : ""
                            }`}
                        >
                            {u.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={u.avatar_url} alt={u.full_name} className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                                <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                                    {getInitials(u.full_name)}
                                </span>
                            )}
                            <span className="text-slate-700 truncate">{u.full_name}</span>
                            {u.id === selectedId && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 ml-auto shrink-0" />
                            )}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ═══════════════════════════════════════════════════════════════
//  DUE DATE POPOVER
// ═══════════════════════════════════════════════════════════════

function DuePopover({
    value, state, onChange,
}: {
    value: string | null
    state: "overdue" | "soon" | null
    onChange: (date: string | null) => void
}) {
    const [open, setOpen] = useState(false)
    const selected = parseDateLocal(value)

    const label = value ? formatDuePill(value) : null
    const stateClass =
        state === "overdue" ? "bg-red-50 text-red-600 border-red-200" :
        state === "soon"    ? "bg-orange-50 text-orange-600 border-orange-200" :
        value               ? "bg-slate-100 text-slate-600 border-slate-200" :
                              ""

    const trigger = value ? (
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-medium ${stateClass}`}>
            <CalendarDays className="h-3 w-3" />
            {label}
        </span>
    ) : (
        <span className="flex items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors text-[11px]">
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">Due</span>
        </span>
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="px-1.5 py-1 rounded-md hover:bg-slate-100 transition-colors"
                    title={value ? `Due ${label}` : "Set due date"}
                >
                    {trigger}
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(d) => {
                        onChange(d ? formatDateLocal(d) : null)
                        setOpen(false)
                    }}
                    autoFocus
                />
                {value && (
                    <div className="border-t border-slate-100 p-2 flex justify-end">
                        <button
                            onClick={() => { onChange(null); setOpen(false) }}
                            className="text-[11px] text-slate-500 hover:text-red-500 px-2 py-1 rounded hover:bg-red-50 transition-colors flex items-center gap-1"
                        >
                            <X className="h-3 w-3" /> Clear
                        </button>
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
