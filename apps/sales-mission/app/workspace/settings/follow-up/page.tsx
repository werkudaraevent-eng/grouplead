import { redirect } from "next/navigation"
import Link from "next/link"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { listReportChoices } from "@/lib/missions/report-choice-queries"
import { FIELD_LABELS } from "@/lib/missions/report-choices"
import { paths } from "@/lib/paths"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { ChoiceManager } from "@/app/workspace/settings/report-form/choice-manager"

export const dynamic = "force-dynamic"

/**
 * The follow-up module's two option lists, the same editor as the report's
 * fixed choices: labels, order and archiving are the admin's, the kind
 * behind each option is locked because the code reads it ("dropped" closes
 * a chain). The next-action types themselves are edited with the report
 * form, where they are asked.
 */
export default async function FollowUpSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage eyebrow="Sales Activity / Administrasi" title="Tindak lanjut" action={<BackLink href={paths.settings.index} />}>
        <EmptyState title="Tidak punya izin" description="Pengaturan tindak lanjut hanya dapat diubah oleh admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const choices = await listReportChoices(access, { includeArchived: true })

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Administrasi"
      title="Tindak lanjut"
      description="Pilihan yang muncul saat sales mencatat tindak lanjut dari laporan: lewat apa dan bagaimana hasilnya."
      action={<BackLink href={paths.settings.index} />}
    >
      <div className="mb-4 space-y-2 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        <p>
          Next action di laporan menjadi tindak lanjut yang dilacak: muncul di Hari ini pemiliknya sampai dicatat hasilnya, dan bisa dirantai ke langkah berikutnya.
          Jenis next action-nya diatur di <Link href="/workspace/settings/report-form" className="font-medium text-foreground underline underline-offset-2">Form laporan</Link>;
          saklar pelacakannya ada di <Link href={paths.settings.activities} className="font-medium text-foreground underline underline-offset-2">Aturan aktivitas</Link>.
        </p>
        <p>Nama dan urutan pilihan bebas; <em>jenis</em> di baliknya terkunci: hasil berjenis “Tidak dilanjutkan” menutup rangkaian tindak lanjut tanpa langkah berikutnya.</p>
      </div>

      <div className="space-y-4">
        <section className="overflow-clip rounded-xl border bg-card">
          <header className="border-b px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">{FIELD_LABELS.follow_up_channel}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Lewat apa tindak lanjut dilakukan: bertemu, telepon, WhatsApp, email.</p>
          </header>
          <div className="px-5 py-4">
            <ChoiceManager fieldKey="follow_up_channel" choices={choices.follow_up_channel} />
          </div>
        </section>
        <section className="overflow-clip rounded-xl border bg-card">
          <header className="border-b px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">{FIELD_LABELS.follow_up_outcome}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Bagaimana hasilnya: ada kemajuan, belum, tidak terhubung, atau tidak dilanjutkan.</p>
          </header>
          <div className="px-5 py-4">
            <ChoiceManager fieldKey="follow_up_outcome" choices={choices.follow_up_outcome} />
          </div>
        </section>
      </div>
    </WorkspacePage>
  )
}
