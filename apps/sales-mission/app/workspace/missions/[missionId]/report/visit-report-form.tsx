"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Check, Cloud, CloudOff, Loader2, Plus, Send, Trash2 } from "lucide-react"
import { saveVisitReportDraft, submitVisitReport } from "@/app/actions/visit-report-actions"
import {
  INTEREST_LEVELS,
  INTEREST_LEVEL_LABELS,
  NEXT_ACTION_LABELS,
  NEXT_ACTION_TYPES,
  VISIT_OUTCOMES,
  VISIT_OUTCOME_LABELS,
  missingConfiguredFields,
  missingSubmitFields,
  outcomeRequiresContacts,
  type InterestLevel,
  type NextActionType,
  type ReportContactInput,
  type VisitOutcome,
} from "@/lib/missions/visit-report-schema"
import { visibleFields, type FieldAnswer, type FormField } from "@/lib/missions/form-fields"
import type { VisitReportRecord } from "@/lib/missions/mission-queries"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import type { ReportOptions } from "@/lib/missions/report-options"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

/**
 * Field-first visit report, rendered from the tenant's configuration.
 *
 * The order, labels, help text and requiredness come from the admin's form
 * builder, and any field they added renders in place among the core ones.
 * Core fields keep purpose-built controls, because their answers have a
 * meaning the KPI screen and the CRM sync depend on; the code's own rules
 * for them cannot be loosened, only tightened.
 *
 * One scrolling screen rather than a wizard: on a weak connection, a wizard
 * forces navigation between steps and risks losing what was typed. Everything
 * is visible, the save bar is pinned, and a draft autosaves as it is filled.
 */

type Draft = {
  visitOutcome: VisitOutcome | null
  meetingSummary: string
  clientNeeds: string[]
  productInterest: string[]
  interestLevel: InterestLevel | null
  opportunityExists: boolean
  estimatedValue: number | null
  competitorMentioned: string
  nextActionType: NextActionType
  nextActionOwner: string | null
  followUpDate: string | null
  contacts: ReportContactInput[]
  custom: Record<string, FieldAnswer>
}

type SyncState = "idle" | "saving" | "saved" | "pending"

const AUTOSAVE_DELAY_MS = 1200
const RETRY_BASE_MS = 2000
const RETRY_CEILING_MS = 30_000

const EMPTY_CONTACT: ReportContactInput = { fullName: "", jobTitle: "", phone: "", email: "", isDecisionMaker: false }

/** Draft property → reporting key, so a missing draft field is labelled from config. */
const DRAFT_TO_KEY: Record<string, string> = {
  visitOutcome: "visit_outcome",
  contacts: "contacts_met",
  meetingSummary: "meeting_summary",
  clientNeeds: "client_needs",
  productInterest: "product_interest",
  interestLevel: "interest_level",
  nextActionOwner: "next_action_owner",
  followUpDate: "follow_up_date",
  opportunityExists: "opportunity_exists",
}

const INPUT_CLASS =
  "w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function toDraft(report: VisitReportRecord | null): Draft {
  return {
    visitOutcome: report?.visitOutcome ?? null,
    meetingSummary: report?.meetingSummary ?? "",
    clientNeeds: report?.clientNeeds ?? [],
    productInterest: report?.productInterest ?? [],
    interestLevel: report?.interestLevel ?? null,
    opportunityExists: report?.opportunityExists ?? false,
    estimatedValue: report?.estimatedValue ?? null,
    competitorMentioned: report?.competitorMentioned ?? "",
    nextActionType: report?.nextActionType ?? "NONE",
    nextActionOwner: report?.nextActionOwner ?? null,
    followUpDate: report?.followUpDate ?? null,
    contacts: report?.contacts?.length ? report.contacts : [],
    custom: (report?.custom as Record<string, FieldAnswer> | undefined) ?? {},
  }
}

/** Section wrapper. Generous vertical rhythm so targets stay thumb-sized. */
function Section({ field, hint, children }: { field: FormField; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b px-4 py-6 last:border-b-0 sm:px-6">
      <h2 className="text-base font-semibold text-foreground">
        {field.label}
        {field.isRequired && <span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>}
      </h2>
      {(field.helpText ?? hint) && <p className="mt-1 text-sm text-muted-foreground">{field.helpText ?? hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

/** Chip picker — larger and faster to hit than a native select on a phone. */
function ChipGroup<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | null; onChange: (next: T) => void; labels: Record<T, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={cn(
            "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
            value === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
          )}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}

function MultiChip({ options, value, onToggle, onAddCustom, allowCustom = true }: { options: string[]; value: string[]; onToggle: (option: string) => void; onAddCustom: (option: string) => void; allowCustom?: boolean }) {
  const [custom, setCustom] = useState("")
  const extras = value.filter((item) => !options.includes(item))
  const add = () => {
    const trimmed = custom.trim()
    if (trimmed) { onAddCustom(trimmed); setCustom("") }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[...options, ...extras].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            aria-pressed={value.includes(option)}
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
              value.includes(option) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            {option}
          </button>
        ))}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Lainnya…" className="h-11" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add() } }} />
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={add}>Tambah</Button>
        </div>
      )}
    </div>
  )
}

