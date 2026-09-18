import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Building2, CalendarCheck, Globe, Mail, MapPin, MessageCircle, Phone } from "@/components/icons"
import { canPerform, getSalesMissionAccess, resolveScope } from "@/lib/sales-mission-access"
import { requireModule } from "@/lib/missions/nav-access"
import { listTenantSales } from "@/lib/missions/mission-queries"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { customAnswers } from "@/lib/prospects/prospect-form-fields"
import { parsePhotoAnswer } from "@/lib/photos/photo-answer"
import { PhotoGallery } from "@/components/photo-gallery"
import { MISSION_TIME_ZONE, formatMissionSchedule } from "@/lib/missions/mission-schema"
import { statusLabel } from "@/lib/missions/status-labels"
import { getProspect } from "@/lib/prospects/prospect-queries"
import { listProspectStatuses } from "@/lib/prospects/prospect-status-queries"
import { canAssignTo, canEditProspect, toProspectViewer } from "@/lib/prospects/prospect-access"
import { CHANNEL_LABELS, OUTCOME_LABELS, describeDueDate } from "@/lib/prospects/prospect-schema"
import { formatPhone, phoneDigits } from "@/lib/format/phone"
import { BackLink, WorkspacePage } from "@/app/workspace/workspace-page"
import { PersonAvatar } from "@/components/person-avatar"
import { Button } from "@/components/ui/button"
import { ProspectStatusLabel } from "../prospect-table"
import { ProspectDetailActions } from "./detail-actions"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-foreground">{children}</dd>
    </div>
  )
}

