"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Building2, ExternalLink, Loader2, Send, TriangleAlert } from "lucide-react"
import { getPushPrecheck, pushMissionToLeadEngine, type PushPrecheck } from "@/app/actions/lead-push-actions"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
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
    estimatedValue: null as number | null,
    remark: "",
    /** Empty means "register the typed name as a new CRM company". */
    linkedCompanyId: "",
  })

  /**
   * Contacts ticked for registration in the CRM.
   *
   * Starts empty, so nothing is created unless the rep says so. Defaulting these
   * on would make "push a lead" quietly mean "write four contacts too", which is
   * exactly the automatic behaviour that fills a CRM with typos.
   */
  const [registerContacts, setRegisterContacts] = useState<string[]>([])

  /** CRM contacts whose gaps the rep agreed to fill. Also opt-in. */
  const [enrichContacts, setEnrichContacts] = useState<string[]>([])

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
            <a href={`${leadEngineUrl}/leads/${precheck.alreadyPushed.leadId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Buka lead di LeadEngine
            </a>
          </Button>
        )}
      </div>
    )
  }

  if (precheck.integrationError) {
    return (
      <div className="flex items-start gap-2.5 px-5 py-5 text-sm text-[var(--danger-foreground)]">
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
        estimatedValue: form.estimatedValue,
        remark: form.remark,
        registerContactNames: registerContacts,
        enrichContactIds: enrichContacts,
        // Empty falls through to the server, which registers the typed name.
        clientCompanyId: form.linkedCompanyId || precheck.companyContext?.company.id || null,
      })

      if (result.success) {
        toast.success("Lead dibuat di LeadEngine")
        // Flip to the "sudah dikirim" state now rather than waiting for the
        // server render; the refresh then replaces this panel with the record.
        const leadId = result.data?.leadId
        if (leadId) setPrecheck((current) => (current ? { ...current, alreadyPushed: { leadId } } : current))
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal mengirim lead")
      }
    })
  }

  return (
    <div className="space-y-5 px-5 py-5">
      {precheck.contactEnrichments.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            Lengkapi kontak yang sudah ada di CRM
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Kunjungan ini tahu hal yang belum dicatat CRM. Hanya kolom yang masih kosong
            yang akan diisi, yang sudah terisi tidak akan ditimpa.
          </p>
          <ul className="mt-3 space-y-2">
            {precheck.contactEnrichments.map((item) => {
              const checked = enrichContacts.includes(item.contactId)
              return (
                <li key={item.contactId}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setEnrichContacts((prev) =>
                          next === true
                            ? [...prev, item.contactId]
                            : prev.filter((id) => id !== item.contactId)
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{item.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        Isi {item.fills.join(", ")}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {precheck.unlinkedContacts.length > 0 && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm font-semibold text-foreground">
            {precheck.unlinkedContacts.length} kontak belum ada di CRM
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Centang yang ingin didaftarkan. Yang tidak dicentang tetap tersimpan di laporan
            kunjungan, hanya tidak masuk ke daftar kontak CRM.
          </p>
          <ul className="mt-3 space-y-2">
            {precheck.unlinkedContacts.map((contact) => {
              const checked = registerContacts.includes(contact.fullName)
              return (
                <li key={contact.fullName}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-1 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        setRegisterContacts((prev) =>
                          next === true
                            ? [...prev, contact.fullName]
                            : prev.filter((name) => name !== contact.fullName)
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{contact.fullName}</span>
                      {(contact.jobTitle || contact.email) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[contact.jobTitle, contact.email].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {precheck.unlinkedCompanyName && (
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="h-4 w-4 shrink-0" />
            &ldquo;{precheck.unlinkedCompanyName}&rdquo; belum ada di CRM
          </p>

          {precheck.companySuggestions.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              <Label htmlFor="push-company">Tautkan ke perusahaan yang sudah ada</Label>
              <select
                id="push-company"
                value={form.linkedCompanyId}
                onChange={(event) => setForm({ ...form, linkedCompanyId: event.target.value })}
                className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="">Daftarkan sebagai perusahaan baru</option>
                {precheck.companySuggestions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                    {company.industry ? ` — ${company.industry}` : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Nama mirip sering berarti perusahaan yang sama. Menautkan lebih baik daripada
                menambah data kembar yang tidak ada yang merapikan.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Tidak ada nama serupa di CRM.
            </p>
          )}

          {!form.linkedCompanyId && (
            <p className="mt-3 text-xs text-muted-foreground">
              Biasanya perusahaan sudah terdaftar saat laporan dikirim. Kalau belum, didaftarkan
              sekarang bersama lead, ditandai{" "}
              <span className="font-semibold">&ldquo;Needs details&rdquo;</span> agar admin CRM bisa
              melengkapinya dari halaman Companies.
            </p>
          )}
        </div>
      )}

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
            className="h-11 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
            className="h-11 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
            className="h-11 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
          <NumberInput
            id="push-value"
            prefix="Rp"
            inputClassName="h-11"
            value={form.estimatedValue}
            onChange={(next) => setForm({ ...form, estimatedValue: next })}
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
            className="w-full rounded-md border border-input bg-field px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
