"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { updateGoalSettingsV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import type { StageWeightsMap } from "@/types/goals"

interface Pipeline {
  id: string
  name: string
}

interface PipelineStage {
  id: string
  pipeline_id: string
  name: string
  stage_type: string
  sort_order: number
}

export function ForecastSettings() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [stagesByPipeline, setStagesByPipeline] = useState<Record<string, PipelineStage[]>>({})
  // stage_id → weight_percent
  const [weights, setWeights] = useState<Map<string, number>>(new Map())

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)

    const [settingsRes, pipelinesRes, stagesRes] = await Promise.all([
      supabase
        .from("goal_settings_v2")
        .select("stage_weights")
        .eq("company_id", activeCompany.id)
        .maybeSingle(),
      supabase
        .from("pipelines")
        .select("id, name")
        .eq("company_id", activeCompany.id)
        .order("name"),
      supabase
        .from("pipeline_stages")
        .select("id, pipeline_id, name, stage_type, sort_order")
        .order("sort_order"),
    ])

    const fetchedPipelines = (pipelinesRes.data ?? []) as Pipeline[]
    setPipelines(fetchedPipelines)

    const pipelineIds = new Set(fetchedPipelines.map((p) => p.id))
    const allStages = (stagesRes.data ?? []) as PipelineStage[]
    const grouped: Record<string, PipelineStage[]> = {}
    for (const stage of allStages) {
      if (!pipelineIds.has(stage.pipeline_id)) continue
      if (stage.stage_type !== "open") continue
      if (!grouped[stage.pipeline_id]) grouped[stage.pipeline_id] = []
      grouped[stage.pipeline_id].push(stage)
    }
    setStagesByPipeline(grouped)

    // Build flat stage_id → weight map from JSONB stage_weights
    const stageWeights = (settingsRes.data?.stage_weights ?? {}) as StageWeightsMap
    const wMap = new Map<string, number>()
    for (const pipelineWeights of Object.values(stageWeights)) {
      for (const [stageId, weight] of Object.entries(pipelineWeights)) {
        wMap.set(stageId, weight)
      }
    }
    setWeights(wMap)
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateWeight = (stageId: string, value: number) => {
    setWeights((prev) => {
      const next = new Map(prev)
      next.set(stageId, Math.min(100, Math.max(0, Math.round(value))))
      return next
    })
  }

  const handleSave = async () => {
    if (!activeCompany?.id) return
    setSaving(true)

    // Rebuild StageWeightsMap from flat weights map
    const stageWeights: StageWeightsMap = {}
    for (const [pipelineId, stages] of Object.entries(stagesByPipeline)) {
      stageWeights[pipelineId] = {}
      for (const stage of stages) {
        stageWeights[pipelineId][stage.id] = weights.get(stage.id) ?? 0
      }
    }

    const result = await updateGoalSettingsV2Action(activeCompany.id, { stage_weights: stageWeights })
    setSaving(false)
    if (result.success) {
      toast.success("Forecast weights saved")
    } else {
      toast.error(result.error ?? "Failed to save forecast weights")
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Collect all unique open stages across pipelines
  const allStages = new Map<string, PipelineStage>()
  for (const stages of Object.values(stagesByPipeline)) {
    for (const stage of stages) {
      if (!allStages.has(stage.id)) allStages.set(stage.id, stage)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Weights</CardTitle>
        <CardDescription>
          Configure stage probability weights for weighted forecast calculation. Weights are stored
          per pipeline in goal settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {pipelines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pipelines configured.</p>
        ) : (
          <>
            {pipelines.map((pipeline) => {
              const stages = stagesByPipeline[pipeline.id] ?? []
              if (stages.length === 0) return null
              return (
                <div key={pipeline.id} className="space-y-3">
                  <Label className="text-sm font-semibold">{pipeline.name}</Label>
                  <div className="space-y-2">
                    {stages
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((stage) => (
                        <div key={stage.id} className="flex items-center gap-3">
                          <span className="text-sm w-44 truncate">{stage.name}</span>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={weights.get(stage.id) ?? 0}
                            onChange={(e) => updateWeight(stage.id, Number(e.target.value))}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}

            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Forecast Weights
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
