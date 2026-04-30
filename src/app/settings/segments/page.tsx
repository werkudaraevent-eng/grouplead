"use client"

import { PermissionGate } from "@/features/users/components/permission-gate"
import { SegmentSettings } from "@/features/goals/components/settings/segment-settings"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"

export default function SegmentsPage() {
  return (
    <PermissionGate
      resource="segment_settings"
      action="read"
      fallback={<div className="p-8 text-muted-foreground">You do not have permission to view segment settings.</div>}
    >
      <div className="min-h-screen bg-muted/30">
        <SettingsPageHeader
          title="Segments & Dimensions"
          subtitle="Define custom segments by grouping lead field values together. Segments are reusable across goals, dashboard widgets, and analytics."
          breadcrumbs={[{ label: "Segments" }]}
        />
        <div className="px-6 pb-10 max-w-[1200px]">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <SegmentSettings />
          </div>
        </div>
      </div>
    </PermissionGate>
  )
}
