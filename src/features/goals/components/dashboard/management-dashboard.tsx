"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { useGoalData } from "@/features/goals/hooks/use-goal-data"
import { useSavedViews } from "@/features/goals/hooks/use-saved-views"
import { AttainmentSummaryWidget } from "./attainment-summary-widget"
import { PipelineWidget } from "./pipeline-widget"
import { ForecastWidget } from "./forecast-widget"
import { VarianceWidget } from "./variance-widget"
import { TrendWidget } from "./trend-widget"
import { CompanyBreakdownWidget } from "./company-breakdown-widget"
import { SegmentBreakdownWidget } from "./segment-breakdown-widget"
import { SalesContributionWidget } from "./sales-contribution-widget"
import { ExceptionListWidget } from "./exception-list-widget"
import { DrillDownPanel } from "./drill-down-panel"
import { SavedViewSelector } from "./saved-view-selector"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { GoalV2, SavedViewConfig } from "@/types/goals"

export function ManagementDashboard() {
  const { activeCompany, companies, switchCompany } = useCompany()
  const { views, loading: viewsLoading, saveView, deleteView, loadView } = useSavedViews()

  const [goals, setGoals] = useState<GoalV2[]>([])
  const [goalsLoading, setGoalsLoading] = useState(true)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [drillDown, setDrillDown] = useState<{
    label: string
    filterType: string
    filterValue: string
  } | null>(null)

  // Load goals_v2 for this company
  const loadGoals = useCallback(async () => {
    if (!activeCompany?.id) return
    setGoalsLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("goals_v2")
      .select("*")
      .eq("company_id", activeCompany.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
    const goalList = (data as GoalV2[]) ?? []
    setGoals(goalList)
    if (goalList.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goalList[0].id)
    }
    setGoalsLoading(false)
  }, [activeCompany?.id, selectedGoalId])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  const goalData = useGoalData({ goalId: selectedGoalId })

  const handleLoadView = (config: SavedViewConfig) => {
    if (config.goal_id) setSelectedGoalId(config.goal_id)
  }

  const handleSaveCurrentView = (name: string, isShared: boolean) => {
    const config: SavedViewConfig = {
      goal_id: selectedGoalId ?? null,
      company_id_filter: activeCompany?.id ?? null,
      attribution_basis: goalData.goal?.attribution_basis ?? null,
      filters: {},
      widget_order: [],
    }
    saveView(name, config, isShared)
  }

  const handleDrillDown = (label: string, filterType: string, filterValue: string) => {
    setDrillDown({ label, filterType, filterValue })
  }

  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <PermissionGate
      resource="management_dashboard"
      action="read"
      fallback={
        <div className="p-8 text-muted-foreground">
          You don&apos;t have access to the management dashboard.
        </div>
      }
    >
      <div className="w-full min-h-screen bg-slate-50">
        {/* Header */}
        <div className="sticky top-0 z-20 flex items-center justify-between h-16 px-6 bg-slate-50/90 backdrop-blur border-b border-slate-200/60">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Management Dashboard
            </h1>
            <p className="text-xs text-muted-foreground">Goal attainment &amp; forecast overview</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Saved View Selector */}
            <SavedViewSelector
              views={views}
              loading={viewsLoading}
              onLoad={(viewId) => {
                const config = loadView(viewId)
                if (config) handleLoadView(config)
              }}
              onSave={handleSaveCurrentView}
              onDelete={deleteView}
            />

            {/* Company scope selector */}
            <Select
              value={activeCompany?.slug ?? ""}
              onValueChange={(slug) => switchCompany(slug)}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.isHolding ? "Holding (All)" : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Goal selector */}
            {goals.length > 1 && (
              <Select
                value={selectedGoalId ?? ""}
                onValueChange={(id) => setSelectedGoalId(id)}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  {goals.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Widget Grid */}
        <div className="p-6">
          {goals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">No goals configured yet.</p>
              <p className="text-xs mt-1">
                Create goals in Settings → Goals to get started.
              </p>
            </div>
          ) : (
            <>
              {/* KPI row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <AttainmentSummaryWidget
                  attainment={goalData.attainment}
                  target={goalData.target}
                  loading={goalData.loading}
                />
                <PipelineWidget forecastRaw={goalData.forecastRaw} loading={goalData.loading} />
                <ForecastWidget
                  forecastWeighted={goalData.forecastWeighted}
                  loading={goalData.loading}
                />
              </div>

              {/* Variance + Trend row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <VarianceWidget
                  attainment={goalData.attainment}
                  forecastRaw={goalData.forecastRaw}
                  forecastWeighted={goalData.forecastWeighted}
                  target={goalData.target}
                  loading={goalData.loading}
                />
                <TrendWidget goalId={selectedGoalId} />
              </div>

              {/* Breakdown row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <CompanyBreakdownWidget
                  goalId={selectedGoalId}
                  loading={goalData.loading}
                  onDrillDown={handleDrillDown}
                />
                <SegmentBreakdownWidget
                  goalId={selectedGoalId}
                  loading={goalData.loading}
                  onDrillDown={handleDrillDown}
                />
                <SalesContributionWidget
                  goalId={selectedGoalId}
                  loading={goalData.loading}
                  onDrillDown={handleDrillDown}
                />
              </div>

              {/* Exceptions */}
              <div className="mb-4">
                <ExceptionListWidget
                  attainment={goalData.attainment}
                  target={goalData.target}
                  loading={goalData.loading}
                  onDrillDown={handleDrillDown}
                />
              </div>
            </>
          )}
        </div>

        {/* Drill-down panel */}
        {drillDown && (
          <DrillDownPanel
            label={drillDown.label}
            filterType={drillDown.filterType}
            filterValue={drillDown.filterValue}
            goalId={selectedGoalId}
            onClose={() => setDrillDown(null)}
          />
        )}
      </div>
    </PermissionGate>
  )
}
