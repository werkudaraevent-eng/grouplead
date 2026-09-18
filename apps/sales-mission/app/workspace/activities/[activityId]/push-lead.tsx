"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { AlertTriangle, Building2, Check, ExternalLink, Loader2, Send, TriangleAlert } from "@/components/icons"
import { getPushPrecheck, pushMissionToLeadEngine, type PushPrecheck } from "@/app/actions/lead-push-actions"
import type { TenantSalesOption } from "@/lib/missions/mission-queries"
import { optionLabel } from "@/lib/missions/lead-category"
import { jumpToField } from "@/lib/ui/scroll-in-panel"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ChoiceChip } from "@/components/ui/choice-chip"
import { Input } from "@/components/ui/input"
import { NumberInput } from "@/components/ui/number-input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * "Send to LeadEngine".
 *
 * The three guards from the PRD are all visible before the button is pressed:
 * the owner is preselected from the CRM and overriding it warns, existing open
 * leads are listed, and the whole panel disappears once a push is recorded.
 *
 * Required fields are enforced here, in the form, the way the report form
 * does it ("Belum lengkap: …" naming each field). The send itself happens
 * behind a summary dialog, because a push is one per activity and cannot be
 * undone: the person sees the lead as the CRM will, then commits.
 */

const SELECT_CLASS =
  "h-11 w-full rounded-md border border-input bg-field px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

const currency = new Intl.NumberFormat("id-ID")

