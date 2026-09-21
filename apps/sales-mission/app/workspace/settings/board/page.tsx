import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { CalendarDays, MonitorPlay } from "@/components/icons"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { createClient } from "@/utils/supabase/server"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { BoardTokenManager, type BoardTokenRow } from "./token-manager"
import type { BoardTokenKind } from "@/lib/board/board-access"
import { paths } from "@/lib/paths"

export const dynamic = "force-dynamic"

export default async function BoardSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage
        eyebrow="Sales Activity / Administration"
        title="Tautan publik"
        description="Kelola tautan layar TV dan kalender manajemen."
        action={<BackLink href="/workspace/settings" />}
      >
        <EmptyState title="Tidak punya izin" description="Tautan publik hanya dapat dikelola oleh admin Sales Activity." />
      </WorkspacePage>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("board_tokens")
    .select("id, label, kind, created_at, expires_at, revoked_at, last_used_at, show_client_names, show_outcomes")
    .eq("company_id", access.companyId)
    .order("created_at", { ascending: false })

  const tokens: BoardTokenRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    kind: ((row.kind as string | null) ?? "screen") as BoardTokenKind,
    showClientNames: row.show_client_names === true,
    showOutcomes: row.show_outcomes === true,
    createdAt: row.created_at as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    revokedAt: (row.revoked_at as string | null) ?? null,
    lastUsedAt: (row.last_used_at as string | null) ?? null,
  }))

  // Built from the request so the copied link works in whatever environment the
  // admin is actually using, rather than a hardcoded production host.
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3001"
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const boardBaseUrl = `${proto}://${host}`

  return (
    <WorkspacePage
      eyebrow="Sales Activity / Administration"
      title="Tautan publik"
      description="Setiap tautan yang pernah dibuat, dari dua jenis: layar TV dan kalender manajemen. Cabut yang tidak dipakai."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="mb-4 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        Tautan dibuat di tempat yang ditampilkannya: <strong className="text-foreground">Papan live</strong> untuk layar TV
        (rentang, sales, lokasi, dan panel ikut ke tautannya), <strong className="text-foreground">Kalender</strong> untuk
        tautan jadwal yang dibuka manajemen tanpa login. Keduanya dicabut di sini. Nama klien dan hasil kunjungan mengikuti pilihan saat tautan
        dibuat; layar di ruang terbuka terbaca tamu, dan foto layar berjalan lebih jauh dari yang siapa pun kira.
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={paths.board}>
              <MonitorPlay className="h-4 w-4" /> Buka Papan live
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={paths.calendar}>
              <CalendarDays className="h-4 w-4" /> Buka Kalender
            </Link>
          </Button>
        </div>
      </div>

      <BoardTokenManager tokens={tokens} boardBaseUrl={boardBaseUrl} />
    </WorkspacePage>
  )
}
