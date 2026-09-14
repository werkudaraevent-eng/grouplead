"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, Loader2, Plus, Save } from "lucide-react"
import { createMission, type CreateMissionState } from "@/app/actions/mission-actions"
import { MISSION_TYPES } from "@/lib/missions/mission-schema"
import {
  DEFAULT_CONTACT_SALUTATIONS,
  configuredOptions,
  visibleFields,
  type FormField,
} from "@/lib/missions/form-fields"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/app/workspace/workspace-page"
import { CompanyPicker } from "./company-picker"
import { PeopleMultiPicker, PersonPicker } from "./people-picker"
import { ContactPicker, EMPTY_CONTACT, type ContactDraft } from "./contact-picker"
import { LocationPicker } from "./location-picker"
import { SchedulePicker, type ScheduleValue } from "./schedule-picker"
import type { ConflictSettings } from "@/lib/missions/mission-join"
import type { PersonSchedule } from "@/lib/missions/schedule-availability"

/**
 * Mission form, rendered from the tenant's field configuration.
 *
 * Order and labels come from the config, so an admin reordering or relabelling
 * a field, core or custom, changes this form without a deploy. Core fields keep
 * purpose-built inputs; everything else is generic by type.
 *
 * Surfaces follow Material's tonal logic rather than its look: the page is the
 * lowest tone, each section is a card one step up, and every field is one step
 * off the card. Before this the page, the card and every field were all white,
 * so the form read as a sheet of words with nothing to say where one answer
 * ended and the next began. The tones are this app's own tokens; see DESIGN.md.
 */

const SELECT_CLASS =
  "h-12 w-full rounded-md border border-input bg-field px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-field px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const PLACEHOLDER_JOBTITLE = "GM, Direktur, dan sebagainya"
const PLACEHOLDER_PHONE = "08…"
const PLACEHOLDER_EMAIL = "nama@perusahaan.com"

/**
 * How much of the row a field takes.
 *
 * Sized to its content rather than packed two-per-row: a time input holds five
 * characters and looked lost in half a page, while the three schedule fields
 * belong on one line because they are read as one answer. The grid is six
 * columns so halves (3), thirds (2) and a third-plus-rest pair (2 + 4) all land
 * on it exactly.
 */
type Span = "full" | "wide" | "half" | "third"

const SPAN_CLASS: Record<Span, string> = {
  full: "sm:col-span-6",
  wide: "sm:col-span-4",
  half: "sm:col-span-3",
  third: "sm:col-span-2",
}

const CORE_SPANS: Record<string, Span> = {
  client_company: "full",
  mission_type: "half",
  location: "half",
  date: "full",
  start_time: "full",
  end_time: "full",
  objective: "full",
  primary_sales: "half",
  supporting_sales: "full",
  // A salutation is one short word; it takes a third and leaves the name the
  // rest of the row, so "Bapak" and "Nofri Ardian" read as one line.
  contact_salutation: "third",
  contact_name: "wide",
  contact_job_title: "half",
  contact_division: "half",
  contact_phone: "half",
  contact_email: "half",
  building: "full",
  appointment_notes: "full",
}

/**
 * Sections, so seventeen fields read as three answerable questions instead of
 * one long run: what the visit is, who goes, and who is being met.
 *
 * A section is emitted whenever it changes while walking the admin's configured
 * order, rather than by regrouping the fields. The admin's ordering stays the
 * ordering; if they interleave, the sections repeat and show them exactly that.
 */
const CORE_SECTIONS: Record<string, string> = {
  client_company: "Kunjungan",
  mission_type: "Kunjungan",
  location: "Kunjungan",
  objective: "Kunjungan",
  primary_sales: "Tim yang berangkat",
  supporting_sales: "Tim yang berangkat",
  date: "Jadwal",
  start_time: "Jadwal",
  end_time: "Jadwal",
  contact_salutation: "Janji temu",
  contact_name: "Janji temu",
  contact_job_title: "Janji temu",
  contact_division: "Janji temu",
  contact_phone: "Janji temu",
  contact_email: "Janji temu",
  building: "Janji temu",
  appointment_notes: "Janji temu",
}

