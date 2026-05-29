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
    Download, Trash2, Folder,
} from "lucide-react"
import { useCurrency } from "@/contexts/currency-context"
import { formatDistanceToNow } from "date-fns"
import {
    logFileUploadAction,
    logFileDeleteAction,
} from "@/app/actions/activity-log-actions"

interface AttachmentRow {
    id: string
    lead_id: number
    storage_path: string
    file_name: string
    file_size_bytes: number
    mime_type: string | null
    description: string | null
    uploaded_by: string | null
    uploaded_by_name: string | null
    created_at: string
}

interface FilesTabProps {
    leadId: number | string
}

const BUCKET = "lead_attachments"
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

export function FilesTab({ leadId }: FilesTabProps) {
    // We import useCurrency only for downstream consistency (number formatter
    // shape). File-size formatting below is its own helper because byte-scale
    // formatting differs from money formatting.
    void useCurrency
    const supabase = createClient()
    const inputRef = useRef<HTMLInputElement>(null)

    const [files, setFiles] = useState<AttachmentRow[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    // Pending delete target. The AlertDialog opens when this is non-null.
    const [pendingDelete, setPendingDelete] = useState<AttachmentRow | null>(null)
    const [deleting, setDeleting] = useState(false)

    const fetchFiles = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("lead_attachments")
            .select("*")
            .eq("lead_id", Number(leadId))
            .order("created_at", { ascending: false })
        if (error) {
            console.error("[FilesTab] fetch error:", error.message)
        } else {
            setFiles(data ?? [])
        }
        setLoading(false)
    }, [leadId, supabase])

    useEffect(() => {
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

            // Path: {leadId}/{uuid}-{safeName}
            // crypto.randomUUID is widely available in modern browsers.
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
            const path = `${leadId}/${crypto.randomUUID()}-${safeName}`

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

            const { error: rowErr } = await supabase.from("lead_attachments").insert({
                lead_id: Number(leadId),
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

            // Dual-write activity (lead_activities + audit_logs) via server
            // action so the global /history page stays in sync.
            await logFileUploadAction(Number(leadId), file.name)

            return true
        },
        [leadId, supabase],
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
                        ? `Uploaded "${arr.find((_, i) => i < successCount)?.name}"`
                        : `Uploaded ${successCount} file(s)`,
                )
                await fetchFiles()
            }
            setUploading(false)
        },
        [uploadOne, fetchFiles],
    )

    const handleDelete = useCallback(
        async (file: AttachmentRow) => {
            setDeleting(true)
            const { error: storageErr } = await supabase.storage
                .from(BUCKET)
                .remove([file.storage_path])
            if (storageErr) {
                // We still attempt to delete the row so the UI doesn't get
                // stuck on a phantom file when the object was already gone.
                console.warn("[FilesTab] storage delete error:", storageErr.message)
            }

            const { error: rowErr } = await supabase
                .from("lead_attachments")
                .delete()
                .eq("id", file.id)
            if (rowErr) {
                toast.error(`Delete failed: ${rowErr.message}`)
                setDeleting(false)
                return
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Dual-write activity (lead_activities + audit_logs).
                await logFileDeleteAction(Number(leadId), file.file_name)
            }

            toast.success(`Deleted "${file.file_name}"`)
            setPendingDelete(null)
            setDeleting(false)
            await fetchFiles()
        },
        [leadId, supabase, fetchFiles],
    )

    const handleDownload = useCallback(
        async (file: AttachmentRow) => {
            // Bucket is public, so we can just resolve the public URL.
            // For tighter control we could switch to createSignedUrl().
            const { data } = supabase.storage.from(BUCKET).getPublicUrl(file.storage_path)
            if (!data?.publicUrl) {
                toast.error("Could not resolve file URL")
                return
            }
            // Open in a new tab and let the browser handle download.
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
        <div className="bg-white border border-slate-200/80 rounded-lg overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-[13px] text-slate-800 tracking-tight flex items-center gap-2">
                    <Folder className="w-4 h-4 text-slate-400" /> Files & Documents
                    {files.length > 0 && (
                        <span className="text-[11px] font-normal text-slate-400">({files.length})</span>
                    )}
                </h3>
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                    className="h-8 gap-1.5 text-xs"
                >
                    {uploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Upload className="h-3.5 w-3.5" />
                    )}
                    Upload
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) handleFiles(e.target.files)
                        // reset so picking the same file twice retriggers change
                        if (inputRef.current) inputRef.current.value = ""
                    }}
                />
            </div>

            {/* Drop zone — always present so the user can drag onto either
                the empty state or the file grid. */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault()
                    setDragOver(false)
                    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files)
                }}
                className={`transition-colors ${dragOver ? "bg-blue-50/60" : ""}`}
            >
                {loading ? (
                    <div className="flex items-center justify-center py-14 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-[13px]">Loading files…</span>
                    </div>
                ) : files.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                            <Upload className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-[13px] text-slate-500 font-medium mb-0.5">
                            {dragOver ? "Drop files here" : "No files attached"}
                        </p>
                        <p className="text-[12px] text-slate-400 max-w-xs">
                            Drag &amp; drop or click <span className="font-medium">Upload</span> to attach proposals,
                            contracts, and supporting documents (max {MAX_FILE_SIZE_MB} MB each).
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {files.map((f) => (
                            <li
                                key={f.id}
                                className="flex items-center gap-3 px-5 py-3 group hover:bg-slate-50/60 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                                    <FileIcon mime={f.mime_type} className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => handleDownload(f)}
                                        className="block text-left w-full truncate text-[13px] font-medium text-slate-800 hover:text-blue-700"
                                        title={f.file_name}
                                    >
                                        {f.file_name}
                                    </button>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                        <span>{formatBytes(f.file_size_bytes)}</span>
                                        <span>·</span>
                                        <span>
                                            {f.uploaded_by_name ?? "Unknown"} ·{" "}
                                            {(() => {
                                                try {
                                                    return formatDistanceToNow(new Date(f.created_at), { addSuffix: true })
                                                } catch {
                                                    return new Date(f.created_at).toLocaleDateString()
                                                }
                                            })()}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDownload(f)}
                                        className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600"
                                        title="Download"
                                    >
                                        <Download className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setPendingDelete(f)}
                                        className="h-7 w-7 p-0 text-slate-500 hover:text-red-600"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Delete confirmation — platform-styled, replaces window.confirm. */}
            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete
                                ? <><span className="font-medium text-slate-700">{pendingDelete.file_name}</span> will be permanently removed from this deal. This cannot be undone.</>
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
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        </div>
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
