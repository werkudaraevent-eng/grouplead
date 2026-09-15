"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { AlertCircle, CalendarDays, Check, Clock, Cloud, CloudOff, Loader2, Plus, Save, Send, Trash2 } from "@/components/icons"
import { discardVisitReportDraft, saveVisitReportDraft, submitVisitReport } from "@/app/actions/visit-report-actions"
import {
  missingConfiguredFields,
  missingSubmitFields,
  outcomeRequiresContacts,
  isAppointmentContact,
  type InterestLevel,
  type NextActionType,
  type ReportContactInput,
  type VisitOutcome,
} from "@/lib/missions/visit-report-schema"
import { visibleFields, type FieldAnswer, type FormField } from "@/lib/missions/form-fields"
import { choicesFor, isNoAction, noActionCode, type ChoiceSet } from "@/lib/missions/report-choices"
import { parsePhotoAnswer } from "@/lib/photos/photo-answer"
import { describeTiming, formatVisitWindow, splitMissionInstant, toVisitInstants } from "@/lib/missions/visit-time"
import { PhotoField } from "@/components/photo-field"
import type { VisitReportRecord } from "@/lib/missions/mission-queries"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import type { ReportOptions } from "@/lib/missions/report-options"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FormActionBar } from "@/components/form-action-bar"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput } from "@/components/ui/number-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { cn } from "@/lib/utils"

/**
 * Visit report, rendered from the tenant's configuration on the same
 * structure as the mission form.
 *
 * The order, labels, help text and requiredness come from the admin's form
 * builder; any field they added renders in place among the core ones. Core
 * fields keep purpose-built controls because their answers carry a meaning
 * the KPI screen and the CRM sync depend on; the code's own rules for them
 * cannot be loosened, only tightened.
 *
 * Structure follows the mission form so the two feel like one product: one
 * card per section (consecutive fields of the same section share a card),
 * a header with the section's question, fields on a six-column grid sized
 * to their content, page tone under card tone under field tone. The action
 * row sticks to the bottom of the content column, never over the sidebar.
 *
 * One scrolling screen rather than a wizard: on a weak connection a wizard
 * forces navigation between steps and risks losing what was typed. A draft
 * autosaves as it is filled.
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
  actualDate: string | null
  actualStartTime: string | null
  actualEndTime: string | null
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

/** Which card a core field lives in. Custom fields go to "Tambahan". */
const CORE_SECTIONS: Record<string, string> = {
  visit_outcome: "Hasil kunjungan",
  visit_time: "Hasil kunjungan",
  contacts_met: "Hasil kunjungan",
  visit_photos: "Hasil kunjungan",
  business_card_photos: "Hasil kunjungan",
  meeting_summary: "Isi pertemuan",
  client_needs: "Isi pertemuan",
  product_interest: "Isi pertemuan",
  interest_level: "Penilaian",
  opportunity_exists: "Penilaian",
  estimated_value: "Penilaian",
  competitor_mentioned: "Penilaian",
  next_action_type: "Tindak lanjut",
  next_action_owner: "Tindak lanjut",
  follow_up_date: "Tindak lanjut",
}

const SECTION_HINTS: Record<string, string> = {
  "Hasil kunjungan": "Apa yang terjadi di sana dan siapa yang ditemui.",
  "Isi pertemuan": "Apa yang dibahas, apa yang mereka butuhkan, apa yang menarik minat.",
  Penilaian: "Seberapa panas peluangnya, dan nilai yang bisa diperkirakan.",
  "Tindak lanjut": "Langkah berikutnya, siapa yang memegang, kapan.",
  Tambahan: "Pertanyaan yang ditambahkan admin unit bisnis ini.",
}

type Span = "full" | "half" | "third"
const SPAN_CLASS: Record<Span, string> = { full: "sm:col-span-6", half: "sm:col-span-3", third: "sm:col-span-2" }

/** How much of the row a field takes, sized to its content like the mission form. */
function spanOf(field: FormField): Span {
  if (field.isCore) {
    if (["estimated_value", "competitor_mentioned", "next_action_owner", "follow_up_date"].includes(field.reportingKey)) return "half"
    return "full"
  }
  if (field.fieldType === "DATE" || field.fieldType === "TIME" || field.fieldType === "NUMBER" || field.fieldType === "CURRENCY") return "third"
  if (field.fieldType === "TEXT" || field.fieldType === "SELECT" || field.fieldType === "BOOLEAN") return "half"
  return "full"
}

