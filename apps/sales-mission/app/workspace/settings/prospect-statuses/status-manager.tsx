"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Archive, ArrowDown, ArrowUp, Loader2, Lock, Pencil, Plus, RotateCcw } from "@/components/icons"
import { archiveProspectStatus, createProspectStatus, moveProspectStatus, restoreProspectStatus, updateProspectStatus } from "@/app/actions/prospect-status-actions"
import {
  ADDABLE_KINDS,
  COLOR_DOT,
  COLOR_LABELS,
  KIND_DESCRIPTIONS,
  KIND_LABELS,
  STATUS_COLORS,
  activeStatuses,
  archiveViolation,
  type ProspectStatus,
  type StatusColor,
  type StatusKind,
} from "@/lib/prospects/prospect-status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * The status list as the field manager draws form fields: rows with an
 * order control, a label, a quiet kind, a usage count and the actions that
 * apply. Editing is a dialog; the kind is shown locked with the reason.
 */

type Editing = { mode: "create" } | { mode: "edit"; status: ProspectStatus } | null

function ColorPicker({ value, onChange }: { value: StatusColor; onChange: (color: StatusColor) => void }) {
  return (
    <div role="radiogroup" aria-label="Warna" className="flex flex-wrap gap-2">
      {STATUS_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={COLOR_LABELS[color]}
          onClick={() => onChange(color)}
          className={cn("flex h-10 items-center gap-2 rounded-full border px-3 text-sm", value === color ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}
        >
          <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-full", COLOR_DOT[color])} />
          {COLOR_LABELS[color]}
        </button>
      ))}
    </div>
  )
}

export function StatusManager({ statuses, usage }: { statuses: ProspectStatus[]; usage: Record<string, number> }) {
  const router = useRouter()
  const [editing, setEditing] = useState<Editing>(null)
  const [label, setLabel] = useState("")
  const [color, setColor] = useState<StatusColor>("warning")
  const [kind, setKind] = useState<StatusKind>("in_progress")
  const [pending, start] = useTransition()
  const active = activeStatuses(statuses)
  const archived = statuses.filter((status) => !status.isActive)

  const open = (next: Editing) => {
    setEditing(next)
    if (next?.mode === "edit") { setLabel(next.status.label); setColor(next.status.color) }
    else { setLabel(""); setColor("warning"); setKind("in_progress") }
  }

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
    if (editing.mode === "create") run(() => createProspectStatus({ label, kind, color }), "Status ditambahkan")
    else run(() => updateProspectStatus(editing.status.id, { label, color }), "Status disimpan")
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => open({ mode: "create" })}><Plus className="h-4 w-4" /> Tambah status</Button>
      </div>

      <ol className="divide-y overflow-hidden rounded-xl border bg-card">
        {active.map((status, index) => {
          const violation = archiveViolation(statuses, status.id)
          return (
            <li key={status.id} className="flex items-center gap-3 px-4 py-3">
              <span className="flex shrink-0 flex-col">
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Naikkan ${status.label}`} disabled={pending || index === 0} onClick={() => run(() => moveProspectStatus(status.id, "up"), "Urutan disimpan")}><ArrowUp className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Turunkan ${status.label}`} disabled={pending || index === active.length - 1} onClick={() => run(() => moveProspectStatus(status.id, "down"), "Urutan disimpan")}><ArrowDown className="h-3.5 w-3.5" /></Button>
              </span>
              <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full", COLOR_DOT[status.color])} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{status.label}</span>
                <span className="block text-xs text-muted-foreground">{KIND_LABELS[status.kind]} · {usage[status.id] ?? 0} prospek</span>
              </span>
              <Button variant="ghost" size="sm" onClick={() => open({ mode: "edit", status })} disabled={pending}><Pencil className="h-4 w-4" /> Ubah</Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={pending || Boolean(violation)}
                title={violation ?? undefined}
                onClick={() => run(() => archiveProspectStatus(status.id), "Status diarsipkan")}
              >
                <Archive className="h-4 w-4" /> Arsipkan
              </Button>
            </li>
          )
        })}
      </ol>

      {archived.length > 0 && (
        <details className="rounded-xl border bg-card">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">Diarsipkan ({archived.length})</summary>
          <ul className="divide-y border-t">
            {archived.map((status) => (
              <li key={status.id} className="flex items-center gap-3 px-4 py-3">
                <span aria-hidden="true" className={cn("h-2.5 w-2.5 shrink-0 rounded-full opacity-50", COLOR_DOT[status.color])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-muted-foreground">{status.label}</span>
                  <span className="block text-xs text-muted-foreground">{KIND_LABELS[status.kind]} · {usage[status.id] ?? 0} prospek masih memakainya</span>
                </span>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => restoreProspectStatus(status.id), "Status dipulihkan")}><RotateCcw className="h-4 w-4" /> Pulihkan</Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={editing !== null} onOpenChange={(next) => { if (!next && !pending) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing?.mode === "edit" ? "Ubah status" : "Tambah status"}</DialogTitle>
            <DialogDescription>
              {editing?.mode === "edit" ? "Nama dan warna bisa diganti. Jenisnya tetap." : "Status baru untuk tahap yang sedang berjalan atau yang tidak berhasil."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="status-label" className="text-foreground">Nama</Label>
              <Input id="status-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} placeholder="Hubungi lagi" className="h-12" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Warna</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-foreground">Jenis</Label>
              {editing?.mode === "edit" ? (
                <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0" />
                  <span><span className="font-medium text-foreground">{KIND_LABELS[editing.status.kind]}.</span> Jenis menentukan perilaku sistem, jadi terkunci setelah dibuat.</span>
                </p>
              ) : (
                <div role="radiogroup" className="grid gap-1.5">
                  {ADDABLE_KINDS.map((item) => (
                    <label key={item} className={cn("flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm", kind === item ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                      <input type="radio" name="kind" value={item} checked={kind === item} onChange={() => setKind(item)} className="mt-1" />
                      <span><span className="block font-medium text-foreground">{KIND_LABELS[item]}</span><span className="block text-xs text-muted-foreground">{KIND_DESCRIPTIONS[item]}</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={pending}>Batal</Button>
            <Button onClick={save} disabled={pending || !label.trim()}>{pending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