/** One line under each section title saying what the section decides. */
const SECTION_HINTS: Record<string, string> = {
  Kunjungan: "Ke mana dan untuk apa.",
  "Tim yang berangkat": "Siapa yang memimpin kunjungan dan siapa yang mendampingi. Kalender di bawah mengikuti jadwal mereka.",
  Jadwal: "Kunjungan tim yang dipilih tergambar di sini, jadi jam yang diambil tidak bentrok.",
  "Janji temu": "Siapa yang ditemui dan apa yang sudah disepakati saat membuat janji.",
  Tambahan: "Field yang ditambahkan admin unit bisnis ini.",
}

/**
 * Where a linked contact's detail came from.
 *
 * Without this the form said "Tertaut ke kontak di LeadEngine" above two empty
 * boxes, and the rep could not tell a CRM that holds nothing from a link that
 * half failed. Four in ten contacts in this CRM have no job title, so that
 * ambiguity was the common case rather than the edge.
 */
function ContactSource({ crmValue }: { crmValue: string | null | undefined }) {
  return (
    <p className="text-xs text-muted-foreground">
      {crmValue ? "Dari CRM." : "Belum ada di CRM. Yang Anda isi bisa dikirim balik saat lead dibuat."}
    </p>
  )
}

function sectionOf(field: FormField): string {
  return field.isCore ? CORE_SECTIONS[field.reportingKey] ?? "Lainnya" : "Tambahan"
}

function spanOf(field: FormField): Span {
  if (field.isCore) return CORE_SPANS[field.reportingKey] ?? "half"
  if (field.fieldType === "LONG_TEXT" || field.fieldType === "MULTI_SELECT" || field.fieldType === "BOOLEAN") {
    return "full"
  }
  return "half"
}

/**
 * Label above, control, supporting text below. Required is marked, optional is
 * not: marking the smaller set is both quieter and the thing people scan for.
 */
function FieldShell({
  field,
  children,
  span,
  as = "field",
}: {
  field: FormField
  children: React.ReactNode
  span?: Span
  /**
   * "group" for a set of checkboxes, which has no single control to point at.
   * A `for` naming an id nothing renders leaves the label attached to nothing:
   * clicking it focuses nothing, and a screen reader announces each checkbox
   * with no idea which question it answers.
   */
  as?: "field" | "group"
}) {
  const labelId = `label-${field.reportingKey}`

  return (
    <div className={`space-y-2 ${SPAN_CLASS[span ?? spanOf(field)]}`}>
      <Label id={labelId} htmlFor={as === "field" ? `field-${field.reportingKey}` : undefined} className="text-foreground">
        {/* One span, so the shared Label's `gap-2` does not push the marker
            10px clear of the word it qualifies. */}
        <span>
          {field.label}
          {field.isRequired && (
            <span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>
          )}
        </span>
      </Label>
      {as === "group" ? (
        <div role="group" aria-labelledby={labelId}>{children}</div>
      ) : (
        children
      )}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  )
}

/** Input for an admin-created field, chosen by its configured type. */
function CustomField({ field, initial }: { field: FormField; initial?: unknown }) {
  const name = `custom__${field.reportingKey}`
  const id = `field-${field.reportingKey}`
  const initialText = typeof initial === "string" || typeof initial === "number" ? String(initial) : ""
  const initialList = Array.isArray(initial) ? initial.map(String) : []

  if (field.fieldType === "BOOLEAN") {
    return (
      <div className={`space-y-2 ${SPAN_CLASS.full}`}>
        <div className="flex min-h-12 items-center gap-2.5">
          <Checkbox id={id} name={name} value="true" defaultChecked={initial === true} />
          <Label htmlFor={id} className="font-normal text-foreground">{field.label}</Label>
        </div>
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      </div>
    )
  }

  if (field.fieldType === "MULTI_SELECT") {
    return (
      <FieldShell field={field} as="group">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {field.options.map((option) => (
            <div className="flex min-h-12 items-center gap-2.5" key={option}>
              <Checkbox id={`${id}-${option}`} name={name} value={option} defaultChecked={initialList.includes(option)} />
              <Label htmlFor={`${id}-${option}`} className="font-normal text-foreground">{option}</Label>
            </div>
          ))}
        </div>
      </FieldShell>
    )
  }

  if (field.fieldType === "SELECT") {
    return (
      <FieldShell field={field}>
        <select id={id} name={name} required={field.isRequired} defaultValue={initialText} className={SELECT_CLASS}>
          <option value="">{field.placeholder || "Pilih salah satu"}</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </FieldShell>
    )
  }

  if (field.fieldType === "LONG_TEXT") {
    return (
      <FieldShell field={field}>
        <textarea
          id={id}
          name={name}
          required={field.isRequired}
          rows={3}
          maxLength={4000}
          defaultValue={initialText}
          placeholder={field.placeholder ?? ""}
          className={TEXTAREA_CLASS}
        />
      </FieldShell>
    )
  }

  const inputType =
    field.fieldType === "DATE" ? "date" : field.fieldType === "TIME" ? "time" : "text"
  const inputMode = field.fieldType === "NUMBER" || field.fieldType === "CURRENCY" ? "numeric" : undefined

  return (
    <FieldShell field={field}>
      <Input
        id={id}
        name={name}
        type={inputType}
        inputMode={inputMode}
        required={field.isRequired}
        defaultValue={initialText}
        placeholder={field.placeholder ?? ""}
        className="h-12"
      />
    </FieldShell>
  )
}

