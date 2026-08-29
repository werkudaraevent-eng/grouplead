import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { MonitorPlay } from "lucide-react"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { createClient } from "@/utils/supabase/server"
import { BackLink, EmptyState, WorkspacePage } from "@/app/workspace/workspace-page"
import { Button } from "@/components/ui/button"
import { BoardTokenManager, type BoardTokenRow } from "./token-manager"

export const dynamic = "force-dynamic"

export default async function BoardSettingsPage() {
  const access = await getSalesMissionAccess()
  if (!access) redirect("/login?error=access_not_provisioned")

  if (!(await canPerform(access, "sales_mission_settings", "update"))) {
    return (
      <WorkspacePage
        eyebrow="Sales Mission / Administration"
        title="Papan live"
        description="Kelola tautan papan untuk layar kantor."
        action={<BackLink href="/workspace/settings" />}
      >
        <EmptyState title="Tidak punya izin" description="Tautan papan hanya dapat dikelola oleh admin Sales Mission." />
      </WorkspacePage>
    )
  }

  const supabase = await createClient()
  const { data } = await supabase
    .schema("sales_mission")
    .from("board_tokens")
    .select("id, label, created_at, expires_at, revoked_at, last_used_at")
    .eq("company_id", access.companyId)
    .order("created_at", { ascending: false })

  const tokens: BoardTokenRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
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
      eyebrow="Sales Mission / Administration"
      title="Papan live"
      description="Tautan untuk layar kantor, dan tampilan internal untuk tim."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="mb-4 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        Papan TV <strong className="text-foreground">menyamarkan nama klien</strong> — hanya menampilkan tim, jadwal,
        area, dan status. Layar di ruang terbuka terbaca tamu, kandidat, dan vendor, dan foto layar berjalan lebih jauh
        dari yang siapa pun kira. Tampilan internal menampilkan nama penuh dan butuh login.
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/workspace/board" target="_blank">
              <MonitorPlay className="h-4 w-4" /> Buka tampilan internal
            </Link>
          </Button>
        </div>
      </div>

      <BoardTokenManager tokens={tokens} boardBaseUrl={boardBaseUrl} />
    </WorkspacePage>
  )
}
