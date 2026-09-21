"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Plus, ShieldOff, TriangleAlert } from "@/components/icons"
import { createBoardToken, revokeBoardToken } from "@/app/actions/board-token-actions"
import { BOARD_TOKEN_KINDS, BOARD_TOKEN_KIND_LABELS, boardTokenUrl, type BoardTokenKind } from "@/lib/board/board-access"
import { IssuedLink } from "@/components/issued-link"
import { Segmented } from "@/components/segmented"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export interface BoardTokenRow {
  id: string
  label: string
  kind: BoardTokenKind
  showClientNames: boolean
  showOutcomes: boolean
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

function formatWhen(iso: string | null) {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: MISSION_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

export function BoardTokenManager({ tokens, boardBaseUrl }: { tokens: BoardTokenRow[]; boardBaseUrl: string }) {
  const [label, setLabel] = useState("")
  const [kind, setKind] = useState<BoardTokenKind>("screen")
  const [expiresInDays, setExpiresInDays] = useState("")
  const [showNames, setShowNames] = useState(false)
  const [showOutcomes, setShowOutcomes] = useState(false)
  const [issued, setIssued] = useState<{ token: string; kind: BoardTokenKind } | null>(null)
  const [pending, start] = useTransition()
  const router = useRouter()

  const issuedUrl = issued ? boardTokenUrl(boardBaseUrl, issued.kind, issued.token) : null

  const create = () => {
    start(async () => {
      const days = expiresInDays ? Number(expiresInDays) : undefined
      const result = await createBoardToken(label, {
        expiresInDays: Number.isFinite(days) ? days : undefined,
        showClientNames: showNames,
        showOutcomes: kind === "screen" && showOutcomes,
        kind,
      })
      if (result.success && result.data) {
        setIssued({ token: result.data.token, kind })
        setLabel("")
        setExpiresInDays("")
        setShowNames(false)
        setShowOutcomes(false)
        router.refresh()
      } else {
        toast.error(result.error ?? "Tautan gagal dibuat")
      }
    })
  }

  const revoke = (tokenId: string) => {
    start(async () => {
      const result = await revokeBoardToken(tokenId)
      if (result.success) {
        toast.success("Tautan dicabut")
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal mencabut tautan")
      }
    })
  }

  return (
    <div className="space-y-4">
      {issuedUrl && (
        <div className="rounded-xl border border-[var(--warning-foreground)]/20 bg-[var(--warning)] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--warning-foreground)]">
            <TriangleAlert className="h-4 w-4" /> Salin sekarang — tautan ini tidak ditampilkan lagi
          </p>
          <p className="mt-1 text-sm text-[var(--warning-foreground)]">
            Hanya hash-nya yang kami simpan, jadi tautan ini tidak bisa dilihat ulang. Kalau hilang, cabut lalu buat baru.
          </p>
          <div className="mt-3">
            <IssuedLink url={issuedUrl} manageLink={false} />
          </div>
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setIssued(null)}>Tutup</Button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground">Tautan baru</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">Buat tautan papan</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-[2fr_1fr] sm:items-end">
          <div className="space-y-1.5 sm:col-span-2">
            <Segmented
              label="Jenis tautan"
              value={kind}
              options={BOARD_TOKEN_KINDS.map((item) => ({ value: item, label: BOARD_TOKEN_KIND_LABELS[item] }))}
              onChange={setKind}
            />
            <p className="text-xs text-muted-foreground">
              {kind === "screen"
                ? "Papan jadwal untuk TV kantor, menyegarkan sendiri. Tanpa pengaturan rentang dan panel; buat dari Papan live kalau perlu itu."
                : "Kalender bulan baca-saja yang dibuka manajemen di browser, tanpa login."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-label">Nama tautan</Label>
            <Input id="token-label" className="h-11" value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} placeholder={kind === "screen" ? "TV lobi lantai 3" : "Direksi"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-expiry">Berlaku (hari)</Label>
            <Input id="token-expiry" className="h-11" inputMode="numeric" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value.replace(/[^\d]/g, ""))} placeholder="Kosong = tanpa batas" />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3 sm:col-span-2">
            <div>
              <Label htmlFor="token-names" className="text-sm font-semibold text-foreground">Tampilkan nama klien</Label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Mati: “PT A•••”. Untuk layar TV, nyalakan hanya kalau ruangannya tidak dilewati tamu. Terikat ke tautan; tidak bisa diubah dari URL.
              </p>
            </div>
            <Switch id="token-names" checked={showNames} onCheckedChange={setShowNames} />
          </div>
          {kind === "screen" && (
            <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3 sm:col-span-2">
              <div>
                <Label htmlFor="token-outcomes" className="text-sm font-semibold text-foreground">Tampilkan hasil kunjungan</Label>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Baris yang sudah dilaporkan menyebut hasilnya (“Bertemu pengambil keputusan”). Bersama nama klien ini adalah pipeline; hanya untuk ruang tim sendiri. Terikat ke tautan.
                </p>
              </div>
              <Switch id="token-outcomes" checked={showOutcomes} onCheckedChange={setShowOutcomes} />
            </div>
          )}
          <Button className="h-11 sm:col-span-2 sm:justify-self-end" onClick={create} disabled={pending || !label.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Buat
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <p className="text-xs font-semibold text-muted-foreground">Tautan aktif</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{tokens.length} tautan</h2>
        </div>

        {tokens.length > 0 ? (
          <ul className="divide-y">
            {tokens.map((token) => {
              const expired = token.expiresAt !== null && new Date(token.expiresAt).getTime() <= Date.now()
              const dead = Boolean(token.revokedAt) || expired

              return (
                <li key={token.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                      {token.label}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                        {BOARD_TOKEN_KIND_LABELS[token.kind]}
                      </span>
                      {token.revokedAt && (
                        <span className="rounded-full bg-[var(--danger)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--danger-foreground)]">Dicabut</span>
                      )}
                      {!token.revokedAt && expired && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Kedaluwarsa</span>
                      )}
                      {token.showClientNames && (
                        <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-bold text-[var(--warning-foreground)]">Nama klien tampil</span>
                      )}
                      {token.showOutcomes && (
                        <span className="rounded-full bg-[var(--warning)] px-2 py-0.5 text-[10px] font-bold text-[var(--warning-foreground)]">Hasil kunjungan tampil</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Dibuat {formatWhen(token.createdAt)} · Terakhir dipakai {formatWhen(token.lastUsedAt)}
                      {token.expiresAt ? ` · Berlaku sampai ${formatWhen(token.expiresAt)}` : ""}
                    </p>
                  </div>

                  {!dead && (
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => revoke(token.id)}>
                      <ShieldOff className="h-4 w-4" /> Cabut
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-muted-foreground">Belum ada tautan papan.</p>
        )}
      </div>
    </div>
  )
}
