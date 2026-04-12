"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import {
    Loader2, ArrowRightLeft, FileText,   
    Mail, Calendar, Plus, Sparkles, Trash2, Edit3,
    Paperclip, Clock
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

interface ActivityProfile {
    full_name: string | null
    avatar_url: string | null
}

interface Activity {
    id: string
    client_company_id: string
    user_id: string | null
    action_type: string
    description: string
    created_at: string
    profile: ActivityProfile | null
    attachment_name?: string | null
    attachment_url?: string | null
}

interface TimelineTabProps {
    companyId: string
}

type EventCategory = "stage" | "note" | "email" | "meeting" | "task" | "create" | "update" | "delete" | "other"

interface EventConfig {
    icon: typeof ArrowRightLeft
    label: string
    nodeBg: string
    nodeText: string
}

const EVENT_CONFIG: Record<EventCategory, EventConfig> = {
    stage:   { icon: ArrowRightLeft, label: "Stage Change",   nodeBg: "bg-amber-50",   nodeText: "text-amber-600" },
    note:    { icon: FileText,       label: "Note Added",     nodeBg: "bg-blue-50",    nodeText: "text-blue-600" },
    email:   { icon: Mail,           label: "Email Sent",     nodeBg: "bg-violet-50",  nodeText: "text-violet-600" },
    meeting: { icon: Calendar,       label: "Meeting Logged", nodeBg: "bg-green-50",   nodeText: "text-green-600" },
    task:    { icon: Sparkles,       label: "Task Updated",   nodeBg: "bg-cyan-50",    nodeText: "text-cyan-600" },
    create:  { icon: Plus,           label: "Record Created", nodeBg: "bg-emerald-50", nodeText: "text-emerald-600" },
    update:  { icon: Edit3,          label: "Field Updated",  nodeBg: "bg-indigo-50",  nodeText: "text-indigo-600" },
    delete:  { icon: Trash2,         label: "Record Deleted", nodeBg: "bg-red-50",     nodeText: "text-red-600" },
    other:   { icon: Clock,          label: "Activity",       nodeBg: "bg-slate-100",  nodeText: "text-slate-500" },
}

function categorize(actionType: string): EventCategory {
    const t = actionType.toLowerCase()
    if (t.includes("stage"))   return "stage"
    if (t.includes("note"))    return "note"
    if (t.includes("email"))   return "email"
    if (t.includes("meeting")) return "meeting"
    if (t.includes("task"))    return "task"
    if (t.includes("create"))  return "create"
    if (t.includes("update"))  return "update"
    if (t.includes("delete"))  return "delete"
    return "other"
}

type FilterKey = "all" | "note" | "email" | "meeting" | "task"

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
    { key: "all",     label: "All Activity" },
    { key: "note",    label: "Notes" },
    { key: "email",   label: "Emails" },
    { key: "meeting", label: "Meetings" },
    { key: "task",    label: "Tasks" },
]

const LOG_ACTIVITY_TYPES = [
    { value: "Note",    label: "Note" },
    { value: "Email",   label: "Email" },
    { value: "Meeting", label: "Meeting" },
    { value: "Task",    label: "Task" },
]

function formatTimestamp(dateStr: string): string {
    const d = new Date(dateStr)
    return d.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatFullDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    })
}

