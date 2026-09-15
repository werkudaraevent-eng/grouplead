"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertCircle, Loader2, Save } from "@/components/icons"
import { createProspect, updateProspect, type ProspectFormState } from "@/app/actions/prospect-actions"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import type { ProspectDetail } from "@/lib/prospects/prospect-schema"
import { Button } from "@/components/ui/button"
import { FormActionBar } from "@/components/form-action-bar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PhoneInput } from "@/components/ui/phone-input"
import { CompanyPicker } from "@/app/workspace/missions/new/company-picker"
import { LocationPicker } from "@/app/workspace/missions/new/location-picker"
import { PersonPicker } from "@/app/workspace/missions/new/people-picker"

/**
 * One prospect, by hand. Three cards, the way the mission form is cut:
 * the company, the person to reach, and who holds it. Same pickers as the
 * mission form so a company typed here is the same company there.
 */

const SELECT_CLASS =
  "flex h-12 w-full rounded-md border border-input bg-field px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
const TEXTAREA_CLASS = `${SELECT_CLASS} h-auto min-h-28 py-2.5`

function Field({ id, label, optional, children, span = "half" }: { id?: string; label: string; optional?: boolean; children: React.ReactNode; span?: "half" | "full" }) {
  return (
    <div className={span === "full" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
      <Label htmlFor={id} className="text-foreground">
        <span>{label}{optional && <span className="ml-1 font-normal text-muted-foreground">(opsional)</span>}</span>
      </Label>
      {children}
    </div>
  )
}

export function ProspectForm({
  salesOptions,
  salutations,
  viewerId,
  canAssignOthers,
  prospect,
}: {
  salesOptions: TenantSalesOption[]
  salutations: string[]
  viewerId: string
  canAssignOthers: boolean
  /** Editing: the prospect to fill from. */
  prospect?: ProspectDetail
}) {
  const action = prospect ? updateProspect.bind(null, prospect.id) : createProspect
  const [state, formAction, pending] = useActionState<ProspectFormState, FormData>(action, null)
  const [clientCompanyId, setClientCompanyId] = useState<string | null>(prospect?.clientCompanyId ?? null)
  const [phone, setPhone] = useState(prospect?.contactPhone ?? "")
  const [ownerId, setOwnerId] = useState(prospect?.ownerId ?? viewerId)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state?.error) return
    errorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
    errorRef.current?.focus()
  }, [state])

  const people = salesOptions.map((person) => ({ id: person.id, name: person.name, avatarUrl: person.avatarUrl }))

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="flex items-start gap-2 rounded-lg border border-[var(--danger-foreground)]/25 bg-[var(--danger)] px-4 py-3 text-sm text-[var(--danger-foreground)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      )}
      <input type="hidden" name="clientCompanyId" value={clientCompanyId ?? ""} />

      <section className="rounded-xl border bg-card">
        <header className="rounded-t-xl border-b px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Perusahaan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Siapa yang akan dihubungi. Kalau sudah ada di LeadEngine, pilih dari daftar supaya tertaut.</p>
        </header>
        <div className="grid gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Field label="Perusahaan" span="full">
            <CompanyPicker label="Perusahaan" required onLink={setClientCompanyId} initial={prospect ? { name: prospect.clientCompanyName, id: prospect.clientCompanyId } : undefined} />
          </Field>
          <Field id="industry" label="Industri" optional>
            <Input id="industry" name="industry" maxLength={120} defaultValue={prospect?.industry ?? ""} placeholder="Farmasi, perbankan, pemerintahan…" className="h-12" />
          </Field>
          <Field id="website" label="Website" optional>
            <Input id="website" name="website" maxLength={200} defaultValue={prospect?.website ?? ""} placeholder="arunika.co.id" inputMode="url" className="h-12" />
          </Field>
          <Field id="address" label="Alamat jalan" optional span="full">
            <Input id="address" name="address" maxLength={300} defaultValue={prospect?.address ?? ""} autoComplete="address-line1" placeholder="Jl. Jend. Sudirman Kav. 52-53" className="h-12" />
          </Field>
          <Field id="field-location" label="Kota" optional>
            <LocationPicker id="field-location" required={false} placeholder="Jakarta Selatan" initial={prospect?.location ?? undefined} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="rounded-t-xl border-b px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Kontak</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Orang yang dihubungi. Nomor telepon disimpan dalam satu format supaya duplikat terdeteksi.</p>
        </header>
        <div className="grid gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Field id="contactSalutation" label="Sapaan" optional>
            <select id="contactSalutation" name="contactSalutation" defaultValue={prospect?.contactSalutation ?? ""} className={SELECT_CLASS}>
              <option value="">—</option>
              {salutations.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field id="contactName" label="Nama kontak" optional>
            <Input id="contactName" name="contactName" maxLength={150} defaultValue={prospect?.contactName ?? ""} placeholder="Nama lengkap" className="h-12" />
          </Field>
          <Field id="contactJobTitle" label="Jabatan" optional>
            <Input id="contactJobTitle" name="contactJobTitle" maxLength={150} defaultValue={prospect?.contactJobTitle ?? ""} placeholder="GM Procurement" className="h-12" />
          </Field>
          <Field id="contactDivision" label="Divisi" optional>
            <Input id="contactDivision" name="contactDivision" maxLength={150} defaultValue={prospect?.contactDivision ?? ""} placeholder="Procurement" className="h-12" />
          </Field>
          <Field id="contactPhone" label="Telepon" optional>
            <PhoneInput id="contactPhone" name="contactPhone" value={phone} onChange={setPhone} />
          </Field>
          <Field id="contactEmail" label="Email" optional>
            <Input id="contactEmail" name="contactEmail" type="email" inputMode="email" maxLength={200} defaultValue={prospect?.contactEmail ?? ""} placeholder="nama@perusahaan.com" className="h-12" />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="rounded-t-xl border-b px-5 py-4 sm:px-6">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Catatan dan pemegang</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Dari mana prospek ini datang, dan siapa yang menghubunginya.</p>
        </header>
        <div className="grid gap-x-4 gap-y-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
          <Field id="notes" label="Catatan" optional span="full">
            <textarea id="notes" name="notes" rows={3} maxLength={4000} defaultValue={prospect?.notes ?? ""} placeholder="Dapat dari pameran, referensi klien lama, dan sebagainya." className={TEXTAREA_CLASS} />
          </Field>
          <Field id="ownerId" label="Pemegang">
            {canAssignOthers ? (
              <PersonPicker id="ownerId" name="ownerId" people={people} value={ownerId} onChange={setOwnerId} placeholder="Pilih orang" />
            ) : (
              <>
                <input type="hidden" name="ownerId" value={ownerId} />
                <p className="flex h-12 items-center text-sm text-foreground">{people.find((person) => person.id === ownerId)?.name ?? "Kamu"}</p>
              </>
            )}
          </Field>
        </div>
      </section>

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
