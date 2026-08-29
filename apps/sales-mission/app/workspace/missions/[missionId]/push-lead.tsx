"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, ExternalLink, Loader2, Send, TriangleAlert } from "lucide-react"
import { getPushPrecheck, pushMissionToLeadEngine, type PushPrecheck } from "@/app/actions/lead-push-actions"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

/**
 * "Send to LeadEngine".
 *
 * The three guards from the PRD are all visible before the button is pressed:
 * the owner is preselected from the CRM and overriding it warns, existing open
 * leads are listed, and the whole panel disappears once a push is recorded.
 */
export function PushLeadPanel({
  missionId,
  clientName,
  salesOptions,
  defaultProjectName,
  leadEngineUrl,
}: {
  missionId: string
  clientName: string
  salesOptions: TenantSalesOption[]
  defaultProjectName: string
  leadEngineUrl: string | null
}) {
  const [precheck, setPrecheck] = useState<PushPrecheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, start] = useTransition()
  const router = useRouter()

  const [form, setForm] = useState({
    projectName: defaultProjectName,
    pipelineId: "",
    pipelineStageId: "",
    ownerUserId: "",
    estimatedValue: "" as string,
    remark: "",
  })

  useEffect(() => {
    let active = true
    getPushPrecheck(missionId).then((result) => {
      if (!active) return
      setPrecheck(result)
      setLoading(false)
      setForm((current) => ({
        ...current,
        pipelineId: result.pipelines[0]?.id ?? "",
        pipelineStageId: result.pipelines[0]?.stages[0]?.id ?? "",
        ownerUserId: result.suggestedOwnerId ?? "",
      }))
    })
    return () => { active = false }
  }, [missionId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa kelayakan…
      </div>
    )
  }

  if (!precheck) return null

  if (precheck.alreadyPushed) {
    return (
      <div className="flex flex-wrap items-center gap-3 px-5 py-5">
        <p className="flex-1 text-sm text-muted-foreground">
          Mission ini sudah dikirim ke LeadEngine sebagai lead <span className="font-mono">{precheck.alreadyPushed.leadId}</span>.
        </p>
        {leadEngineUrl && (
          <Button asChild size="sm" variant="outline">
            <a href={`${leadEngineUrl}/pipeline`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Lihat di LeadEngine
            </a>
          </Button>
        )}
      </div>
    )
  }

  if (precheck.integrationError) {
    return (
      <div className="flex items-start gap-2.5 px-5 py-5 text-sm text-destructive">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{precheck.integrationError}</p>
      </div>
    )
  }

  if (!precheck.eligible) {
    return <p className="px-5 py-5 text-sm text-muted-foreground">{precheck.reason}</p>
  }

  const pipeline = precheck.pipelines.find((item) => item.id === form.pipelineId)
  const currentOwner = precheck.companyContext?.currentOwner ?? null
  const ownerOverridden = Boolean(currentOwner && form.ownerUserId !== currentOwner.userId)
  const openLeads = precheck.companyContext?.openLeads ?? []

  const submit = () => {
    start(async () => {
      const result = await pushMissionToLeadEngine(missionId, {
        projectName: form.projectName,
        pipelineId: form.pipelineId,
        pipelineStageId: form.pipelineStageId || null,
        ownerUserId: form.ownerUserId,
        estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : null,
        remark: form.remark,
        clientCompanyId: precheck.companyContext?.company.id ?? null,
      })

      if (result.success) {
        toast.success("Lead dibuat di LeadEngine")
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal mengirim lead")
      }
    })
  }

  return (
    <div className="space-y-5 px-5 py-5">
      {openLeads.length > 0 && (
        <div className="rounded-lg border border-[var(--warning-foreground)]/20 bg-[var(--warning)] p-4 text-sm text-[var(--warning-foreground)]">
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="h-4 w-4" /> {clientName} sudah punya {openLeads.length} lead aktif
          </p>
          <ul className="mt-2 space-y-1">
            {openLeads.slice(0, 3).map((lead) => (
              <li key={lead.id}>
                &ldquo;{lead.projectName}&rdquo;
                {lead.ownerName ? ` — ${lead.ownerName}` : ""}
                {lead.stageName ? `, stage ${lead.stageName}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-2">Pastikan ini benar-benar peluang baru sebelum menambah kartu kedua.</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="push-project">Nama proyek / kebutuhan</Label>
          <Input id="push-project" className="h-11" value={form.projectName} maxLength={300} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="push-pipeline">Pipeline tujuan</Label>
          <select
            id="push-pipeline"
            value={form.pipelineId}
            onChange={(e) => {
              const next = precheck.pipelines.find((item) => item.id === e.target.value)
              setForm({ ...form, pipelineId: e.target.value, pipelineStageId: next?.stages[0]?.id ?? "" })
            }}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {precheck.pipelines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="push-stage">Stage</Label>
          <select
            id="push-stage"
            value={form.pipelineStageId}
            onChange={(e) => setForm({ ...form, pipelineStageId: e.target.value })}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {(pipeline?.stages ?? []).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="push-owner">Pemilik lead</Label>
          <select
            id="push-owner"
            value={form.ownerUserId}
            onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Pilih pemilik</option>
            {salesOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </select>
          {ownerOverridden && (
            <p className="flex items-start gap-1.5 text-xs text-[var(--warning-foreground)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {clientName} sudah dipegang {currentOwner?.name}. Mengganti pemilik memindahkan akun ini.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="push-value">Estimasi nilai</Label>
          <Input
            id="push-value"
            className="h-11"
            inputMode="numeric"
            value={form.estimatedValue}
            onChange={(e) => setForm({ ...form, estimatedValue: e.target.value.replace(/[^\d]/g, "") })}
            placeholder="0"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="push-remark">Catatan untuk CRM</Label>
          <textarea
            id="push-remark"
            rows={3}
            maxLength={4000}
            value={form.remark}
            onChange={(e) => setForm({ ...form, remark: e.target.value })}
            placeholder="Kosongkan untuk memakai ringkasan pertemuan"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <Button
        className="h-11"
        disabled={pending || !form.projectName.trim() || !form.pipelineId || !form.ownerUserId}
        onClick={submit}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Kirim ke LeadEngine
      </Button>
    </div>
  )
}
