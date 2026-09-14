import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { FieldManager } from "@/app/workspace/settings/form/field-manager"

export const dynamic = "force-dynamic"

/**
 * The visit report's fields, the same builder as the mission form.
 *
 * Core fields feed the KPI screen, the CRM sync and the lead push, so their
 * type and their fixed choices are locked; everything else is the admin's:
 * label, order, help text, whether it is required, the option lists behind
 * "Kebutuhan klien" and "Produk yang diminati", and any field they add.
 */
export default async function ReportFormSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage eyebrow="Sales Mission / Administrasi" title="Form laporan" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Pengaturan form laporan hanya dapat diubah oleh admin Sales Mission." />
      </WorkspacePage>
    )
  }

  const fields = await listFormFields(access, "visit_report", { includeArchived: true })

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Administrasi"
      title="Form laporan"
      description="Tambah, ubah, urutkan, dan tentukan pertanyaan mana yang wajib dijawab pada laporan kunjungan."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="mb-4 space-y-2 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        <p>
          Field bertanda <strong className="text-foreground">Inti</strong> menopang laporan KPI, pencatatan ke CRM, dan
          pengiriman lead ke LeadEngine.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong className="text-foreground">Bisa diubah:</strong> label, urutan, teks bantuan, dan daftar pilihan pada Kebutuhan klien dan Produk yang diminati.</li>
          <li><strong className="text-foreground">Bisa diperketat:</strong> pertanyaan opsional dijadikan wajib.</li>
          <li><strong className="text-foreground">Terkunci:</strong> tipe field, pilihan Hasil kunjungan, Tingkat minat, dan Next action, serta penghapusan.</li>
        </ul>
        <p>Pertanyaan yang Anda tambahkan tampil di form laporan pada urutan yang Anda atur, dan jawabannya ikut tercatat di detail mission.</p>
      </div>

      <FieldManager fields={fields} formKey="visit_report" />
    </WorkspacePage>
  )
}
