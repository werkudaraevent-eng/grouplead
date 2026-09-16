import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { FieldManager } from "@/app/workspace/settings/form/field-manager"

export const dynamic = "force-dynamic"

/**
 * The prospect form's fields, the same builder as the mission form.
 *
 * Core fields feed duplicate detection, the import, and the hand-over to a
 * mission, so their type is locked; everything else is the admin's: label,
 * order, placeholder, help text, whether it is required, and any field they
 * add. The salutation list is shared with the mission form on purpose, so a
 * prospect converts into a mission without its salutation falling out of the
 * list.
 */
export default async function ProspectFormSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage eyebrow="Sales Activity / Administrasi" title="Form prospek" action={<BackLink href="/workspace/settings" />}>
        <EmptyState title="Tidak punya izin" description="Pengaturan form prospek hanya dapat diubah oleh admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const fields = await listFormFields(access, "prospect", { includeArchived: true })

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Administrasi"
      title="Form prospek"
      description="Tambah, ubah, urutkan, dan tentukan field mana yang wajib diisi saat membuat atau mengimpor prospek."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="mb-4 space-y-2 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        <p>
          Field bertanda <strong className="text-foreground">Inti</strong> menopang deteksi duplikat, impor dari
          spreadsheet, dan pengisian otomatis form aktivitas saat prospek dijadwalkan.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong className="text-foreground">Bisa diubah:</strong> label, urutan, placeholder, dan teks bantuan.</li>
          <li><strong className="text-foreground">Bisa diperketat:</strong> field opsional dijadikan wajib. Aturan yang sama berlaku pada impor.</li>
          <li><strong className="text-foreground">Terkunci:</strong> tipe field dan penghapusan. Daftar sapaan diatur di Form aktivitas supaya prospek dan aktivitas memakai daftar yang sama.</li>
        </ul>
        <p>Field yang Anda tambahkan tampil di form prospek dan menjadi kolom pada template impor; jawabannya tampil di detail prospek.</p>
      </div>

      <FieldManager fields={fields} formKey="prospect" />
    </WorkspacePage>
  )
}
