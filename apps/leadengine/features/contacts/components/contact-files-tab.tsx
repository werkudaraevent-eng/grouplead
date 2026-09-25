"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import {
    Upload, Loader2, FileText, FileSpreadsheet, FileImage, File,
    Download, Trash2,
} from "@/components/icons"
import { formatDistanceToNow } from "date-fns"

interface ContactAttachmentRow {
    id: string
    contact_id: string
    storage_path: string
    file_name: string
    file_size_bytes: number
    mime_type: string | null
    description: string | null
    uploaded_by: string | null
    uploaded_by_name: string | null
    created_at: string
}

interface ContactFilesTabProps {
    contactId: string
    /** The id of the section's heading, which the record page's section is labelled by. */
    headingId?: string
    /** Told how many files there are, for the page's rail and chips. */
    onCountChange?: (count: number) => void
}

const BUCKET = "contact_attachments"
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/**
 * The contact's files, as a section of its record page: the heading with
 * Upload at its trailing edge, then one card that is the list and the drop
 * zone. A file opens (downloads) from its name; Download and Delete sit at
 * the row's end, on hover or focus with a pointer and always to a finger.
 */
export function ContactFilesTab({ contactId, headingId, onCountChange }: ContactFilesTabProps) {
    const supabase = createClient()
    const inputRef = useRef<HTMLInputElement>(null)

    const [files, setFiles] = useState<ContactAttachmentRow[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<ContactAttachmentRow | null>(null)
    const [deleting, setDeleting] = useState(false)

    const fetchFiles = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("contact_attachments")
            .select("*")
            .eq("contact_id", contactId)
            .order("created_at", { ascending: false })
        if (error) {
            console.error("[ContactFilesTab] fetch error:", error.message)
        } else {
            setFiles(data ?? [])
            onCountChange?.((data ?? []).length)
        }
        setLoading(false)
    }, [contactId, supabase, onCountChange])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchFiles()
    }, [fetchFiles])

    const uploadOne = useCallback(
        async (file: File): Promise<boolean> => {
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast.error(`"${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB limit`)
                return false
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("You must be signed in to upload files")
                return false
            }

            // Path: {contactId}/{uuid}-{safeName}
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
            const path = `${contactId}/${crypto.randomUUID()}-${safeName}`

            const { error: uploadErr } = await supabase.storage
                .from(BUCKET)
                .upload(path, file, {
                    contentType: file.type || "application/octet-stream",
                    cacheControl: "3600",
                    upsert: false,
                })
            if (uploadErr) {
                toast.error(`Upload failed: ${uploadErr.message}`)
                return false
            }

            // Resolve uploader display name (best effort).
            let uploaderName: string | null = null
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .single()
            if (profile?.full_name) uploaderName = profile.full_name

            const { error: rowErr } = await supabase.from("contact_attachments").insert({
                contact_id: contactId,
                storage_path: path,
                file_name: file.name,
                file_size_bytes: file.size,
                mime_type: file.type || null,
                uploaded_by: user.id,
                uploaded_by_name: uploaderName,
            })
            if (rowErr) {
                // Roll back the storage object if metadata insert failed —
                // otherwise we leak orphan blobs in the bucket.
                await supabase.storage.from(BUCKET).remove([path])
                toast.error(`Save metadata failed: ${rowErr.message}`)
                return false
            }

            // Best-effort timeline entry so the activity feed stays in sync.
            await supabase.from("contact_activities").insert({
                contact_id: contactId,
                user_id: user.id,
                action_type: "File Uploaded",
                description: `Uploaded file "${file.name}"`,
            })

            return true
        },
        [contactId, supabase],
    )

    const handleFiles = useCallback(
        async (fileList: FileList | File[]) => {
            const arr = Array.from(fileList)
            if (arr.length === 0) return
            setUploading(true)
            let successCount = 0
            for (const f of arr) {
                const ok = await uploadOne(f)
                if (ok) successCount++
            }
            if (successCount > 0) {
                toast.success(
                    successCount === 1
                        ? `Uploaded "${arr[0]?.name}"`
                        : `Uploaded ${successCount} file(s)`,
                )
                await fetchFiles()
            }
            setUploading(false)
        },
        [uploadOne, fetchFiles],
    )

    const handleDelete = useCallback(
        async (file: ContactAttachmentRow) => {
            setDeleting(true)
            const { error: storageErr } = await supabase.storage
                .from(BUCKET)
                .remove([file.storage_path])
            if (storageErr) {
                console.warn("[ContactFilesTab] storage delete error:", storageErr.message)
            }

            const { error: rowErr } = await supabase
                .from("contact_attachments")
                .delete()
                .eq("id", file.id)
            if (rowErr) {
                toast.error(`Delete failed: ${rowErr.message}`)
                setDeleting(false)
                return
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase.from("contact_activities").insert({
                    contact_id: contactId,
                    user_id: user.id,
                    action_type: "File Deleted",
                    description: `Deleted file "${file.file_name}"`,
                })
            }

            toast.success(`Deleted "${file.file_name}"`)
            setPendingDelete(null)
            setDeleting(false)
            await fetchFiles()
        },
        [contactId, supabase, fetchFiles],
    )

    const handleDownload = useCallback(
        async (file: ContactAttachmentRow) => {
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(file.storage_path)
            if (!data?.publicUrl) {
                toast.error("Could not resolve file URL")
                return
            }
            const a = document.createElement("a")
            a.href = data.publicUrl
            a.target = "_blank"
            a.rel = "noopener noreferrer"
            a.download = file.file_name
            document.body.appendChild(a)
            a.click()
            a.remove()
        },
        [supabase],
    )

    return (
        <>
            <div className="mb-3 flex min-h-9 items-center justify-between gap-3">
                <h2 id={headingId} className="text-base font-semibold text-foreground">Files</h2>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="h-9 gap-1.5 max-md:h-10"
                >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) handleFiles(e.target.files)
                        if (inputRef.current) inputRef.current.value = ""
                    }}
                />
            </div>

            {/* Drop zone — wraps both the empty state and the file list. */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
                }}
                className={`overflow-hidden rounded-xl border bg-card transition-colors ${dragOver ? "border-primary bg-primary/5" : ""}`}
            >
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading files…
                    </div>
                ) : files.length === 0 ? (
                    <div className="px-4 py-6 sm:px-5">
                        <p className="text-sm text-muted-foreground">
                            {dragOver ? "Drop the files here." : <>No files yet. Drop files here or use <span className="font-medium text-foreground">Upload</span> to attach business cards, ID scans and other documents (up to {MAX_FILE_SIZE_MB} MB each).</>}
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y">
                        {files.map((f) => (
                            <li key={f.id} className="group/file flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60 sm:px-5">
                                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                                    <FileIcon mime={f.mime_type} className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(f)}
                                        className="block w-full truncate text-left text-sm font-medium text-foreground hover:text-primary"
                                        title={f.file_name}
                                    >
                                        {f.file_name}
                                    </button>
                                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                        {formatBytes(f.file_size_bytes)} · {f.uploaded_by_name ?? "Unknown"} ·{" "}
                                        {(() => {
                                            try {
                                                return formatDistanceToNow(new Date(f.created_at), { addSuffix: true })
                                            } catch {
                                                return new Date(f.created_at).toLocaleDateString()
                                            }
                                        })()}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/file:opacity-100 group-focus-within/file:opacity-100 pointer-coarse:opacity-100">
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => handleDownload(f)}
                                        className="text-muted-foreground hover:text-primary pointer-coarse:size-10"
                                        aria-label={`Download ${f.file_name}`}
                                    >
                                        <Download className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => setPendingDelete(f)}
                                        className="text-muted-foreground hover:text-destructive pointer-coarse:size-10"
                                        aria-label={`Delete ${f.file_name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Delete confirmation */}
            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete
                                ? <><span className="font-medium text-foreground">{pendingDelete.file_name}</span> will be permanently removed from this contact. This cannot be undone.</>
                                : null}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(e) => {
                                e.preventDefault()
                                if (pendingDelete) handleDelete(pendingDelete)
                            }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleting ? (
                                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Deleting…</>
                            ) : (
                                "Delete"
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function FileIcon({ mime, className }: { mime: string | null; className?: string }) {
    if (!mime) return <File className={className} />
    if (mime.startsWith("image/")) return <FileImage className={className} />
    if (mime.includes("pdf")) return <FileText className={className} />
    if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv"))
        return <FileSpreadsheet className={className} />
    if (mime.includes("word") || mime.includes("document") || mime.startsWith("text/"))
        return <FileText className={className} />
    return <File className={className} />
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    let i = 0
    let value = bytes
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024
        i++
    }
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}
