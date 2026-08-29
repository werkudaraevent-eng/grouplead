import { redirect } from "next/navigation"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listFormFields } from "@/lib/missions/form-field-queries"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { FieldManager } from "./field-manager"

export const dynamic = "force-dynamic"

export default async function MissionFormSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage
        eyebrow="Sales Mission / Administration"
        title="Form mission"
        description="Atur field pada form buat mission."
        action={<BackLink href="/workspace/settings" />}
      >
        <EmptyState
          title="Tidak punya izin"
          description="Pengaturan form mission hanya dapat diubah oleh admin Sales Mission."
        />
      </WorkspacePage>
    )
  }

  const fields = await listFormFields(access, "mission", { includeArchived: true })

  return (
    <WorkspacePage
      eyebrow="Sales Mission / Administration"
      title="Form mission"
      description="Tambah, ubah, urutkan, dan tentukan field mana yang wajib diisi saat membuat mission."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="mb-4 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        Field bertanda <strong className="text-foreground">Inti</strong> menopang deteksi konflik jadwal, kalender,
        laporan KPI, dan pengiriman lead ke LeadEngine. Label dan urutannya bisa diubah, dan yang opsional bisa
        dijadikan wajib — tetapi tidak bisa dihapus atau dilonggarkan, karena empat fitur itu akan berhenti bekerja
        tanpa pemberitahuan.
      </div>

      <FieldManager fields={fields} />
    </WorkspacePage>
  )
}
