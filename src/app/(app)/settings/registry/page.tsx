"use client"

import { PermissionGate } from "@/features/users/components/permission-gate"
import { RegistrySettings } from "@/features/goals/components/settings/registry-settings"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"

export default function RegistryPage() {
  return (
    <PermissionGate
      resource="master_options"
      action="can_update"
      fallback={<div className="p-8 text-muted-foreground">You do not have permission to manage the field registry.</div>}
    >
      <div className="min-h-screen bg-muted/30">
        <SettingsPageHeader
          title="Lead Field Registry"
          subtitle="Manage which lead fields are available for analysis across goals, segments, and dashboard widgets."
          breadcrumbs={[{ label: "Registry" }]}
        />
        <div className="px-6 pb-10 max-w-[1200px]">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <RegistrySettings />
          </div>
        </div>
      </div>
    </PermissionGate>
  )
}
