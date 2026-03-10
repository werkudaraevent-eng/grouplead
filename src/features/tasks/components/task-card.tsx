"use client"

import { useState } from "react"
import { LeadTask, TASK_STATUS_CONFIG, PRIORITY_CONFIG, DEPARTMENT_CONFIG } from "@/types/tasks"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, CheckCircle2, Clock, ArrowRight, Building2, User, FileText } from "lucide-react"
import { PermissionGate } from "@/features/users/components/permission-gate"

interface TaskCardProps {
    task: LeadTask
    onComplete?: () => void
}

export function TaskCard({ task, onComplete }: TaskCardProps) {
    const [isCompleting, setIsCompleting] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [notes, setNotes] = useState("")
    const [completedBy, setCompletedBy] = useState("")

    const supabase = createClient()

    const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG['PENDING']
    const priorityConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['MEDIUM']
    const deptConfig = DEPARTMENT_CONFIG[task.department] || { label: task.department, color: 'bg-gray-100 text-gray-700' }

    const lead = task.leads

    const handleComplete = async () => {
        setIsCompleting(true)
        try {
            const { error } = await supabase
                .from('lead_tasks')
                .update({
                    status: 'COMPLETED',
                    completed_at: new Date().toISOString(),
                    completed_by: completedBy || null,
                    notes: notes || null,
                })
                .eq('id', task.id)

            if (error) {
                console.error("Error completing task:", error)
                alert(`Error: ${error.message}`)
            } else {
                setDialogOpen(false)
                onComplete?.()
            }
        } finally {
            setIsCompleting(false)
        }
    }

    const handleStartProgress = async () => {
        const { error } = await supabase
            .from('lead_tasks')
            .update({ status: 'IN_PROGRESS' })
            .eq('id', task.id)

        if (!error) onComplete?.()
    }

    const isActionable = task.status === 'PENDING' || task.status === 'IN_PROGRESS'
    const daysSinceCreated = Math.floor((Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24))

    return (
        <>
            <div className={`group relative bg-card border rounded-xl p-5 transition-all duration-200 hover:shadow-lg hover:border-primary/30 ${task.status === 'COMPLETED' ? 'opacity-60' : ''}`}>
                {/* Top Row: Department + Priority + Status */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${deptConfig.color}`}>
                            {deptConfig.label}
                        </span>
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${priorityConfig.color}`}>
                            {priorityConfig.label}
                        </span>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusConfig.color}`}>
                        {statusConfig.label}
                    </span>
                </div>

                {/* Title */}
                <h3 className="font-semibold text-sm leading-tight mb-1.5 text-foreground">
                    {task.task_title}
                </h3>

                {/* Lead Info */}
                {lead && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {lead.company_name}
                        </span>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {lead.project_name}
                        </span>
                    </div>
                )}

                {/* Description */}
                {task.task_description && (
                    <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
                        {task.task_description}
                    </p>
                )}

                {/* Bottom Row: Meta + Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        {task.assigned_to && (
                            <span className="flex items-center gap-1">
                                <User className="h-3 w-3" /> {task.assigned_to}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {daysSinceCreated}d ago
                        </span>
                        {lead?.manual_id && (
                            <span className="font-mono text-muted-foreground/60">#{lead.manual_id}</span>
                        )}
                    </div>

                    {/* Action Buttons */}
                    {isActionable && (
                        <PermissionGate resource="lead_tasks" action="update">
                            <div className="flex items-center gap-1.5">
                                {task.status === 'PENDING' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleStartProgress}
                                        className="h-7 text-xs px-2.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                    >
                                        <ArrowRight className="h-3 w-3 mr-1" /> Start
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    onClick={() => setDialogOpen(true)}
                                    className="h-7 text-xs px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                    <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                                </Button>
                            </div>
                        </PermissionGate>
                    )}

                    {task.status === 'COMPLETED' && task.completed_at && (
                        <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            {new Date(task.completed_at).toLocaleDateString("en-GB", { day: 'numeric', month: 'short' })}
                        </span>
                    )}
                </div>
            </div>

            {/* Completion Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Complete Task</DialogTitle>
                        <DialogDescription>
                            Mark &quot;{task.task_title}&quot; as completed. This will automatically update the lead&apos;s SLA timestamp.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="completedBy">Completed By</Label>
                            <Input
                                id="completedBy"
                                placeholder="Your name"
                                value={completedBy}
                                onChange={(e) => setCompletedBy(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes (optional)</Label>
                            <Input
                                id="notes"
                                placeholder="Any notes about the completion..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleComplete}
                            disabled={isCompleting}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isCompleting ? (
                                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
                            ) : (
                                <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Complete</>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
