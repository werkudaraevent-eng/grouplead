"use client"

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { updateGoalV2Action, updateGoalNodeAction, createGoalNodeAction, deleteGoalNodeAction, autoInsertGoalHierarchyAction, deleteGoalLevelAction } from "@/app/actions/goal-actions"
import { computeMonthlyTarget } from "@/features/goals/lib/target-calculator"
import { CurrencyInput } from "@/components/shared/currency-input"
import { GoalContextMenu } from "./goal-context-menu"
import { GoalUnallocatedRow } from "./goal-unallocated-row"
import { toast } from "sonner"
import {
  Loader2, ChevronDown, ChevronRight, Search, Maximize2, Minimize2, ArrowRight,
  Scale, RotateCcw, Pencil, Check, X, Download, Eye, EyeOff, Calendar,
} from "lucide-react"
import { getDimensionRegistry, type DimensionOption } from "@/config/dimension-registry"
import type { GoalV2, GoalNode, GoalNodeTree, MonthlyWeights } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"



// ── Design tokens (aligned with spec §3) ──
const ROW_HEIGHT = 48
const HIERARCHY_COL_WIDTH = 280
const MONTH_COL_MIN = 100

// Level badge colors per spec §3
const LEVEL_COLORS: Record<number, { bg: string; text: string }> = {
  1: { bg: "bg-indigo-100", text: "text-indigo-700" },
  2: { bg: "bg-sky-100", text: "text-sky-700" },
  3: { bg: "bg-violet-100", text: "text-violet-700" },
  4: { bg: "bg-emerald-100", text: "text-emerald-700" },
  5: { bg: "bg-amber-100", text: "text-amber-700" },
}

const CURRENT_MONTH = new Date().getMonth() + 1 // 1-indexed

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

type DisplayMetric = "nominal" | "percent" | "both"

// Search highlight helper — wraps matching substring in a colored span
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-yellow-200/80 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  )
}

function buildTree(nodes: GoalNode[]): GoalNodeTree[] {
  const map = new Map<string, GoalNodeTree>()
  const roots: GoalNodeTree[] = []
  for (const n of nodes) map.set(n.id, { ...n, children: [] })
  for (const n of nodes) {
    const tree = map.get(n.id)!
    if (n.parent_node_id && map.has(n.parent_node_id)) {
      map.get(n.parent_node_id)!.children.push(tree)
    } else {
      roots.push(tree)
    }
  }
  const sortChildren = (items: GoalNodeTree[]) => {
    items.sort((a, b) => a.sort_order - b.sort_order)
    for (const item of items) sortChildren(item.children)
  }
  sortChildren(roots)
  return roots
}

function getNodeLevel(node: GoalNodeTree, allNodes: Map<string, GoalNodeTree>): number {
  let level = 1
  let current = node
  while (current.parent_node_id && allNodes.has(current.parent_node_id)) {
    level++
    current = allNodes.get(current.parent_node_id)!
  }
  return level
}

