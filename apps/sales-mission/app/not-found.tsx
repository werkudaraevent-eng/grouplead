import Link from "next/link"
import { Compass } from "@/components/icons"
import { Button } from "@/components/ui/button"

/**
 * 404. Reached most often by an old mission link that was deleted or belongs to
 * another business unit, so the copy points at that rather than talking about
 * pages in the abstract.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card px-6 py-8 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-muted text-muted-foreground">
          <Compass className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-lg font-semibold text-foreground">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Alamat ini tidak ada, atau mission-nya sudah dihapus. Bisa juga mission itu milik unit
          bisnis lain.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="h-11">
            <Link href="/workspace">Ke dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="h-11">
            <Link href="/workspace/missions">Lihat semua mission</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
