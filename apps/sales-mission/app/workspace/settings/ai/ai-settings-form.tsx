"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Check, Loader2, Save, X } from "@/components/icons"
import { saveAiSettings, testAiConnection } from "@/app/actions/ai-settings-actions"
import type { AiSettings } from "@/lib/ai/ai-settings"
import type { AiModel } from "@/lib/ai/ai-proxy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

/**
 * The AI connection, in two cards: the endpoint and the key, then the two
 * models chosen from what that endpoint reports. "Uji koneksi" asks the
 * endpoint for its model list and fills the pickers; the pickers fall back
 * to a text field when the endpoint lists nothing. The key field is empty
 * on every visit and shows only the stored key's last four characters, the
 * way every integrations page does (HubSpot, Zapier, Vercel): a key is
 * written, never read back.
 */
export function AiSettingsForm({ initial }: { initial: AiSettings }) {
  const router = useRouter()
  const [endpoint, setEndpoint] = useState(initial.endpoint)
  const [apiKey, setApiKey] = useState("")
  const [modelFast, setModelFast] = useState(initial.modelFast ?? "")
  const [modelReasoning, setModelReasoning] = useState(initial.modelReasoning ?? "")
  const [models, setModels] = useState<AiModel[]>(initial.models)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    initial.testedAt
      ? { ok: Boolean(initial.testOk), text: initial.testOk ? `Terhubung · ${initial.models.length} model · diuji ${formatWhen(initial.testedAt)}` : `Gagal saat diuji ${formatWhen(initial.testedAt)}: ${initial.testError ?? ""}` }
      : null
  )
  const [testing, startTest] = useTransition()
  const [saving, startSave] = useTransition()

  const test = () => {
    startTest(async () => {
      const result = await testAiConnection({ endpoint, apiKey })
      if (result.success && result.data) {
        setModels(result.data.models)
        setStatus({ ok: true, text: `Terhubung · ${result.data.models.length} model tersedia` })
        if (result.data.models.length === 0) toast.message("Endpoint terhubung tapi tidak mengembalikan daftar model. Ketik nama modelnya manual.")
      } else {
        setStatus({ ok: false, text: result.error ?? "Gagal." })
      }
    })
  }

  const save = () => {
    startSave(async () => {
      const result = await saveAiSettings({ endpoint, apiKey, modelFast, modelReasoning })
      if (result.success && result.data) {
        toast.success("Pengaturan AI tersimpan.")
        setApiKey("")
        setModels(result.data.models)
        router.refresh()
      } else {
        toast.error(result.error ?? "Pengaturan gagal disimpan.")
      }
    })
  }

  const busy = testing || saving

  return (
    <div className="max-w-3xl space-y-4">
      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Koneksi</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Endpoint yang kompatibel OpenAI, termasuk jalur versinya (biasanya berakhir /v1).</p>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-endpoint" className="text-sm font-semibold text-foreground">Endpoint</Label>
            <Input id="ai-endpoint" className="h-12" inputMode="url" autoComplete="off" placeholder="https://proxy.contoh.com/v1" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-key" className="text-sm font-semibold text-foreground">Kunci API</Label>
            <Input id="ai-key" className="h-12" type="password" autoComplete="new-password" placeholder={initial.hasKey ? `Tersimpan · berakhiran ${initial.keyHint ?? "…"} · isi hanya untuk mengganti` : "Tempel kunci dari proxy"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            <p className="text-xs leading-relaxed text-muted-foreground">Disimpan terenkripsi di Supabase Vault dan tidak pernah ditampilkan kembali. Kosongkan untuk memakai kunci yang sudah tersimpan.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" className="h-12 md:h-10" onClick={test} disabled={busy || !endpoint.trim()}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Uji koneksi
            </Button>
            {status && (
              <p className={`flex items-center gap-1.5 text-sm ${status.ok ? "text-[var(--success-foreground)]" : "text-[var(--danger-foreground)]"}`} role="status">
                {status.ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {status.text}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card">
        <header className="border-b px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Model</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Dipilih dari daftar yang dilaporkan endpoint saat diuji. Kalau daftarnya kosong, ketik nama modelnya.</p>
        </header>
        <div className="divide-y">
          <ModelPicker id="ai-model-fast" label="Model cepat" hint="Untuk jawaban singkat: Tanya data dan hal lain yang perlu cepat." value={modelFast} onChange={setModelFast} models={models} />
          <ModelPicker id="ai-model-reasoning" label="Model analisis" hint="Untuk analisis yang lebih dalam: insight harian dan ringkasan periode. Boleh sama dengan model cepat." value={modelReasoning} onChange={setModelReasoning} models={models} />
        </div>
      </section>

      <p className="text-xs leading-relaxed text-muted-foreground">
        LeadEngine memakai koneksi ini untuk Ask AI dan Analyze di dashboard. Fitur AI di Sales Activity menyusul dan akan punya saklarnya sendiri di Aturan aktivitas.
      </p>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy || !endpoint.trim()} className="h-12 md:h-10">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Simpan pengaturan
        </Button>
      </div>
    </div>
  )
}

function ModelPicker({ id, label, hint, value, onChange, models }: { id: string; label: string; hint: string; value: string; onChange: (next: string) => void; models: AiModel[] }) {
  // A stored model that the endpoint no longer lists stays selectable, so the form never silently drops it.
  const options = value && !models.some((model) => model.id === value) ? [{ id: value, ownedBy: null }, ...models] : models
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_18rem] sm:items-center">
      <div>
        <Label htmlFor={id} className="text-sm font-semibold text-foreground">{label}</Label>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      {models.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="h-12 w-full md:h-10"><SelectValue placeholder="Pilih model" /></SelectTrigger>
          <SelectContent>
            {options.map((model) => (
              <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input id={id} className="h-12 md:h-10" autoComplete="off" placeholder="nama-model" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  )
}

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso))
}
