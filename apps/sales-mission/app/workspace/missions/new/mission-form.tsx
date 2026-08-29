"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader2, Plus } from "lucide-react"
import { createMission, type CreateMissionState } from "@/app/actions/mission-actions"
import { MISSION_TYPES } from "@/lib/missions/mission-schema"
import { isChoiceType, visibleFields, type FormField } from "@/lib/missions/form-fields"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/app/workspace/workspace-page"
import { CompanyPicker } from "./company-picker"

/**
 * Mission form, rendered from the tenant's field configuration.
 *
 * Order and labels come from the config, so an admin reordering or relabelling
 * a field — core or custom — changes this form without a deploy. Core fields
 * keep purpose-built inputs; everything else is generic by type.
 */

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

function FieldShell({
  field,
  children,
  wide = false,
}: {
  field: FormField
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
      <Label htmlFor={`field-${field.reportingKey}`}>
        {field.label}
        {!field.isRequired && <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>}
      </Label>
      {children}
      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
    </div>
  )
}

/** Input for an admin-created field, chosen by its configured type. */
function CustomField({ field }: { field: FormField }) {
  const name = `custom__${field.reportingKey}`
  const id = `field-${field.reportingKey}`

  if (field.fieldType === "BOOLEAN") {
    return (
      <div className="space-y-1.5 sm:col-span-2">
        <div className="flex items-center gap-2.5">
          <Checkbox id={id} name={name} value="true" />
          <Label htmlFor={id} className="font-normal">{field.label}</Label>
        </div>
        {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
      </div>
    )
  }

  if (field.fieldType === "MULTI_SELECT") {
    return (
      <FieldShell field={field} wide>
        <div className="flex flex-wrap gap-x-5 gap-y-2.5">
          {field.options.map((option) => (
            <div className="flex items-center gap-2.5" key={option}>
              <Checkbox id={`${id}-${option}`} name={name} value={option} />
              <Label htmlFor={`${id}-${option}`} className="font-normal">{option}</Label>
            </div>
          ))}
        </div>
      </FieldShell>
    )
  }

  if (field.fieldType === "SELECT") {
    return (
      <FieldShell field={field}>
        <select id={id} name={name} required={field.isRequired} defaultValue="" className={SELECT_CLASS}>
          <option value="">{field.placeholder || "Pilih salah satu"}</option>
          {field.options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </FieldShell>
    )
  }

  if (field.fieldType === "LONG_TEXT") {
    return (
      <FieldShell field={field} wide>
        <textarea
          id={id}
          name={name}
          required={field.isRequired}
          rows={3}
          maxLength={4000}
          placeholder={field.placeholder ?? ""}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
        placeholder={field.placeholder ?? ""}
        className="h-11"
      />
    </FieldShell>
  )
}

export function MissionForm({
  salesOptions,
  defaultDate,
  fields,
}: {
  salesOptions: TenantSalesOption[]
  defaultDate: string
  fields: FormField[]
}) {
  const [state, formAction, pending] = useActionState<CreateMissionState, FormData>(createMission, null)
  const router = useRouter()

  useEffect(() => {
    if (state?.success && state.data?.id) {
      router.push(`/workspace/missions/${state.data.id}`)
      router.refresh()
    }
  }, [state, router])

  if (salesOptions.length === 0) {
    return (
      <EmptyState
        title="Belum ada anggota tim"
        description="Mission butuh minimal satu sales untuk ditugaskan. Minta admin menambahkan anggota ke unit bisnis ini lebih dulu."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/workspace/missions">Kembali ke missions</Link>
          </Button>
        }
      />
    )
  }

  // Core fields keep dedicated inputs; the config only decides their label,
  // order, and whether they are mandatory.
  const coreField = (field: FormField): React.ReactNode => {
    switch (field.reportingKey) {
      case "client_company":
        return <CompanyPicker key={field.id} />
      case "mission_type":
        return (
          <FieldShell field={field} key={field.id}>
            <select id="field-mission_type" name="missionType" defaultValue="Meeting" className={SELECT_CLASS}>
              {MISSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </FieldShell>
        )
      case "location":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-location" name="location" maxLength={300} required={field.isRequired} placeholder={field.placeholder ?? "Jakarta Selatan"} className="h-11" />
          </FieldShell>
        )
      case "date":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-date" name="date" type="date" required defaultValue={defaultDate} className="h-11" />
          </FieldShell>
        )
      case "start_time":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-start_time" name="startTime" type="time" required defaultValue="09:30" className="h-11" />
          </FieldShell>
        )
      case "end_time":
        return (
          <FieldShell field={field} key={field.id}>
            <Input id="field-end_time" name="endTime" type="time" required={field.isRequired} className="h-11" />
          </FieldShell>
        )
      case "objective":
        return (
          <FieldShell field={field} key={field.id} wide>
            <Input id="field-objective" name="objective" maxLength={1000} required={field.isRequired} placeholder={field.placeholder ?? "Apa yang ingin dicapai dari kunjungan ini?"} className="h-11" />
          </FieldShell>
        )
      case "primary_sales":
        return (
          <FieldShell field={field} key={field.id}>
            <select id="field-primary_sales" name="primarySalesId" required defaultValue="" className={SELECT_CLASS}>
              <option value="" disabled>Pilih sales utama</option>
              {salesOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
          </FieldShell>
        )
      case "supporting_sales":
        return (
          <FieldShell field={field} key={field.id} wide>
            <div className="flex flex-wrap gap-x-5 gap-y-2.5">
              {salesOptions.map((option) => (
                <div className="flex items-center gap-2.5" key={option.id}>
                  <Checkbox id={`supporting-${option.id}`} name="supportingSalesIds" value={option.id} />
                  <Label htmlFor={`supporting-${option.id}`} className="font-normal">{option.name}</Label>
                </div>
              ))}
            </div>
          </FieldShell>
        )
      default:
        return null
    }
  }

  return (
    <form action={formAction} className="mx-auto max-w-3xl overflow-hidden rounded-xl border bg-card">
      {state?.error ? (
        <div className="flex items-start gap-2.5 border-b bg-destructive/10 px-5 py-4 text-sm text-destructive sm:px-6" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      ) : null}

      <div className="px-5 py-6 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2">
          {visibleFields(fields).map((field) =>
            field.isCore ? coreField(field) : <CustomField key={field.id} field={field} />
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 bg-muted/30 px-5 py-4 sm:px-6">
        <Button asChild variant="outline" type="button">
          <Link href="/workspace/missions">Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan…</> : <><Plus className="h-4 w-4" /> Save mission</>}
        </Button>
      </div>
    </form>
  )
}
