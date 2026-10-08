import Link from "next/link"
import { redirect } from "next/navigation"
import { FileQuestion } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { paths } from "@/lib/paths"
import { getSalesMissionAccess } from "@/lib/sales-mission-access"

export const dynamic = "force-dynamic"

/**
 * Where a file link from an exported workbook lands when there is nothing to
 * open (`app/workspace/lampiran/route.ts`): the photo or recording was removed
 * from its report since the export, the link was cut short when it was
 * copied, or it points outside the person's company folder. One message for
 * all of them, so a link never tells whether a file exists elsewhere. Ke
 * Laporan is safe for everyone: without the Laporan grant it lands on Hari ini.
 */
export default async function AttachmentUnavailablePage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  return (
    <WorkspacePage reading eyebrow="Lampiran" title="Berkas tidak tersedia">
      <EmptyState
        icon={FileQuestion}
        title="Berkas ini tidak bisa dibuka"
        description="Foto atau rekaman ini mungkin sudah dihapus dari laporannya, atau tautannya terpotong saat disalin. Buka laporannya lewat kolom Tautan laporan di berkas ekspor, atau ekspor ulang dari halaman Laporan."
        action={
          <Button asChild className="h-10">
            <Link href={paths.reports}>Ke Laporan</Link>
          </Button>
        }
      />
    </WorkspacePage>
  )
}