// ═══════════════════════════════════════════════════════════════
// Inline Monthly Weights Editor (collapsible)
// ═══════════════════════════════════════════════════════════════
function InlineMonthlyWeights({ goal, onSave }: { goal: GoalV2; onSave?: () => void }) {
  const { fmt } = useCurrency()
  const existing = goal.monthly_weights ?? {}
  const initial: Record<string, number> = {}
  for (let m = 1; m <= 12; m++) initial[String(m)] = existing[String(m)] ?? 1 / 12

  const [weights, setWeights] = useState<Record<string, number>>(initial)
  const [saving, setSaving] = useState(false)

  const total = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights])
  const totalPct = (total * 100).toFixed(1)
  const isValid = Math.abs(total - 1.0) <= 0.001
  const allNonNeg = Object.values(weights).every((w) => w >= 0)

  const handleWeightChange = useCallback((month: number, pctStr: string) => {
    const pct = parseFloat(pctStr)
    if (isNaN(pct)) return
    setWeights((prev) => ({ ...prev, [String(month)]: pct / 100 }))
  }, [])

  const handleEqualDistribution = useCallback(() => {
    const eq: Record<string, number> = {}
    for (let m = 1; m <= 12; m++) eq[String(m)] = 1 / 12
    setWeights(eq)
  }, [])

  const handleSave = useCallback(async () => {
    if (!isValid || !allNonNeg) {
      toast.error("Weights must sum to 100% and be non-negative")
      return
    }
    setSaving(true)
    const result = await updateGoalV2Action(goal.id, {
      monthly_weights: weights as MonthlyWeights,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Monthly weights saved")
      onSave?.()
    } else {
      toast.error(result.error ?? "Failed to save weights")
    }
  }, [goal.id, weights, isValid, allNonNeg, onSave])

  return (
    <div className="px-5 py-4 bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Scale className="h-4 w-4 text-slate-500" />
            Monthly Weights
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Distribute the annual target ({fmt(goal.target_amount)}) across months.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleEqualDistribution}>
          <RotateCcw className="h-3 w-3" /> Equal Distribution
        </Button>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1
          const w = weights[String(month)] ?? 0
          const pct = (w * 100).toFixed(2)
          const amount = goal.target_amount * w
          return (
            <div key={month} className="space-y-1">
              <Label className="text-[11px] text-slate-400 font-medium">{label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={pct}
                  onChange={(e) => handleWeightChange(month, e.target.value)}
                  className="h-8 text-xs pr-6 tabular-nums"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">%</span>
              </div>
              <p className="text-[10px] text-slate-400 tabular-nums">{fmt(amount)}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">Total:</span>
          <span className={`font-semibold ${isValid ? "text-emerald-600" : "text-amber-600"}`}>{totalPct}%</span>
          {!isValid && <span className="text-amber-600 text-[11px]">⚠ Must equal 100%</span>}
          {!allNonNeg && <span className="text-red-600 text-[11px]">⚠ Negative weights not allowed</span>}
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving || !isValid || !allNonNeg} className="h-8 text-xs">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
          Save Weights
        </Button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Matrix Cell
// ═══════════════════════════════════════════════════════════════
interface CellProps {
  node: GoalNodeTree
  level: number
  month: number
  monthlyWeights: MonthlyWeights | null
  parentTarget: number
  displayMetric: DisplayMetric
  onCellSave: (nodeId: string, month: number, amount: number) => Promise<void>
  readOnly?: boolean
  year: number
  isTotal?: boolean
}

function MatrixCell({ node, level, month, monthlyWeights, parentTarget, displayMetric, onCellSave, readOnly, isTotal }: CellProps) {
  const { fmt } = useCurrency()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [flashGreen, setFlashGreen] = useState(false)

  const amount = computeMonthlyTarget(node.target_amount, monthlyWeights, month, node.monthly_targets)
  const parentMonthly = parentTarget > 0 ? computeMonthlyTarget(parentTarget, monthlyWeights, month) : 0
  const pctOfParent = parentMonthly > 0 ? ((amount / parentMonthly) * 100).toFixed(0) : "—"

  const handleDoubleClick = () => {
    if (saving || readOnly || isTotal) return
    setEditValue(String(Math.round(amount)))
    setEditing(true)
  }

  const handleSave = async () => {
    const val = parseFloat(editValue)
    if (isNaN(val) || val < 0) { setEditing(false); return }
    setSaving(true)
    await onCellSave(node.id, month, val)
    setSaving(false)
    setEditing(false)
    setFlashGreen(true)
    setTimeout(() => setFlashGreen(false), 600)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave()
    if (e.key === "Escape") setEditing(false)
  }

  if (editing) {
    return (
      <td className="px-2 py-1 align-middle" style={{ minWidth: MONTH_COL_MIN }}>
        <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown} autoFocus className="h-8 text-xs tabular-nums w-full" />
      </td>
    )
  }

  // Current month highlight per spec §7.5
  const isCurrentMonth = month === CURRENT_MONTH

  return (
    <td className={`px-4 py-2 align-middle cursor-pointer hover:bg-slate-50 transition-colors ${flashGreen ? "bg-green-50" : ""} ${isCurrentMonth ? "border-l-2 border-l-indigo-500" : ""}`}
      style={{ minWidth: MONTH_COL_MIN, height: ROW_HEIGHT }} onDoubleClick={handleDoubleClick}>
      {saving ? (
        <div className="flex justify-end pr-2"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
      ) : (
        <div className="flex flex-col justify-center text-right">
          {(displayMetric === "nominal" || displayMetric === "both") && (
            <span className={`text-[12px] tabular-nums ${level === 1 ? 'font-semibold text-slate-900' : 'font-medium text-slate-900'}`}>
              {fmt(amount)}
            </span>
          )}
          {(displayMetric === "percent" || displayMetric === "both") && (
            <span className="text-[10.5px] text-slate-500 tabular-nums font-medium mt-0.5">
              {pctOfParent === "—" ? "0%" : `${pctOfParent}%`}
            </span>
          )}
        </div>
      )}
    </td>
  )
}

// ═══════════════════════════════════════════════════════════════
// Matrix Row
// ═══════════════════════════════════════════════════════════════
interface RowProps {
  node: GoalNodeTree; level: number; months: number[]; year: number
  monthlyWeights: MonthlyWeights | null; parentTarget: number; displayMetric: DisplayMetric
  expanded: Set<string>; onToggle: (id: string) => void
  onCellSave: (nodeId: string, month: number, amount: number) => Promise<void>
  onNodeAdd: (parentId: string | null, levelIndex: number) => Promise<void>
  onNodeRename: (nodeId: string, name: string) => Promise<void>
  onNodeDelete: (nodeId: string) => Promise<void>
  onNodeSwitchMode: (nodeId: string) => Promise<void>
  nodeMap: Map<string, GoalNodeTree>; readOnly?: boolean
  displayPills: { label: string; value?: string; field?: string }[]
  searchQuery: string
}

function MatrixRow({ node, level, months, year, monthlyWeights, parentTarget, displayMetric, expanded, onToggle, onCellSave, onNodeAdd, onNodeRename, onNodeDelete, onNodeSwitchMode, nodeMap, readOnly, displayPills, searchQuery }: RowProps) {
  const isExpanded = expanded.has(node.id)
  const hasChildren = node.children.length > 0
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(node.name)



  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  const LevelBadge = () => {
    const color = LEVEL_COLORS[level] ?? LEVEL_COLORS[5]!
    return (
      <span className={`${color.bg} ${color.text} text-[9px] w-6 h-5 flex items-center justify-center rounded font-bold mr-2 shrink-0`}>
        L{level}
      </span>
    )
  }

  const handleNameSave = async () => {
    if (nameValue.trim() && nameValue !== node.name) {
      await onNodeRename(node.id, nameValue.trim())
    }
    setEditingName(false)
  }

  const Avatar = () => {
    if (level < 3) return null
    const baseColors = ["bg-[#fdf2f8] text-[#be185d]", "bg-[#eff6ff] text-[#1d4ed8]", "bg-[#f0fdf4] text-[#15803d]", "bg-[#fef3c7] text-[#b45309]"]
    let color = "bg-slate-100 text-slate-500"
    if (node.id) {
       color = baseColors[node.id.charCodeAt(0) % baseColors.length] || color
    }
    let initials = node.name.substring(0, 2).toUpperCase()
    if (node.name.includes(" ")) initials = node.name.split(" ").map(w => w[0]).join("").substring(0,2).toUpperCase()
    return (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ml-2.5 ${color} shadow-sm border border-black/5`}>
        {initials}
      </div>
    )
  }

  // Per spec §7.3: indent = level × 24px
  const indentPx = (level - 1) * 24
  const textClass = level === 1
    ? "text-[12.5px] font-semibold text-slate-900"
    : "text-[12.5px] font-medium text-slate-700"



  const canAddChild = level < displayPills.length
  const nextLevel = displayPills[level]

  const handleContextMenu = (e: React.MouseEvent) => {
    if (readOnly) return
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <tr className={`border-b border-slate-100 transition-colors group hover:bg-slate-50/60 ${isExpanded && hasChildren ? 'bg-[#fafbfc]' : ''}`}>
        <td className="sticky left-0 z-10 bg-white border-r border-slate-200 group-hover:bg-slate-50/60 transition-colors align-middle shadow-[2px_0_8px_rgba(0,0,0,.04)]"
          style={{ width: HIERARCHY_COL_WIDTH, minWidth: HIERARCHY_COL_WIDTH, height: ROW_HEIGHT }}
          onContextMenu={handleContextMenu}>
          <div className="flex items-center" style={{ paddingLeft: `${14 + indentPx}px` }}>
            <button onClick={() => onToggle(node.id)}
              className={`mr-2 p-0.5 rounded transition-transform duration-150 ${level > 1 ? "text-slate-400 hover:bg-slate-200" : "text-slate-600 hover:bg-slate-200"} ${(!hasChildren && !canAddChild) && 'opacity-0 pointer-events-none'}`}>
              {isExpanded ? <ChevronDown className="h-4 w-4" strokeWidth={2.5} /> : <ChevronRight className="h-4 w-4" strokeWidth={2.5} />}
            </button>
            <LevelBadge />
            {editingName ? (
              <div className="flex items-center gap-1 flex-1 min-w-0">
                <Input value={nameValue} onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleNameSave(); if (e.key === "Escape") setEditingName(false) }}
                  autoFocus className="h-7 text-xs w-full" />
                <button onClick={handleNameSave} className="p-0.5 text-emerald-600 hover:text-emerald-700">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setEditingName(false)} className="p-0.5 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => !readOnly && setEditingName(true)}
                className={`${textClass} truncate text-left group/name flex items-center gap-1.5 min-w-0`}
                title={node.name}>
                <span className="truncate">
                  {searchQuery && node.name.toLowerCase().includes(searchQuery.toLowerCase()) ? (
                    highlightMatch(node.name, searchQuery)
                  ) : (
                    node.name
                  )}
                </span>
                {!readOnly && <Pencil className="h-3 w-3 text-slate-300 opacity-0 group-hover/name:opacity-100 shrink-0 transition-opacity" />}
              </button>
            )}
            <Avatar />
          </div>
        </td>
        {months.map((m) => (
          <MatrixCell key={m} node={node} level={level} month={m} monthlyWeights={monthlyWeights}
            parentTarget={parentTarget} displayMetric={displayMetric} onCellSave={onCellSave} readOnly={readOnly} year={year} />
        ))}

      </tr>
      {/* Context menu */}
      {ctxMenu && (
        <GoalContextMenu
          x={ctxMenu.x} y={ctxMenu.y}
          nodeId={node.id} nodeName={node.name}
          allocationMode={node.allocation_mode}
          onClose={() => setCtxMenu(null)}
          onEditName={() => setEditingName(true)}
          onSwitchMode={(id) => onNodeSwitchMode(id)}
          onAddChild={(id) => onNodeAdd(id, level)}
          onDelete={(id) => onNodeDelete(id)}
        />
      )}
      {isExpanded && node.children.map((child) => (
        <MatrixRow key={child.id} node={child} level={level + 1} months={months} year={year}
          monthlyWeights={monthlyWeights} parentTarget={node.target_amount} displayMetric={displayMetric}
          expanded={expanded} onToggle={onToggle} onCellSave={onCellSave} onNodeAdd={onNodeAdd} onNodeRename={onNodeRename} onNodeDelete={onNodeDelete} onNodeSwitchMode={onNodeSwitchMode} nodeMap={nodeMap} readOnly={readOnly} displayPills={displayPills} searchQuery={searchQuery} />
      ))}
      {/* Unallocated row per spec §9 */}
      {isExpanded && hasChildren && (
        <GoalUnallocatedRow parentNode={node} months={months} monthlyWeights={monthlyWeights} level={level + 1} />
      )}
      {isExpanded && !readOnly && canAddChild && (
        <tr className="border-b border-slate-100 group hover:bg-slate-50/50">
          <td className="sticky left-0 z-10 bg-white border-r border-slate-200 group-hover:bg-slate-50/50 align-middle shadow-[2px_0_8px_rgba(0,0,0,.04)]"
            style={{ width: HIERARCHY_COL_WIDTH, minWidth: HIERARCHY_COL_WIDTH, height: 40 }}>
            <div className="flex items-center" style={{ paddingLeft: `${14 + (level) * 24}px` }}>
              <button 
                onClick={() => onNodeAdd(node.id, level)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 py-1"
              >
                + Add {nextLevel.label}
              </button>
            </div>
          </td>
          <td colSpan={months.length} className="bg-slate-50/30"></td>
        </tr>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Main Board Component
// ═══════════════════════════════════════════════════════════════
interface GoalMatrixBoardProps {
  goalId: string
  goal: GoalV2
  readOnly?: boolean
  onGoalUpdated: () => void
}

export function GoalMatrixBoard({ goalId, goal, readOnly = false, onGoalUpdated }: GoalMatrixBoardProps) {
  const supabase = createClient()
  const { activeCompany } = useCompany()
  const { fmt } = useCurrency()

  const [nodes, setNodes] = useState<GoalNode[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [displayMetric, setDisplayMetric] = useState<DisplayMetric>("both")
  const [year, setYear] = useState(new Date().getFullYear())
  const [weightsOpen, setWeightsOpen] = useState(false)
  const [additionalLevels, setAdditionalLevels] = useState<{value: string, label: string}[]>([])
  const [dimensionOptions, setDimensionOptions] = useState<DimensionOption[]>([])

  const loadDimensions = useCallback(async () => {
    if (!activeCompany?.id) return
    const dims = await getDimensionRegistry(supabase, activeCompany.id)
    setDimensionOptions(dims)
  }, [activeCompany?.id, supabase])

  useEffect(() => { loadDimensions() }, [loadDimensions])


  // Search state (spec §6)
  const [searchQuery, setSearchQuery] = useState("")

  // Inline Goal Name editing
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(goal.name)
  const [savingName, setSavingName] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Inline Target editing state (for the popover)
  const [targetValue, setTargetValue] = useState(goal.target_amount)
  const [savingTarget, setSavingTarget] = useState(false)

  // Month visibility state — all 12 visible by default
  const [visibleMonths, setVisibleMonths] = useState<Set<number>>(() => new Set(Array.from({ length: 12 }, (_, i) => i + 1)))
  const months = useMemo(() => Array.from(visibleMonths).sort((a, b) => a - b), [visibleMonths])
  const allMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), [])

  const toggleMonth = useCallback((m: number) => {
    setVisibleMonths(prev => {
      const next = new Set(prev)
      if (next.has(m)) { if (next.size > 1) next.delete(m) } // keep at least 1
      else next.add(m)
      return next
    })
  }, [])

  const setQuarter = useCallback((q: number) => {
    const qMonths = [q * 3 - 2, q * 3 - 1, q * 3]
    setVisibleMonths(prev => {
      const allPresent = qMonths.every(m => prev.has(m))
      const next = new Set(prev)
      if (allPresent) {
        // Remove quarter months (keep at least 1 overall)
        for (const m of qMonths) { if (next.size > 1) next.delete(m) }
      } else {
        for (const m of qMonths) next.add(m)
      }
      return next
    })
  }, [])

  const tree = useMemo(() => buildTree(nodes), [nodes])
  const nodeMap = useMemo(() => {
    const m = new Map<string, GoalNodeTree>()
    const walk = (items: GoalNodeTree[]) => { for (const item of items) { m.set(item.id, item); walk(item.children) } }
    walk(tree)
    return m
  }, [tree])

  const loadData = useCallback(async () => {
    if (!activeCompany?.id || !goalId) return
    setLoading(true)
    const { data: nodesRes } = await supabase
      .from("goal_nodes").select("*").eq("goal_id", goalId).order("sort_order")
    setNodes((nodesRes as GoalNode[]) ?? [])
    setAdditionalLevels([])
    setSearchQuery("")
    const roots = buildTree((nodesRes as GoalNode[]) ?? [])
    const initialExpanded = new Set<string>()
    roots.forEach(r => { initialExpanded.add(r.id); r.children.forEach(c => initialExpanded.add(c.id)) })
    setExpanded(initialExpanded)
    setLoading(false)
  }, [activeCompany?.id, goalId, supabase])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { setNameValue(goal.name); setTargetValue(goal.target_amount) }, [goal])

  const handleToggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { for (const key of prev) { if (key === id || key.startsWith(id)) next.delete(key) }; next.delete(id) }
      else { next.add(id) }
      return next
    })
  }, [])

  const handleCellSave = useCallback(async (nodeId: string, month: number, amount: number) => {
    const existing = nodeMap.get(nodeId)
    if (!existing) return
    const updatedTargets = { ...(existing.monthly_targets ?? {}) }
    updatedTargets[String(month)] = amount
    const result = await updateGoalNodeAction(nodeId, { monthly_targets: updatedTargets })
    if (result.success) { loadData(); onGoalUpdated() }
    else toast.error(result.error ?? "Failed to update cell")
  }, [nodeMap, loadData, onGoalUpdated])

  // Save goal name inline
  const saveGoalName = useCallback(async () => {
    if (!nameValue.trim() || nameValue === goal.name) { setEditingName(false); return }
    setSavingName(true)
    const result = await updateGoalV2Action(goal.id, { name: nameValue.trim() })
    setSavingName(false)
    if (result.success) { toast.success("Goal name updated"); onGoalUpdated(); setEditingName(false) }
    else toast.error(result.error ?? "Failed to save")
  }, [goal.id, goal.name, nameValue, onGoalUpdated])

  // Save target amount
  const saveTargetAmount = useCallback(async () => {
    if (targetValue === goal.target_amount) return
    setSavingTarget(true)
    const result = await updateGoalV2Action(goal.id, { target_amount: targetValue })
    setSavingTarget(false)
    if (result.success) { toast.success("Target updated"); onGoalUpdated(); loadData() }
    else toast.error(result.error ?? "Failed to save")
  }, [goal.id, goal.target_amount, targetValue, onGoalUpdated, loadData])

  // Fix: use Map<string, {value,label}> keyed by dimension_type to avoid Set dedup issues with objects
  const levelNames = useMemo(() => {
    const levels = new Map<number, Map<string, { value: string, label: string }>>()
    for (const [, node] of nodeMap) {
      const lvl = getNodeLevel(node, nodeMap)
      if (!levels.has(lvl)) levels.set(lvl, new Map())
      const opt = dimensionOptions.find(o => o.value === node.dimension_type)
      const dimType = node.dimension_type || "segment"
      if (!levels.get(lvl)!.has(dimType)) {
        levels.get(lvl)!.set(dimType, { value: dimType, label: opt?.label ?? dimType })
      }
    }
    return levels
  }, [nodeMap])

  const orderedLevels = Array.from(levelNames.entries()).sort(([a], [b]) => a - b)
  const displayPills = [
    ...orderedLevels.map(([, typesMap]) => {
        const arr = Array.from(typesMap.values())
        return { label: arr.map(t => t.label).join(", ") || "Segment", value: arr[0]?.value }
    }),
    ...additionalLevels,
  ]

  const handleAddHierarchyLevel = useCallback(async (opt: { value: string, label: string }) => {
    if (!activeCompany?.id) return
    const toastId = toast.loading(`Generating nodes for ${opt.label}...`)
    
    const levelIndex = displayPills.length
    let parentIds: string[] = []
    
    if (levelIndex > 0) {
      const targetLevelForParent = levelIndex
      for (const [id, node] of nodeMap) {
        if (getNodeLevel(node, nodeMap) === targetLevelForParent) {
          parentIds.push(id)
        }
      }
    }
    
    const result = await autoInsertGoalHierarchyAction(
      goal.id, activeCompany.id, opt.value, parentIds
    )
    
    if (result.success) {
      toast.success(`${opt.label} nodes generated`, { id: toastId })
      loadData()
      onGoalUpdated()
    } else {
      toast.error(result.error ?? "Failed to generate nodes", { id: toastId })
    }
  }, [activeCompany?.id, displayPills.length, goal.id, nodeMap, loadData, onGoalUpdated])

  const handleRemoveHierarchyLevel = useCallback(async (dimensionType?: string) => {
    if (!dimensionType) return
    const toastId = toast.loading(`Deleting level...`)
    const result = await deleteGoalLevelAction(goal.id, dimensionType)
    if (result.success) {
      setAdditionalLevels(prev => prev.filter(p => p.value !== dimensionType))
      toast.success("Level deleted", { id: toastId })
      loadData()
      onGoalUpdated()
    } else {
      toast.error(result.error ?? "Failed to delete level", { id: toastId })
    }
  }, [goal.id, loadData, onGoalUpdated])

  const handleNodeAdd = useCallback(async (parentId: string | null, levelIndex: number) => {
    if (!activeCompany) return
    const nextPill = displayPills[levelIndex]
    if (!nextPill) return

    const opt = dimensionOptions.find(o => o.value === nextPill.value) || dimensionOptions[0]
    
    // Automatically expand the parent
    if (parentId) {
      setExpanded(prev => new Set(prev).add(parentId))
    }

    const toastId = toast.loading(`Adding ${nextPill.label}...`)
    const result = await createGoalNodeAction({
      goal_id: goal.id,
      company_id: activeCompany.id,
      parent_node_id: parentId,
      name: `New ${nextPill.label}`,
      dimension_type: nextPill.value || "segment",
      reference_field: opt.field || "id",
      reference_value: `new-${Date.now()}`,
      allocation_mode: "absolute",
      percentage: 0,
      target_amount: 0,
      monthly_targets: {},
      sort_order: 999
    })

    if (result.success) {
      toast.success("Added new row", { id: toastId })
      loadData()
    } else {
      toast.error(result.error ?? "Failed to add row", { id: toastId })
    }
  }, [activeCompany, displayPills, goal.id, loadData])

  const handleNodeRename = useCallback(async (nodeId: string, name: string) => {
    const result = await updateGoalNodeAction(nodeId, { name })
    if (result.success) {
      toast.success("Name updated")
      loadData()
    } else {
      toast.error(result.error ?? "Failed to rename")
    }
  }, [loadData])

  // Delete node handler for context menu
  const handleNodeDelete = useCallback(async (nodeId: string) => {
    const result = await deleteGoalNodeAction(nodeId)
    if (result.success) {
      toast.success("Node deleted")
      loadData()
      onGoalUpdated()
    } else {
      toast.error(result.error ?? "Failed to delete")
    }
  }, [loadData, onGoalUpdated])

  // Switch allocation mode for context menu
  const handleNodeSwitchMode = useCallback(async (nodeId: string) => {
    const node = nodeMap.get(nodeId)
    if (!node) return
    const newMode = node.allocation_mode === "percentage" ? "absolute" : "percentage"
    const result = await updateGoalNodeAction(nodeId, { allocation_mode: newMode })
    if (result.success) {
      toast.success(`Switched to ${newMode} mode`)
      loadData()
    } else {
      toast.error(result.error ?? "Failed to switch mode")
    }
  }, [nodeMap, loadData])

  // Expand All / Collapse All
  const [allExpanded, setAllExpanded] = useState(true)
  const handleExpandAll = useCallback(() => {
    const allIds = new Set<string>()
    const walk = (items: GoalNodeTree[]) => { for (const item of items) { allIds.add(item.id); walk(item.children) } }
    walk(tree)
    setExpanded(allIds)
    setAllExpanded(true)
  }, [tree])
  const handleCollapseAll = useCallback(() => {
    setExpanded(new Set())
    setAllExpanded(false)
  }, [])

  // Search: auto-expand matching nodes
  useEffect(() => {
    if (!searchQuery.trim()) return
    const q = searchQuery.toLowerCase()
    const matchingIds = new Set<string>()
    const walk = (items: GoalNodeTree[]) => {
      for (const item of items) {
        if (item.name.toLowerCase().includes(q)) {
          // expand all ancestors
          let current: GoalNodeTree | undefined = item
          while (current) {
            matchingIds.add(current.id)
            current = current.parent_node_id ? nodeMap.get(current.parent_node_id) : undefined
          }
        }
        walk(item.children)
      }
    }
    walk(tree)
    if (matchingIds.size > 0) setExpanded(prev => new Set([...prev, ...matchingIds]))
  }, [searchQuery, tree, nodeMap])

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
  }

  const monthlyWeights = goal.monthly_weights ?? null

  // CSV export
  const handleExport = () => {
    const rows: string[][] = []
    const header = ["Hierarchy"]
    for (const m of months) header.push(`${MONTH_LABELS[m - 1]} ${year}`)
    rows.push(header)
    const walkTree = (items: GoalNodeTree[], depth: number) => {
      for (const node of items) {
        const indent = "  ".repeat(depth)
        const row: string[] = [`${indent}${node.name}`]
        for (const m of months) {
          const val = computeMonthlyTarget(node.target_amount, monthlyWeights, m, node.monthly_targets)
          row.push(String(Math.round(val)))
        }
        rows.push(row)
        if (node.children.length > 0) walkTree(node.children, depth + 1)
      }
    }
    walkTree(tree, 0)
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `goal_matrix_${year}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* ──── SECTION 1: Title + Export + Target Badge ──── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input ref={nameInputRef} value={nameValue} onChange={(e) => setNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveGoalName(); if (e.key === "Escape") { setEditingName(false); setNameValue(goal.name) } }}
                autoFocus className="h-9 text-lg font-bold w-[300px]" />
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={saveGoalName} disabled={savingName}>
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingName(false); setNameValue(goal.name) }}>
                <X className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          ) : (
            <button onClick={() => !readOnly && setEditingName(true)}
              className="group flex items-center gap-2 text-xl font-bold text-slate-900 hover:text-slate-700 transition-colors">
              {goal.name}
              {!readOnly && <Pencil className="h-3.5 w-3.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </button>
          )}
          <p className="text-sm text-slate-500 hidden md:block">
            Break down revenue targets by hierarchy levels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Total Target Badge with Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shadow-sm">
                <span className="text-slate-400 text-xs font-medium">Target:</span>
                {fmt(goal.target_amount)}
                {!readOnly && <Pencil className="h-3 w-3 text-slate-400" />}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[280px] p-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Total Annual Target (Rp)</Label>
                  <CurrencyInput prefix="Rp" value={targetValue} onChange={(v) => setTargetValue(v ?? 0)} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Period</Label>
                    <Select value={goal.period_type} disabled>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-slate-600">Year</Label>
                    <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" className="w-full h-8 text-xs" onClick={saveTargetAmount} disabled={savingTarget || readOnly}>
                  {savingTarget && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  Save Target
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> Export View
          </Button>
        </div>
      </div>

      {/* ──── SECTION 2: Builder Bar ──── */}
      <div className="px-5 py-4 bg-slate-50 rounded-xl border border-slate-200">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
          {/* Hierarchy Levels */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Hierarchy Levels</span>
            <div className="flex items-center flex-wrap gap-2">
              {displayPills.map((pill, idx) => {
                const color = LEVEL_COLORS[idx + 1] ?? LEVEL_COLORS[5]!
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm bg-white text-[12px] font-semibold text-slate-700`}>
                      <span className={`${color.bg} ${color.text} text-[9px] w-5 h-4 flex items-center justify-center rounded font-bold`}>L{idx + 1}</span>
                      {pill.label}
                      <button onClick={() => handleRemoveHierarchyLevel(pill.value)} className="ml-1 hover:bg-slate-100 rounded p-0.5 transition-colors">
                        <X className="h-3 w-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                    {idx < displayPills.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
                  </div>
                )
              })}
              {displayPills.length > 0 && <ArrowRight className="h-3.5 w-3.5 text-slate-300" />}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="px-4 py-1.5 border border-dashed border-slate-300 rounded-lg text-[13px] font-medium text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-100 transition-colors bg-transparent">
                    + Add Level
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[220px] max-h-[350px] overflow-y-auto">
                  {/* Entity dimensions */}
                  {dimensionOptions.filter(o => o.group === 'entity').length > 0 && (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Entity</DropdownMenuLabel>
                      {dimensionOptions.filter(o => o.group === 'entity').map((opt) => (
                        <DropdownMenuItem key={opt.value}
                          onClick={() => handleAddHierarchyLevel({ value: opt.value, label: opt.label })}
                          className="cursor-pointer">{opt.label}</DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  )}
                  {/* Lead attribute dimensions */}
                  {dimensionOptions.filter(o => o.group === 'lead_attribute').length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Lead Fields</DropdownMenuLabel>
                        {dimensionOptions.filter(o => o.group === 'lead_attribute').map((opt) => (
                          <DropdownMenuItem key={opt.value}
                            onClick={() => handleAddHierarchyLevel({ value: opt.value, label: opt.label })}
                            className="cursor-pointer">
                            <span className="flex-1">{opt.label}</span>
                            {opt.optionCount != null && <span className="text-[10px] text-muted-foreground ml-2">{opt.optionCount}</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}
                  {/* Company attribute dimensions */}
                  {dimensionOptions.filter(o => o.group === 'company_attribute').length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Company Fields</DropdownMenuLabel>
                        {dimensionOptions.filter(o => o.group === 'company_attribute').map((opt) => (
                          <DropdownMenuItem key={opt.value}
                            onClick={() => handleAddHierarchyLevel({ value: opt.value, label: opt.label })}
                            className="cursor-pointer">
                            <span className="flex-1">{opt.label}</span>
                            {opt.optionCount != null && <span className="text-[10px] text-muted-foreground ml-2">{opt.optionCount}</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}
                  {/* Contact attribute dimensions */}
                  {dimensionOptions.filter(o => o.group === 'contact_attribute').length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Contact Fields</DropdownMenuLabel>
                        {dimensionOptions.filter(o => o.group === 'contact_attribute').map((opt) => (
                          <DropdownMenuItem key={opt.value}
                            onClick={() => handleAddHierarchyLevel({ value: opt.value, label: opt.label })}
                            className="cursor-pointer">
                            <span className="flex-1">{opt.label}</span>
                            {opt.optionCount != null && <span className="text-[10px] text-muted-foreground ml-2">{opt.optionCount}</span>}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}
                  {/* Segment dimensions */}
                  {dimensionOptions.filter(o => o.group === 'segment').length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Segments</DropdownMenuLabel>
                        {dimensionOptions.filter(o => o.group === 'segment').map((opt) => (
                          <DropdownMenuItem key={opt.value}
                            onClick={() => handleAddHierarchyLevel({ value: opt.value, label: opt.label })}
                            className="cursor-pointer">{opt.label}</DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 xl:gap-8">
            {/* Timeframe */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Timeframe Setup</span>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="px-3.5 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm text-[13px] font-medium text-slate-700 flex items-center gap-2.5 hover:bg-slate-50 transition-colors">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    {months.length === 12 ? `Jan - Dec ${year}` : `${months.length} months`}
                    <span className="text-[10px] text-slate-400 ml-1">{months.length}/12</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[280px] p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700">Visible Months</span>
                      <div className="flex gap-1">
                        <button onClick={() => setVisibleMonths(new Set(allMonths))}
                          className="text-[10px] text-blue-600 hover:text-blue-700 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50">All</button>
                        <button onClick={() => setVisibleMonths(new Set([new Date().getMonth() + 1]))}
                          className="text-[10px] text-slate-500 hover:text-slate-700 font-medium px-1.5 py-0.5 rounded hover:bg-slate-100">Current</button>
                      </div>
                    </div>
                    {/* Quick quarter toggles */}
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map(q => {
                        const qMonths = [q * 3 - 2, q * 3 - 1, q * 3]
                        const allIn = qMonths.every(m => visibleMonths.has(m))
                        return (
                          <button key={q} onClick={() => setQuarter(q)}
                            className={`flex-1 py-1 text-[11px] font-semibold rounded-md border transition-colors ${
                              allIn ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                            }`}>Q{q}</button>
                        )
                      })}
                    </div>
                    {/* Individual month checkboxes */}
                    <div className="grid grid-cols-4 gap-1">
                      {allMonths.map(m => {
                        const active = visibleMonths.has(m)
                        return (
                          <button key={m} onClick={() => toggleMonth(m)}
                            className={`py-1.5 text-[11px] font-medium rounded-md border transition-all ${
                              active
                                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 hover:text-slate-600'
                            }`}>
                            {MONTH_LABELS[m - 1]}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Display Metrics */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Display Metrics</span>
              <div className="flex bg-slate-200/60 p-1 rounded-lg border border-slate-200/50">
                {(["nominal", "percent", "both"] as DisplayMetric[]).map((m) => (
                  <button key={m} onClick={() => setDisplayMetric(m)}
                    className={`px-4 py-1 text-[13px] font-medium rounded-md transition-all capitalize ${
                      displayMetric === m ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                    }`}>{m}</button>
                ))}
              </div>
            </div>

            {/* Monthly Weights toggle */}
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Weights</span>
              <button onClick={() => setWeightsOpen(!weightsOpen)}
                className={`px-3.5 py-1.5 rounded-lg text-[13px] font-medium flex items-center gap-2 transition-all border ${
                  weightsOpen
                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                    : "bg-white border-slate-200 text-slate-700 shadow-sm hover:bg-slate-100"
                }`}>
                <Scale className="h-3.5 w-3.5" />
                Monthly Weights
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${weightsOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ──── SECTION 3: Collapsible Monthly Weights ──── */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${weightsOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
        <InlineMonthlyWeights goal={goal} onSave={() => { onGoalUpdated(); loadData() }} />
      </div>

      {/* ──── SECTION 4: Table ──── */}
      <div className="flex flex-col bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Tabs + search */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 relative bg-white">
          <div className="flex gap-8">
            <button className="px-2 py-4 text-sm font-semibold text-blue-600 border-b-[3px] border-blue-600 mb-[-1px]">Revenue Breakdown</button>
            <button className="px-2 py-4 text-sm font-semibold text-slate-400 cursor-not-allowed border-b-[3px] border-transparent mb-[-1px] flex items-center gap-1.5">
              Cost Allocation
              <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Soon</span>
            </button>
            <button className="px-2 py-4 text-sm font-semibold text-slate-400 cursor-not-allowed border-b-[3px] border-transparent mb-[-1px] flex items-center gap-1.5">
              Profit Margin
              <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Soon</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search rows..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`h-9 w-56 pl-9 text-sm bg-white border-slate-300 shadow-sm transition-all ${searchQuery ? 'w-72 ring-2 ring-blue-500/20 border-blue-400' : ''}`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-9 bg-white border-slate-300 shadow-sm text-sm font-medium"
              onClick={allExpanded ? handleCollapseAll : handleExpandAll}>
              {allExpanded ? (
                <><Minimize2 className="h-4 w-4 mr-2" /> Collapse All</>
              ) : (
                <><Maximize2 className="h-4 w-4 mr-2" /> Expand All</>
              )}
            </Button>
          </div>
        </div>

        {/* Table with hierarchy scroll shadow */}
        <div className="overflow-x-auto relative" style={{ scrollbarGutter: 'stable' }}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="bg-[#f8f9fb] border-b border-slate-200">
                <th className="sticky left-0 z-40 bg-[#f8f9fb] text-left pl-6 pr-4 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.5px] border-r border-slate-200 shadow-[2px_0_8px_rgba(0,0,0,.04)]"
                  style={{ width: HIERARCHY_COL_WIDTH, minWidth: HIERARCHY_COL_WIDTH }}>Row Hierarchy</th>
                {months.map((m) => {
                  const isCurrent = m === CURRENT_MONTH
                  return (
                    <th key={m} className={`text-right px-4 py-3 text-[10px] font-bold uppercase tracking-[0.5px] ${isCurrent ? 'border-l-2 border-l-indigo-500 text-indigo-600 bg-indigo-50/40' : 'text-slate-400'}`}
                      style={{ minWidth: MONTH_COL_MIN }}>{MONTH_LABELS[m - 1]}</th>
                  )
                })}

              </tr>
            </thead>
            <tbody>
              {tree.map((root) => (
                <MatrixRow key={root.id} node={root} level={1} months={months} year={year}
                  monthlyWeights={monthlyWeights} parentTarget={goal.target_amount} displayMetric={displayMetric}
                  expanded={expanded} onToggle={handleToggle} onCellSave={handleCellSave} onNodeAdd={handleNodeAdd} onNodeRename={handleNodeRename} onNodeDelete={handleNodeDelete} onNodeSwitchMode={handleNodeSwitchMode} nodeMap={nodeMap} readOnly={readOnly} displayPills={displayPills} searchQuery={searchQuery} />
              ))}
              {tree.length === 0 && (
                <tr><td colSpan={months.length + 1} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" strokeLinecap="round" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-600">No revenue goal configured</p>
                    <p className="text-xs text-slate-400">Set up your annual target and breakdown structure to start tracking.</p>
                  </div>
                </td></tr>
              )}
              {!readOnly && displayPills.length > 0 && (
                 <tr className="border-t border-slate-200">
                    <td className="sticky left-0 z-10 bg-white border-r border-slate-200 align-middle px-4 py-2.5 shadow-[2px_0_8px_rgba(0,0,0,.04)]">
                       <button 
                         onClick={() => handleNodeAdd(null, 0)}
                         className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                       >
                         + Add {displayPills[0]?.label || "Level 1"}
                       </button>
                    </td>
                    <td colSpan={months.length + 1} className="bg-slate-50/30"></td>
                 </tr>
              )}
            </tbody>
            {/* ──── TOTAL Summary Row (spec §7.6) ──── */}
            {tree.length > 0 && (
              <tfoot>
                <tr className="bg-[#f0f1f4] border-t-2 border-slate-300">
                  <td className="sticky left-0 z-20 bg-[#f0f1f4] pl-6 pr-4 py-3 border-r border-slate-200 align-middle shadow-[2px_0_8px_rgba(0,0,0,.04)]"
                    style={{ width: HIERARCHY_COL_WIDTH, minWidth: HIERARCHY_COL_WIDTH, height: ROW_HEIGHT }}>
                    <span className="text-[12.5px] font-bold text-slate-900 uppercase tracking-wide">Total</span>
                  </td>
                  {months.map((m) => {
                    let colTotal = 0
                    for (const root of tree) {
                      colTotal += computeMonthlyTarget(root.target_amount, monthlyWeights, m, root.monthly_targets)
                    }
                    const isCurrent = m === CURRENT_MONTH
                    return (
                      <td key={m} className={`px-4 py-3 text-right align-middle ${isCurrent ? 'border-l-2 border-l-indigo-500 bg-indigo-50/30' : ''}`} style={{ minWidth: MONTH_COL_MIN }}>
                        <span className="text-[12.5px] font-bold text-slate-900 tabular-nums">{fmt(colTotal)}</span>
                      </td>
                    )
                  })}

                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  )
}
