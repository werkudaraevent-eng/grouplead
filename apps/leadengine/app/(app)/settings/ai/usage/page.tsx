import { requirePermission } from "@/lib/require-permission"
import { readAiUsage } from "@/lib/ai/ai-usage"
import { createServiceClient } from "@/utils/supabase/service"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { AiUsageCard } from "@/features/settings/components/ai-usage-card"

export const dynamic = "force-dynamic"

/**
 * Settings → AI → Usage: what the proxy has been asked for, in tokens. Its
 * own page rather than a card under the connection form, because a form
 * ends at its Save and a read-only ledger is a different task (OpenAI's and
 * Anthropic's consoles keep Usage beside, not under, the API keys).
 */
export default async function AiUsagePage() {
  const guard = await requirePermission("settings", "update")
  const usage = guard.allowed ? await readAiUsage(createServiceClient()) : null

  return (
    <div className="min-h-screen bg-muted/30">
      <SettingsPageHeader
        title="AI usage"
        subtitle="Tokens both apps sent through the AI proxy, and what a week and a month need at the current pace."
        breadcrumbs={[{ label: "AI", href: "/settings/ai" }, { label: "Usage" }]}
      />
      <div className="px-6 pb-10 max-w-[800px]">
        {usage ? (
          <AiUsageCard summary={usage} />
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">You do not have permission to see AI usage.</div>
        )}
      </div>
    </div>
  )
}