/**
 * What a form can start from when it is not blank: a cancelled mission being
 * rescheduled. Everything but the date carries over, because the client who
 * called it off usually asked for another day, not a different visit.
 */
export interface MissionPrefill {
  clientCompanyName: string
  clientCompanyId: string | null
  missionType: string
  location: string
  objective: string
  primarySalesId: string
  supportingSalesIds: string[]
  contactSalutation: string
  contactId: string
  contactName: string
  contactJobTitle: string
  contactDivision: string
  contactPhone: string
  contactEmail: string
  building: string
  appointmentNotes: string
}

export function MissionForm({
  salesOptions,
  defaultDate,
  fields,
  schedules,
  conflictSettings,
  prefill,
  edit,
}: {
  salesOptions: TenantSalesOption[]
  defaultDate: string
  fields: FormField[]
  /** Every member's upcoming visits, so the picker can draw the assignees' days. */
  schedules: PersonSchedule[]
  conflictSettings: ConflictSettings
  prefill?: MissionPrefill
  /**
   * Editing an existing mission. The same form, already filled in, posting to
   * updateMission. The schedule is shown but not editable here: moving it is
   * a separate action that tells the team. Custom answers are seeded too.
   */
  edit?: {
    missionId: string
    action: (previous: CreateMissionState, formData: FormData) => Promise<CreateMissionState>
    schedule: ScheduleValue
    customValues: Record<string, unknown>
    /**
     * Whether this person may move the slot. If so the picker is here, one
     * form for everything; if not, the slot is shown read-only and a change
     * is a proposal made from the mission page.
     */
    canMoveSchedule: boolean
  }
}) {
  // On success the action redirects server-side, so this state only ever holds
  // a failure worth showing.
  const [state, formAction, pending] = useActionState<CreateMissionState, FormData>(edit?.action ?? createMission, null)

  // Tracked so the supporting list can exclude whoever is leading the visit.
  const [primarySalesId, setPrimarySalesId] = useState(prefill?.primarySalesId ?? "")
  const [supportingIds, setSupportingIds] = useState<string[]>(prefill?.supportingSalesIds ?? [])
  const [schedule, setSchedule] = useState<ScheduleValue>(edit?.schedule ?? { date: defaultDate, startTime: "09:30", endTime: "" })
  const [location, setLocation] = useState(prefill?.location ?? "")

  // The calendars the picker draws: whoever is being sent. Nothing until a
  // primary is chosen, because an empty calendar looks like a free one.
  const assignedPeople = [primarySalesId, ...supportingIds]
    .map((id) => schedules.find((person) => person.userId === id))
    .filter((person): person is PersonSchedule => Boolean(person))

  // The CRM link, lifted out of the company picker so the contact field can
  // offer that company's known people.
  const [clientCompanyId, setClientCompanyId] = useState<string | null>(prefill?.clientCompanyId ?? null)
  const [contact, setContact] = useState<ContactDraft>(
    prefill?.contactName
      ? {
          id: prefill.contactId,
          name: prefill.contactName,
          jobTitle: prefill.contactJobTitle,
          phone: prefill.contactPhone,
          email: prefill.contactEmail,
          crm: null,
        }
      : EMPTY_CONTACT
  )

  const errorRef = useRef<HTMLDivElement>(null)

  // The alert sits at the top of a form that is taller than the screen, so on a
  // phone a failed submit used to look like nothing had happened at all.
  useEffect(() => {
    if (!state?.error) return
    errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    errorRef.current?.focus()
  }, [state])

  if (salesOptions.length === 0) {
    return (
      <EmptyState
        title="Belum ada anggota tim"
        description="Mission butuh minimal satu sales untuk ditugaskan. Minta admin menambahkan anggota ke unit bisnis ini lebih dulu."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/workspace/missions">Kembali ke daftar mission</Link>
          </Button>
        }
      />
    )
  }

  // Both lists come from the tenant's configuration, not from code, so a value
  // added in Pengaturan appears here without a deploy. The fallback covers a
  // tenant seeded before the options existed, and is the same fallback the
  // server validates against.
  const missionTypes = configuredOptions(fields, "mission_type", MISSION_TYPES)
  const salutations = configuredOptions(fields, "contact_salutation", DEFAULT_CONTACT_SALUTATIONS)

  // Core fields keep dedicated inputs; the config only decides their label,
  // order, and whether they are mandatory.
  const coreField = (field: FormField): React.ReactNode => {
    switch (field.reportingKey) {
      case "client_company":
        return (
          <FieldShell field={field} key={field.id}>
            <CompanyPicker
              label={field.label}
              required={field.isRequired}
              initial={prefill ? { name: prefill.clientCompanyName, id: prefill.clientCompanyId } : undefined}
              onLink={(id) => {
                setClientCompanyId(id)
                // A different company means a different set of people, so a
                // contact picked from the previous one is no longer theirs.
                setContact((prev) => (prev.id ? EMPTY_CONTACT : prev))
              }}
            />
          </FieldShell>
        )
      case "mission_type":
        return (
          <FieldShell field={field} key={field.id}>
            <select id="field-mission_type" name="missionType" defaultValue={prefill?.missionType && missionTypes.includes(prefill.missionType) ? prefill.missionType : missionTypes[0]} className={SELECT_CLASS}>
              {missionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </FieldShell>
        )
      case "location":
        return (
          <FieldShell field={field} key={field.id}>
            <LocationPicker
              id="field-location"
              required={field.isRequired}
              placeholder={field.placeholder ?? "Jakarta Selatan"}
              initial={prefill?.location}
              onChange={setLocation}
            />
          </FieldShell>
        )
      case "date": {
        // One picker answers date, start and end together; the two time
        // fields below render nothing so the admin's ordering still holds.
        const endField = fields.find((item) => item.reportingKey === "end_time")
        if (edit && !edit.canMoveSchedule) {
          // Read-only for someone who may only propose. The slot still
          // submits (the schema expects it); a change is refused server-side.
          return (
            <div key={field.id} className={`space-y-2 ${SPAN_CLASS.full}`}>
              <input type="hidden" name="date" value={schedule.date} />
              <input type="hidden" name="startTime" value={schedule.startTime} />
              <input type="hidden" name="endTime" value={schedule.endTime} />
              <p className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed bg-muted/40 px-4 py-3 text-sm">
                <span className="text-foreground">
                  <span className="font-semibold">{field.label}:</span> {schedule.date}, {schedule.startTime}
                  {schedule.endTime ? `–${schedule.endTime}` : ""}
                </span>
                <Link href={`/workspace/missions/${edit.missionId}#jawaban`} className="text-xs font-semibold text-primary hover:underline">
                  Usulkan jadwal lain di halaman mission
                </Link>
              </p>
            </div>
          )
        }
        const scheduleChanged =
          edit !== undefined &&
          (schedule.date !== edit.schedule.date || schedule.startTime !== edit.schedule.startTime || schedule.endTime !== edit.schedule.endTime)
        return (
          <FieldShell field={field} key={field.id} as="group">
            <SchedulePicker
              value={schedule}
              onChange={setSchedule}
              people={assignedPeople}
              settings={conflictSettings}
              location={location || null}
              missionId={edit?.missionId}
              now={new Date()}
              endRequired={endField?.isRequired ?? false}
            />
            {/* Google Calendar's "send update to guests?", asked in place: the
                team is told the slot moved, and this line travels with it. */}
            {scheduleChanged && (
              <div className="mt-3 space-y-1.5 rounded-md border border-[var(--warning-foreground)]/25 bg-[var(--warning)] px-4 py-3">
                <Label htmlFor="field-schedule_reason" className="text-sm font-semibold text-[var(--warning-foreground)]">
                  Jadwal berubah. Tim akan diberi tahu.
                </Label>
                <Input
                  id="field-schedule_reason"
                  name="scheduleReason"
                  maxLength={1000}
                  placeholder="Alasan perubahan jadwal (opsional), ikut dikirim ke tim"
                  className="h-11 bg-card"
                />
              </div>
            )}
          </FieldShell>
        )
      }
      case "start_time":
      case "end_time":
        return null
      case "objective":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-objective" name="objective" maxLength={1000} required={field.isRequired} defaultValue={prefill?.objective} placeholder={field.placeholder ?? "Apa yang ingin dicapai dari kunjungan ini?"} className="h-12" />
          </FieldShell>
        )
      case "primary_sales":
        return (
          <FieldShell field={field} key={field.id}>
            <PersonPicker
              id="field-primary_sales"
              name="primarySalesId"
              required
              people={salesOptions}
              value={primarySalesId}
              onChange={(id) => {
                setPrimarySalesId(id)
                // Whoever now leads cannot also support. Dropping them here
                // rather than only hiding them stops a stale hidden input
                // submitting a person the schema will reject.
                setSupportingIds((prev) => prev.filter((item) => item !== id))
              }}
              placeholder="Pilih sales utama"
            />
          </FieldShell>
        )
      case "contact_salutation":
        return (
          <FieldShell field={field} key={field.id}>
            <select
              id="field-contact_salutation"
              name="contactSalutation"
              defaultValue={prefill?.contactSalutation ?? ""}
              required={field.isRequired}
              className={SELECT_CLASS}
            >
              <option value="">{field.placeholder || "Pilih"}</option>
              {salutations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </FieldShell>
        )
      case "contact_name":
        return (
          <FieldShell field={field} key={field.id}>
            <ContactPicker
              clientCompanyId={clientCompanyId}
              value={contact}
              onChange={setContact}
              required={field.isRequired}
              placeholder={field.placeholder ?? "Nama lengkap"}
            />
          </FieldShell>
        )
      case "contact_job_title":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-contact_job_title" name="contactJobTitle" maxLength={150} required={field.isRequired} placeholder={field.placeholder ?? PLACEHOLDER_JOBTITLE} value={contact.jobTitle} onChange={(e) => setContact({ ...contact, jobTitle: e.target.value })} className="h-12" />
            {contact.id && <ContactSource crmValue={contact.crm?.jobTitle} />}
          </FieldShell>
        )
      case "contact_division":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-contact_division" name="contactDivision" maxLength={150} required={field.isRequired} defaultValue={prefill?.contactDivision} placeholder={field.placeholder ?? "Marketing, Procurement, dan sebagainya"} className="h-12" />
          </FieldShell>
        )
      case "contact_phone":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-contact_phone" name="contactPhone" type="tel" inputMode="tel" autoComplete="tel" maxLength={50} required={field.isRequired} placeholder={field.placeholder ?? PLACEHOLDER_PHONE} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="h-12" />
            {contact.id && <ContactSource crmValue={contact.crm?.phone} />}
          </FieldShell>
        )
      case "contact_email":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-contact_email" name="contactEmail" type="email" inputMode="email" autoComplete="email" maxLength={200} required={field.isRequired} placeholder={field.placeholder ?? PLACEHOLDER_EMAIL} value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="h-12" />
            {contact.id && <ContactSource crmValue={contact.crm?.email} />}
          </FieldShell>
        )
      case "building":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-building" name="building" maxLength={300} required={field.isRequired} defaultValue={prefill?.building} placeholder={field.placeholder ?? "Menara BCA lt. 21"} className="h-12" />
          </FieldShell>
        )
      case "appointment_notes":
        return (
          <FieldShell field={field} key={field.id}>
            <textarea
              id="field-appointment_notes"
              name="appointmentNotes"
              defaultValue={prefill?.appointmentNotes}
              rows={4}
              maxLength={4000}
              required={field.isRequired}
              placeholder={field.placeholder ?? "Apa yang sudah dibicarakan saat membuat janji: permintaan klien, materi yang diminta, siapa lagi yang akan hadir."}
              className={TEXTAREA_CLASS}
            />
          </FieldShell>
        )
      case "supporting_sales": {
        // The primary drops out of this list. One person cannot hold both roles
        // on a mission (the schema rejects it and the assignments table has a
        // unique key on mission_id and user_id), so offering the choice only
        // invites an error after the form is filled in.
        const supportingOptions = salesOptions.filter((option) => option.id !== primarySalesId)

        return (
          <FieldShell field={field} key={field.id}>
            <PeopleMultiPicker
              id="field-supporting_sales"
              name="supportingSalesIds"
              people={supportingOptions}
              value={supportingIds.filter((item) => item !== primarySalesId)}
              onChange={setSupportingIds}
              placeholder="Tambah sales pendukung"
              // Only reachable when the tenant has exactly one member and they
              // are the primary; the form already refuses to render with none.
              emptyLabel="Belum ada anggota lain di unit bisnis ini."
            />
          </FieldShell>
        )
      }
      default:
        return null
    }
  }

  const ordered = visibleFields(fields)
  const requiredCount = ordered.filter((field) => field.isRequired).length

  /*
    Cut the configured order into consecutive runs of the same section, so each
    run becomes ONE card with ONE grid. A column span only means something among
    siblings; a field in its own grid would sit alone on its row at a third of
    the width with the rest empty.
  */
  const blocks: Array<{ section: string; fields: FormField[] }> = []
  for (const field of ordered) {
    const section = sectionOf(field)
    const current = blocks[blocks.length - 1]
    if (current && current.section === section) current.fields.push(field)
    else blocks.push({ section, fields: [field] })
  }

  return (
    // Left-aligned, not centred. The page title sits at the left edge, so a
    // centred form left the heading and the thing it describes on different
    // axes with a stripe of empty page between them.
    <form action={formAction} className="max-w-3xl space-y-4">
      {state?.error ? (
        <div
          ref={errorRef}
          tabIndex={-1}
          className="flex items-start gap-2.5 rounded-xl border border-[var(--danger-foreground)]/20 bg-[var(--danger)] px-5 py-4 text-sm text-[var(--danger-foreground)] outline-none"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      ) : null}

      {requiredCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Bertanda <span className="text-[var(--danger-foreground)]">*</span> wajib diisi. Sisanya boleh dilewati.
        </p>
      )}

      {/*
        One card per section. Material separates a long form into cards when
        each group answers a different question, and uses a divider between a
        card's header and its body. The title is a step above the field label
        in the type scale (16px/600 against 14px/500), and the supporting line
        under it says what the section decides, which is what tells a rep on a
        phone whether this is the part they came to fill in.
      */}
      {blocks.map((block, index) => (
        <section
          key={`${block.section}-${index}`}
          aria-labelledby={`section-${index}`}
          className="overflow-clip rounded-xl border bg-card"
        >
          <header className="border-b px-5 py-4 sm:px-6">
            <h2 id={`section-${index}`} className="text-base font-semibold tracking-tight text-foreground">
              {block.section}
            </h2>
            {SECTION_HINTS[block.section] && (
              <p className="mt-0.5 text-sm text-muted-foreground">{SECTION_HINTS[block.section]}</p>
            )}
          </header>
          <div className="grid gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-6 sm:px-6">
            {block.fields.map((field) =>
              field.isCore ? coreField(field) : <CustomField key={field.id} field={field} initial={edit?.customValues[field.reportingKey]} />
            )}
          </div>
        </section>
      ))}

      {/*
        Actions at the trailing edge, filled for the primary and outlined for
        the secondary. On a phone the row pins to the bottom of the viewport
        with an opaque card background, because seventeen fields put the save
        button a long scroll from wherever you finished; from sm up it is the
        last row of the form, where nothing scrolls beneath it and a bar parked
        over the fields would only cover them. The negative margin below sm
        matches the page's own padding so the bar runs edge to edge.
      */}
      <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t bg-card px-4 py-3 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Button asChild variant="outline" type="button" className="h-12 md:h-10">
          <Link href={edit ? `/workspace/missions/${edit.missionId}` : "/workspace/missions"}>Batal</Link>
        </Button>
        <Button type="submit" disabled={pending} className="h-12 md:h-10">
          {pending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</>
          ) : edit ? (
            <><Save className="h-4 w-4" /> Simpan perubahan</>
          ) : (
            <><Plus className="h-4 w-4" /> Simpan mission</>
          )}
        </Button>
      </div>
    </form>
  )
}
