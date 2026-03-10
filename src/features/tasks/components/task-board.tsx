"use client"

import { useEffect, useState, useCallback } from "react"
import { LeadTask, DEPARTMENTS, TASK_STATUS_CONFIG, DEPARTMENT_CONFIG } from "@/types/tasks"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { scopedQuery } from "@/utils/supabase/scoped-query"
import { TaskCard } from "@/features/tasks/components/task-card"
import { Button } from "@/components/ui/button"
import { Loader2, Inbox, Filter, LayoutList } from "lucide-react"

type FilterStatus = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
type FilterDept = 'ALL' | string

export function TaskBoard() {
    const [tasks, setTasks] = useState<LeadTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL')
    const [filterDept, setFilterDept] = useState<FilterDept>('ALL')

    const supabase = createClient()
    const { activeCompany } = useCompany()

    const fetchTasks = useCallback(async () => {
        setLoading(true)
        setError(null)

        const base = supabase
            .from('lead_tasks')
            .select(`
        *,
        leads (
          company_name,
          project_name,
          manual_id,
          status,
          estimated_revenue,
          pic_sales
        )
      `)
            .order('created_at', { ascending: false })

        let query = scopedQuery(base, activeCompany?.id ?? null)

        if (filterStatus !== 'ALL') {
            query = query.eq('status', filterStatus)
        }
        if (filterDept !== 'ALL') {
            query = query.eq('department', filterDept)
        }

        const { data, error: fetchError } = await query

        if (fetchError) {
            console.error("Error fetching tasks:", fetchError)
            setError(fetchError.message)
        } else {
            setTasks((data as LeadTask[]) || [])
        }

        setLoading(false)
    }, [filterStatus, filterDept, activeCompany?.id])

    useEffect(() => {
        fetchTasks()
    }, [fetchTasks])

    // Count by status for the filter pills
    const statusCounts = tasks.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const activeFilters = (filterStatus !== 'ALL' ? 1 : 0) + (filterDept !== 'ALL' ? 1 : 0)

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <LayoutList className="h-6 w-6 text-primary" />
                        Department Tasks
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Complete tasks to automatically update lead SLA timestamps.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {activeFilters > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setFilterStatus('ALL'); setFilterDept('ALL') }}
                            className="text-xs text-muted-foreground"
                        >
                            Clear filters
                        </Button>
                    )}
                    <span className="text-sm text-muted-foreground font-medium">
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            {/* Filters Row */}
            <div className="space-y-3">
                {/* Status Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Status:</span>
                    {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as FilterStatus[]).map((s) => {
                        const config = s === 'ALL' ? null : TASK_STATUS_CONFIG[s]
                        const isActive = filterStatus === s
                        return (
                            <button
                                key={s}
                                onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${isActive
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                                    }`}
                            >
                                {s === 'ALL' ? 'All' : config?.label}
                                {s !== 'ALL' && filterStatus === 'ALL' && statusCounts[s] ? ` (${statusCounts[s]})` : ''}
                            </button>
                        )
                    })}
                </div>

                {/* Department Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Dept:</span>
                    <button
                        onClick={() => setFilterDept('ALL')}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${filterDept === 'ALL'
                                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted'
                            }`}
                    >
                        All
                    </button>
                    {DEPARTMENTS.map((dept) => {
                        const config = DEPARTMENT_CONFIG[dept]
                        const isActive = filterDept === dept
                        return (
                            <button
                                key={dept}
                                onClick={() => setFilterDept(dept)}
                                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all border ${isActive
                                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                                        : `${config?.color || 'bg-muted/50 text-muted-foreground'} border-transparent hover:opacity-80`
                                    }`}
                            >
                                {config?.label || dept}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg text-sm">
                    <strong>Error:</strong> {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            )}

            {/* Empty State */}
            {!loading && tasks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="bg-muted rounded-full p-4 mb-4">
                        <Inbox className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">No tasks found</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                        {activeFilters > 0
                            ? "Try changing your filters to see more tasks."
                            : "No tasks have been created yet. Run the seed SQL to populate sample data."}
                    </p>
                </div>
            )}

            {/* Task List */}
            {!loading && tasks.length > 0 && (
                <div className="grid gap-3">
                    {tasks.map((task) => (
                        <TaskCard key={task.id} task={task} onComplete={fetchTasks} />
                    ))}
                </div>
            )}
        </div>
    )
}
