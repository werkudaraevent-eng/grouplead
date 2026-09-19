"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, AudioFile, Loader2, Upload, X } from "@/components/icons"
import { createClient } from "@/utils/supabase/client"
import { prepareAudioUpload, removeAudio, signAudio } from "@/app/actions/audio-actions"
import { AUDIO_BUCKET, AUDIO_MAX_BYTES, AUDIO_MAX_FILES, WAV_MESSAGE, audioExtension, formatBytes, formatDuration, isWavFile, type AudioAnswer } from "@/lib/audio/audio-answer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * An audio field: attach a recording the phone already made, see it as a
 * row, play it back, remove it.
 *
 * The phone records, the app keeps: Safari on iOS stops the microphone
 * the moment the screen locks or a call comes in, so a recorder built into
 * the page would lose the meeting it was meant to keep. Memo Suara (and
 * any recorder app) survives all of that, and the share sheet already
 * knows how to hand a file to a web page. So this is the photo field's
 * shape with the camera left out: one outlined button that opens the
 * picker, a row per recording with its length and size and its own remove
 * control, a linear progress bar per upload that reports real bytes (a
 * 30 MB file on a mobile connection deserves more than a spinner), errors
 * as supporting text.
 *
 * Controlled with value/onChange, or uncontrolled with name: then the
 * current list rides on a hidden input as JSON, for forms that post.
 */

type Item = AudioAnswer & { url?: string }

interface Pending {
  id: string
  name: string
  size: number
  progress: number
  error?: string
  abort?: () => void
}

