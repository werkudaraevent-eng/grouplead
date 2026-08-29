"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowDown,
  ArrowUp,
  Lock,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import {
  archiveFormField,
  createFormField,
  moveFormField,
  restoreFormField,
  updateFormField,
} from "@/app/actions/form-field-actions"
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  isChoiceType,
  visibleFields,
  type FieldType,
  type FormField,
} from "@/lib/missions/form-fields"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Form builder.
 *
 * Core fields render with a lock and a reduced set of controls rather than
 * being hidden: an admin should see that "Date" exists and why they cannot
 * remove it, instead of wondering where it went.
 */

interface Draft {
  label: string
  fieldType: FieldType
  isRequired: boolean
  placeholder: string
  helpText: string
  options: string[]
}

const EMPTY_DRAFT: Draft = {
  label: "",
  fieldType: "TEXT",
  isRequired: false,
  placeholder: "",
  helpText: "",
  options: [],
}

function toDraft(field: FormField): Draft {
  return {
    label: field.label,
    fieldType: field.fieldType,
    isRequired: field.isRequired,
    placeholder: field.placeholder ?? "",
    helpText: field.helpText ?? "",
    options: field.options,
  }
}

function FieldEditor({
  draft,
  setDraft,
  locked,
  onSave,
  onCancel,
  saving,
}: {
  draft: Draft
  setDraft: (next: Draft) => void
  locked: boolean
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const [optionInput, setOptionInput] = useState("")

  const addOption = () => {
    const trimmed = optionInput.trim()
    if (!trimmed || draft.options.includes(trimmed)) return
    setDraft({ ...draft, options: [...draft.options, trimmed] })
    setOptionInput("")
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="field-label">Nama field</Label>
          <Input id="field-label" className="h-11" value={draft.label} maxLength={100} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-type">Tipe</Label>
          <select
            id="field-type"
            value={draft.fieldType}
            disabled={locked}
            onChange={(e) => setDraft({ ...draft, fieldType: e.target.value as FieldType })}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {FIELD_TYPES.map((type) => <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>)}
          </select>
          {locked && <p className="text-xs text-muted-foreground">Tipe field inti tidak bisa diubah.</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-placeholder">Placeholder</Label>
          <Input id="field-placeholder" className="h-11" value={draft.placeholder} maxLength={200} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="field-help">Teks bantuan</Label>
          <Input id="field-help" className="h-11" value={draft.helpText} maxLength={300} onChange={(e) => setDraft({ ...draft, helpText: e.target.value })} />
        </div>
      </div>

      {isChoiceType(draft.fieldType) && !locked && (
        <div className="space-y-2">
          <Label>Opsi pilihan</Label>
          <div className="flex flex-wrap gap-2">
            {draft.options.map((option) => (
              <span key={option} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm">
                {option}
                <button
                  type="button"
                  aria-label={`Hapus opsi ${option}`}
                  onClick={() => setDraft({ ...draft, options: draft.options.filter((item) => item !== option) })}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
            {draft.options.length === 0 && <p className="text-xs text-muted-foreground">Belum ada opsi.</p>}
          </div>
          <div className="flex gap-2">
            <Input
              className="h-11"
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption() } }}
              placeholder="Tambah opsi lalu Enter"
            />
            <Button type="button" variant="outline" className="h-11 shrink-0" onClick={addOption}>Tambah</Button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5">
        <Checkbox
          id="field-required"
          checked={draft.isRequired}
          onCheckedChange={(checked) => setDraft({ ...draft, isRequired: checked === true })}
        />
        <Label htmlFor="field-required" className="font-normal">Wajib diisi</Label>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving || !draft.label.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>Batal</Button>
      </div>
    </div>
  )
}

export function FieldManager({ fields }: { fields: FormField[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [pending, start] = useTransition()
  const router = useRouter()

  const active = visibleFields(fields)
  const archived = fields.filter((field) => !field.isActive)

  const run = (work: () => Promise<{ success: boolean; error?: string }>, okMessage: string) => {
    start(async () => {
      const result = await work()
      if (result.success) {
        toast.success(okMessage)
        setEditingId(null)
        setAdding(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal menyimpan")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Form buat mission</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{active.length} field aktif</h2>
          </div>
          <Button size="sm" onClick={() => { setDraft(EMPTY_DRAFT); setAdding(true); setEditingId(null) }} disabled={adding}>
            <Plus className="h-4 w-4" /> Tambah field
          </Button>
        </div>

        {adding && (
          <div className="border-b px-5 py-5">
            <FieldEditor
              draft={draft}
              setDraft={setDraft}
              locked={false}
              saving={pending}
              onCancel={() => setAdding(false)}
              onSave={() => run(() => createFormField(draft), "Field ditambahkan")}
            />
          </div>
        )}

        <ul className="divide-y">
          {active.map((field, index) => (
            <li key={field.id} className="px-5 py-4">
              {editingId === field.id ? (
                <FieldEditor
                  draft={draft}
                  setDraft={setDraft}
                  locked={field.isCore}
                  saving={pending}
                  onCancel={() => setEditingId(null)}
                  onSave={() => run(() => updateFormField(field.id, draft), "Field disimpan")}
                />
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      aria-label={`Naikkan ${field.label}`}
                      disabled={index === 0 || pending}
                      onClick={() => run(() => moveFormField(field.id, "up"), "Urutan diperbarui")}
                      className="grid h-7 w-7 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Turunkan ${field.label}`}
                      disabled={index === active.length - 1 || pending}
                      onClick={() => run(() => moveFormField(field.id, "down"), "Urutan diperbarui")}
                      className="grid h-7 w-7 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {field.label}
                      {field.isCore && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                          <Lock className="h-3 w-3" /> Inti
                        </span>
                      )}
                      {field.isRequired && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase text-secondary-foreground">
                          Wajib
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {FIELD_TYPE_LABELS[field.fieldType]}
                      <span className="font-mono"> · {field.reportingKey}</span>
                      {field.options.length > 0 ? ` · ${field.options.length} opsi` : ""}
                    </p>
                    {field.helpText && <p className="mt-1 text-xs text-muted-foreground">{field.helpText}</p>}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label={`Ubah ${field.label}`}
                      onClick={() => { setDraft(toDraft(field)); setEditingId(field.id); setAdding(false) }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={cn("h-8 w-8", field.isCore ? "opacity-30" : "text-muted-foreground hover:text-destructive")}
                      aria-label={field.isCore ? `${field.label} tidak bisa dihapus` : `Hapus ${field.label}`}
                      title={field.isCore ? "Field inti tidak bisa dihapus" : undefined}
                      disabled={field.isCore || pending}
                      onClick={() => run(() => archiveFormField(field.id), "Field dihapus dari form")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      {archived.length > 0 && (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Diarsipkan</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{archived.length} field</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Tidak lagi muncul di form, tetapi jawaban yang sudah terkumpul tetap tersimpan dan terbaca.
            </p>
          </div>
          <ul className="divide-y">
            {archived.map((field) => (
              <li key={field.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{field.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{field.reportingKey}</span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => restoreFormField(field.id), "Field dikembalikan")}
                >
                  <RotateCcw className="h-4 w-4" /> Kembalikan
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