const FIELD_CLASS =
  "w-full rounded-md border border-input bg-field px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function toDraft(report: VisitReportRecord | null, appointmentContact: ReportContactInput | null, noAction: string, schedule: { start: string | null; end: string | null }): Draft {
  return {
    visitOutcome: report?.visitOutcome ?? null,
    meetingSummary: report?.meetingSummary ?? "",
    clientNeeds: report?.clientNeeds ?? [],
    productInterest: report?.productInterest ?? [],
    interestLevel: report?.interestLevel ?? null,
    opportunityExists: report?.opportunityExists ?? false,
    estimatedValue: report?.estimatedValue ?? null,
    competitorMentioned: report?.competitorMentioned ?? "",
    nextActionType: report?.nextActionType ?? noAction,
    nextActionOwner: report?.nextActionOwner ?? null,
    followUpDate: report?.followUpDate ?? null,
    // The visit's real window: what was reported, else the appointment, so
    // a visit that went as planned costs no typing.
    actualDate: (report ? splitMissionInstant(report.actualStart) : splitMissionInstant(schedule.start))?.date ?? null,
    actualStartTime: (report ? splitMissionInstant(report.actualStart) : splitMissionInstant(schedule.start))?.time ?? null,
    actualEndTime: (report ? splitMissionInstant(report.actualEnd) : splitMissionInstant(schedule.end))?.time ?? null,
    // A fresh report starts with the person the visit was arranged with. A
    // saved draft keeps whatever the rep left, including an emptied list.
    contacts: report ? report.contacts : appointmentContact ? [{ ...appointmentContact }] : [],
    custom: (report?.custom as Record<string, FieldAnswer> | undefined) ?? {},
  }
}

/** Label, required marker, help text, and the control, on the shared grid. */
function FieldShell({ field, hint, span, children }: { field: FormField; hint?: string; span?: Span; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-2", SPAN_CLASS[span ?? spanOf(field)])}>
      <Label className="text-foreground">
        <span>
          {field.label}
          {field.isRequired && <span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>}
        </span>
      </Label>
      {children}
      {(field.helpText ?? hint) && <p className="text-xs text-muted-foreground">{field.helpText ?? hint}</p>}
    </div>
  )
}

/**
 * Choice chips. Material's filter chip for a one-of-few or some-of-many
 * answer: larger and faster to hit than a native select on a phone, and
 * every option visible at once so nothing is hidden behind a dropdown.
 */
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card text-foreground hover:bg-muted"
      )}
    >
      {on && <Check className="h-3.5 w-3.5" />}
      {children}
    </button>
  )
}

function ChipGroup<T extends string>({ options, value, onChange, labels }: { options: readonly T[]; value: T | null; onChange: (next: T) => void; labels: Record<T, string> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => <Chip key={option} on={value === option} onClick={() => onChange(option)}>{labels[option]}</Chip>)}
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
        {[...options, ...extras].map((option) => <Chip key={option} on={value.includes(option)} onClick={() => onToggle(option)}>{option}</Chip>)}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Lainnya…" className="h-11 max-w-xs" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add() } }} />
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={add}>Tambah</Button>
        </div>
      )}
    </div>
  )
}

/** One choice as chips, with "Lainnya…" when the admin lets people answer off the list. */
function SingleChip({ options, value, onChange, allowCustom }: { options: string[]; value: string | null; onChange: (next: string | null) => void; allowCustom: boolean }) {
  const [custom, setCustom] = useState("")
  const extra = value && !options.includes(value) ? value : null
  const add = () => {
    const trimmed = custom.trim()
    if (trimmed) { onChange(trimmed); setCustom("") }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {[...options, ...(extra ? [extra] : [])].map((option) => <Chip key={option} on={value === option} onClick={() => onChange(value === option ? null : option)}>{option}</Chip>)}
      </div>
      {allowCustom && (
        <div className="flex gap-2">
          <Input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Lainnya…" className="h-11 max-w-xs" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add() } }} />
          <Button type="button" variant="outline" className="h-11 shrink-0" onClick={add} disabled={!custom.trim()}>Tambah</Button>
        </div>
      )}
    </div>
  )
}

