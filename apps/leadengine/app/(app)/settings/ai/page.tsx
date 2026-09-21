import { requirePermission } from "@/lib/require-permission"
import { readAiSettings } from "@/lib/ai/ai-settings"
import { readAiUsage } from "@/lib/ai/ai-usage"
import { createServiceClient } from "@/utils/supabase/service"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { AiSettingsForm } from "@/features/settings/components/ai-settings-form"
import { AiUsageCard } from "@/features/settings/components/ai-usage-card"

export const dynamic = "force-dynamic"

/**
 * Settings → AI: the connection LeadEngine's Ask AI and Analyze use, shared
 * with Sales Activity. The layout already requires settings.read; changing
 * the connection needs settings.update, checked here and again in the
 * actions.
 */
export default async function AiSettingsPage() {
  const guard = await requirePermission("settings", "update")
  const [settings, usage] = guard.allowed ? await Promise.all([readAiSettings(), readAiUsage(createServiceClient())]) : [null, null]

  return (
    <div className="min-h-screen bg-muted/30">
      <SettingsPageHeader
        title="AI"
        subtitle="The endpoint, API key and models behind Ask AI and Analyze. One connection, shared with Sales Activity."
        breadcrumbs={[{ label: "AI" }]}
      />
      <div className="px-6 pb-10 max-w-[800px]">
        {settings && usage ? (
          <div className="space-y-6">
            <AiSettingsForm initial={settings} />
            <AiUsageCard summary={usage} />
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">You do not have permission to change the AI connection.</div>
        )}
      </div>
    </div>
  )
}
