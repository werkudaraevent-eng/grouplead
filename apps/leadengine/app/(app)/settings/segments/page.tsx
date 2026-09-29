"use client"

import { PermissionGate } from "@/features/users/components/permission-gate"
import { SegmentSettings } from "@/features/goals/components/settings/segment-settings"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { pageIntroKey } from "@/lib/hints/hint-key"

export default function SegmentsPage() {
  return (
    <PermissionGate
      resource="segment_settings"
      action="read"
      fallback={<div className="p-8 text-muted-foreground">You do not have permission to view segment settings.</div>}
    >
      <div data-settings-wide className="min-h-screen bg-background">
        <SettingsPageHeader
          title="Segments & Dimensions"
          subtitle="Define custom segments by grouping lead field values together. Segments are reusable across goals, dashboard widgets, and analytics."
          intro={pageIntroKey("settings-segments")}
          breadcrumbs={[{ label: "Segments" }]}
        />
        <div className="px-4 sm:px-6 lg:px-8 pb-10">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <SegmentSettings />
          </div>
        </div>
      </div>
    </PermissionGate>
  )
}
