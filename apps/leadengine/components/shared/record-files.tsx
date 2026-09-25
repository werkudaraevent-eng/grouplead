"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Download, File, FileImage, FileSpreadsheet, FileText, Loader2, Trash2, Upload } from "@/components/icons"
import { cn } from "@/lib/utils"
import { OUTLINED_BUTTON, RecordCard } from "./record-page"

/**
 * Where a record's files live: a contact's in the `contact_attachments`
 * table and bucket by `contact_id`, a company's in `company_attachments`
 * by `client_company_id`; each upload and delete also writes a row to the
 * record's timeline.
 */
const FILE_STORES = {
    contact: {
        table: "contact_attachments",
        bucket: "contact_attachments",
        foreignKey: "contact_id",
        activities: "contact_activities",
        noun: "contact",
        examples: "business cards, ID scans and other documents",
    },
    company: {
        table: "company_attachments",
        bucket: "company_attachments",
        foreignKey: "client_company_id",
        activities: "company_activities",
        noun: "company",
        examples: "contracts, proposals and supporting documents",
    },
} as const

interface AttachmentRow {
    id: string
    storage_path: string
    file_name: string
    file_size_bytes: number
    mime_type: string | null
    uploaded_by_name: string | null
    created_at: string
}

const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

/**
 * A record's Files tab: one card titled Files with Upload at its trailing
 * edge, whose list is also the drop zone. A file opens (downloads) from its
 * name; Download and Delete sit at the row's end, on hover or focus with a
 * pointer and always to a finger; Delete asks first.
 */