export function PushLeadPanel({
  missionId,
  clientName,
  industry,
  salesOptions,
  defaultProjectName,
  leadEngineUrl,
}: {
  missionId: string
  clientName: string
  /** The activity's industry; sent with a company the CRM has never seen. */
  industry: string | null
  salesOptions: TenantSalesOption[]
  defaultProjectName: string
  leadEngineUrl: string | null
}) {
  const [precheck, setPrecheck] = useState<PushPrecheck | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)
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
    /** Master option values, as LeadEngine stores them. */
    category: "",
    gradeLead: "",
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
        category: result.suggestedCategory ?? "",
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
          Aktivitas ini sudah dikirim ke LeadEngine sebagai lead <span className="font-mono">{precheck.alreadyPushed.leadId}</span>.
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
  const stage = pipeline?.stages.find((item) => item.id === form.pipelineStageId)
  const owner = salesOptions.find((option) => option.id === form.ownerUserId)
  const currentOwner = precheck.companyContext?.currentOwner ?? null
  const ownerOverridden = Boolean(currentOwner && form.ownerUserId !== currentOwner.userId)
  const openLeads = precheck.companyContext?.openLeads ?? []
  const linkedCompany = precheck.companySuggestions.find((company) => company.id === form.linkedCompanyId)

  // What still stands between this form and the CRM. Each entry names a
  // field and scrolls to it, so nothing is discovered by a greyed button.
  const missing: Array<{ id: string; label: string }> = [
    !form.projectName.trim() ? { id: "push-project", label: "nama proyek" } : null,
    !form.pipelineId ? { id: "push-pipeline", label: "pipeline tujuan" } : null,
    !form.ownerUserId ? { id: "push-owner", label: "pemilik lead" } : null,
    !form.category ? { id: "push-category", label: "kategori lead" } : null,
  ].filter((item): item is { id: string; label: string } => item !== null)

  const jumpTo = (id: string) => jumpToField(id, "input, textarea, select, button")

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
        category: form.category,
        gradeLead: form.gradeLead || null,
      })

      if (result.success) {
        setConfirming(false)
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
        <div className="space-y-1.5 sm:col-span-2 scroll-mt-20" id="push-project-field">
          <Label htmlFor="push-project">Nama proyek / kebutuhan <span className="text-[var(--danger-foreground)]" aria-hidden="true">*</span></Label>
          <Input id="push-project" className="h-11" value={form.projectName} maxLength={300} onChange={(e) => setForm({ ...form, projectName: e.target.value })} />
        </div>

        {/* The CRM's own classification, from its Master Options: the same
            list its lead form shows, HQL included, never copied here. The
            suggestion follows the report's interest level; the person decides. */}
        <div className="space-y-1.5 sm:col-span-2 scroll-mt-20" id="push-category">
          <Label>Kategori lead <span className="text-[var(--danger-foreground)]" aria-hidden="true">*</span></Label>
          {precheck.categoryOptions.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Kategori lead">
                {precheck.categoryOptions.map((option) => (
                  <ChoiceChip
                    key={option.value}
                    selected={form.category === option.value}
                    onClick={() => setForm({ ...form, category: option.value })}
                  >
                    {option.label}
                  </ChoiceChip>
                ))}
              </div>
              {precheck.suggestedCategory && precheck.interestLabel && (
                <p className="text-xs text-muted-foreground">
                  Disarankan dari tingkat minat di laporan: {precheck.interestLabel}. Kategori bisa diubah sebelum dikirim.
                </p>
              )}
            </>
          ) : (
            <p className="flex items-start gap-1.5 text-sm text-[var(--danger-foreground)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {precheck.optionsError ?? "Daftar kategori LeadEngine tidak terbaca. Muat ulang halaman, atau minta admin memeriksa Master Options."}
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="push-grade">Grade lead</Label>
          <select
            id="push-grade"
            value={form.gradeLead}
            onChange={(e) => setForm({ ...form, gradeLead: e.target.value })}
            className={SELECT_CLASS}
            disabled={precheck.gradeLeadOptions.length === 0}
          >
            <option value="">{precheck.gradeLeadOptions.length === 0 ? "Belum ada grade di LeadEngine" : "Belum ditentukan"}</option>
            {precheck.gradeLeadOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>

        <div className="space-y-1.5 scroll-mt-20" id="push-pipeline-field">
          <Label htmlFor="push-pipeline">Pipeline tujuan <span className="text-[var(--danger-foreground)]" aria-hidden="true">*</span></Label>
          <select
            id="push-pipeline"
            value={form.pipelineId}
            onChange={(e) => {
              const next = precheck.pipelines.find((item) => item.id === e.target.value)
              setForm({ ...form, pipelineId: e.target.value, pipelineStageId: next?.stages[0]?.id ?? "" })
            }}
            className={SELECT_CLASS}
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
            className={SELECT_CLASS}
          >
            {(pipeline?.stages ?? []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>

        <div className="space-y-1.5 scroll-mt-20" id="push-owner-field">
          <Label htmlFor="push-owner">Pemilik lead <span className="text-[var(--danger-foreground)]" aria-hidden="true">*</span></Label>
          <select
            id="push-owner"
            value={form.ownerUserId}
            onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}
            className={SELECT_CLASS}
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

      <div className="space-y-3">
        {missing.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Belum lengkap:{" "}
            {missing.map((item, index) => (
              <span key={item.id}>
                {index > 0 && ", "}
                <button type="button" onClick={() => jumpTo(item.id === "push-category" ? item.id : `${item.id}-field`)} className="font-medium text-primary underline-offset-2 hover:underline">
                  {item.label}
                </button>
              </span>
            ))}
          </p>
        ) : (
          <p className="flex items-center gap-1.5 text-sm text-[var(--success-foreground)]">
            <Check className="h-4 w-4" /> Siap dikirim
          </p>
        )}
        <Button className="h-11" disabled={pending || missing.length > 0} onClick={() => setConfirming(true)}>
          <Send className="h-4 w-4" /> Kirim ke LeadEngine
        </Button>
      </div>

      {/* The review before the one-way step: the lead as the CRM will show
          it. M3 asks for a dialog when an action is consequential and not
          reversible; this one is both. On a phone it rises from the bottom. */}
      <Dialog open={confirming} onOpenChange={(next) => { if (!pending) setConfirming(next) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat lead ini di LeadEngine?</DialogTitle>
            <DialogDescription>
              Sekali dikirim, lead tidak bisa dikirim ulang dari aktivitas ini. Perubahan berikutnya dilakukan di LeadEngine.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <dl className="divide-y text-sm">
              <Row label="Klien">
                {linkedCompany?.name ?? precheck.companyContext?.company.name ?? clientName}
                {precheck.unlinkedCompanyName && !form.linkedCompanyId && (
                  <span className="block text-xs text-muted-foreground">Didaftarkan sebagai perusahaan baru</span>
                )}
              </Row>
              <Row label="Industri">
                {precheck.companyContext?.company.industry ?? industry ?? "—"}
                {!precheck.companyContext?.company.industry && industry && precheck.unlinkedCompanyName && !form.linkedCompanyId && (
                  <span className="block text-xs text-muted-foreground">Ikut tercatat pada perusahaan baru di CRM</span>
                )}
              </Row>
              <Row label="Proyek">{form.projectName.trim()}</Row>
              <Row label="Pipeline">{[pipeline?.name, stage?.name].filter(Boolean).join(" · ") || "—"}</Row>
              <Row label="Pemilik">
                {owner?.name ?? "—"}
                {ownerOverridden && currentOwner && (
                  <span className="block text-xs text-[var(--warning-foreground)]">Menggantikan {currentOwner.name} sebagai pemegang akun</span>
                )}
              </Row>
              <Row label="Kategori">{optionLabel(precheck.categoryOptions, form.category) ?? "—"}</Row>
              <Row label="Grade">{optionLabel(precheck.gradeLeadOptions, form.gradeLead) ?? "Belum ditentukan"}</Row>
              <Row label="Estimasi nilai">{form.estimatedValue !== null ? `Rp ${currency.format(form.estimatedValue)}` : "Mengikuti laporan"}</Row>
              {(registerContacts.length > 0 || enrichContacts.length > 0) && (
                <Row label="Kontak">
                  {[
                    registerContacts.length > 0 ? `${registerContacts.length} didaftarkan` : null,
                    enrichContacts.length > 0 ? `${enrichContacts.length} dilengkapi` : null,
                  ].filter(Boolean).join(" · ")}
                </Row>
              )}
            </dl>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>Kembali</Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium text-foreground">{children}</dd>
    </div>
  )
}
