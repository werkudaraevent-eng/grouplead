"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, Loader2, Save } from "@/components/icons"
import { createProspect, updateProspect, type ProspectFormState } from "@/app/actions/prospect-actions"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { scrollInPanel } from "@/lib/ui/scroll-in-panel"
import { DEFAULT_INDUSTRIES, configuredOptions, type FormField } from "@/lib/missions/form-fields"
import type { ProspectDetail } from "@/lib/prospects/prospect-schema"
import { PROSPECT_SECTION_HINTS, prospectBlocks } from "@/lib/prospects/prospect-form-fields"
import { parseNumber } from "@/lib/format/number"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiChoiceWithOther, SelectWithOther } from "@/components/ui/choice-with-other"
import { PhotoField } from "@/components/photo-field"
import { parsePhotoAnswer } from "@/lib/photos/photo-answer"
import { FormActionBar } from "@/components/form-action-bar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NumberInput } from "@/components/ui/number-input"
import { PhoneInput } from "@/components/ui/phone-input"
import { CompanyPicker } from "@/app/workspace/activities/new/company-picker"
import { LocationPicker } from "@/app/workspace/activities/new/location-picker"
import { PersonPicker } from "@/app/workspace/activities/new/people-picker"

/**
 * One prospect, by hand, rendered from the tenant's prospect form.
 *
 * Order, labels, required marks, placeholders and help text come from the
 * configuration, so an admin reordering or relabelling a field changes this
 * form without a deploy. Core fields keep purpose-built inputs (the company
 * picker, the city picker, the phone field, the owner picker); everything
 * the admin added is generic by type. Same pickers as the mission form so a
 * company typed here is the same company there.
 */

const SELECT_CLASS =
  "flex h-12 w-full rounded-md border border-input bg-field px-3 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
const TEXTAREA_CLASS =
  "w-full rounded-md border border-input bg-field px-3 py-2.5 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

type Span = "full" | "wide" | "half" | "third"
const SPAN_CLASS: Record<Span, string> = { full: "sm:col-span-6", wide: "sm:col-span-4", half: "sm:col-span-3", third: "sm:col-span-2" }
const CORE_SPANS: Record<string, Span> = {
  client_company: "full",
  industry: "half",
  website: "half",
  address: "full",
  location: "half",
  contact_salutation: "third",
  contact_name: "wide",
  contact_job_title: "half",
  contact_division: "half",
  contact_phone: "half",
  contact_email: "half",
  notes: "full",
  owner: "half",
}

function spanOf(field: FormField): Span {
  if (field.isCore) return CORE_SPANS[field.reportingKey] ?? "half"
  if (field.fieldType === "LONG_TEXT" || field.fieldType === "MULTI_SELECT" || field.fieldType === "BOOLEAN") return "full"
  return "half"
}

/** Label above, control, supporting text below. Required is marked, optional is not. */
function FieldShell({ field, children, as = "field" }: { field: FormField; children: React.ReactNode; as?: "field" | "group" }) {
  const labelId = `label-${field.reportingKey}`
  return (
    <div className={`space-y-2 ${SPAN_CLASS[spanOf(field)]}`}>
      <Label id={labelId} htmlFor={as === "field" ? `field-${field.reportingKey}` : undefined} className="text-foreground">
        <span>
          {field.label}
          {field.isRequired && <span className="ml-0.5 text-[var(--danger-foreground)]" aria-hidden="true">*</span>}
        </span>
      </Label>
      {as === "group" ? <div role="group" aria-labelledby={labelId}>{children}</div> : children}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  )
}