export default async function ProspectDetailPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")
  await requireModule(access, "sales_mission_prospect")

  const { prospectId } = await params
  const [prospect, statuses, allPeople, canUpdate, canDelete, canCreateMission, scope, fields] = await Promise.all([
    getProspect(access, prospectId),
    listProspectStatuses(access, { includeArchived: true }),
    listTenantSales(access),
    canPerform(access, "sales_mission_prospect", "update"),
    canPerform(access, "sales_mission_prospect", "delete"),
    canPerform(access, "sales_mission_mission", "create"),
    resolveScope(access, "sales_mission_prospect"),
    listFormFields(access, "prospect"),
  ])
  if (!prospect) notFound()

  const extra = customAnswers(fields, prospect.customValues)
  const viewer = toProspectViewer(scope)
  const people = allPeople.filter((person) => canAssignTo(viewer, person.id))
  const editable = canUpdate && canEditProspect(prospect, viewer)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: MISSION_TIME_ZONE }).format(new Date())
  const stamp = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
  const contactName = [prospect.contactSalutation, prospect.contactName].filter(Boolean).join(" ")
  const due = prospect.nextContactAt && !prospect.missionId ? describeDueDate(prospect.nextContactAt, today) : null

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Prospek"
      title={prospect.clientCompanyName}
      description={[contactName, prospect.contactJobTitle].filter(Boolean).join(" · ") || "Belum ada kontak yang dicatat"}
      action={
        <>
          <BackLink href="/workspace/prospects" />
          <ProspectDetailActions prospect={prospect} statuses={statuses} people={people.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl }))} viewer={viewer} editable={editable} canUpdate={canUpdate} canDelete={canDelete} canCreateMission={canCreateMission} />
        </>
      }
    >
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-4">
          {prospect.mission ? (
            <article className="rounded-xl border border-[var(--success-foreground)]/30 bg-[var(--success)] p-5">
              <p className="flex items-center gap-2 text-base font-semibold text-[var(--success-foreground)]"><CalendarCheck className="h-4 w-4" /> Sudah jadi aktivitas</p>
              <p className="mt-1 text-sm text-[var(--success-foreground)]">
                {formatMissionSchedule(prospect.mission.scheduledStart, new Date())} · {statusLabel(prospect.mission.status)}. Status prospek mengikuti aktivitas ini.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-3 bg-card"><Link href={paths.activity(prospect.mission.id)}>Buka aktivitas</Link></Button>
            </article>
          ) : editable && canCreateMission && prospect.statusKind !== "lost" ? (
            <article className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card px-5 py-4">
              <p className="text-sm text-muted-foreground">Sudah dapat janji temu? Jadwalkan kunjungannya; data prospek ini terisi otomatis di form mission.</p>
              <Button asChild size="sm"><Link href={paths.newActivity({ prospect: prospect.id })}><CalendarCheck className="h-4 w-4" /> Jadwalkan kunjungan</Link></Button>
            </article>
          ) : null}

          <article className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-5 py-4">
              <p className="text-xs font-semibold text-muted-foreground">Prospek</p>
              <h2 className="mt-1 flex items-center gap-3 text-base font-semibold text-foreground"><ProspectStatusLabel prospect={prospect} /></h2>
            </div>
            <dl className="divide-y">
              <Fact label="Pemegang">
                {prospect.ownerName ? <span className="inline-flex items-center gap-2"><PersonAvatar name={prospect.ownerName} avatarUrl={prospect.ownerAvatarUrl} size="sm" />{prospect.ownerName}</span> : <span className="text-muted-foreground">Belum ada</span>}
              </Fact>
              {due && <Fact label="Hubungi lagi"><span className={due.due ? "font-medium text-[var(--warning-foreground)]" : ""}>{due.text}</span></Fact>}
              {prospect.lostReason && prospect.statusKind === "lost" && <Fact label="Alasan">{prospect.lostReason}</Fact>}
              {prospect.industry && <Fact label="Industri">{prospect.industry}</Fact>}
              {(prospect.address || prospect.location) && (
                <Fact label="Alamat">
                  <span className="inline-flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{[prospect.address, prospect.location].filter(Boolean).join(", ")}</span></span>
                </Fact>
              )}
              {prospect.website && (
                <Fact label="Website"><a href={prospect.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 font-medium text-primary hover:underline"><Globe className="h-4 w-4" />{prospect.website.replace(/^https?:\/\//, "")}</a></Fact>
              )}
              {prospect.clientCompanyId && <Fact label="LeadEngine"><span className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" />Tertaut ke perusahaan di CRM</span></Fact>}
              {prospect.contactDivision && <Fact label="Divisi">{prospect.contactDivision}</Fact>}
              {prospect.contactPhone && (
                <Fact label="Telepon">
                  <span className="inline-flex flex-wrap items-center justify-end gap-3">
                    <a href={`tel:${prospect.contactPhone}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><Phone className="h-4 w-4" />{formatPhone(prospect.contactPhone)}</a>
                    <a href={`https://wa.me/${phoneDigits(prospect.contactPhone).replace("+", "")}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary hover:underline"><MessageCircle className="h-4 w-4" />WhatsApp</a>
                  </span>
                </Fact>
              )}
              {prospect.contactEmail && <Fact label="Email"><a href={`mailto:${prospect.contactEmail}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"><Mail className="h-4 w-4" />{prospect.contactEmail}</a></Fact>}
              {extra.map(({ field, text }) => (
                <Fact key={field.id} label={field.label}><span className="whitespace-pre-wrap">{text}</span></Fact>
              ))}
              <Fact label="Sumber">{prospect.source === "import" ? `Impor${prospect.batchFileName ? ` · ${prospect.batchFileName}` : ""}` : "Manual"}{prospect.createdByName ? ` · ${prospect.createdByName}` : ""} · {stamp(prospect.createdAt)}</Fact>
            </dl>
            {fields.some((field) => field.fieldType === "PHOTO" && field.isActive && parsePhotoAnswer(prospect.customValues[field.reportingKey]).length > 0) && (
              <div className="space-y-4 border-t px-5 py-4">
                {fields
                  .filter((field) => field.fieldType === "PHOTO" && field.isActive)
                  .map((field) => (
                    <PhotoGallery key={field.id} access={access} label={field.label} photos={parsePhotoAnswer(prospect.customValues[field.reportingKey])} />
                  ))}
              </div>
            )}
            {prospect.notes && (
              <div className="border-t bg-muted/30 px-5 py-4">
                <p className="text-xs font-semibold text-muted-foreground">Catatan</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{prospect.notes}</p>
              </div>
            )}
          </article>
        </div>

        <aside className="min-w-0 overflow-hidden rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <p className="text-xs font-semibold text-muted-foreground">Riwayat kontak</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{prospect.attemptCount > 0 ? `${prospect.attemptCount}× dihubungi` : "Belum pernah dihubungi"}</h2>
          </div>
          {prospect.attempts.length > 0 ? (
            <ol className="divide-y">
              {prospect.attempts.map((attempt) => (
                <li key={attempt.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{CHANNEL_LABELS[attempt.channel]} · {OUTCOME_LABELS[attempt.outcome]}</p>
                  {attempt.note && <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{attempt.note}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">{stamp(attempt.attemptedAt)}{attempt.createdByName ? ` · ${attempt.createdByName}` : ""}{attempt.statusAfterLabel ? ` · ${attempt.statusAfterLabel}` : ""}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-6 text-sm text-muted-foreground">Setiap telepon, WhatsApp, atau email yang dicatat akan muncul di sini, dengan hasilnya.</p>
          )}
        </aside>
      </section>
    </WorkspacePage>
  )
}
