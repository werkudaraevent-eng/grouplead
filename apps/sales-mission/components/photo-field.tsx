"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, Camera, Loader2, Upload, X } from "@/components/icons"
import { createClient } from "@/utils/supabase/client"
import { preparePhotoUpload, removePhoto, signPhotos } from "@/app/actions/photo-actions"
import { PHOTO_BUCKET, PHOTO_MAX_BYTES, PHOTO_MAX_FILES, fitWithin, type PhotoAnswer } from "@/lib/photos/photo-answer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * A photo field: take or pick pictures, see them as thumbnails, remove one.
 *
 * The shape field-service apps settled on (Jobber, Zoho FSM): camera first
 * on a phone, the gallery a step away, a thumbnail per photo with its own
 * remove control, one progress bar per upload. Material has no upload
 * component; this is its parts: an outlined button with an icon to start,
 * a linear progress indicator while it runs, supporting text for errors,
 * 48dp targets, and drag-and-drop only as an extra on desktop.
 *
 * Photos are downscaled on the device before upload, since a phone camera
 * produces 5 to 10 MB a frame and a report needs none of that.
 *
 * Controlled with value/onChange, or uncontrolled with name: then the
 * current list rides on a hidden input as JSON, for forms that post.
 */

type Item = PhotoAnswer & { preview?: string }

interface Pending {
  id: string
  name: string
  progress: number
  error?: string
}

