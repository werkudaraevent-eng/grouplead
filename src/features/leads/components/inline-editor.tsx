"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import {
    Pencil, Check, X, Loader2, Plus,
    Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
    Heading2, Undo2, Redo2, Link2
} from "lucide-react"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import UnderlineExt from "@tiptap/extension-underline"
import LinkExt from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"

// ─── Toolbar Button ──────────────────────────────────────────────
function ToolbarBtn({
    onClick,
    active,
    disabled,
    children,
    title,
}: {
    onClick: () => void
    active?: boolean
    disabled?: boolean
    children: React.ReactNode
    title: string
}) {
    return (
        <button
            type="button"
            onMouseDown={(e) => {
                e.preventDefault() // keep focus in editor
                onClick()
            }}
            disabled={disabled}
            title={title}
            className={`
                w-7 h-7 flex items-center justify-center rounded-md text-slate-500 transition-all
                ${active ? 'bg-blue-100 text-blue-700 shadow-sm' : 'hover:bg-slate-100 hover:text-slate-700'}
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}
            `}
        >
            {children}
        </button>
    )
}

// ─── Toolbar ─────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: Editor }) {
    const setLink = useCallback(() => {
        const prev = editor.getAttributes('link').href
        const url = window.prompt('URL', prev ?? 'https://')
        if (url === null) return
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
        }
    }, [editor])

    return (
        <div className="flex items-center gap-0.5 px-3 py-2 border-b border-slate-150 bg-slate-50/80 rounded-t-lg flex-wrap">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
                <Bold className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
                <Italic className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)">
                <UnderlineIcon className="h-3.5 w-3.5" />
            </ToolbarBtn>

            <div className="w-px h-4 bg-slate-200 mx-1" />

            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading">
                <Heading2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List">
                <List className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered List">
                <ListOrdered className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={setLink} active={editor.isActive('link')} title="Add Link">
                <Link2 className="h-3.5 w-3.5" />
            </ToolbarBtn>

            <div className="w-px h-4 bg-slate-200 mx-1" />

            <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)">
                <Undo2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)">
                <Redo2 className="h-3.5 w-3.5" />
            </ToolbarBtn>
        </div>
    )
}

// ─── Props ────────────────────────────────────────────────────────
interface InlineEditorProps {
    leadId: number
    fieldPath: string
    initialValue: string | null | undefined
    label: string
    placeholder?: string
    emptyTitle?: string
    emptyDescription?: string
}

// ─── Main Component ──────────────────────────────────────────────
// Helper: detect plain text and wrap into <p> tags for Tiptap compatibility
function toHtml(raw: string | null | undefined): string {
    if (!raw) return ""
    const trimmed = raw.trim()
    if (!trimmed) return ""
    // Already HTML? (contains any tag)
    if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed
    // Plain text → wrap each line in <p>
    return trimmed
        .split(/\n/)
        .map(line => `<p>${line || '<br>'}</p>`)
        .join('')
}

function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').trim()
}

