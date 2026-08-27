"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { AlertCircle, Loader2, Plus } from "lucide-react"
import { createMission, type CreateMissionState } from "@/app/actions/mission-actions"
import { MISSION_TYPES } from "@/lib/missions/mission-schema"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { EmptyState } from "@/app/workspace/workspace-page"

function Section({ kicker, title, children }: { kicker: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-b px-5 py-6 last:border-b-0 sm:px-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{kicker}</p>
      <h2 className="mt-1 text-base font-semibold text-foreground">{title}</h2>
      <div className="mt-5">{children}</div>
    </div>
  )
}

export function MissionForm({ salesOptions, defaultDate }: { salesOptions: TenantSalesOption[]; defaultDate: string }) {
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

  return (
    <form action={formAction} className="mx-auto max-w-3xl overflow-hidden rounded-xl border bg-card">
      {state?.error ? (
        <div className="flex items-start gap-2.5 border-b bg-destructive/10 px-5 py-4 text-sm text-destructive sm:px-6" role="alert">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{state.error}</p>
        </div>
      ) : null}

      <Section kicker="Visit details" title="What is happening?">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="clientCompanyName">Client company</Label>
            <Input id="clientCompanyName" name="clientCompanyName" required maxLength={200} placeholder="Nama perusahaan klien" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="missionType">Mission type</Label>
            <select
              id="missionType"
              name="missionType"
              defaultValue="Meeting"
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {MISSION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input id="location" name="location" maxLength={300} placeholder="Jakarta Selatan" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" name="date" required type="date" defaultValue={defaultDate} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startTime">Start time</Label>
              <Input id="startTime" name="startTime" required type="time" defaultValue="09:30" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endTime">End time</Label>
              <Input id="endTime" name="endTime" type="time" />
            </div>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="objective">Objective</Label>
            <Input id="objective" name="objective" maxLength={1000} placeholder="Apa yang ingin dicapai dari kunjungan ini?" />
          </div>
        </div>
      </Section>

      <Section kicker="Assignment" title="Who will attend?">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="primarySalesId">Primary sales</Label>
            <select
              id="primarySalesId"
              name="primarySalesId"
              required
              defaultValue=""
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="" disabled>Pilih sales utama</option>
              {salesOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Primary sales harus menerima sebelum mission berjalan.</p>
          </div>

          <fieldset className="space-y-2.5">
            <legend className="text-sm font-medium">
              Supporting sales <span className="font-normal text-muted-foreground">(opsional)</span>
            </legend>
            <div className="max-h-44 space-y-2.5 overflow-y-auto custom-scrollbar pr-1">
              {salesOptions.map((option) => (
                <div className="flex items-center gap-2.5" key={option.id}>
                  <Checkbox id={`supporting-${option.id}`} name="supportingSalesIds" value={option.id} />
                  <Label htmlFor={`supporting-${option.id}`} className="font-normal">{option.name}</Label>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      </Section>

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