function getInitials(name: string | null | undefined): string {
    if (!name) return "?"
    return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

export function TimelineTab({ companyId }: TimelineTabProps) {
    const supabase = createClient()
    const router = useRouter()
    const [activities, setActivities] = useState<Activity[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<FilterKey>("all")

    const [dialogOpen, setDialogOpen] = useState(false)
    const [logType, setLogType] = useState("Note")
    const [logDescription, setLogDescription] = useState("")
    const [logSaving, setLogSaving] = useState(false)

    const fetchActivities = useCallback(async () => {
        const { data, error } = await supabase
            .from("company_activities")
            .select("*, profile:profiles!company_activities_user_id_fkey(full_name, avatar_url)")
            .eq("client_company_id", companyId)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("[TimelineTab] Fetch error:", error.message)
        } else {
            console.log("Fetched company activities:", data)
            setActivities((data as Activity[]) ?? [])
        }
        setLoading(false)
    }, [companyId])

    useEffect(() => {
        fetchActivities()
    }, [fetchActivities])

    const filtered = useMemo(() => {
        if (filter === "all") return activities
        return activities.filter(a => categorize(a.action_type) === filter)
    }, [activities, filter])

    const handleLogActivity = async () => {
        if (!logDescription.trim()) {
            toast.error("Please enter a description.")
            return
        }

        setLogSaving(true)

        const { data: { user } } = await supabase.auth.getUser()

        const { error } = await supabase.from("company_activities").insert({
            client_company_id: companyId,
            user_id: user?.id ?? null,
            action_type: logType,
            description: logDescription.trim(),
        })

        if (error) {
            toast.error(`Failed to log activity: ${error.message}`)
        } else {
            toast.success("Activity logged")
            setLogDescription("")
            setLogType("Note")
            setDialogOpen(false)
            await fetchActivities()
            router.refresh()
        }
        setLogSaving(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading timeline…
            </div>
        )
    }

    return (
        <div className="flex flex-col">
            <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-1.5 flex-wrap">
                    {FILTER_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setFilter(opt.key)}
                            className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                                filter === opt.key
                                    ? "bg-slate-900 text-white shadow-sm"
                                    : "bg-transparent text-slate-500 hover:bg-slate-100"
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <button className="bg-slate-900 text-white rounded-md px-3 py-1.5 text-[12px] font-medium flex items-center gap-1.5 hover:bg-slate-800 transition-colors shadow-sm shrink-0">
                            <Plus className="h-3.5 w-3.5 mt-[-1px]" /> Log Activity
                        </button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                            <DialogTitle className="text-[15px] font-semibold text-slate-900">
                                Log Activity
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-4 pt-2">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Activity Type
                                </label>
                                <Select value={logType} onValueChange={setLogType}>
                                    <SelectTrigger className="h-9 text-[13px]">
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {LOG_ACTIVITY_TYPES.map(t => (
                                            <SelectItem key={t.value} value={t.value} className="text-[13px]">
                                                <div className="flex items-center gap-2">
                                                    {t.value === "Note" && <FileText className="h-3.5 w-3.5 text-blue-500" />}
                                                    {t.value === "Email" && <Mail className="h-3.5 w-3.5 text-violet-500" />}
                                                    {t.value === "Meeting" && <Calendar className="h-3.5 w-3.5 text-green-500" />}
                                                    {t.value === "Task" && <Sparkles className="h-3.5 w-3.5 text-cyan-500" />}
                                                    {t.label}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                                    Description
                                </label>
                                <Textarea
                                    value={logDescription}
                                    onChange={(e) => setLogDescription(e.target.value)}
                                    placeholder="Describe the activity..."
                                    className="min-h-[100px] resize-none text-[13px]"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                            e.preventDefault()
                                            handleLogActivity()
                                        }
                                    }}
                                />
                                <p className="text-[11px] text-slate-400">Press Ctrl+Enter to save</p>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDialogOpen(false)}
                                    disabled={logSaving}
                                    className="text-[12px] h-8"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleLogActivity}
                                    disabled={logSaving || !logDescription.trim()}
                                    className="text-[12px] bg-slate-900 hover:bg-slate-800 h-8"
                                >
                                    {logSaving ? (
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3 mr-1.5" />
                                    )}
                                    Save
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <Clock className="h-5 w-5 text-slate-400" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-slate-700 mb-1">
                        {filter === "all" ? "No activity recorded yet" : `No ${FILTER_OPTIONS.find(f => f.key === filter)?.label?.toLowerCase() ?? "events"} found`}
                    </h3>
                    <p className="text-[12px] text-slate-400 max-w-xs">
                        Notes, emails, and updates will appear here as they happen.
                    </p>
                </div>
            )}

            {filtered.length > 0 && (
                <div className="relative w-full pb-10">
                    <div className="absolute top-1 bottom-0 left-[15px] w-px bg-slate-200" />
                    {filtered.map((activity) => {
                        const cat = categorize(activity.action_type)
                        const config = EVENT_CONFIG[cat]
                        const Icon = config.icon

                        const userName = activity.profile?.full_name || "System"

                        return (
                            <div
                                key={activity.id}
                                className="relative flex gap-4 mb-4 group"
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 relative bg-[#f8fafc] border-[2px] border-[#f8fafc] mt-0.5">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${config.nodeBg} ${config.nodeText}`}>
                                        <Icon className="h-3 w-3" />
                                    </div>
                                </div>

                                <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                    <div className="p-3 px-4 flex flex-col gap-1.5">
                                        <div className="flex justify-between items-start mb-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.nodeText}`}>
                                                    {config.label}
                                                </span>
                                            </div>
                                            <span
                                                className="text-[11px] text-slate-400 shrink-0 ml-4 font-medium"
                                                title={formatFullDate(activity.created_at)}
                                                suppressHydrationWarning
                                            >
                                                {formatTimestamp(activity.created_at)}
                                            </span>
                                        </div>

                                        <p className="text-[13px] text-slate-700 leading-snug">
                                            {activity.description}
                                        </p>

                                        {activity.attachment_name && (
                                            <div className="mt-1.5 inline-flex items-center gap-1.5 border border-slate-200 rounded-md px-2.5 py-1 text-[12px] bg-slate-50 w-fit text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer">
                                                <Paperclip className="h-3 w-3 text-slate-400" />
                                                {activity.attachment_name}
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t border-dashed border-slate-100 px-4 py-2 flex items-center gap-2 bg-slate-50/50">
                                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500 shrink-0">
                                            {getInitials(userName)}
                                        </div>
                                        <span className="text-[11px] text-slate-500 font-medium tracking-tight">
                                            {userName}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
