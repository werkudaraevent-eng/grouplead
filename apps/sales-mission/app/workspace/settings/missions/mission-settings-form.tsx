"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"
import { updateMissionSettings, type MissionSettingsInput } from "@/app/actions/mission-settings-actions"
import type { MissionSettings } from "@/lib/missions/mission-queries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

/**
 * The tenant's mission rules.
 *
 * Each switch row is label, one-line consequence, control: the admin reads what
 * changes before flipping it, not after. Material's list-item-with-trailing-
 * switch shape, on the app's own tokens.
 */
function SwitchRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {/* The hit area is the 48px row, not the 24px track. */}
      <span className="grid min-h-12 shrink-0 place-items-center">
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </span>
    </div>
  )
}

export function MissionSettingsForm({ initial }: { initial: MissionSettings }) {
  const [form, setForm] = useState<MissionSettingsInput>(initial)
  const [pending, start] = useTransition()
  const router = useRouter()

  const save = () => {
    start(async () => {
      const result = await updateMissionSettings(form)
      if (result.success) {
        toast.success("Pengaturan mission tersimpan.")
        router.refresh()
      } else {
        toast.error(result.error ?? "Pengaturan gagal disimpan.")
      }
    })
  }

  return (
    <div className="max-w-3xl space-y-4">
      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Penugasan</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Apa yang terjadi saat sales ditugaskan pada mission.</p>
        </header>
        <div className="divide-y">
          <SwitchRow
            id="require-confirmation"
            label="Sales harus mengonfirmasi penugasan"
            hint="Nyala: penugasan menunggu sampai sales menekan Terima. Mati: penugasan langsung diterima. Tolak dan Minta jadwal ulang tetap tersedia di kedua mode."
            checked={form.requireAssignmentConfirmation}
            onChange={(next) => setForm({ ...form, requireAssignmentConfirmation: next })}
          />
          <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem] sm:items-center">
            <div>
              <Label htmlFor="max-supporting" className="text-sm font-semibold text-foreground">Maksimal sales pendukung per mission</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Batas orang yang bisa bergabung di luar sales utama, agar klien yang dijanjikan dua orang tidak kedatangan rombongan.</p>
            </div>
            <Input
              id="max-supporting"
              type="number"
              inputMode="numeric"
              min={0}
              max={20}
              className="h-12"
              value={form.maxSupporting}
              onChange={(event) => setForm({ ...form, maxSupporting: Number(event.target.value) })}
            />
          </div>
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Bentrok jadwal</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Kapan dua mission dianggap tidak bisa dijalani satu orang.</p>
        </header>
        <div className="divide-y">
          <SwitchRow
            id="conflict-check"
            label="Periksa bentrok jadwal"
            hint="Mission yang tumpang tindih dengan jadwal sales ditandai, dan tombol join dimatikan."
            checked={form.conflictCheckEnabled}
            onChange={(next) => setForm({ ...form, conflictCheckEnabled: next })}
          />
          <div className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_8rem] sm:items-center">
            <div>
              <Label htmlFor="travel-buffer" className="text-sm font-semibold text-foreground">Jeda perjalanan (menit)</Label>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Ditambahkan sebelum dan sesudah tiap mission saat memeriksa bentrok. Dua kunjungan berjarak satu jam di sisi kota berbeda tetap bentrok.</p>
            </div>
            <Input
              id="travel-buffer"
              type="number"
              inputMode="numeric"
              min={0}
              max={480}
              className="h-12"
              value={form.travelBufferMinutes}
              onChange={(event) => setForm({ ...form, travelBufferMinutes: Number(event.target.value) })}
            />
          </div>
          <SwitchRow
            id="same-location"
            label="Tanpa jeda di lokasi yang sama"
            hint="Dua mission di lokasi yang sama boleh berurutan tanpa jeda perjalanan."
            checked={form.allowSameLocationBackToBack}
            onChange={(next) => setForm({ ...form, allowSameLocationBackToBack: next })}
          />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending} className="h-12 md:h-10">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan pengaturan
        </Button>
      </div>
    </div>
  )
}
