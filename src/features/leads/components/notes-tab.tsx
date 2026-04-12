"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Loader2, Send } from "lucide-react"

interface Note {
    id: string
    lead_id: number
    user_id: string | null
    author_name: string | null
    content: string
    created_at: string
}

interface NotesTabProps {
    leadId: number | string
}

export function NotesTab({ leadId }: NotesTabProps) {
    const supabase = createClient()
    const router = useRouter()
    const [notes, setNotes] = useState<Note[]>([])
    const [loading, setLoading] = useState(true)
    const [newNote, setNewNote] = useState("")
    const [saving, setSaving] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const fetchNotes = useCallback(async () => {
        const { data, error } = await supabase
            .from("lead_notes")
            .select("*")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("[NotesTab] Fetch error:", error.message)
        } else {
            setNotes(data ?? [])
        }
        setLoading(false)
    }, [leadId])

    useEffect(() => {
        fetchNotes()
    }, [fetchNotes])

    const handleAddNote = async () => {
        if (!newNote.trim()) return
        setSaving(true)

        // Get current user for author attribution
        const { data: { user } } = await supabase.auth.getUser()
        let authorName = "User"
        if (user) {
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .single()
            if (profile?.full_name) authorName = profile.full_name
        }

        // Insert note
        const { error: noteError } = await supabase.from("lead_notes").insert({
            lead_id: Number(leadId),
            user_id: user?.id ?? null,
            author_name: authorName,
            content: newNote.trim(),
        })

        if (noteError) {
            toast.error(`Failed to save note: ${noteError.message}`)
            setSaving(false)
            return
        }

        // Also insert into lead_activities for the Timeline
        await supabase.from("lead_activities").insert({
            lead_id: Number(leadId),
            user_id: user?.id ?? null,
            action_type: "Note Added",
            description: `${authorName} added a note`,
        })

        toast.success("Note saved")
        setNewNote("")
        setSaving(false)
        fetchNotes()
        router.refresh()
    }

    const getInitials = (name: string | null) => {
        if (!name) return "U"
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading notes...
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-6 h-full">
            {/* ── Input Section ─────────────────────────────────── */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 shrink-0">
                <Textarea
                    placeholder="Add a note — meeting summary, call log, follow-up action..."
                    className="min-h-[80px] mb-3 bg-white border-slate-200 text-sm resize-none focus-visible:ring-1 focus-visible:ring-primary/30"
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault()
                            handleAddNote()
                        }
                    }}
                />
                <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                        Ctrl+Enter to save
                    </span>
                    <Button
                        size="sm"
                        onClick={handleAddNote}
                        disabled={!newNote.trim() || saving}
                        className="h-8"
                    >
                        {saving ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Save Note
                    </Button>
                </div>
            </div>

            {/* ── Notes List ────────────────────────────────────── */}
            <div ref={scrollRef} className="flex flex-col gap-5 flex-1 overflow-y-auto pr-1">
                {notes.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-sm text-muted-foreground">No notes yet.</p>
                        <p className="text-xs text-muted-foreground mt-1">Add your first note above.</p>
                    </div>
                )}
                {notes.map((note) => (
                    <div key={note.id} className="flex gap-3">
                        {/* Avatar */}
                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                            {getInitials(note.author_name)}
                        </div>
                        {/* Content */}
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-semibold text-slate-900">
                                    {note.author_name || "User"}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-slate-500">
                                    {new Date(note.created_at).toLocaleString("en-GB", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </span>
                            </div>
                            <div className="text-sm text-slate-700 whitespace-pre-wrap bg-white border border-slate-100 p-3 rounded-lg shadow-sm leading-relaxed">
                                {note.content}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