export function InlineEditor({
    leadId,
    fieldPath,
    initialValue,
    label,
    placeholder = "Click to add details...",
    emptyTitle,
    emptyDescription,
}: InlineEditorProps) {
    const supabase = createClient()
    const router = useRouter()
    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    const htmlValue = toHtml(initialValue)
    const editorContentRef = useRef<string>(htmlValue)

    // Track server value changes
    const [lastKnown, setLastKnown] = useState(initialValue || "")
    useEffect(() => {
        if ((initialValue || "") !== lastKnown) {
            setLastKnown(initialValue || "")
            editorContentRef.current = toHtml(initialValue)
        }
    }, [initialValue, lastKnown])

    const hasValue = Boolean(stripHtml(htmlValue))

    // ── SAVE ──────────────────────────────────────────────
    const handleSave = async () => {
        const html = editorContentRef.current
        // Normalize: if <p></p> or empty tags only, treat as null
        const stripped = html.replace(/<[^>]*>/g, '').trim()
        const saveValue = stripped ? html : null

        if (saveValue === (initialValue || null)) {
            setIsEditing(false)
            return
        }
        setIsSaving(true)
        try {
            const updatePayload = { [fieldPath]: saveValue }
            const { error: updateError } = await supabase
                .from("leads")
                .update(updatePayload)
                .eq("id", leadId)
                .select()
                .single()

            if (updateError) throw updateError

            // Audit trail (non-blocking)
            const oldSnippet = (initialValue || "").replace(/<[^>]*>/g, '').slice(0, 120)
            const newSnippet = (saveValue || "").replace(/<[^>]*>/g, '').slice(0, 120)
            const { data: { user } } = await supabase.auth.getUser()

            supabase
                .from("lead_activities")
                .insert({
                    lead_id: leadId,
                    user_id: user?.id || null,
                    action_type: "field_update",
                    field_name: fieldPath,
                    description: `Updated ${label}`,
                    old_value: oldSnippet || null,
                    new_value: newSnippet || null,
                })
                .then(({ error: logError }) => {
                    if (logError) console.error("Audit log failed:", logError)
                })

            toast.success(`${label} saved`)
            setIsEditing(false)
            router.refresh()
        } catch (err) {
            toast.error(`Save failed: ${err instanceof Error ? err.message : "Unknown error"}`)
        } finally {
            setIsSaving(false)
        }
    }

    const handleCancel = () => {
        editorContentRef.current = initialValue || ""
        setIsEditing(false)
    }

    // ── EDIT MODE ─────────────────────────────────────────────
    if (isEditing) {
        return (
            <TiptapEditMode
                initialValue={htmlValue}
                placeholder={placeholder}
                isSaving={isSaving}
                onContentChange={(html) => { editorContentRef.current = html }}
                onSave={handleSave}
                onCancel={handleCancel}
            />
        )
    }

    // ── READ MODE ─────────────────────────────────────────────
    return (
        <div className="group relative">
            {hasValue ? (
                <>
                    {/* Edit button — only way to enter edit mode */}
                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                            onClick={() => setIsEditing(true)}
                            className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 bg-white border border-slate-200 rounded-md px-2.5 py-1 font-medium shadow-sm hover:text-blue-600 hover:border-blue-300 transition-colors cursor-pointer"
                        >
                            <Pencil className="h-3 w-3" /> Edit
                        </button>
                    </div>
                    {/* Rendered HTML content — fully selectable, NOT clickable to edit */}
                    <div
                        className="tiptap-readonly text-[13.5px] text-slate-600 leading-[1.75] pr-14 select-text"
                        dangerouslySetInnerHTML={{ __html: htmlValue }}
                    />
                </>
            ) : (
                <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-4 py-5 px-4 rounded-lg border border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/30 transition-all w-full text-left cursor-pointer group/empty"
                >
                    <div className="w-10 h-10 bg-slate-50 rounded-full border border-dashed border-slate-300 flex items-center justify-center shrink-0 text-slate-400 group-hover/empty:border-blue-400 group-hover/empty:text-blue-500 group-hover/empty:bg-blue-50 transition-colors">
                        <Plus className="h-4 w-4" />
                    </div>
                    <div>
                        <span className="font-medium text-[13px] text-slate-600 group-hover/empty:text-blue-600 transition-colors">
                            {emptyTitle || "Click to add"}
                        </span>
                        {emptyDescription && (
                            <p className="text-[12px] text-slate-400 mt-0.5">{emptyDescription}</p>
                        )}
                    </div>
                </button>
            )}
        </div>
    )
}


// ─── Tiptap Edit Mode (separate component for clean hook lifecycle) ──
function TiptapEditMode({
    initialValue,
    placeholder,
    isSaving,
    onContentChange,
    onSave,
    onCancel,
}: {
    initialValue: string
    placeholder: string
    isSaving: boolean
    onContentChange: (html: string) => void
    onSave: () => void
    onCancel: () => void
}) {
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
            }),
            UnderlineExt,
            LinkExt.configure({
                openOnClick: false,
                HTMLAttributes: { class: 'text-blue-600 underline cursor-pointer' },
            }),
            Placeholder.configure({ placeholder }),
        ],
        content: initialValue,
        editorProps: {
            attributes: {
                class: 'tiptap-editor outline-none min-h-[160px] px-4 py-3 text-[13.5px] leading-[1.75] text-slate-700 prose prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-semibold prose-headings:text-base prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5',
            },
            handleKeyDown: (_view, event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    event.preventDefault()
                    onSave()
                    return true
                }
                if (event.key === 'Escape') {
                    event.preventDefault()
                    onCancel()
                    return true
                }
                return false
            },
        },
        onUpdate: ({ editor: ed }) => {
            onContentChange(ed.getHTML())
        },
        autofocus: 'end',
    })

    // Cleanup
    useEffect(() => {
        return () => { editor?.destroy() }
    }, [editor])

    if (!editor) return null

    return (
        <div className="animate-in fade-in duration-200 rounded-lg border border-blue-200 shadow-sm overflow-hidden bg-white">
            <EditorToolbar editor={editor} />
            <EditorContent editor={editor} />
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-100 bg-slate-50/60">
                <p className="text-[10px] text-slate-400 select-none">
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Ctrl+Enter</kbd>{" "}save
                    {" · "}
                    <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-mono">Esc</kbd>{" "}cancel
                </p>
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2.5 text-slate-500 hover:text-slate-700"
                        onClick={onCancel}
                        disabled={isSaving}
                    >
                        <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button
                        size="sm"
                        className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        onClick={onSave}
                        disabled={isSaving}
                    >
                        {isSaving
                            ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            : <Check className="h-3 w-3 mr-1" />
                        }
                        Save
                    </Button>
                </div>
            </div>
        </div>
    )
}
