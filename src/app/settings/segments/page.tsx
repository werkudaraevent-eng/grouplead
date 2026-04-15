"use client"

import Link from "next/link"
import { ArrowLeft, Tags } from "lucide-react"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { SegmentSettings } from "@/features/goals/components/settings/segment-settings"

export default function SegmentsPage() {
  return (
    <PermissionGate
      resource="segment_settings"
      action="read"
      fallback={<div className="p-8 text-muted-foreground">You do not have permission to view segment settings.</div>}
    >
      <div className="min-h-screen bg-[#f2f3f6]">
        <div className="px-8 pt-6 pb-4 max-w-[1200px] mx-auto">
          <Link
            href="/settings"
            className="text-[12px] font-medium text-[#8892a4] hover:text-[#4f46e5] flex items-center gap-1.5 mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
          </Link>
          <div className="flex items-center gap-2 mb-0.5">
            <Tags className="h-5 w-5 text-slate-600" />
            <h1 className="text-[19px] font-[800] text-[#0f1729] tracking-[-0.3px]">Segments & Dimensions</h1>
          </div>
          <p className="text-[12px] text-[#8892a4]">
            Define custom segments by grouping lead field values together. Segments are reusable across goals, dashboard widgets, and analytics.
          </p>
        </div>
        <div className="px-8 pb-10 max-w-[1200px] mx-auto">
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <SegmentSettings />
          </div>
        </div>
      </div>
    </PermissionGate>
  )
}
