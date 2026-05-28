"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
    UploadCloud,
    Loader2,
    FileText,
    FileSpreadsheet,
    FileImage,
    File as FileIcon,
    Trash2,
    ExternalLink,
} from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { logFileUploadAction, logFileDeleteAction } from "@/app/actions/activity-log-actions"

const BUCKET = "lead_attachments"
const MAX_FILE_SIZE_MB = 25
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
const MAX_FILES = 10

const ALLOWED_EXTENSIONS = [
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "png",
    "jpg",
    "jpeg",
    "zip",
] as const

const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")

export interface UploadedAttachment {
    id: string
    storage_path: string
    file_name: string
    file_size_bytes: number
    mime_type: string | null
    created_at: string
    public_url: string
}

interface MultiFileUploaderProps {
    leadId: number | string
    /** Notifies parent whenever the attachment list changes. */
    onChange?: (files: UploadedAttachment[]) => void
    /** Notifies parent whenever an upload starts/finishes so it can disable submit. */
    onUploadingChange?: (uploading: boolean) => void
    /** Required label shown below dropzone. */
    helperText?: string
    /** Disabled state from parent (e.g. while saving the form). */
    disabled?: boolean
}

const formatBytes = (bytes: number) => {
    if (!bytes || bytes <= 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)))
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`
}

const isExtensionAllowed = (name: string) => {
    const dot = name.lastIndexOf(".")
    if (dot === -1) return false
    const ext = name.slice(dot + 1).toLowerCase()
    return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}

const iconForFile = (file: { mime_type: string | null; file_name: string }) => {
    const ext = file.file_name.split(".").pop()?.toLowerCase() ?? ""
    const mime = (file.mime_type ?? "").toLowerCase()
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
        return FileImage
    }
    if (
        mime.includes("pdf") ||
        mime.includes("word") ||
        mime.includes("text") ||
        ["pdf", "doc", "docx", "txt"].includes(ext)
    ) {
        return FileText
    }
    if (
        mime.includes("excel") ||
        mime.includes("spreadsheet") ||
        ["xls", "xlsx", "csv"].includes(ext)
    ) {
        return FileSpreadsheet
    }
    return FileIcon
}

/**
 * Reusable multi-file uploader that persists rows in `lead_attachments`
 * and storage in the `lead_attachments` bucket. Used by transition prompts
 * and any other surface that needs to attach files mid-flow.
 */
export function MultiFileUploader({
    leadId,
    onChange,
    onUploadingChange,
    helperText,
    disabled = false,
}: MultiFileUploaderProps) {
    const supabase = createClient()
    const inputRef = useRef<HTMLInputElement>(null)
    const [items, setItems] = useState<UploadedAttachment[]>([])
    const [uploading, setUploading] = useState(false)
    const [removingId, setRemovingId] = useState<string | null>(null)
    const [dragOver, setDragOver] = useState(false)

    useEffect(() => {
        onUploadingChange?.(uploading)
    }, [uploading, onUploadingChange])

    useEffect(() => {
        onChange?.(items)
    }, [items, onChange])

    const resolvePublicUrl = useCallback(
        (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl,
        [supabase],
    )

    const uploadOne = useCallback(
        async (file: File): Promise<UploadedAttachment | null> => {
            if (!isExtensionAllowed(file.name)) {
                toast.error(`"${file.name}" is not an allowed file type`)
                return null
            }
            if (file.size > MAX_FILE_SIZE_BYTES) {
                toast.error(`"${file.name}" exceeds ${MAX_FILE_SIZE_MB} MB limit`)
                return null
            }

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("You must be signed in to upload files")
                return null
            }

            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
            const path = `${leadId}/${crypto.randomUUID()}-${safeName}`

            const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file, {
                contentType: file.type || "application/octet-stream",
                cacheControl: "3600",
                upsert: false,
            })
            if (uploadErr) {
                toast.error(`Upload failed: ${uploadErr.message}`)
                return null
            }

            let uploaderName: string | null = null
            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", user.id)
                .single()
            if (profile?.full_name) uploaderName = profile.full_name

            const { data: row, error: rowErr } = await supabase
                .from("lead_attachments")
                .insert({
                    lead_id: Number(leadId),
                    storage_path: path,
                    file_name: file.name,
                    file_size_bytes: file.size,
                    mime_type: file.type || null,
                    uploaded_by: user.id,
                    uploaded_by_name: uploaderName,
                })
                .select("id, storage_path, file_name, file_size_bytes, mime_type, created_at")
                .single()

            if (rowErr || !row) {
                await supabase.storage.from(BUCKET).remove([path])
                toast.error(`Save metadata failed: ${rowErr?.message ?? "Unknown error"}`)
                return null
            }

            await logFileUploadAction(Number(leadId), file.name)

            return {
                ...row,
                public_url: resolvePublicUrl(row.storage_path),
            }
        },
        [leadId, resolvePublicUrl, supabase],
    )

    const handleFiles = useCallback(
        async (fileList: FileList | File[]) => {
            const arr = Array.from(fileList)
            if (arr.length === 0) return
            if (items.length + arr.length > MAX_FILES) {
                toast.error(`Maximum ${MAX_FILES} files per upload`)
                return
            }
            setUploading(true)
            const uploaded: UploadedAttachment[] = []
            for (const file of arr) {
                const result = await uploadOne(file)
                if (result) uploaded.push(result)
            }
            if (uploaded.length > 0) {
                setItems((prev) => [...prev, ...uploaded])
                toast.success(
                    uploaded.length === 1
                        ? `Uploaded "${uploaded[0].file_name}"`
                        : `Uploaded ${uploaded.length} files`,
                )
            }
            setUploading(false)
        },
        [items.length, uploadOne],
    )

    const handleRemove = useCallback(
        async (item: UploadedAttachment) => {
            setRemovingId(item.id)
            try {
                const { error: storageErr } = await supabase.storage
                    .from(BUCKET)
                    .remove([item.storage_path])
                if (storageErr) {
                    console.warn("[MultiFileUploader] storage delete error:", storageErr.message)
                }

                const { error: rowErr } = await supabase
                    .from("lead_attachments")
                    .delete()
                    .eq("id", item.id)
                if (rowErr) {
                    toast.error(`Delete failed: ${rowErr.message}`)
                    return
                }

                await logFileDeleteAction(Number(leadId), item.file_name)
                setItems((prev) => prev.filter((row) => row.id !== item.id))
                toast.success(`Removed "${item.file_name}"`)
            } finally {
                setRemovingId(null)
            }
        },
        [leadId, supabase],
    )

    const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        setDragOver(false)
        if (disabled || uploading) return
        if (event.dataTransfer?.files?.length) {
            void handleFiles(event.dataTransfer.files)
        }
    }

    return (
        <div className="space-y-2.5">
            <div
                role="button"
                tabIndex={0}
                onClick={() => !disabled && !uploading && inputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault()
                    if (!disabled && !uploading) setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`group relative flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 py-5 text-center transition-colors ${
                    dragOver
                        ? "border-blue-400 bg-blue-50/60"
                        : "border-slate-300 bg-slate-50 hover:border-slate-400"
                } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
                <Input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) {
                            void handleFiles(e.target.files)
                            if (inputRef.current) inputRef.current.value = ""
                        }
                    }}
                    disabled={disabled || uploading}
                />
                {uploading ? (
                    <div className="flex flex-col items-center text-slate-500">
                        <Loader2 className="h-5 w-5 animate-spin mb-1" />
                        <span className="text-xs font-medium">Uploading…</span>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-slate-500">
                        <UploadCloud className="h-5 w-5 text-slate-400 mb-1" />
                        <span className="text-xs font-medium text-blue-600">Click to browse or drop files here</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                            {helperText ?? `Up to ${MAX_FILES} files · ${MAX_FILE_SIZE_MB} MB each · ${ALLOWED_EXTENSIONS.join(", ")}`}
                        </span>
                    </div>
                )}
            </div>

            {items.length > 0 && (
                <ul className="space-y-1.5">
                    {items.map((item) => {
                        const Icon = iconForFile(item)
                        return (
                            <li
                                key={item.id}
                                className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                            >
                                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-medium text-slate-700 truncate" title={item.file_name}>
                                        {item.file_name}
                                    </p>
                                    <p className="text-[10.5px] text-slate-400">
                                        {formatBytes(item.file_size_bytes)}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                                    onClick={() =>
                                        window.open(item.public_url, "_blank", "noopener,noreferrer")
                                    }
                                    title="Open file"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                                    onClick={() => void handleRemove(item)}
                                    disabled={removingId === item.id || disabled}
                                    title="Remove"
                                >
                                    {removingId === item.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                    )}
                                </Button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