/** The form is uncontrolled, so a formatted number needs its own bit of state and a hidden input. */
function NumberField({ id, name, initial, currency, required, placeholder }: { id: string; name: string; initial: string; currency: boolean; required: boolean; placeholder: string }) {
  const [value, setValue] = useState<number | null>(() => parseNumber(initial))
  return <NumberInput id={id} name={name} prefix={currency ? "Rp" : undefined} value={value} onChange={setValue} required={required} placeholder={placeholder} />
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
        <MultiChoiceWithOther id={id} name={name} options={field.options} defaultValue={initialList} allowOther={field.allowOther} />
      </FieldShell>
    )
  }
  if (field.fieldType === "SELECT") {
    return (
      <FieldShell field={field}>
        <SelectWithOther id={id} name={name} options={field.options} defaultValue={initialText} required={field.isRequired} placeholder={field.placeholder || undefined} allowOther={field.allowOther} />
      </FieldShell>
    )
  }
  if (field.fieldType === "PHOTO") {
    return (
      <FieldShell field={field}>
        <PhotoField id={id} name={name} scope="prospects" defaultValue={parsePhotoAnswer(initial)} hint={field.placeholder || undefined} />
      </FieldShell>
    )
  }

  if (field.fieldType === "LONG_TEXT") {
    return (
      <FieldShell field={field}>
        <textarea id={id} name={name} required={field.isRequired} rows={3} maxLength={4000} defaultValue={initialText} placeholder={field.placeholder ?? ""} className={TEXTAREA_CLASS} />
      </FieldShell>
    )
  }
  if (field.fieldType === "NUMBER" || field.fieldType === "CURRENCY") {
    return (
      <FieldShell field={field}>
        <NumberField id={id} name={name} initial={initialText} currency={field.fieldType === "CURRENCY"} required={field.isRequired} placeholder={field.placeholder ?? "0"} />
      </FieldShell>
    )
  }
  const inputType = field.fieldType === "DATE" ? "date" : field.fieldType === "TIME" ? "time" : "text"
  return (
    <FieldShell field={field}>
      <Input id={id} name={name} type={inputType} required={field.isRequired} defaultValue={initialText} placeholder={field.placeholder ?? ""} className="h-12" />
    </FieldShell>
  )
}