export function RecordFiles({ kind, recordId, onCountChange }: {
    kind: keyof typeof FILE_STORES
    recordId: string
    /** Told how many files there are, for the tab's count. */
    onCountChange?: (count: number) => void
}) {
    const store = FILE_STORES[kind]
    const router = useRouter()
    const inputRef = useRef<HTMLInputElement>(null)
    const [files, setFiles] = useState<AttachmentRow[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [dragOver, setDragOver] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<AttachmentRow | null>(null)
    const [deleting, setDeleting] = useState(false)

    const fetchFiles = useCallback(async () => {
        const { data, error } = await createClient()
            .from(store.table)
            .select("*")
            .eq(store.foreignKey, recordId)
            .order("created_at", { ascending: false })
        if (error) {
            toast.error("Could not load the files")
        } else {
            setFiles((data ?? []) as AttachmentRow[])
            onCountChange?.((data ?? []).length)
        }
        setLoading(false)
    }, [store.table, store.foreignKey, recordId, onCountChange])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchFiles()
    }, [fetchFiles])

    const logActivity = async (userId: string, actionType: string, description: string) => {
        // Best effort, so the Activity tab stays in step.
        await createClient().from(store.activities).insert({ [store.foreignKey]: recordId, user_id: userId, action_type: actionType, description })
    }

    const uploadOne = async (file: File): Promise<boolean> => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            toast.error(`"${file.name}" is larger than ${MAX_FILE_SIZE_MB} MB`)
            return false
        }
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            toast.error("You must be signed in to upload files")
            return false
        }
        // Path: {recordId}/{uuid}-{safeName}
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        const path = `${recordId}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from(store.bucket).upload(path, file, {
            contentType: file.type || "application/octet-stream",
            cacheControl: "3600",
            upsert: false,
        })
        if (uploadError) {
            toast.error(`Upload failed: ${uploadError.message}`)
            return false
        }
        const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single()
        const { error: rowError } = await supabase.from(store.table).insert({
            [store.foreignKey]: recordId,
            storage_path: path,
            file_name: file.name,
            file_size_bytes: file.size,
            mime_type: file.type || null,
            uploaded_by: user.id,
            uploaded_by_name: profile?.full_name ?? null,
        })
        if (rowError) {
            // Take the stored object back, or the bucket keeps an orphan.
            await supabase.storage.from(store.bucket).remove([path])
            toast.error(`Upload failed: ${rowError.message}`)
            return false
        }
        await logActivity(user.id, "File Uploaded", `Uploaded file "${file.name}"`)
        return true
    }

    const handleFiles = async (list: FileList | File[]) => {
        const chosen = Array.from(list)
        if (chosen.length === 0) return
        setUploading(true)
        let uploaded = 0
        for (const file of chosen) if (await uploadOne(file)) uploaded += 1
        if (uploaded > 0) {
            toast.success(uploaded === 1 ? `Uploaded "${chosen[0]?.name}"` : `Uploaded ${uploaded} files`)
            await fetchFiles()
            router.refresh()
        }
        setUploading(false)
    }

    const handleDelete = async (file: AttachmentRow) => {
        setDeleting(true)
        const supabase = createClient()
        await supabase.storage.from(store.bucket).remove([file.storage_path])
        const { error } = await supabase.from(store.table).delete().eq("id", file.id)
        if (error) {
            toast.error(`Delete failed: ${error.message}`)
            setDeleting(false)
            return
        }
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await logActivity(user.id, "File Deleted", `Deleted file "${file.file_name}"`)
        toast.success(`Deleted "${file.file_name}"`)
        setPendingDelete(null)
        setDeleting(false)
        await fetchFiles()
        router.refresh()
    }

    const handleDownload = (file: AttachmentRow) => {
        const { data } = createClient().storage.from(store.bucket).getPublicUrl(file.storage_path)
        if (!data?.publicUrl) {
            toast.error("Could not find the file")
            return
        }
        const link = document.createElement("a")
        link.href = data.publicUrl
        link.target = "_blank"
        link.rel = "noopener noreferrer"
        link.download = file.file_name
        document.body.appendChild(link)
        link.click()
        link.remove()
    }

    return (
        <>
            <RecordCard
                title="Files"
                headingId={`${kind}-files-heading`}
                action={
                    <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading} className={cn(OUTLINED_BUTTON, "-my-1.5 max-lg:h-10")}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                        Upload
                    </Button>
                }
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                        if (event.target.files) handleFiles(event.target.files)
                        if (inputRef.current) inputRef.current.value = ""
                    }}
                />
                <div
                    onDragOver={(event) => { event.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(event) => {
                        event.preventDefault()
                        setDragOver(false)
                        if (event.dataTransfer.files) handleFiles(event.dataTransfer.files)
                    }}
                    className={cn("transition-colors", dragOver && "bg-primary/5")}
                >
                    {loading ? (
                        <p className="flex items-center gap-2 px-4 py-5 text-[13px] text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading files…
                        </p>
                    ) : files.length === 0 ? (
                        <p className="px-4 py-5 text-[13px] text-muted-foreground">
                            {dragOver ? "Drop the files here." : <>No files yet. Drop files here or use <span className="font-medium text-foreground">Upload</span> to attach {store.examples} (up to {MAX_FILE_SIZE_MB} MB each).</>}
                        </p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {files.map((file) => (
                                <li key={file.id} className="group/file flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
                                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-muted text-muted-foreground">
                                        <FileIcon mime={file.mime_type} className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <button
                                            type="button"
                                            onClick={() => handleDownload(file)}
                                            className="block w-full truncate text-left text-sm font-semibold text-foreground outline-none hover:text-primary focus-visible:underline"
                                            title={file.file_name}
                                        >
                                            {file.file_name}
                                        </button>
                                        <p className="mt-0.5 truncate text-[13px] text-muted-foreground" suppressHydrationWarning>
                                            {formatBytes(file.file_size_bytes)} · {file.uploaded_by_name ?? "Unknown"} · {uploadedWhen(file.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover/file:opacity-100 group-focus-within/file:opacity-100 pointer-coarse:opacity-100">
                                        <Button size="icon-sm" variant="ghost" onClick={() => handleDownload(file)} className="text-muted-foreground hover:bg-muted hover:text-primary pointer-coarse:size-10" aria-label={`Download ${file.file_name}`}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon-sm" variant="ghost" onClick={() => setPendingDelete(file)} className="text-muted-foreground hover:bg-muted hover:text-destructive pointer-coarse:size-10" aria-label={`Delete ${file.file_name}`}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </RecordCard>

            <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDelete && <><span className="font-medium text-foreground">{pendingDelete.file_name}</span> will be removed from this {store.noun} for good. This can&apos;t be undone.</>}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            disabled={deleting}
                            onClick={(event) => { event.preventDefault(); if (pendingDelete) handleDelete(pendingDelete) }}
                            className="bg-destructive text-white hover:bg-destructive/90"
                        >
                            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function uploadedWhen(iso: string): string {
    const at = new Date(iso)
    if (Number.isNaN(at.getTime())) return ""
    return formatDistanceToNow(at, { addSuffix: true })
}

function FileIcon({ mime, className }: { mime: string | null; className?: string }) {
    if (!mime) return <File className={className} />
    if (mime.startsWith("image/")) return <FileImage className={className} />
    if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return <FileSpreadsheet className={className} />
    if (mime.includes("pdf") || mime.includes("word") || mime.includes("document") || mime.startsWith("text/")) return <FileText className={className} />
    return <File className={className} />
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
    const units = ["B", "KB", "MB", "GB"]
    let index = 0
    let value = bytes
    while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index += 1
    }
    return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}