/** A field the admin added, by its configured type, bound to the draft. */
function CustomControl({ field, value, onChange }: { field: FormField; value: FieldAnswer | undefined; onChange: (next: FieldAnswer) => void }) {
  const id = `custom-${field.reportingKey}`
  if (field.fieldType === "BOOLEAN") {
    return (
      <div className="flex min-h-11 items-center gap-2.5">
        <Checkbox id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
        <Label htmlFor={id} className="font-normal">{field.placeholder || "Ya"}</Label>
      </div>
    )
  }
  if (field.fieldType === "MULTI_SELECT") {
    const list = Array.isArray(value) ? value : []
    return (
      <MultiChip
        options={field.options}
        value={list}
        onToggle={(option) => onChange(list.includes(option) ? list.filter((item) => item !== option) : [...list, option])}
        onAddCustom={() => undefined}
        allowCustom={false}
      />
    )
  }
  if (field.fieldType === "SELECT") {
    return (
      <div className="flex flex-wrap gap-2">
        {field.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(value === option ? null : option)}
            aria-pressed={value === option}
            className={cn(
              "min-h-11 rounded-lg border px-4 text-sm font-medium transition-colors",
              value === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    )
  }
  if (field.fieldType === "LONG_TEXT") {
    return <textarea id={id} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} rows={4} maxLength={4000} placeholder={field.placeholder ?? ""} className={cn(INPUT_CLASS, "py-2")} />
  }
  const type = field.fieldType === "DATE" ? "date" : field.fieldType === "TIME" ? "time" : "text"
  const numeric = field.fieldType === "NUMBER" || field.fieldType === "CURRENCY"
  return (
    <Input
      id={id}
      type={type}
      inputMode={numeric ? "numeric" : undefined}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(event) => {
        if (numeric) {
          const raw = event.target.value.replace(/[^\d.]/g, "")
          onChange(raw === "" ? null : Number(raw))
        } else {
          onChange(event.target.value)
        }
      }}
      placeholder={field.placeholder ?? ""}
      className="h-11"
    />
  )
}

