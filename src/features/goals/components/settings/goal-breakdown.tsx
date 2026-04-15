"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { updateGoalV2Action } from "@/app/actions/goal-actions"
import { LEAD_FIELD_REGISTRY } from "@/config/lead-field-registry"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { CurrencyInput } from "@/components/shared/currency-input"
import { Loader2, BarChart3, Pencil, Save, X, ChevronRight, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import type { GoalV2, GoalSegment, BreakdownLevelConfig, BreakdownTargets } from "@/types/goals"
import {
  type TreeNodeData,
  type LeadRow,
  buildBreakdownTree,
  computeChildren,
  serializeTargets,
  setDimensionSourceFields,
} from "@/features/goals/lib/breakdown-utils"

/** Comprehensive lead select string covering all registry fields + joins */
const LEAD_SELECT = `
  id, company_id, actual_value, estimated_value,
  pipeline_stage:pipeline_stages!pipeline_stage_id (stage_type, closed_status),
  client_company_id, client_company:client_companies!client_company_id (id, name, line_industry),
  pic_sales_id, pic_sales_profile:profiles!pic_sales_id (id, full_name),
  category, lead_source, main_stream, grade_lead, stream_type,
  business_purpose, tipe, nationality, sector, area, referral_source, event_format
`.trim()

function formatIDR(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (Math.abs(value) >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(0)}M`
  if (Math.abs(value) >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

function pct(part: number, total: number): string {
  if (total <= 0) return "0%"
  return `${((part / total) * 100).toFixed(1)}%`
}

// ── TreeNode recursive component ──

interface TreeNodeProps {
  node: TreeNodeData
  levels: BreakdownLevelConfig[]
  editing: boolean
  editTargets: Map<string, number>
  onToggleExpand: (node: TreeNodeData, path: string) => void
  onTargetChange: (pathKey: string, value: number) => void
  depth: number
  pathKey: string
  expandedPaths: Set<string>
  loadingPaths: Set<string>
}

function TreeNode({
  node, levels, editing, editTargets, onToggleExpand, onTargetChange,
  depth, pathKey, expandedPaths, loadingPaths,
}: TreeNodeProps) {
  const isExpanded = expandedPaths.has(pathKey)
  const isLoading = loadingPaths.has(pathKey)
  const hasChildren = node.children !== null && node.children.length > 0
  const canExpand = node.level < levels.length - 1

  const rowTarget = editing ? (editTargets.get(pathKey) ?? node.target) : node.target
  const progressPct = rowTarget > 0 ? Math.min((node.wonRevenue / rowTarget) * 100, 100) : 0
  const pctOfTarget = rowTarget > 0 ? pct(node.wonRevenue, rowTarget) : "—"

  return (
    <>
      <TableRow className="group">
        <TableCell style={{ paddingLeft: `${depth * 24 + 8}px` }}>
          <div className="flex items-center gap-1.5">
            {canExpand ? (
              <button
                onClick={() => onToggleExpand(node, pathKey)}
                className="p-0.5 rounded hover:bg-muted shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            ) : (
              <span className="w-[22px] shrink-0" />
            )}
            <span className="font-medium text-sm truncate">{node.name}</span>
          </div>
        </TableCell>
        <TableCell className="text-right">
          {editing ? (
            <div className="w-[140px] ml-auto">
              <CurrencyInput
                prefix="Rp"
                value={editTargets.get(pathKey) ?? node.target}
                onChange={(v) => onTargetChange(pathKey, v ?? 0)}
                placeholder="0"
              />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">
              {rowTarget > 0 ? formatIDR(rowTarget) : "—"}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right text-sm text-emerald-600 font-medium">
          {formatIDR(node.wonRevenue)}
        </TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">
          {formatIDR(node.pipelineValue)}
        </TableCell>
        <TableCell className="text-right text-sm font-medium">{pctOfTarget}</TableCell>
        <TableCell>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && hasChildren &&
        node.children!.map((child) => {
          const childPath = `${pathKey}/${child.id}`
          return (
            <TreeNode
              key={childPath}
              node={child}
              levels={levels}
              editing={editing}
              editTargets={editTargets}
              onToggleExpand={onToggleExpand}
              onTargetChange={onTargetChange}
              depth={depth + 1}
              pathKey={childPath}
              expandedPaths={expandedPaths}
              loadingPaths={loadingPaths}
            />
          )
        })}
    </>
  )
}

// ── GoalBreakdown main component ──

export function GoalBreakdown({
  goals,
  onGoalsChange,
}: {
  goals: GoalV2[]
  onGoalsChange?: () => void
}) {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [selectedGoalId, setSelectedGoalId] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [segments, setSegments] = useState<GoalSegment[]>([])

  const [treeNodes, setTreeNodes] = useState<TreeNodeData[]>([])
  const [allLeads, setAllLeads] = useState<LeadRow[]>([])
  const [valueMaps, setValueMaps] = useState<Map<string, Map<string, string>>>(new Map())

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set())

  const [editing, setEditing] = useState(false)
  const [editTargets, setEditTargets] = useState<Map<string, number>>(new Map())
  const [saving, setSaving] = useState(false)

  // Auto-select first goal
  useEffect(() => {
    if (goals.length > 0 && !selectedGoalId) {
      setSelectedGoalId(goals[0].id)
    }
  }, [goals, selectedGoalId])

  const selectedGoal = goals.find((g) => g.id === selectedGoalId)
  const levels: BreakdownLevelConfig[] = selectedGoal?.breakdown_config ?? []
  const savedTargets: BreakdownTargets = (selectedGoal?.breakdown_targets as BreakdownTargets) ?? {}

  // Load segments for this company
  useEffect(() => {
    if (!activeCompany?.id) return
    const load = async () => {
      const { data } = await supabase
        .from("goal_segments")
        .select("*")
        .eq("company_id", activeCompany.id)
      const segs = (data as GoalSegment[]) ?? []
      setSegments(segs)
      // Register segment source fields for resolveLeadValue
      setDimensionSourceFields(segs)
    }
    load()
  }, [activeCompany?.id, supabase])

  // Fetch field values for a level
  const fetchFieldValueMap = useCallback(
    async (fieldKey: string): Promise<Map<string, string>> => {
      const vMap = new Map<string, string>()

      if (fieldKey.startsWith("segment:")) {
        const segId = fieldKey.replace("segment:", "")
        const seg = segments.find((s) => s.id === segId)
        if (seg) {
          for (const m of seg.mappings) {
            vMap.set(m.segment_name, m.segment_name)
          }
          vMap.set(seg.fallback_name, seg.fallback_name)
        }
        return vMap
      }

      const entry = LEAD_FIELD_REGISTRY.find((f) => f.key === fieldKey)
      if (!entry) return vMap

      const src = entry.valueSource
      if (src.type === "master_options") {
        const { data } = await supabase
          .from("master_options")
          .select("value, label")
          .eq("option_type", src.optionType)
          .eq("is_active", true)
          .order("sort_order")
        for (const row of data ?? []) {
          vMap.set(row.value, row.label ?? row.value)
        }
      } else if (src.type === "leads_distinct") {
        const { data } = await supabase
          .from("leads")
          .select(src.column)
          .not(src.column, "is", null)
        for (const row of data ?? []) {
          const v = (row as Record<string, unknown>)[src.column] as string
          if (v) vMap.set(v, v)
        }
      } else if (src.type === "profiles") {
        const { data } = await supabase.from("profiles").select("id, full_name")
        for (const row of data ?? []) {
          vMap.set(row.id, row.full_name ?? row.id)
        }
      } else if (src.type === "client_companies") {
        const { data } = await supabase.from("client_companies").select("id, name")
        for (const row of data ?? []) {
          vMap.set(row.id, row.name ?? row.id)
        }
      } else if (src.type === "client_company_field") {
        const col = (src as { type: "client_company_field"; column: string }).column
        const { data } = await supabase
          .from("client_companies")
          .select(col)
          .not(col, "is", null)
        for (const row of data ?? []) {
          const v = (row as Record<string, unknown>)[col] as string
          if (v) vMap.set(v, v)
        }
      } else if (src.type === "subsidiaries") {
        const { data } = await supabase.from("companies").select("id, name")
        for (const row of data ?? []) {
          vMap.set(row.id, row.name ?? row.id)
        }
      }

      return vMap
    },
    [supabase, segments]
  )

  // Load breakdown data
  const loadBreakdown = useCallback(async () => {
    if (!activeCompany?.id || !selectedGoalId || levels.length === 0) {
      setTreeNodes([])
      setAllLeads([])
      return
    }
    setLoading(true)

    try {
      const { data: leads, error } = await supabase.from("leads").select(LEAD_SELECT)
      if (error || !leads) {
        toast.error("Failed to load leads")
        setLoading(false)
        return
      }

      const typedLeads = leads as unknown as LeadRow[]
      setAllLeads(typedLeads)

      // Build value maps for each level
      const newValueMaps = new Map<string, Map<string, string>>()
      for (const level of levels) {
        const vMap = await fetchFieldValueMap(level.field)
        newValueMaps.set(level.field, vMap)
      }
      setValueMaps(newValueMaps)

      const nodes = buildBreakdownTree(typedLeads, levels, newValueMaps, segments, savedTargets)
      setTreeNodes(nodes)
    } catch {
      toast.error("Failed to load breakdown data")
      setTreeNodes([])
    }

    setLoading(false)
    setExpandedPaths(new Set())
    setLoadingPaths(new Set())
  }, [activeCompany?.id, selectedGoalId, levels, supabase, segments, savedTargets, fetchFieldValueMap])

  useEffect(() => {
    loadBreakdown()
  }, [loadBreakdown])

  // Expand/collapse
  const handleToggleExpand = useCallback(
    async (node: TreeNodeData, pathKey: string) => {
      if (expandedPaths.has(pathKey)) {
        setExpandedPaths((prev) => {
          const next = new Set(prev)
          for (const p of prev) {
            if (p === pathKey || p.startsWith(pathKey + "/")) next.delete(p)
          }
          return next
        })
        return
      }

      if (node.children === null) {
        setLoadingPaths((prev) => new Set(prev).add(pathKey))
        const children = computeChildren(
          node, allLeads, levels, node.level, valueMaps, segments, savedTargets
        )
        node.children = children
        setLoadingPaths((prev) => {
          const next = new Set(prev)
          next.delete(pathKey)
          return next
        })
      }

      setExpandedPaths((prev) => new Set(prev).add(pathKey))
    },
    [allLeads, levels, valueMaps, segments, savedTargets, expandedPaths]
  )

  // Editing
  const startEditing = () => {
    const initial = new Map<string, number>()
    const populate = (nodes: TreeNodeData[], parentPath: string) => {
      for (const node of nodes) {
        const path = parentPath ? `${parentPath}/${node.id}` : node.id
        initial.set(path, node.target)
        if (node.children?.length) populate(node.children, path)
      }
    }
    populate(treeNodes, "")
    setEditTargets(initial)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setEditTargets(new Map())
  }

  const handleTargetChange = (pathKey: string, value: number) => {
    setEditTargets((prev) => {
      const next = new Map(prev)
      next.set(pathKey, value)
      return next
    })
  }

  const handleSaveTargets = async () => {
    if (!selectedGoal) return
    setSaving(true)

    try {
      // Apply edit targets back to tree nodes
      const applyTargets = (nodes: TreeNodeData[], parentPath: string) => {
        for (const node of nodes) {
          const path = parentPath ? `${parentPath}/${node.id}` : node.id
          const editVal = editTargets.get(path)
          if (editVal !== undefined) node.target = editVal
          if (node.children?.length) applyTargets(node.children, path)
        }
      }
      applyTargets(treeNodes, "")

      const nested = serializeTargets(treeNodes)

      // Warn if level-0 sum doesn't match goal target
      const level0Sum = treeNodes.reduce((sum, n) => {
        return sum + (editTargets.get(n.id) ?? n.target)
      }, 0)
      if (level0Sum !== selectedGoal.target_amount) {
        toast.warning(
          `Sub-target total (${formatIDR(level0Sum)}) doesn't match goal target (${formatIDR(selectedGoal.target_amount)})`,
          { duration: 5000 }
        )
      }

      const result = await updateGoalV2Action(selectedGoal.id, {
        breakdown_targets: nested as unknown as BreakdownTargets,
      })
      if (result.success) {
        toast.success("Breakdown targets saved")
        setEditing(false)
        onGoalsChange?.()
      } else {
        toast.error(result.error ?? "Failed to save targets")
      }
    } catch {
      toast.error("Failed to save targets")
    }

    setSaving(false)
  }

  const totalWon = treeNodes.reduce((sum, n) => sum + n.wonRevenue, 0)

  const editTotal = useMemo(() => {
    return treeNodes.reduce((sum, n) => sum + (editTargets.get(n.id) ?? n.target), 0)
  }, [editTargets, treeNodes])

  if (goals.length === 0) return null

  const currentLabel =
    levels.length > 0 ? levels.map((l) => l.label).join(" → ") : "breakdown"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Goal Breakdown
            </CardTitle>
            <CardDescription>
              {editing
                ? `Set individual targets per ${currentLabel}. Save when done.`
                : levels.length === 0
                  ? "Configure breakdown levels on the goal to analyze attainment."
                  : `See how attainment breaks down by ${currentLabel}.`}
            </CardDescription>
          </div>
          {goals.length > 1 && (
            <Select
              value={selectedGoalId}
              onValueChange={(v) => {
                setSelectedGoalId(v)
                setEditing(false)
              }}
            >
              <SelectTrigger className="w-[220px] h-8 text-xs">
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : levels.length === 0 ? (
          <div className="text-center py-8">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Add breakdown levels to this goal to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            {selectedGoal && (
              <div className="mb-4 flex items-center gap-4 text-xs flex-wrap">
                <div>
                  <span className="text-muted-foreground">Target: </span>
                  <span className="font-semibold">{formatIDR(selectedGoal.target_amount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Won: </span>
                  <span className="font-semibold text-emerald-600">{formatIDR(totalWon)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Attainment: </span>
                  <span className="font-semibold">
                    {pct(totalWon, selectedGoal.target_amount)}
                  </span>
                </div>
                {editing && (
                  <div>
                    <span className="text-muted-foreground">Sub-target total: </span>
                    <span
                      className={`font-semibold ${editTotal !== selectedGoal.target_amount ? "text-amber-600" : "text-emerald-600"}`}
                    >
                      {formatIDR(editTotal)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Edit controls */}
            <div className="mb-3 flex items-center gap-2">
              {editing ? (
                <>
                  <Button size="sm" onClick={handleSaveTargets} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Save Targets
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEditing} disabled={saving}>
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                </>
              ) : (
                treeNodes.length > 0 && (
                  <Button size="sm" variant="outline" onClick={startEditing}>
                    <Pencil className="h-3.5 w-3.5" /> Edit Targets
                  </Button>
                )
              )}
            </div>

            {/* Tree table */}
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Target</TableHead>
                    <TableHead className="text-right">Won Revenue</TableHead>
                    <TableHead className="text-right">Pipeline</TableHead>
                    <TableHead className="text-right">% of Target</TableHead>
                    <TableHead className="w-[100px]">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {treeNodes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                        No data available.
                      </TableCell>
                    </TableRow>
                  ) : (
                    treeNodes.map((node) => (
                      <TreeNode
                        key={node.id}
                        node={node}
                        levels={levels}
                        editing={editing}
                        editTargets={editTargets}
                        onToggleExpand={handleToggleExpand}
                        onTargetChange={handleTargetChange}
                        depth={0}
                        pathKey={node.id}
                        expandedPaths={expandedPaths}
                        loadingPaths={loadingPaths}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