/** A field the admin added, by its configured type, bound to the draft. */
function CustomControl({ field, value, onChange, scope }: { field: FormField; value: FieldAnswer | undefined; onChange: (next: FieldAnswer) => void; scope: string }) {
  const id = `custom-${field.reportingKey}`
  if (field.fieldType === "PHOTO") {
    return <PhotoField id={id} scope={scope} value={parsePhotoAnswer(value)} onChange={(next) => onChange(next)} hint={field.placeholder || undefined} />
  }
  if (field.fieldType === "BOOLEAN") {
    return (
      <div className="flex min-h-12 items-center gap-2.5">
        <Checkbox id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} />
        <Label htmlFor={id} className="font-normal text-foreground">{field.placeholder || "Ya"}</Label>
      </div>
    )
  }
  if (field.fieldType === "MULTI_SELECT") {
    const list = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []
    return <MultiChip options={field.options} value={list} onToggle={(option) => onChange(list.includes(option) ? list.filter((item) => item !== option) : [...list, option])} onAddCustom={(option) => { if (!list.includes(option)) onChange([...list, option]) }} allowCustom={field.allowOther} />
  }
  if (field.fieldType === "SELECT") {
    return <SingleChip options={field.options} value={typeof value === "string" ? value : null} onChange={(next) => onChange(next)} allowCustom={field.allowOther} />
  }
  if (field.fieldType === "LONG_TEXT") {
    return <textarea id={id} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} rows={4} maxLength={4000} placeholder={field.placeholder ?? ""} className={cn(FIELD_CLASS, "py-2.5")} />
  }
  if (field.fieldType === "NUMBER" || field.fieldType === "CURRENCY") {
    return (
      <NumberInput
        id={id}
        prefix={field.fieldType === "CURRENCY" ? "Rp" : undefined}
        value={typeof value === "number" ? value : null}
        onChange={onChange}
        placeholder={field.placeholder ?? "0"}
      />
    )
  }
  const type = field.fieldType === "DATE" ? "date" : field.fieldType === "TIME" ? "time" : "text"
  return (
    <Input
      id={id}
      type={type}
      value={value === null || value === undefined ? "" : String(value)}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder ?? ""}
      className="h-12"
    />
  )
}