export function PhotoField({
  id,
  name,
  scope,
  value,
  defaultValue,
  onChange,
  max = PHOTO_MAX_FILES,
  disabled,
  hint,
}: {
  id: string
  /** Form field name for uncontrolled use: the list is posted as JSON under it. */
  name?: string
  /** Folder inside the company's space: a mission id, "missions", "prospects". */
  scope: string
  value?: PhotoAnswer[]
  defaultValue?: PhotoAnswer[]
  onChange?: (next: PhotoAnswer[]) => void
  max?: number
  disabled?: boolean
  hint?: string
}) {
  const [items, setItems] = useState<Item[]>(() => value ?? defaultValue ?? [])
  const [pending, setPending] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const controlled = value !== undefined

  // Controlled: the parent's list is the truth; keep previews we already have.
  useEffect(() => {
    if (!controlled) return
    setItems((current) => (value ?? []).map((photo) => ({ ...photo, preview: current.find((item) => item.path === photo.path)?.preview })))
  }, [value, controlled])

  // Existing photos need a signed URL to show; new ones keep their local preview.
  useEffect(() => {
    const missing = items.filter((item) => !item.preview).map((item) => item.path)
    if (missing.length === 0) return
    let cancelled = false
    signPhotos(missing).then((urls) => {
      if (cancelled) return
      setItems((current) => current.map((item) => (item.preview || !urls[item.path] ? item : { ...item, preview: urls[item.path] })))
    })
    return () => { cancelled = true }
  }, [items])

  const commit = (next: Item[]) => {
    setItems(next)
    onChange?.(next.map(({ preview: _preview, ...photo }) => photo))
  }

  const addFiles = async (files: FileList | File[]) => {
    setError(null)
    const list = Array.from(files).filter((file) => file.type.startsWith("image/"))
    if (list.length === 0) { setError("Pilih berkas gambar."); return }
    const room = max - items.length - pending.length
    if (room <= 0) { setError(`Maksimal ${max} foto.`); return }
    for (const file of list.slice(0, room)) void uploadOne(file)
    if (list.length > room) setError(`Hanya ${room} foto lagi yang muat; sisanya dilewati.`)
  }

  const uploadOne = async (file: File) => {
    const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setPending((list) => [...list, { id: pendingId, name: file.name, progress: 10 }])
    const fail = (message: string) => setPending((list) => list.map((item) => (item.id === pendingId ? { ...item, error: message } : item)))
    try {
      const shrunk = await downscale(file)
      if (shrunk.blob.size > PHOTO_MAX_BYTES) { fail("Foto masih lebih dari 10 MB setelah diperkecil."); return }
      setPending((list) => list.map((item) => (item.id === pendingId ? { ...item, progress: 35 } : item)))

      const prepared = await preparePhotoUpload({ scope, size: shrunk.blob.size, type: shrunk.blob.type })
      if (!prepared.success || !prepared.data) { fail(prepared.error ?? "Tidak bisa menyiapkan unggahan."); return }
      setPending((list) => list.map((item) => (item.id === pendingId ? { ...item, progress: 55 } : item)))

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from(PHOTO_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, shrunk.blob, { contentType: shrunk.blob.type, upsert: false })
      if (uploadError) { fail("Unggahan gagal. Periksa koneksi lalu coba lagi."); return }

      const photo: Item = {
        path: prepared.data.path,
        name: file.name.slice(0, 200),
        size: shrunk.blob.size,
        width: shrunk.width,
        height: shrunk.height,
        preview: URL.createObjectURL(shrunk.blob),
      }
      setPending((list) => list.filter((item) => item.id !== pendingId))
      setItems((current) => {
        const next = [...current, photo]
        onChange?.(next.map(({ preview: _preview, ...rest }) => rest))
        return next
      })
    } catch {
      fail("Foto tidak bisa dibaca.")
    }
  }

  const remove = async (path: string) => {
    commit(items.filter((item) => item.path !== path))
    // The file goes too; a failed remove leaves an orphan, never a broken answer.
    void removePhoto(path)
  }

  const full = items.length + pending.length >= max
  const busy = disabled || full

  return (
    <div
      className={cn("space-y-3", dragging && "rounded-lg ring-2 ring-primary/40")}
      onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); if (!busy) void addFiles(event.dataTransfer.files) }}
    >
      {name && <input type="hidden" name={name} value={JSON.stringify(items.map(({ preview: _preview, ...photo }) => photo))} />}

      {(items.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {items.map((item) => (
            <li key={item.path} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
              {item.preview ? (
                <a href={item.preview} target="_blank" rel="noopener noreferrer" className="block h-full w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.preview} alt={item.name} className="h-full w-full object-cover" />
                </a>
              ) : (
                <div className="grid h-full w-full place-items-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
              )}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`Hapus ${item.name}`}
                  onClick={() => remove(item.path)}
                  className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-sm hover:bg-background"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
          {pending.map((item) => (
            <li key={item.id} className="relative flex aspect-square flex-col justify-end overflow-hidden rounded-lg border border-dashed bg-muted/50 p-2">
              {item.error ? (
                <>
                  <p className="flex items-start gap-1 text-xs text-[var(--danger-foreground)]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {item.error}</p>
                  <button type="button" className="mt-1 text-xs font-medium text-foreground underline" onClick={() => setPending((list) => list.filter((entry) => entry.id !== item.id))}>Tutup</button>
                </>
              ) : (
                <>
                  <p className="truncate text-xs text-muted-foreground">{item.name}</p>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                  </div>
                  <span className="sr-only" role="status">Mengunggah {item.name}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <input ref={cameraRef} id={id} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = "" }} />
      <input ref={galleryRef} type="file" accept="image/*" multiple className="sr-only" aria-label="Pilih dari galeri" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = "" }} />

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="h-12 sm:h-11" disabled={busy} onClick={() => cameraRef.current?.click()}>
          <Camera className="h-4 w-4" /> Ambil foto
        </Button>
        <Button type="button" variant="outline" className="h-12 sm:h-11" disabled={busy} onClick={() => galleryRef.current?.click()}>
          <Upload className="h-4 w-4" /> Pilih dari galeri
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {error ? <span className="text-[var(--danger-foreground)]">{error}</span> : hint ?? `Maksimal ${max} foto. Diperkecil otomatis sebelum diunggah.`}
      </p>
    </div>
  )
}

/** Shrink on the device: longest edge to the cap, JPEG. Falls back to the original when the browser cannot decode it. */
async function downscale(file: File): Promise<{ blob: Blob; width?: number; height?: number }> {
  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = fitWithin(bitmap.width, bitmap.height)
    if (width === bitmap.width && height === bitmap.height && file.size <= PHOTO_MAX_BYTES && file.type === "image/jpeg") {
      bitmap.close()
      return { blob: file, width, height }
    }
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("no canvas")
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85))
    if (!blob) throw new Error("no blob")
    return { blob, width, height }
  } catch {
    return { blob: file }
  }
}
