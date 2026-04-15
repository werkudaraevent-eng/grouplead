"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { GoalManager } from "./goal-manager"
import { GoalBreakdown } from "./goal-breakdown"
import { AttributionSettings } from "./attribution-settings"
import { ForecastSettings } from "./forecast-settings"
import { CriticalFieldsSettings } from "./critical-fields-settings"
import { AutoLockSettings } from "./auto-lock-settings"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ArrowLeft, Check, Circle, Target, Settings2, PartyPopper } from "lucide-react"
import Link from "next/link"
import type { GoalV2 } from "@/types/goals"

interface SetupStatus {
  goalsExist: boolean
  settingsExist: boolean
  goalsCount: number
  attributionBasis: string | null
  cutoffDay: number | null
  weightedForecast: boolean | null
  criticalFieldsCount: number | null
  autoLockEnabled: boolean | null
}

function SetupProgress({ status, onStepClick }: { status: SetupStatus; onStepClick: (id: string) => void }) {
  const steps = [
    {
      id: "goals-section",
      label: "Create Goal",
      done: status.goalsExist,
      detail: status.goalsExist ? `${status.goalsCount} goal${status.goalsCount !== 1 ? "s" : ""}` : "No goals yet",
    },
    {
      id: "advanced-section",
      label: "Configure Settings",
      done: status.settingsExist,
      detail: status.settingsExist ? "Configured" : "Using defaults",
    },
  ]

  const allDone = steps.every((s) => s.done)
  const currentIdx = steps.findIndex((s) => !s.done)

  return (
    <div className="space-y-4">
      {allDone && (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <PartyPopper className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Goal tracking is active!</p>
            <p className="text-xs text-emerald-600">
              View your progress on the{" "}
              <Link href="/" className="underline hover:text-emerald-800">
                Dashboard
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-0">
        {steps.map((step, idx) => {
          const isCurrent = idx === currentIdx
          return (
            <div key={step.id} className="flex items-center">
              {idx > 0 && (
                <div
                  className={`h-0.5 w-8 sm:w-12 ${step.done || steps[idx - 1]?.done ? "bg-emerald-400" : "bg-slate-200"}`}
                />
              )}
              <button
                onClick={() => onStepClick(step.id)}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-slate-100 group"
              >
                {step.done ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shrink-0">
                    <Check className="h-4 w-4" />
                  </div>
                ) : isCurrent ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-50 shrink-0">
                    <Circle className="h-3 w-3 fill-blue-500 text-blue-500" />
                  </div>
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-200 bg-white shrink-0">
                    <span className="text-xs font-medium text-slate-400">{idx + 1}</span>
                  </div>
                )}
                <div className="text-left hidden sm:block">
                  <p className={`text-xs font-medium ${step.done ? "text-emerald-700" : isCurrent ? "text-blue-700" : "text-slate-500"}`}>
                    Step {idx + 1}
                  </p>
                  <p className={`text-[11px] ${step.done ? "text-emerald-600" : isCurrent ? "text-blue-600" : "text-slate-400"}`}>
                    {step.detail}
                  </p>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AdvancedSettingSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between w-full">
      <span>{label}</span>
      <span className="text-xs font-normal text-muted-foreground mr-2">{value}</span>
    </div>
  )
}

export function GoalSettingsPage() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [status, setStatus] = useState<SetupStatus>({
    goalsExist: false,
    settingsExist: false,
    goalsCount: 0,
    attributionBasis: null,
    cutoffDay: null,
    weightedForecast: null,
    criticalFieldsCount: null,
    autoLockEnabled: null,
  })
  const [loading, setLoading] = useState(true)
  const [goals, setGoals] = useState<GoalV2[]>([])

  const loadStatus = useCallback(async () => {
    if (!activeCompany?.id) return

    const [goalsRes, settingsRes] = await Promise.all([
      supabase
        .from("goals_v2")
        .select("*")
        .eq("company_id", activeCompany.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("goal_settings_v2")
        .select("reporting_critical_fields, auto_lock_enabled, stage_weights")
        .eq("company_id", activeCompany.id)
        .maybeSingle(),
    ])

    const goalsList = (goalsRes.data as GoalV2[]) ?? []
    const settings = settingsRes.data

    // Derive attribution info from first active goal
    const firstGoal = goalsList[0] ?? null

    setGoals(goalsList)
    setStatus({
      goalsExist: goalsList.length > 0,
      settingsExist: !!settings,
      goalsCount: goalsList.length,
      attributionBasis: firstGoal?.attribution_basis ?? null,
      cutoffDay: firstGoal?.monthly_cutoff_day ?? null,
      weightedForecast: firstGoal?.weighted_forecast_enabled ?? null,
      criticalFieldsCount: settings?.reporting_critical_fields?.length ?? null,
      autoLockEnabled: settings?.auto_lock_enabled ?? null,
    })
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const attributionSummary = status.attributionBasis
    ? `${status.attributionBasis === "closed_won_date" ? "Closed Won Date" : "Event Date"}, Cutoff: ${status.cutoffDay ?? 25}`
    : "Using defaults: Event Date, Cutoff day 25"

  const forecastSummary =
    status.weightedForecast === true ? "Weighted forecast: On" : "Weighted forecast: Off"

  const criticalFieldsSummary =
    status.criticalFieldsCount !== null
      ? `${status.criticalFieldsCount} protected fields`
      : "6 protected fields (default)"

  const autoLockSummary =
    status.autoLockEnabled === true ? "Auto-lock: On" : "Auto-lock: Off"

  return (
    <PermissionGate
      resource="goal_settings"
      action="read"
      fallback={
        <div className="p-8 text-muted-foreground">
          You do not have permission to view goal settings.
        </div>
      }
    >
      <div className="min-h-screen bg-[#f2f3f6]">
        {/* Header */}
        <div className="px-8 pt-6 pb-4 max-w-[1200px] mx-auto">
          <Link
            href="/settings"
            className="text-[12px] font-medium text-[#8892a4] hover:text-[#4f46e5] flex items-center gap-1.5 mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Settings
          </Link>
          <h1 className="text-[19px] font-[800] text-[#0f1729] tracking-[-0.3px] mb-0.5">
            Goal Settings
          </h1>
          <p className="text-[12px] text-[#8892a4]">
            Create goals, configure breakdown levels, attribution rules, and forecast settings.
          </p>
        </div>

        <div className="px-8 pb-10 max-w-[1200px] mx-auto space-y-8">
          {/* Setup Progress */}
          {!loading && (
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <SetupProgress status={status} onStepClick={scrollTo} />
            </div>
          )}

          {/* Section 1: Revenue Goals */}
          <section id="goals-section" className="scroll-mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Step 1: Revenue Goals</h2>
              <span className="text-[11px] text-rose-500 font-medium">Required</span>
            </div>
            <GoalManager onDataChange={loadStatus} />
          </section>

          {/* Section 2: Advanced Settings */}
          <section id="advanced-section" className="scroll-mt-6">
            <div className="mb-3 flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-700">Step 2: Advanced Settings</h2>
              <span className="text-[11px] text-slate-400 font-medium">Optional</span>
            </div>
            <div className="rounded-xl border bg-white shadow-sm">
              <Accordion type="multiple" className="px-4">
                <AccordionItem value="attribution">
                  <AccordionTrigger>
                    <AdvancedSettingSummary label="Attribution Rules" value={attributionSummary} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <AttributionSettings goals={goals} onGoalsChange={loadStatus} />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="forecast">
                  <AccordionTrigger>
                    <AdvancedSettingSummary label="Forecast Weights" value={forecastSummary} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <ForecastSettings />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="critical-fields">
                  <AccordionTrigger>
                    <AdvancedSettingSummary label="Critical Fields" value={criticalFieldsSummary} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <CriticalFieldsSettings />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="auto-lock">
                  <AccordionTrigger>
                    <AdvancedSettingSummary label="Auto-Lock" value={autoLockSummary} />
                  </AccordionTrigger>
                  <AccordionContent>
                    <AutoLockSettings />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="px-4 py-3 border-t">
                <Link
                  href="/settings/segments"
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1.5 transition-colors"
                >
                  Manage Segments in global settings →
                </Link>
              </div>
            </div>
          </section>

          {/* Goal Breakdown — attainment view with editable targets */}
          {status.goalsExist && (
            <section className="scroll-mt-6">
              <GoalBreakdown goals={goals} onGoalsChange={loadStatus} />
            </section>
          )}
        </div>
      </div>
    </PermissionGate>
  )
}
