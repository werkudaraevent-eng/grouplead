"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2, Plus } from "lucide-react"
import { addSupportingNote } from "@/app/actions/visit-report-actions"
import type { SupportingNoteRecord } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

/**
 * Supporting notes live beside the report, never inside it. A supporting sales
 * — including anyone who joined the mission themselves — records their own view
 * without overwriting the primary's account of the meeting.
 */
export function SupportingNotes({
  missionId,
  notes,
  canAdd,
}: {
  missionId: string
  notes: SupportingNoteRecord[]
  canAdd: boolean
}) {
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const submit = () => {
    const trimmed = note.trim()
    if (!trimmed) return

    setError(null)
    startTransition(async () => {
      const result = await addSupportingNote(missionId, trimmed)
      if (result.success) {
        setNote("")
        router.refresh()
      } else {
        setError(result.error ?? "Catatan gagal disimpan.")
      }
    })
  }

  const formatWhen = (iso: string) =>
    new Intl.DateTimeFormat("id-ID", {
      timeZone: MISSION_TIME_ZONE,
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso))

  return (
    <div>
      {notes.length > 0 ? (
        <ul className="divide-y">
          {notes.map((item) => (
            <li key={item.id} className="px-5 py-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{item.authorName}</p>
                <p className="shrink-0 font-mono text-[11px] text-muted-foreground">{formatWhen(item.createdAt)}</p>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.note}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">Belum ada catatan pendukung.</p>
      )}

      {canAdd && (
        <div className="border-t px-5 py-4">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Tambahkan pengamatan Anda…"
            className="w-full rounded-md border border-input bg-field px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />

          {error && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--danger-foreground)]">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          <Button className="mt-3 h-10 w-full" onClick={submit} disabled={pending || !note.trim()}>
            {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</> : <><Plus className="h-4 w-4" /> Tambah catatan</>}
          </Button>
        </div>
      )}
    </div>
  )
}