export function AudioField({
  id,
  name,
  scope,
  value,
  defaultValue,
  onChange,
  max = AUDIO_MAX_FILES,
  disabled,
  hint,
}: {
  id: string
  /** Form field name for uncontrolled use: the list is posted as JSON under it. */
  name?: string
  /** Folder inside the company's space: a mission id, "missions", "prospects". */
  scope: string
  value?: AudioAnswer[]
  defaultValue?: AudioAnswer[]
  onChange?: (next: AudioAnswer[]) => void
  max?: number
  disabled?: boolean
  hint?: string
}) {
  const [items, setItems] = useState<Item[]>(() => value ?? defaultValue ?? [])
  const [pending, setPending] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)
  const pickerRef = useRef<HTMLInputElement>(null)
  const controlled = value !== undefined

  useEffect(() => {
    if (!controlled) return
    setItems((current) => (value ?? []).map((item) => ({ ...item, url: current.find((entry) => entry.path === item.path)?.url })))
  }, [value, controlled])

  // A stored recording needs a signed URL before it can play.
  useEffect(() => {
    const missing = items.filter((item) => !item.url).map((item) => item.path)
    if (missing.length === 0) return
    let cancelled = false
    signAudio(missing).then((urls) => {
      if (cancelled) return
      setItems((current) => current.map((item) => (item.url || !urls[item.path] ? item : { ...item, url: urls[item.path] })))
    })
    return () => { cancelled = true }
  }, [items])

  const strip = (list: Item[]): AudioAnswer[] => list.map(({ url: _url, ...item }) => item)

  const commit = (next: Item[]) => {
    setItems(next)
    onChange?.(strip(next))
  }

  const addFiles = async (files: FileList | File[]) => {
    setError(null)
    const picked = Array.from(files)
    if (picked.some((file) => isWavFile(file.type, file.name))) { setError(WAV_MESSAGE); return }
    const list = picked.filter((file) => audioExtension(file.type, file.name))
    if (list.length === 0) { setError("Pilih berkas rekaman suara (misalnya .m4a dari Memo Suara)."); return }
    const room = max - items.length - pending.length
    if (room <= 0) { setError(`Maksimal ${max} rekaman.`); return }
    for (const file of list.slice(0, room)) void uploadOne(file)
    if (list.length > room) setError(`Hanya ${room} rekaman lagi yang muat; sisanya dilewati.`)
  }

  const patch = (pendingId: string, change: Partial<Pending>) =>
    setPending((list) => list.map((item) => (item.id === pendingId ? { ...item, ...change } : item)))

  const uploadOne = async (file: File) => {
    const pendingId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setPending((list) => [...list, { id: pendingId, name: file.name, size: file.size, progress: 0 }])
    const fail = (message: string) => patch(pendingId, { error: message, abort: undefined })
    try {
      if (file.size > AUDIO_MAX_BYTES) { fail("Rekaman lebih dari 50 MB. Potong di Memo Suara, lalu unggah bagian-bagiannya."); return }

      const durationMs = await readDuration(file)
      const prepared = await prepareAudioUpload({ scope, size: file.size, type: file.type, name: file.name })
      if (!prepared.success || !prepared.data) { fail(prepared.error ?? "Tidak bisa menyiapkan unggahan."); return }

      const contentType = file.type || "application/octet-stream"
      const sent = await putWithProgress(prepared.data.signedUrl, file, contentType, (fraction) => patch(pendingId, { progress: Math.round(fraction * 100) }), (abort) => patch(pendingId, { abort }))
      if (sent === "aborted") { setPending((list) => list.filter((item) => item.id !== pendingId)); return }
      if (sent === "failed") {
        // The direct PUT is the fast path; the SDK's own upload is the proven one.
        const supabase = createClient()
        const { error: uploadError } = await supabase.storage
          .from(AUDIO_BUCKET)
          .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType, upsert: false })
        if (uploadError) { fail("Unggahan gagal. Periksa koneksi lalu coba lagi."); return }
      }

      const item: Item = {
        path: prepared.data.path,
        name: file.name.slice(0, 200) || "Rekaman",
        size: file.size,
        ...(durationMs !== null ? { durationMs } : {}),
        url: URL.createObjectURL(file),
      }
      setPending((list) => list.filter((entry) => entry.id !== pendingId))
      setItems((current) => {
        const next = [...current, item]
        onChange?.(strip(next))
        return next
      })
    } catch {
      fail("Rekaman tidak bisa dibaca.")
    }
  }

  const remove = async (path: string) => {
    commit(items.filter((item) => item.path !== path))
    // The file goes too; a failed remove leaves an orphan, never a broken answer.
    void removeAudio(path)
  }

  const full = items.length + pending.length >= max
  const busy = disabled || full

  return (
    <div className="space-y-3">
      {name && <input type="hidden" name={name} value={JSON.stringify(strip(items))} />}

      {(items.length > 0 || pending.length > 0) && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.path} className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-start gap-3">
                <AudioFile className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[item.durationMs !== undefined ? formatDuration(item.durationMs) : null, formatBytes(item.size)].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {!disabled && (
                  <button
                    type="button"
                    aria-label={`Hapus ${item.name}`}
                    onClick={() => remove(item.path)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground md:h-8 md:w-8"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {item.url ? (
                // Native controls: the phone's own player knows the format better than any widget.
                <audio controls preload="none" src={item.url} className="mt-2 h-10 w-full" aria-label={`Putar ${item.name}`} />
              ) : (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyiapkan pemutar…</p>
              )}
            </li>
          ))}
          {pending.map((item) => (
            <li key={item.id} className="rounded-lg border border-dashed bg-muted/40 p-3">
              {item.error ? (
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger-foreground)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{item.name}</p>
                    <p className="text-xs text-[var(--danger-foreground)]">{item.error}</p>
                  </div>
                  <button type="button" className="text-xs font-medium text-foreground underline" onClick={() => setPending((list) => list.filter((entry) => entry.id !== item.id))}>Tutup</button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm text-foreground">{item.name}</p>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.progress}% · {formatBytes(item.size)}</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${item.progress}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground" role="status">Mengunggah… jangan tutup halaman ini.</span>
                    {item.abort && <button type="button" className="text-xs font-medium text-foreground underline" onClick={item.abort}>Batal</button>}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <input ref={pickerRef} id={id} type="file" accept="audio/*,.m4a,.mp4,.mp3,.aac,.ogg,.webm,.caf" multiple className="sr-only" onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = "" }} />

      <Button type="button" variant="outline" className={cn("h-12 sm:h-11")} disabled={busy} onClick={() => pickerRef.current?.click()}>
        <Upload className="h-4 w-4" /> Unggah rekaman
      </Button>

      <p className="text-xs text-muted-foreground">
        {error ? <span className="text-[var(--danger-foreground)]">{error}</span> : hint ?? `Maks ${max} rekaman, 50 MB per berkas.`}
      </p>
    </div>
  )
}

/** The recording's length, from the browser's own decoder; null when it cannot tell (a rare format). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = document.createElement("audio")
    audio.preload = "metadata"
    const done = (value: number | null) => {
      URL.revokeObjectURL(url)
      resolve(value)
    }
    const timer = window.setTimeout(() => done(null), 8000)
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer)
      done(Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null)
    }
    audio.onerror = () => {
      window.clearTimeout(timer)
      done(null)
    }
    audio.src = url
  })
}

/**
 * PUT the file to the signed upload URL with real progress. The same request
 * the SDK makes (apikey and the session's bearer, the content type, no
 * upsert), by hand so the browser reports bytes as they leave.
 */
async function putWithProgress(
  signedUrl: string,
  file: File,
  contentType: string,
  onProgress: (fraction: number) => void,
  onAbortable: (abort: () => void) => void
): Promise<"sent" | "failed" | "aborted"> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  const bearer = data.session?.access_token ?? anonKey
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.open("PUT", signedUrl)
    request.setRequestHeader("apikey", anonKey)
    request.setRequestHeader("authorization", `Bearer ${bearer}`)
    request.setRequestHeader("x-upsert", "false")
    request.setRequestHeader("content-type", contentType)
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    request.onload = () => resolve(request.status >= 200 && request.status < 300 ? "sent" : "failed")
    request.onerror = () => resolve("failed")
    request.onabort = () => resolve("aborted")
    onAbortable(() => request.abort())
    request.send(file)
  })
}
