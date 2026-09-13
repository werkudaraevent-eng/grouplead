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
} from "lucide-react"
import {
  archiveFormField,
  createFormField,
  getFieldOptionUsage,
  moveFormField,
  restoreFormField,
  updateFormField,
} from "@/app/actions/form-field-actions"
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  canEditOptions,
  describeOptionsViolation,
  isChoiceType,
  optionSource,
  visibleFields,
  type FieldType,
  type FormField,
} from "@/lib/missions/form-fields"
import { OptionsEditor } from "./options-editor"
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
 *
 * "Reduced" used to mean the options editor disappeared from every core field,
 * which is how "Jenis mission" ended up presented as a single-choice field with
 * no choices. What a field locks is now decided per field, not per category.
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

/** Why a core field's type cannot move, stated per field rather than in general. */
function lockedTypeReason(reportingKey: string): string {
  switch (reportingKey) {
    case "date":
    case "start_time":
    case "end_time":
      return "Jadwal dipakai deteksi bentrok dan kalender, jadi tipenya terkunci."
    case "mission_type":
    case "contact_salutation":
      return "Tersimpan sebagai satu nilai di setiap mission. Opsinya bisa diubah di bawah."
    case "primary_sales":
    case "supporting_sales":
      return "Isinya orang, diambil dari daftar pengguna."
    default:
      return "Field inti dipakai fitur lain, jadi tipenya terkunci. Label, urutan, dan wajib/opsional tetap bisa diubah."
  }
}

/**
 * Edit one field.
 *
 * The editor replaces the row it belongs to, so it opens with the field's name
 * as a heading: without it the panel appeared under a different field's title
 * and there was nothing on screen saying what was being edited.
 *
 * `field` is null when adding, which is the only difference between the two
 * modes and keeps them one component.
 */
function FieldEditor({
  field,
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  usage,
  usageLoading,
}: {
  field: FormField | null
  draft: Draft
  setDraft: (next: Draft) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  usage: Record<string, number> | null
  usageLoading: boolean
}) {
  const isCore = field?.isCore ?? false
  // Ids must be unique on the page: two editors are never open at once today,
  // but a label pointing at the wrong input is a silent bug waiting for that.
  const uid = field?.id ?? "new"

  const editableOptions = canEditOptions({
    isCore,
    reportingKey: field?.reportingKey ?? "",
    fieldType: draft.fieldType,
  })
  const source = optionSource({
    isCore,
    reportingKey: field?.reportingKey ?? "",
    fieldType: draft.fieldType,
  })

  const optionsError = describeOptionsViolation(
    { isCore, reportingKey: field?.reportingKey ?? "", fieldType: draft.fieldType },
    draft.options
  )
  const labelError = draft.label.trim() ? null : "Nama field wajib diisi"
  const blocked = Boolean(labelError || optionsError)

  return (
    <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          {field ? `Ubah "${field.label}"` : "Field baru"}
        </h3>
        {field && (
          <span className="font-mono text-xs text-muted-foreground">{field.reportingKey}</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`label-${uid}`}>Nama field</Label>
          <Input
            id={`label-${uid}`}
            className="h-11"
            value={draft.label}
            maxLength={100}
            aria-invalid={labelError ? true : undefined}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          {labelError && <p className="text-xs text-[var(--danger-foreground)]">{labelError}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`type-${uid}`}>Tipe</Label>
          {isCore ? (
            // A dropdown that refuses every change is a control that lies. The
            // type is a fact here, with the reason next to it.
            <>
              <p
                id={`type-${uid}`}
                className="flex h-11 items-center rounded-md border border-input bg-muted px-3 text-sm text-foreground"
              >
                {FIELD_TYPE_LABELS[draft.fieldType]}
              </p>
              <p className="text-xs text-muted-foreground">{lockedTypeReason(field?.reportingKey ?? "")}</p>
            </>
          ) : (
            <select
              id={`type-${uid}`}
              value={draft.fieldType}
              onChange={(e) => setDraft({ ...draft, fieldType: e.target.value as FieldType })}
              className="h-11 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {FIELD_TYPES.map((type) => <option key={type} value={type}>{FIELD_TYPE_LABELS[type]}</option>)}
            </select>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`placeholder-${uid}`}>Placeholder</Label>
          <Input id={`placeholder-${uid}`} className="h-11" value={draft.placeholder} maxLength={200} onChange={(e) => setDraft({ ...draft, placeholder: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`help-${uid}`}>Teks bantuan</Label>
          <Input id={`help-${uid}`} className="h-11" value={draft.helpText} maxLength={300} onChange={(e) => setDraft({ ...draft, helpText: e.target.value })} />
        </div>
      </div>

      {isChoiceType(draft.fieldType) && (
        editableOptions ? (
          <OptionsEditor
            // Keyed so the editor's record of what each option was called on
            // open is rebuilt when a different field is opened.
            key={uid}
            options={draft.options}
            onChange={(next) => setDraft({ ...draft, options: next })}
            usage={usage}
            usageLoading={usageLoading}
            disabled={saving}
            error={optionsError}
          />
        ) : (
          // Saying where the list comes from beats an empty editor the admin
          // would fill in and watch do nothing.
          <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            {source === "directory"
              ? "Pilihannya diambil dari daftar pengguna Sales Mission, jadi tidak diatur di sini. Tambah atau nonaktifkan orang lewat LeadEngine → Settings → Users."
              : "Pilihan untuk field ini tidak diatur di sini."}
          </p>
        )
      )}

      <div className="flex items-center gap-2.5">
        <Checkbox
          id={`required-${uid}`}
          checked={draft.isRequired}
          onCheckedChange={(checked) => setDraft({ ...draft, isRequired: checked === true })}
        />
        <Label htmlFor={`required-${uid}`} className="font-normal">Wajib diisi</Label>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={onSave} disabled={saving || blocked}>
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
  const [usage, setUsage] = useState<Record<string, number> | null>(null)
  const [usageLoading, setUsageLoading] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  /**
   * Open a field for editing and fetch how often each of its options was
   * answered. Counted on open rather than with the page so the settings screen
   * does not pay for a scan of every mission on every load.
   */
  const openEditor = (field: FormField) => {
    setDraft(toDraft(field))
    setEditingId(field.id)
    setAdding(false)
    setUsage(null)

    if (!isChoiceType(field.fieldType) || !canEditOptions(field)) return

    setUsageLoading(true)
    getFieldOptionUsage(field.id)
      .then((counts) => setUsage(counts))
      // A failed count must not block editing: the options still work, the
      // admin just does not get the "used 12 times" note.
      .catch(() => setUsage(null))
      .finally(() => setUsageLoading(false))
  }

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
          <Button size="sm" onClick={() => { setDraft(EMPTY_DRAFT); setAdding(true); setEditingId(null); setUsage(null) }} disabled={adding}>
            <Plus className="h-4 w-4" /> Tambah field
          </Button>
        </div>

        {adding && (
          <div className="border-b px-5 py-5">
            <FieldEditor
              field={null}
              draft={draft}
              setDraft={setDraft}
              saving={pending}
              usage={null}
              usageLoading={false}
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
                  field={field}
                  draft={draft}
                  setDraft={setDraft}
                  saving={pending}
                  usage={usage}
                  usageLoading={usageLoading}
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
                      onClick={() => openEditor(field)}
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
