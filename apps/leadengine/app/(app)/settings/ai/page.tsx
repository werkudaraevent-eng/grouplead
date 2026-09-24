import { requirePermission } from "@/lib/require-permission"
import { readAiSettings } from "@/lib/ai/ai-settings"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { AiSettingsForm } from "@/features/settings/components/ai-settings-form"

export const dynamic = "force-dynamic"

/**
 * Settings → AI: the connection LeadEngine's Ask AI and Analyze use, shared
 * with Sales Activity. The layout already requires settings.read; changing
 * the connection needs settings.update, checked here and again in the
 * actions.
 */
export default async function AiSettingsPage() {
  const guard = await requirePermission("settings", "update")
  const settings = guard.allowed ? await readAiSettings() : null

  return (
    <div className="min-h-screen bg-muted/30">
      <SettingsPageHeader
        title="AI"
        subtitle="The endpoint, API key and models behind Ask AI and Analyze. One connection, shared with Sales Activity."
        intro={pageIntroKey("settings-ai")}
        breadcrumbs={[{ label: "AI" }]}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/ai/usage">Usage</Link>
          </Button>
        }
      />
      <div className="px-6 pb-10 max-w-[800px]">
        {settings ? (
          <AiSettingsForm initial={settings} />
        ) : (
          <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">You do not have permission to change the AI connection.</div>
        )}
      </div>
    </div>
  )
}
