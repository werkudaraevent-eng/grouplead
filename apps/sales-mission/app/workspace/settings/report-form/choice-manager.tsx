"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Archive, ArrowDown, ArrowUp, Loader2, Lock, Pencil, Plus, RotateCcw } from "@/components/icons"
import { archiveReportChoice, createReportChoice, moveReportChoice, restoreReportChoice, updateReportChoice } from "@/app/actions/report-choice-actions"
import { KINDS_BY_FIELD, KIND_HINTS, KIND_LABELS, archiveChoiceViolation, type ChoiceField, type ReportChoice } from "@/lib/missions/report-choices"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * The options behind one of the report's fixed choices, inside the field
 * editor. Same shape as the prospect status manager: rows with an order
 * control, the label, the kind shown locked with what it does, and the
 * moves that apply. Every move saves at once; the field editor around it
 * saves the field's own label and help text separately.
 */
export function ChoiceManager({ fieldKey, choices }: { fieldKey: ChoiceField; choices: ReportChoice[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ id: string | null; label: string; kind: string } | null>(null)
  const [pending, start] = useTransition()
  const active = choices.filter((choice) => choice.isActive).sort((a, b) => a.displayOrder - b.displayOrder)
  const archived = choices.filter((choice) => !choice.isActive)
  const kinds = KINDS_BY_FIELD[fieldKey]

  const run = (work: () => Promise<{ success: boolean; error?: string }>, done: string) =>
    start(async () => {
      const result = await work()
      if (!result.success) { toast.error(result.error ?? "Gagal."); return }
      toast.success(done)
      setEditing(null)
      router.refresh()
    })

  const save = () => {
    if (!editing) return
    if (editing.id) run(() => updateReportChoice(editing.id!, { label: editing.label }), "Pilihan disimpan")
    else run(() => createReportChoice({ fieldKey, label: editing.label, kind: editing.kind }), "Pilihan ditambahkan")
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Opsi pilihan <span className="font-normal text-muted-foreground">({active.length})</span></p>
          <p className="text-xs text-muted-foreground">Nama dan urutan bebas. Jenis di balik tiap opsi terkunci karena KPI, CRM, dan lead membacanya.</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={pending || editing !== null} onClick={() => setEditing({ id: null, label: "", kind: kinds[0] })}>
          <Plus className="h-4 w-4" /> Tambah pilihan
        </Button>
      </div>

      <ol className="divide-y overflow-hidden rounded-lg border bg-card">
        {active.map((choice, index) => {
          const violation = archiveChoiceViolation(choices, choice.id)
          const isEditing = editing?.id === choice.id
          return (
            <li key={choice.id} className="px-3 py-2.5">
              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor={`choice-label-${choice.id}`} className="text-foreground">Nama</Label>
                  <Input id={`choice-label-${choice.id}`} value={editing.label} maxLength={80} onChange={(event) => setEditing({ ...editing, label: event.target.value })} className="h-11" autoFocus />
                  <p className="flex items-start gap-2 text-xs text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Jenis: {KIND_LABELS[fieldKey][choice.kind] ?? choice.kind}. {KIND_HINTS[fieldKey][choice.kind]}</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={save} disabled={pending || !editing.label.trim()}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={pending}>Batal</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex shrink-0 flex-col">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`Naikkan ${choice.label}`} disabled={pending || index === 0} onClick={() => run(() => moveReportChoice(choice.id, "up"), "Urutan disimpan")}><ArrowUp className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" aria-label={`Turunkan ${choice.label}`} disabled={pending || index === active.length - 1} onClick={() => run(() => moveReportChoice(choice.id, "down"), "Urutan disimpan")}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{choice.label}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock className="h-3 w-3" /> {KIND_LABELS[fieldKey][choice.kind] ?? choice.kind} <span className="font-mono">· {choice.code}</span></span>
                  </span>
                  <Button type="button" variant="ghost" size="sm" disabled={pending || editing !== null} onClick={() => setEditing({ id: choice.id, label: choice.label, kind: choice.kind })}><Pencil className="h-4 w-4" /> Ubah</Button>
                  <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" disabled={pending || editing !== null || Boolean(violation)} title={violation ?? undefined} onClick={() => run(() => archiveReportChoice(choice.id), "Pilihan diarsipkan")}><Archive className="h-4 w-4" /></Button>
                </div>
              )}
            </li>
          )
        })}
        {editing && editing.id === null && (
          <li className="space-y-3 px-3 py-3">
            <div className="space-y-1.5">
              <Label htmlFor={`choice-new-${fieldKey}`} className="text-foreground">Nama pilihan</Label>
              <Input id={`choice-new-${fieldKey}`} value={editing.label} maxLength={80} onChange={(event) => setEditing({ ...editing, label: event.target.value })} placeholder="Bertemu via video call" className="h-11" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Jenis</Label>
              <div role="radiogroup" className="grid gap-1.5">
                {kinds.map((kind) => (
                  <label key={kind} className={cn("flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm", editing.kind === kind ? "border-primary bg-primary/5" : "bg-card hover:bg-muted")}>
                    <input type="radio" name={`kind-${fieldKey}`} value={kind} checked={editing.kind === kind} onChange={() => setEditing({ ...editing, kind })} className="mt-1" />
                    <span><span className="block font-medium text-foreground">{KIND_LABELS[fieldKey][kind]}</span><span className="block text-xs text-muted-foreground">{KIND_HINTS[fieldKey][kind]}</span></span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={save} disabled={pending || !editing.label.trim()}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Tambah</Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={pending}>Batal</Button>
            </div>
          </li>
        )}
      </ol>

      {archived.length > 0 && (
        <details className="rounded-lg border bg-card">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">Diarsipkan ({archived.length})</summary>
          <ul className="divide-y border-t">
            {archived.map((choice) => (
              <li key={choice.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-muted-foreground">{choice.label}</span>
                  <span className="block text-xs text-muted-foreground">{KIND_LABELS[fieldKey][choice.kind] ?? choice.kind} · laporan lama tetap menampilkannya</span>
                </span>
                <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run(() => restoreReportChoice(choice.id), "Pilihan dipulihkan")}><RotateCcw className="h-4 w-4" /> Pulihkan</Button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