export function ProspectForm({
  fields,
  salesOptions,
  salutations,
  salutationsAllowOther,
  viewerId,
  canAssignOthers,
  prospect,
}: {
  /** The tenant's prospect form, core and custom, in the admin's order. */
  fields: FormField[]
  salesOptions: TenantSalesOption[]
  /** The salutation list, shared with the mission form. */
  salutations: string[]
  /** Whether the mission form lets people type a salutation off that list. */
  salutationsAllowOther?: boolean
  viewerId: string
  canAssignOthers: boolean
  /** Editing: the prospect to fill from, custom answers included. */
  prospect?: ProspectDetail
}) {
  const action = prospect ? updateProspect.bind(null, prospect.id) : createProspect
  const [state, formAction, pending] = useActionState<ProspectFormState, FormData>(action, null)
  const [clientCompanyId, setClientCompanyId] = useState<string | null>(prospect?.clientCompanyId ?? null)
  // Industry as it stands; a CRM company fills it only while it is empty.
  const [industry, setIndustry] = useState(prospect?.industry ?? "")
  const [industryKey, setIndustryKey] = useState(0)
  const [phone, setPhone] = useState(prospect?.contactPhone ?? "")
  const [ownerId, setOwnerId] = useState(prospect?.ownerId ?? viewerId)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state?.error) return
    if (errorRef.current) scrollInPanel(errorRef.current)
    errorRef.current?.focus({ preventScroll: true })
  }, [state])

  const people = salesOptions.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))
  const blocks = prospectBlocks(fields)
  const requiredCount = fields.filter((field) => field.isActive && field.isRequired).length
  const customValues = prospect?.customValues ?? {}

  const text = (field: FormField, name: string, value: string | null | undefined, extra: React.ComponentProps<typeof Input> = {}) => (
    <FieldShell field={field} key={field.id}>
      <Input id={`field-${field.reportingKey}`} name={name} required={field.isRequired} defaultValue={value ?? ""} placeholder={field.placeholder ?? undefined} className="h-12" {...extra} />
    </FieldShell>
  )

  const coreField = (field: FormField): React.ReactNode => {
    switch (field.reportingKey) {
      case "client_company":
        return (
          <FieldShell field={field} key={field.id}>
            <CompanyPicker
              label={field.label}
              required={field.isRequired}
              onLink={setClientCompanyId}
              onPickCompany={(company) => {
                if (!company?.industry || industry) return
                setIndustry(company.industry)
                setIndustryKey((key) => key + 1)
              }}
              initial={prospect ? { name: prospect.clientCompanyName, id: prospect.clientCompanyId, industry: prospect.industry } : undefined}
            />
          </FieldShell>
        )
      case "industry": {
        // A value stored before the list changed stays selectable, marked, so
        // editing an old prospect does not silently drop what it had.
        const options = configuredOptions(fields, "industry", DEFAULT_INDUSTRIES)
        const stale = industry && !options.includes(industry) && !field.allowOther ? industry : null
        return (
          <FieldShell field={field} key={field.id}>
            <SelectWithOther
              key={industryKey}
              id="field-industry"
              name="industry"
              options={stale ? [`${stale}`, ...options] : options}
              defaultValue={industry}
              onChange={setIndustry}
              required={field.isRequired}
              placeholder={field.placeholder || "Pilih industri"}
              allowOther={field.allowOther}
            />
          </FieldShell>
        )
      }
      case "website":
        return text(field, "website", prospect?.website, { maxLength: 200, inputMode: "url", placeholder: field.placeholder ?? "arunika.co.id" })
      case "address":
        return text(field, "address", prospect?.address, { maxLength: 300, autoComplete: "address-line1", placeholder: field.placeholder ?? "Jl. Jend. Sudirman Kav. 52-53" })
      case "location":
        return (
          <FieldShell field={field} key={field.id}>
            <LocationPicker id="field-location" required={field.isRequired} placeholder={field.placeholder ?? "Jakarta Selatan"} initial={prospect?.location ?? undefined} />
          </FieldShell>
        )
      case "contact_salutation":
        return (
          <FieldShell field={field} key={field.id}>
            <SelectWithOther id="field-contact_salutation" name="contactSalutation" options={salutations} defaultValue={prospect?.contactSalutation ?? ""} required={field.isRequired} placeholder={field.placeholder || "—"} allowOther={salutationsAllowOther ?? false} />
          </FieldShell>
        )
      case "contact_name":
        return text(field, "contactName", prospect?.contactName, { maxLength: 150, placeholder: field.placeholder ?? "Nama lengkap" })
      case "contact_job_title":
        return text(field, "contactJobTitle", prospect?.contactJobTitle, { maxLength: 150, placeholder: field.placeholder ?? "GM Procurement" })
      case "contact_division":
        return text(field, "contactDivision", prospect?.contactDivision, { maxLength: 150, placeholder: field.placeholder ?? "Procurement" })
      case "contact_phone":
        return (
          <FieldShell field={field} key={field.id}>
            <PhoneInput id="field-contact_phone" name="contactPhone" value={phone} onChange={setPhone} required={field.isRequired} />
          </FieldShell>
        )
      case "contact_email":
        return text(field, "contactEmail", prospect?.contactEmail, { type: "email", inputMode: "email", maxLength: 200, placeholder: field.placeholder ?? "nama@perusahaan.com" })
      case "notes":
        return (
          <FieldShell field={field} key={field.id}>
            <textarea id="field-notes" name="notes" rows={3} maxLength={4000} required={field.isRequired} defaultValue={prospect?.notes ?? ""} placeholder={field.placeholder ?? "Dapat dari pameran, referensi klien lama, dan sebagainya."} className={TEXTAREA_CLASS} />
          </FieldShell>
        )
      case "owner":
        return (
          <FieldShell field={field} key={field.id}>
            {canAssignOthers ? (
              <PersonPicker id="field-owner" name="ownerId" people={people} value={ownerId} onChange={setOwnerId} placeholder={field.placeholder ?? "Pilih orang"} />
            ) : (
              <>
                <input type="hidden" name="ownerId" value={ownerId} />
                <p id="field-owner" className="flex h-12 items-center text-sm text-foreground">{people.find((person) => person.id === ownerId)?.name ?? "Kamu"}</p>
              </>
            )}
          </FieldShell>
        )
      default:
        return null
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--danger-foreground)]/25 bg-[var(--danger)] px-4 py-3 text-sm text-[var(--danger-foreground)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      <input type="hidden" name="clientCompanyId" value={clientCompanyId ?? ""} />

      {requiredCount > 0 && (
        <p className="text-xs text-muted-foreground">
          Bertanda <span className="text-[var(--danger-foreground)]">*</span> wajib diisi. Sisanya boleh dilewati.
        </p>
      )}

      {blocks.map((block, index) => (
        <section key={`${block.section}-${index}`} aria-labelledby={`prospect-section-${index}`} className="rounded-xl border bg-card">
          <header className="rounded-t-xl border-b px-5 py-4 sm:px-6">
            <h2 id={`prospect-section-${index}`} className="text-base font-semibold tracking-tight text-foreground">{block.section}</h2>
            {PROSPECT_SECTION_HINTS[block.section] && <p className="mt-0.5 text-sm text-muted-foreground">{PROSPECT_SECTION_HINTS[block.section]}</p>}
          </header>
          <div className="grid gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-6 sm:px-6">
            {block.fields.map((field) => (field.isCore ? coreField(field) : <CustomField key={field.id} field={field} initial={customValues[field.reportingKey]} />))}
          </div>
        </section>
      ))}

      <FormActionBar className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="outline" type="button" className="h-12 md:h-10">
          <Link href={prospect ? `/workspace/prospects/${prospect.id}` : "/workspace/prospects"}>Batal</Link>
        </Button>
        <Button type="submit" disabled={pending} className="h-12 md:h-10">
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</> : <><Save className="h-4 w-4" /> {prospect ? "Simpan perubahan" : "Simpan prospek"}</>}
        </Button>
      </FormActionBar>
    </form>
  )
}
