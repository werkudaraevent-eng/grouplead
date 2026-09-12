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
        eyebrow="Sales Mission / Administrasi"
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
      eyebrow="Sales Mission / Administrasi"
      title="Form mission"
      description="Tambah, ubah, urutkan, dan tentukan field mana yang wajib diisi saat membuat mission."
      action={<BackLink href="/workspace/settings" />}
    >
      {/*
        Says what an admin may change before they try, listing the three levels
        separately. The old version stopped at "tidak bisa diubah", which read as
        a blanket refusal and left the impression that a core dropdown's choices
        were untouchable too.
      */}
      <div className="mb-4 space-y-2 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        <p>
          Field bertanda <strong className="text-foreground">Inti</strong> menopang deteksi konflik jadwal, kalender,
          laporan KPI, dan pengiriman lead ke LeadEngine.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li><strong className="text-foreground">Bisa diubah:</strong> label, urutan, placeholder, teks bantuan, dan daftar pilihan seperti Jenis mission.</li>
          <li><strong className="text-foreground">Bisa diperketat:</strong> field opsional dijadikan wajib.</li>
          <li><strong className="text-foreground">Terkunci:</strong> tipe field dan penghapusan, karena empat fitur di atas akan berhenti bekerja tanpa pemberitahuan.</li>
        </ul>
      </div>

      <FieldManager fields={fields} />
    </WorkspacePage>
  )
}
