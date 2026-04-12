"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { scopedQuery } from "@/utils/supabase/scoped-query"
import { useCompany } from "@/contexts/company-context"
import { LeadTask, DEPARTMENTS, DEPARTMENT_CONFIG } from "@/types/tasks"
import { TaskCard } from "./task-card"
import { ListTodo, AlertCircle, Loader2, Inbox } from "lucide-react"

const STATUS_LABELS: Record<string, string> = {
    All: "All",
    PENDING: "Pending",
    IN_PROGRESS: "In Progress",
    COMPLETED: "Completed",
}

export function TaskBoard() {
    const supabase = createClient()
    const { activeCompany } = useCompany()

    const [tasks, setTasks] = useState<LeadTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [statusFilter, setStatusFilter] = useState("All")
    const [deptFilter, setDeptFilter] = useState("All")

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const base = supabase
                .from("lead_tasks")
                .select("*")
                .order("created_at", { ascending: false })
            const scoped = scopedQuery(base, activeCompany?.id ?? null)
            const { data, error: fetchError } = await scoped
            if (fetchError) throw fetchError
            setTasks((data as LeadTask[]) || [])
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Unknown error"
            setError(message)
        } finally {
            setLoading(false)
        }
    }, [supabase, activeCompany])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    const filteredTasks = tasks.filter((t) => {
        if (statusFilter !== "All" && t.status !== statusFilter) return false
        if (deptFilter !== "All" && t.department !== deptFilter) return false
        return true
    })

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
                        <ListTodo className="w-8 h-8 text-slate-700" />
                        Department Tasks
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Complete tasks to automatically update lead SLA timestamps.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="bg-white border border-slate-200 text-slate-700 px-3 py-1 rounded-md text-sm font-medium">
                        {tasks.length} Total Tasks
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                <div className="flex bg-slate-200/50 p-1 rounded-lg border border-slate-100">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={
                                "px-3 py-1.5 text-sm font-medium rounded-md transition-all " +
                                (statusFilter === key
                                    ? "bg-white text-slate-900 shadow-sm"
                                    : "text-slate-600 hover:text-slate-900")
                            }
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-3 mb-8">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dept</span>
                <div className="flex flex-wrap gap-2">
                    {(["All", ...DEPARTMENTS] as string[]).map((dept) => (
                        <button
                            key={dept}
                            onClick={() => setDeptFilter(dept)}
                            className={
                                "px-3 py-1.5 text-sm rounded-md border transition-all flex items-center gap-2 " +
                                (deptFilter === dept
                                    ? "bg-slate-900 border-slate-900 text-white font-medium"
                                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300")
                            }
                        >
                            {dept === "All" ? dept : (DEPARTMENT_CONFIG[dept]?.label || dept)}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md mb-8 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div>
                        <h3 className="text-sm font-semibold text-red-800">Database Query Failed</h3>
                        <p className="text-sm text-red-700 mt-1">{error}</p>
                    </div>
                </div>
            )}

            <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden min-h-[400px] flex flex-col">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <Inbox className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">No tasks found</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
                            There are currently no tasks matching your filters. Ensure the seed SQL has been executed.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
                        {filteredTasks.map((task: LeadTask) => (
                            <TaskCard key={task.id} task={task} onComplete={fetchTasks} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}