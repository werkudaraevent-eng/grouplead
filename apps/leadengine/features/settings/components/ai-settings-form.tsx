"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Loader2, XCircle } from "@/components/icons"
import { saveAiSettings, testAiConnection } from "@/app/actions/ai-settings-actions"
import type { AiSettings } from "@/lib/ai/ai-settings"
import type { AiModel } from "@/lib/ai/ai-proxy"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/**
 * The AI connection in two cards: the endpoint and the key, then the two
 * models chosen from what that endpoint reports. "Test connection" asks the
 * endpoint for its model list and fills the pickers, which fall back to a
 * text field when the endpoint lists nothing. The key field is empty on
 * every visit and shows only the stored key's last four characters, as on
 * every integrations page (HubSpot, Zapier, Vercel): a key is written,
 * never read back.
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
      ? { ok: Boolean(initial.testOk), text: initial.testOk ? `Connected · ${initial.models.length} models · tested ${formatWhen(initial.testedAt)}` : `Failed when tested ${formatWhen(initial.testedAt)}: ${initial.testError ?? ""}` }
      : null
  )
  const [testing, startTest] = useTransition()
  const [saving, startSave] = useTransition()

  const test = () => {
    startTest(async () => {
      const result = await testAiConnection({ endpoint, apiKey })
      if (result.success && result.data) {
        setModels(result.data.models)
        setStatus({ ok: true, text: `Connected · ${result.data.models.length} models available` })
        if (result.data.models.length === 0) toast.message("The endpoint answered but listed no models. Type the model names by hand.")
      } else {
        setStatus({ ok: false, text: result.error ?? "Failed." })
      }
    })
  }

  const save = () => {
    startSave(async () => {
      const result = await saveAiSettings({ endpoint, apiKey, modelFast, modelReasoning })
      if (result.success && result.data) {
        toast.success("AI settings saved.")
        setApiKey("")
        setModels(result.data.models)
        router.refresh()
      } else {
        toast.error(result.error ?? "Settings could not be saved.")
      }
    })
  }

  const busy = testing || saving

  return (
    <div className="space-y-4">
      <section className="overflow-clip rounded-xl border bg-card shadow-sm">
        <header className="border-b px-5 py-4">
          <h2 className="text-[14px] font-semibold text-foreground">Connection</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">An OpenAI-compatible endpoint, including its version path (usually ending in /v1).</p>
        </header>
        <div className="space-y-4 px-5 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="ai-endpoint">Endpoint</Label>
            <Input id="ai-endpoint" inputMode="url" autoComplete="off" placeholder="https://proxy.example.com/v1" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-key">API key</Label>
            <Input id="ai-key" type="password" autoComplete="new-password" placeholder={initial.hasKey ? `Stored · ends in ${initial.keyHint ?? "…"} · fill in only to replace` : "Paste the key from the proxy"} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
            <p className="text-[12px] text-muted-foreground">Stored encrypted in Supabase Vault and never shown again. Leave empty to keep the stored key.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" variant="outline" onClick={test} disabled={busy || !endpoint.trim()}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Test connection
            </Button>
            {status && (
              <p className={`flex items-center gap-1.5 text-[13px] ${status.ok ? "text-[var(--success-foreground)]" : "text-destructive"}`} role="status">
                {status.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {status.text}
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="overflow-clip rounded-xl border bg-card shadow-sm">
        <header className="border-b px-5 py-4">
          <h2 className="text-[14px] font-semibold text-foreground">Models</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Chosen from what the endpoint reported at the last test. If it listed nothing, type the model name.</p>
        </header>
        <div className="divide-y">
          <ModelPicker id="ai-model-fast" label="Fast model" hint="For short answers: Ask AI and anything that has to be quick." value={modelFast} onChange={setModelFast} models={models} />
          <ModelPicker id="ai-model-reasoning" label="Reasoning model" hint="For deeper analysis: Analyze, and Sales Activity's daily insights. May be the same as the fast model." value={modelReasoning} onChange={setModelReasoning} models={models} />
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy || !endpoint.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save settings
        </Button>
      </div>
    </div>
  )
}

function ModelPicker({ id, label, hint, value, onChange, models }: { id: string; label: string; hint: string; value: string; onChange: (next: string) => void; models: AiModel[] }) {
  // A stored model the endpoint no longer lists stays selectable, so the form never silently drops it.
  const options = value && !models.some((model) => model.id === value) ? [{ id: value, ownedBy: null }, ...models] : models
  return (
    <div className="grid grid-cols-1 gap-2 px-5 py-4 sm:grid-cols-[1fr_18rem] sm:items-center">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
      </div>
      {models.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose a model" /></SelectTrigger>
          <SelectContent>
            {options.map((model) => (
              <SelectItem key={model.id} value={model.id}>{model.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input id={id} autoComplete="off" placeholder="model-name" value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </div>
  )
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