export function VisitReportForm({
  missionId,
  clientName,
  report,
  options,
  salesOptions,
  fields,
}: {
  missionId: string
  clientName: string
  report: VisitReportRecord | null
  /** Fallback vocabularies, used only when the configured field has no options. */
  options: ReportOptions
  salesOptions: TenantSalesOption[]
  fields: FormField[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => toDraft(report))
  const [sync, setSync] = useState<SyncState>("idle")
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [submitting, startSubmit] = useTransition()

  const dirty = useRef(false)
  const latest = useRef(draft)
  latest.current = draft

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K]) => {
    dirty.current = true
    setAttempt(0)
    setDraft((previous) => ({ ...previous, [key]: value }))
  }, [])
  const updateCustom = useCallback((key: string, value: FieldAnswer) => {
    dirty.current = true
    setAttempt(0)
    setDraft((previous) => ({ ...previous, custom: { ...previous.custom, [key]: value } }))
  }, [])

  // Autosave on a trailing timer; a failed save schedules a retry with backoff.
  useEffect(() => {
    if (!dirty.current) return
    const delay = attempt === 0 ? AUTOSAVE_DELAY_MS : Math.min(RETRY_CEILING_MS, RETRY_BASE_MS * 2 ** (attempt - 1))
    const timer = setTimeout(async () => {
      setSync("saving")
      const result = await saveVisitReportDraft(missionId, latest.current)
      if (result.success) {
        dirty.current = false
        setAttempt(0)
        setSync("saved")
      } else {
        setSync("pending")
        setAttempt((value) => value + 1)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [draft, missionId, attempt])

  const toggleIn = (key: "clientNeeds" | "productInterest") => (option: string) => {
    const current = draft[key]
    update(key, current.includes(option) ? current.filter((item) => item !== option) : [...current, option])
  }
  const addCustom = (key: "clientNeeds" | "productInterest") => (option: string) => {
    if (!draft[key].includes(option)) update(key, [...draft[key], option])
  }
  const updateContact = (index: number, patch: Partial<ReportContactInput>) => {
    update("contacts", draft.contacts.map((contact, i) => (i === index ? { ...contact, ...patch } : contact)))
  }

  const handleSubmit = () => {
    setError(null)
    startSubmit(async () => {
      const result = await submitVisitReport(missionId, latest.current)
      if (result.success) {
        router.push(`/workspace/missions/${missionId}`)
        router.refresh()
      } else {
        setError(result.error ?? "Laporan gagal dikirim.")
      }
    })
  }

  const ordered = visibleFields(fields)
  const byKey = new Map(ordered.map((field) => [field.reportingKey, field]))
  const labelFor = (key: string) => byKey.get(key)?.label ?? key
  const needsContacts = outcomeRequiresContacts(draft.visitOutcome)

  // What still blocks submission, in the admin's words: the code's rules
  // (mapped to reporting keys) plus the configuration's.
  const missingKeys = [
    ...missingSubmitFields(draft).map((prop) => DRAFT_TO_KEY[prop] ?? prop),
    ...missingConfiguredFields(draft, fields),
  ]
  const missing = [...new Set(missingKeys)]

  const clientNeedOptions = byKey.get("client_needs")?.options.length ? byKey.get("client_needs")!.options : options.clientNeeds
  const productOptions = byKey.get("product_interest")?.options.length ? byKey.get("product_interest")!.options : options.productInterest

  const renderCore = (field: FormField): React.ReactNode => {
    switch (field.reportingKey) {
      case "visit_outcome":
        return (
          <Section key={field.id} field={field} hint={`Kunjungan ke ${clientName}`}>
            <ChipGroup options={VISIT_OUTCOMES} value={draft.visitOutcome} onChange={(next) => update("visitOutcome", next)} labels={VISIT_OUTCOME_LABELS} />
          </Section>
        )
      case "contacts_met":
        return (
          <Section key={field.id} field={field} hint={needsContacts ? undefined : "Klien tidak ada — bagian ini opsional."}>
            <div className="space-y-4">
              {draft.contacts.map((contact, index) => (
                <div key={index} className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Kontak {index + 1}</p>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => update("contacts", draft.contacts.filter((_, i) => i !== index))} aria-label={`Hapus kontak ${index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`contact-name-${index}`}>Nama</Label>
                      <Input id={`contact-name-${index}`} className="h-11" value={contact.fullName} onChange={(e) => updateContact(index, { fullName: e.target.value })} placeholder="Nama lengkap" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-title-${index}`}>Jabatan</Label>
                      <Input id={`contact-title-${index}`} className="h-11" value={contact.jobTitle ?? ""} onChange={(e) => updateContact(index, { jobTitle: e.target.value })} placeholder="GM, Direktur, …" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-phone-${index}`}>Telepon</Label>
                      <Input id={`contact-phone-${index}`} className="h-11" inputMode="tel" value={contact.phone ?? ""} onChange={(e) => updateContact(index, { phone: e.target.value })} placeholder="08…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-email-${index}`}>Email</Label>
                      <Input id={`contact-email-${index}`} className="h-11" inputMode="email" value={contact.email ?? ""} onChange={(e) => updateContact(index, { email: e.target.value })} placeholder="nama@perusahaan.com" />
                    </div>
                    <div className="flex items-center gap-2.5 sm:col-span-2">
                      <Checkbox id={`contact-dm-${index}`} checked={contact.isDecisionMaker} onCheckedChange={(checked) => updateContact(index, { isDecisionMaker: checked === true })} />
                      <Label htmlFor={`contact-dm-${index}`} className="font-normal">Pengambil keputusan</Label>
                    </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="h-11 w-full" onClick={() => update("contacts", [...draft.contacts, { ...EMPTY_CONTACT }])}>
                <Plus className="h-4 w-4" /> Tambah kontak
              </Button>
            </div>
          </Section>
        )
      case "meeting_summary":
        return (
          <Section key={field.id} field={field}>
            <textarea value={draft.meetingSummary} onChange={(event) => update("meetingSummary", event.target.value)} rows={5} maxLength={5000} placeholder={field.placeholder ?? "Ceritakan singkat jalannya pertemuan…"} className={cn(INPUT_CLASS, "py-2")} />
          </Section>
        )
      case "client_needs":
        return (
          <Section key={field.id} field={field}>
            <MultiChip options={clientNeedOptions} value={draft.clientNeeds} onToggle={toggleIn("clientNeeds")} onAddCustom={addCustom("clientNeeds")} />
          </Section>
        )
      case "product_interest":
        return (
          <Section key={field.id} field={field}>
            <MultiChip options={productOptions} value={draft.productInterest} onToggle={toggleIn("productInterest")} onAddCustom={addCustom("productInterest")} />
          </Section>
        )
      case "interest_level":
        return (
          <Section key={field.id} field={field}>
            <ChipGroup options={INTEREST_LEVELS} value={draft.interestLevel} onChange={(next) => update("interestLevel", next)} labels={INTEREST_LEVEL_LABELS} />
          </Section>
        )
      case "opportunity_exists":
        return (
          <Section key={field.id} field={field}>
            <div className="flex min-h-11 items-center gap-2.5">
              <Checkbox id="opportunity" checked={draft.opportunityExists} onCheckedChange={(checked) => update("opportunityExists", checked === true)} />
              <Label htmlFor="opportunity" className="font-normal">{field.placeholder || "Ada peluang — bisa dikirim ke LeadEngine"}</Label>
            </div>
          </Section>
        )
      case "estimated_value":
        return (
          <Section key={field.id} field={field}>
            <Input id="estimatedValue" className="h-11 max-w-xs" inputMode="numeric" value={draft.estimatedValue ?? ""} onChange={(event) => { const raw = event.target.value.replace(/[^\d]/g, ""); update("estimatedValue", raw ? Number(raw) : null) }} placeholder={field.placeholder ?? "0"} />
          </Section>
        )
      case "competitor_mentioned":
        return (
          <Section key={field.id} field={field}>
            <Input id="competitor" className="h-11" value={draft.competitorMentioned} onChange={(event) => update("competitorMentioned", event.target.value)} placeholder={field.placeholder ?? "Opsional"} />
          </Section>
        )
      case "next_action_type": {
        const owner = byKey.get("next_action_owner")
        const date = byKey.get("follow_up_date")
        return (
          <Section key={field.id} field={field}>
            <ChipGroup options={NEXT_ACTION_TYPES} value={draft.nextActionType} onChange={(next) => update("nextActionType", next)} labels={NEXT_ACTION_LABELS} />
            {draft.nextActionType !== "NONE" && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {owner && (
                  <div className="space-y-1.5">
                    <Label htmlFor="nextActionOwner">{owner.label}</Label>
                    <select id="nextActionOwner" value={draft.nextActionOwner ?? ""} onChange={(event) => update("nextActionOwner", event.target.value || null)} className={cn(INPUT_CLASS, "h-11")}>
                      <option value="">Pilih penanggung jawab</option>
                      {salesOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                    </select>
                  </div>
                )}
                {date && (
                  <div className="space-y-1.5">
                    <Label htmlFor="followUpDate">{date.label}</Label>
                    <Input id="followUpDate" className="h-11" type="date" value={draft.followUpDate ?? ""} onChange={(event) => update("followUpDate", event.target.value || null)} />
                  </div>
                )}
              </div>
            )}
          </Section>
        )
      }
      // Rendered inside the next-action section above.
      case "next_action_owner":
      case "follow_up_date":
        return null
      default:
        return null
    }
  }

  return (
    <div className="mx-auto max-w-3xl pb-40">
      {report?.clarificationNote && (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[var(--warning-foreground)]/20 bg-[var(--warning)] px-4 py-3.5 text-sm text-[var(--warning-foreground)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Admin meminta klarifikasi</p>
            <p className="mt-1">{report.clarificationNote}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        {ordered.map((field) =>
          field.isCore ? (
            renderCore(field)
          ) : (
            <Section key={field.id} field={field}>
              <CustomControl field={field} value={draft.custom[field.reportingKey]} onChange={(next) => updateCustom(field.reportingKey, next)} />
            </Section>
          )
        )}
      </div>

      {/* Pinned action bar — reachable by thumb, always visible while scrolling. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground">
            {sync === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</>}
            {sync === "saved" && <><Cloud className="h-3.5 w-3.5" /> Tersimpan</>}
            {sync === "pending" && <span className="flex items-center gap-1.5 text-[var(--warning-foreground)]"><CloudOff className="h-3.5 w-3.5" /> Menunggu koneksi</span>}
          </span>
          <Button asChild variant="outline" className="h-11">
            <Link href={`/workspace/missions/${missionId}`}>Kembali</Link>
          </Button>
          <Button className="h-11" onClick={handleSubmit} disabled={submitting || missing.length > 0}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengirim…</> : <><Send className="h-4 w-4" /> Kirim laporan</>}
          </Button>
        </div>

        {missing.length > 0 && (
          <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
            Belum lengkap: {missing.map((key) => labelFor(key).toLowerCase()).join(", ")}
          </p>
        )}
        {missing.length === 0 && !submitting && (
          <p className="mx-auto mt-2 flex max-w-3xl items-center gap-1.5 text-xs text-[var(--success-foreground)]">
            <Check className="h-3.5 w-3.5" /> Laporan siap dikirim
          </p>
        )}
        {error && (
          <div className="mx-auto mt-2 flex max-w-3xl items-start gap-2 text-xs text-[var(--danger-foreground)]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
