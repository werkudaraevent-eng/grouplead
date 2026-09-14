import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { MonitorPlay } from "@/components/icons"
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
    .select("id, label, created_at, expires_at, revoked_at, last_used_at, show_client_names")
    .eq("company_id", access.companyId)
    .order("created_at", { ascending: false })

  const tokens: BoardTokenRow[] = (data ?? []).map((row) => ({
    id: row.id as string,
    label: row.label as string,
    showClientNames: row.show_client_names === true,
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
      description="Tautan layar yang pernah dibuat: cabut yang tidak dipakai. Membuat tautan baru dilakukan dari halaman Papan live."
      action={<BackLink href="/workspace/settings" />}
    >
      <div className="mb-4 rounded-xl border border-dashed bg-muted/40 px-5 py-4 text-sm text-muted-foreground">
        Tautan layar dibuat dari <strong className="text-foreground">Papan live</strong>: atur rentang, sales, lokasi, dan
        panel di sana, lalu “Buat tautan layar” membawa pengaturan itu ke TV. Nama klien disamarkan kecuali dinyalakan
        saat tautan dibuat; layar di ruang terbuka terbaca tamu, dan foto layar berjalan lebih jauh dari yang siapa pun kira.
        <div className="mt-3">
          <Button asChild size="sm" variant="outline">
            <Link href="/workspace/board">
              <MonitorPlay className="h-4 w-4" /> Buka Papan live
            </Link>
          </Button>
        </div>
      </div>

      <BoardTokenManager tokens={tokens} boardBaseUrl={boardBaseUrl} />
    </WorkspacePage>
  )
}