export function VisitReportForm({
  missionId,
  clientName,
  schedule,
  report,
  appointmentContact,
  editing,
  choices,
  options,
  salesOptions,
  fields,
}: {
  missionId: string
  clientName: string
  /** The appointment, so the visit window starts filled and can be compared. */
  schedule: { start: string | null; end: string | null }
  report: VisitReportRecord | null
  /** The mission's appointment contact, offered as the first person met. */
  appointmentContact: ReportContactInput | null
  /**
   * Set when a sent report is being changed: autosave is off (there is no
   * draft to keep), a reason is required, and saving files the old version.
   */
  editing?: { leadPushed: boolean } | null
  /** The tenant's options for the three fixed choices, kinds included. */
  choices: ChoiceSet
  /** Fallback vocabularies, used only when the configured field has no options. */
  options: ReportOptions
  salesOptions: TenantSalesOption[]
  fields: FormField[]
}) {
  const router = useRouter()
  const [draft, setDraft] = useState<Draft>(() => toDraft(report, appointmentContact, noActionCode(choices), schedule))
  const [sync, setSync] = useState<SyncState>("idle")
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [changeReason, setChangeReason] = useState("")
  const [submitting, startSubmit] = useTransition()
  // A draft exists once the server has one: loaded with the page, or saved
  // since. Discarding sets this back and stops the autosave from recreating it.
  const [hasDraft, setHasDraft] = useState(report !== null)
  const [discarding, setDiscarding] = useState<"ask" | "busy" | null>(null)
  const discarded = useRef(false)

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
    // A sent report has no draft: nothing is written until "Simpan perubahan".
    if (!dirty.current || editing) return
    const delay = attempt === 0 ? AUTOSAVE_DELAY_MS : Math.min(RETRY_CEILING_MS, RETRY_BASE_MS * 2 ** (attempt - 1))
    const timer = setTimeout(async () => {
      if (discarded.current) return
      setSync("saving")
      const result = await saveVisitReportDraft(missionId, latest.current)
      if (discarded.current) return
      if (result.success) {
        dirty.current = false
        setAttempt(0)
        setSync("saved")
        setHasDraft(true)
      } else {
        setSync("pending")
        setAttempt((value) => value + 1)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [draft, missionId, attempt, editing])

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
      const result = await submitVisitReport(missionId, { ...latest.current, changeReason: changeReason.trim() })
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
  const needsContacts = outcomeRequiresContacts(draft.visitOutcome, choices)
  const outcomeChoices = choicesFor(choices, "visit_outcome", draft.visitOutcome)
  const interestChoices = choicesFor(choices, "interest_level", draft.interestLevel)
  const nextActionChoices = choicesFor(choices, "next_action_type", draft.nextActionType)
  const labelsOf = (list: typeof outcomeChoices) => Object.fromEntries(list.map((choice) => [choice.code, choice.label]))
  // Offered back whenever the appointment contact is not in the list, so a
  // removed or pre-feature draft is one tap from correct.
  const appointmentMissing = Boolean(appointmentContact) && !draft.contacts.some((contact) => isAppointmentContact(contact, appointmentContact))

  const missing = [...new Set([
    ...missingSubmitFields(draft).map((prop) => DRAFT_TO_KEY[prop] ?? prop),
    ...missingConfiguredFields(draft, fields),
  ])]

  const clientNeedOptions = byKey.get("client_needs")?.options.length ? byKey.get("client_needs")!.options : options.clientNeeds
  const productOptions = byKey.get("product_interest")?.options.length ? byKey.get("product_interest")!.options : options.productInterest

  const renderCore = (field: FormField): React.ReactNode => {
    switch (field.reportingKey) {
      case "visit_outcome":
        return (
          <FieldShell key={field.id} field={field} hint={`Kunjungan ke ${clientName}`}>
            <ChipGroup options={outcomeChoices.map((choice) => choice.code)} value={draft.visitOutcome} onChange={(next) => update("visitOutcome", next)} labels={labelsOf(outcomeChoices)} />
          </FieldShell>
        )
      case "visit_time": {
        const instants = toVisitInstants(draft)
        const timing = describeTiming(instants.start, schedule.start)
        const planned = schedule.start ? formatVisitWindow(schedule.start, schedule.end) : null
        const stampNow = () => {
          const now = splitMissionInstant(new Date().toISOString())
          if (!now) return
          if (!draft.actualDate || !draft.actualStartTime) {
            setDraft((previous) => ({ ...previous, actualDate: now.date, actualStartTime: now.time }))
          } else {
            setDraft((previous) => ({ ...previous, actualEndTime: now.time }))
          }
          dirty.current = true
          setAttempt(0)
        }
        return (
          <FieldShell key={field.id} field={field} hint={undefined}>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_1fr_1fr_auto]">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Tanggal</span>
                <Input type="date" aria-label="Tanggal kunjungan" className="h-12" value={draft.actualDate ?? ""} onChange={(event) => update("actualDate", event.target.value || null)} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Mulai</span>
                <Input type="time" aria-label="Jam mulai" className="h-12" value={draft.actualStartTime ?? ""} onChange={(event) => update("actualStartTime", event.target.value || null)} />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Selesai</span>
                <Input type="time" aria-label="Jam selesai" className="h-12" value={draft.actualEndTime ?? ""} onChange={(event) => update("actualEndTime", event.target.value || null)} />
              </div>
              <div className="flex items-end">
                {/* One tap on the phone: the first press stamps the start, the next the end. */}
                <Button type="button" variant="outline" className="h-12 w-full sm:w-auto" onClick={stampNow}>
                  <Clock className="h-4 w-4" /> {!draft.actualDate || !draft.actualStartTime ? "Mulai sekarang" : "Selesai sekarang"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {planned ? `Dijadwalkan ${planned}.` : "Mission ini belum punya jadwal."}
              {timing && (
                <span className={cn("ml-1.5 font-medium", timing.tone === "success" ? "text-[var(--success-foreground)]" : timing.tone === "warning" ? "text-[var(--warning-foreground)]" : "text-foreground")}>{timing.text}.</span>
              )}
            </p>
          </FieldShell>
        )
      }
      case "contacts_met":
        return (
          <FieldShell key={field.id} field={field} hint={needsContacts ? undefined : "Klien tidak ada, bagian ini opsional."}>
            <div className="space-y-3">
              {draft.contacts.map((contact, index) => (
                <div key={index} className="rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center justify-between">
                    <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-foreground">
                      Kontak {index + 1}
                      {isAppointmentContact(contact, appointmentContact) && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Dari janji temu</span>
                      )}
                    </p>
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => update("contacts", draft.contacts.filter((_, i) => i !== index))} aria-label={`Hapus kontak ${index + 1}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`contact-name-${index}`}>Nama</Label>
                      <Input id={`contact-name-${index}`} className="h-12 bg-card" value={contact.fullName} onChange={(e) => updateContact(index, { fullName: e.target.value })} placeholder="Nama lengkap" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-title-${index}`}>Jabatan</Label>
                      <Input id={`contact-title-${index}`} className="h-12 bg-card" value={contact.jobTitle ?? ""} onChange={(e) => updateContact(index, { jobTitle: e.target.value })} placeholder="GM, Direktur, …" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-phone-${index}`}>Telepon</Label>
                      <PhoneInput id={`contact-phone-${index}`} inputClassName="bg-card" value={contact.phone ?? ""} onChange={(next) => updateContact(index, { phone: next })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`contact-email-${index}`}>Email</Label>
                      <Input id={`contact-email-${index}`} className="h-12 bg-card" inputMode="email" value={contact.email ?? ""} onChange={(e) => updateContact(index, { email: e.target.value })} placeholder="nama@perusahaan.com" />
                    </div>
                    <div className="flex min-h-11 items-center gap-2.5 sm:col-span-2">
                      <Checkbox id={`contact-dm-${index}`} checked={contact.isDecisionMaker} onCheckedChange={(checked) => updateContact(index, { isDecisionMaker: checked === true })} />
                      <Label htmlFor={`contact-dm-${index}`} className="font-normal">Pengambil keputusan</Label>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-2 sm:flex-row">
                {appointmentMissing && appointmentContact && (
                  <Button type="button" variant="outline" className="h-12 w-full sm:w-auto" onClick={() => update("contacts", [{ ...appointmentContact }, ...draft.contacts])}>
                    <CalendarDays className="h-4 w-4" /> Tambah {appointmentContact.fullName} (janji temu)
                  </Button>
                )}
                <Button type="button" variant="outline" className="h-12 w-full sm:w-auto" onClick={() => update("contacts", [...draft.contacts, { ...EMPTY_CONTACT }])}>
                  <Plus className="h-4 w-4" /> Tambah kontak
                </Button>
              </div>
            </div>
          </FieldShell>
        )
      case "meeting_summary":
        return (
          <FieldShell key={field.id} field={field}>
            <textarea value={draft.meetingSummary} onChange={(event) => update("meetingSummary", event.target.value)} rows={5} maxLength={5000} placeholder={field.placeholder ?? "Ceritakan singkat jalannya pertemuan…"} className={cn(FIELD_CLASS, "py-2.5")} />
          </FieldShell>
        )
      case "client_needs":
        return (
          <FieldShell key={field.id} field={field}>
            <MultiChip options={clientNeedOptions} value={draft.clientNeeds} onToggle={toggleIn("clientNeeds")} onAddCustom={addCustom("clientNeeds")} allowCustom={field.allowOther} />
          </FieldShell>
        )
      case "product_interest":
        return (
          <FieldShell key={field.id} field={field}>
            <MultiChip options={productOptions} value={draft.productInterest} onToggle={toggleIn("productInterest")} onAddCustom={addCustom("productInterest")} allowCustom={field.allowOther} />
          </FieldShell>
        )
      case "interest_level":
        return (
          <FieldShell key={field.id} field={field}>
            <ChipGroup options={interestChoices.map((choice) => choice.code)} value={draft.interestLevel} onChange={(next) => update("interestLevel", next)} labels={labelsOf(interestChoices)} />
          </FieldShell>
        )
      case "opportunity_exists":
        return (
          <FieldShell key={field.id} field={field}>
            <div className="flex min-h-12 items-center gap-2.5">
              <Checkbox id="opportunity" checked={draft.opportunityExists} onCheckedChange={(checked) => update("opportunityExists", checked === true)} />
              <Label htmlFor="opportunity" className="font-normal text-foreground">{field.placeholder || "Ada peluang, bisa dikirim ke LeadEngine"}</Label>
            </div>
          </FieldShell>
        )
      case "estimated_value":
        return (
          <FieldShell key={field.id} field={field}>
            <NumberInput id="estimatedValue" prefix="Rp" value={draft.estimatedValue} onChange={(next) => update("estimatedValue", next)} placeholder={field.placeholder ?? "0"} />
          </FieldShell>
        )
      case "competitor_mentioned":
        return (
          <FieldShell key={field.id} field={field}>
            <Input id="competitor" className="h-12" value={draft.competitorMentioned} onChange={(event) => update("competitorMentioned", event.target.value)} placeholder={field.placeholder ?? "Opsional"} />
          </FieldShell>
        )
      case "next_action_type":
        return (
          <FieldShell key={field.id} field={field}>
            <ChipGroup options={nextActionChoices.map((choice) => choice.code)} value={draft.nextActionType} onChange={(next) => update("nextActionType", next)} labels={labelsOf(nextActionChoices)} />
          </FieldShell>
        )
      case "next_action_owner":
        if (isNoAction(draft.nextActionType, choices)) return null
        return (
          <FieldShell key={field.id} field={field}>
            <select id="nextActionOwner" value={draft.nextActionOwner ?? ""} onChange={(event) => update("nextActionOwner", event.target.value || null)} className={cn(FIELD_CLASS, "h-12")}>
              <option value="">Pilih penanggung jawab</option>
              {salesOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </FieldShell>
        )
      case "visit_photos":
      case "business_card_photos":
        return (
          <FieldShell key={field.id} field={field}>
            <PhotoField
              id={`custom-${field.reportingKey}`}
              scope={missionId}
              value={parsePhotoAnswer(draft.custom[field.reportingKey])}
              onChange={(next) => updateCustom(field.reportingKey, next)}
              max={field.reportingKey === "business_card_photos" ? 3 : 5}
              hint={field.placeholder || undefined}
            />
          </FieldShell>
        )
      case "follow_up_date":
        if (isNoAction(draft.nextActionType, choices)) return null
        return (
          <FieldShell key={field.id} field={field}>
            <Input id="followUpDate" className="h-12" type="date" value={draft.followUpDate ?? ""} onChange={(event) => update("followUpDate", event.target.value || null)} />
          </FieldShell>
        )
      default:
        return null
    }
  }

  // Consecutive fields of one section share a card, so the admin's order is
  // the order and a section repeats if they interleave. Same rule as the
  // mission form.
  const sectionOf = (field: FormField) => (field.isCore ? CORE_SECTIONS[field.reportingKey] ?? "Lainnya" : "Tambahan")
  const blocks: Array<{ section: string; fields: FormField[] }> = []
  for (const field of ordered) {
    const section = sectionOf(field)
    const current = blocks[blocks.length - 1]
    if (current && current.section === section) current.fields.push(field)
    else blocks.push({ section, fields: [field] })
  }

  return (
    <div className="space-y-4">
      {report?.clarificationNote && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--warning-foreground)]/20 bg-[var(--warning)] px-5 py-4 text-sm text-[var(--warning-foreground)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Admin meminta klarifikasi</p>
            <p className="mt-1">{report.clarificationNote}</p>
          </div>
        </div>
      )}

      {editing && (
        <div className="space-y-3 rounded-xl border border-[var(--warning-foreground)]/20 bg-[var(--warning)] px-5 py-4 text-sm text-[var(--warning-foreground)]">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Mengubah laporan yang sudah dikirim</p>
              <p className="mt-1">
                Versi yang sekarang disimpan ke riwayat bersama alasan Anda, dan angka di Laporan mengikuti versi baru.
                {editing.leadPushed && " Lead yang sudah dikirim ke LeadEngine tidak ikut berubah."}
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="change-reason" className="text-[var(--warning-foreground)]">Alasan perubahan <span aria-hidden="true">*</span></Label>
            <Input
              id="change-reason"
              value={changeReason}
              maxLength={300}
              onChange={(event) => setChangeReason(event.target.value)}
              placeholder="Contoh: nilai estimasi salah ketik, seharusnya 150 juta"
              className="h-12 bg-card"
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Bertanda <span className="text-[var(--danger-foreground)]">*</span> wajib diisi. {editing ? "Perubahan disimpan saat Anda menekan Simpan perubahan." : "Draf tersimpan otomatis."}
      </p>

      {blocks.map((block, index) => (
        <section key={`${block.section}-${index}`} aria-labelledby={`report-section-${index}`} className="overflow-clip rounded-xl border bg-card">
          <header className="border-b px-5 py-4 sm:px-6">
            <h2 id={`report-section-${index}`} className="text-base font-semibold tracking-tight text-foreground">{block.section}</h2>
            {SECTION_HINTS[block.section] && <p className="mt-0.5 text-sm text-muted-foreground">{SECTION_HINTS[block.section]}</p>}
          </header>
          <div className="grid gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-6 sm:px-6">
            {block.fields.map((field) =>
              field.isCore ? (
                renderCore(field)
              ) : (
                <FieldShell key={field.id} field={field}>
                  <CustomControl field={field} value={draft.custom[field.reportingKey]} onChange={(next) => updateCustom(field.reportingKey, next)} scope={missionId} />
                </FieldShell>
              )
            )}
          </div>
        </section>
      ))}

      {/* Action row: fixed to the phone's bottom edge, the last row from sm up. */}
      <FormActionBar>
        {missing.length > 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">Belum lengkap: {missing.map((key) => labelFor(key).toLowerCase()).join(", ")}</p>
        ) : editing && !changeReason.trim() ? (
          <p className="mb-2 text-xs text-muted-foreground">Tulis alasan perubahan di atas.</p>
        ) : !submitting ? (
          <p className="mb-2 flex items-center gap-1.5 text-xs text-[var(--success-foreground)]"><Check className="h-3.5 w-3.5" /> {editing ? "Perubahan siap disimpan" : "Laporan siap dikirim"}</p>
        ) : null}
        {error && (
          <div className="mb-2 flex items-start gap-2 text-xs text-[var(--danger-foreground)]">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
        <div className="flex items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {sync === "saving" && <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan…</>}
            {sync === "saved" && <><Cloud className="h-3.5 w-3.5" /> Tersimpan</>}
            {sync === "pending" && <span className="flex items-center gap-1.5 text-[var(--warning-foreground)]"><CloudOff className="h-3.5 w-3.5" /> Menunggu koneksi</span>}
            {/* The way back to "belum diisi": a text button, the quietest kind,
                because it undoes rather than does; the dialog carries the weight. */}
            {hasDraft && !editing && (
              <button
                type="button"
                onClick={() => setDiscarding("ask")}
                disabled={submitting || discarding === "busy"}
                className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 font-medium text-[var(--danger-foreground)] hover:bg-[var(--danger)]"
              >
                <Trash2 className="h-3.5 w-3.5" /> Buang draf
              </button>
            )}
          </span>
          <Button asChild variant="outline" className="h-12 md:h-10">
            <Link href={`/workspace/missions/${missionId}`}>Kembali</Link>
          </Button>
          <Button className="h-12 md:h-10" onClick={handleSubmit} disabled={submitting || missing.length > 0 || (Boolean(editing) && !changeReason.trim())}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> {editing ? "Menyimpan…" : "Mengirim…"}</> : editing ? <><Save className="h-4 w-4" /> Simpan perubahan</> : <><Send className="h-4 w-4" /> Kirim laporan</>}
          </Button>
        </div>
      </FormActionBar>

      <Dialog open={discarding !== null} onOpenChange={(open) => { if (!open && discarding !== "busy") setDiscarding(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buang draf laporan ini?</DialogTitle>
            <DialogDescription>
              Semua isian yang tersimpan untuk kunjungan ke {clientName} dihapus, dan mission kembali ke keadaan belum ada laporan. Laporan yang sudah dikirim tidak terpengaruh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscarding(null)} disabled={discarding === "busy"}>Simpan draf</Button>
            <Button
              disabled={discarding === "busy"}
              className="bg-[var(--danger-foreground)] text-white hover:bg-[var(--danger-foreground)]/90"
              onClick={async () => {
                setDiscarding("busy")
                discarded.current = true
                dirty.current = false
                const result = await discardVisitReportDraft(missionId)
                if (!result.success) {
                  discarded.current = false
                  setDiscarding(null)
                  toast.error(result.error ?? "Draft gagal dibuang.")
                  return
                }
                setHasDraft(false)
                toast.success("Draf dibuang")
                router.push(`/workspace/missions/${missionId}`)
                router.refresh()
              }}
            >
              {discarding === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Buang draf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
