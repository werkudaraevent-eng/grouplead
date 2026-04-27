"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { createGoalV2Action, updateGoalV2Action, deleteGoalV2Action } from "@/app/actions/goal-actions"
import { toast } from "sonner"
import { Plus, Loader2, Pencil, Trash2, Target, ArrowRight, Star, MoreVertical, Calendar, TrendingUp } from "lucide-react"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import type { GoalV2 } from "@/types/goals"
import { useCurrency } from "@/contexts/currency-context"

function formatCurrencyInput(value: number): string {
  if (value === 0) return ""
  return Math.round(value).toLocaleString("id-ID")
}

function parseCurrencyInput(str: string): number {
  return parseFloat(str.replace(/\./g, "").replace(/,/g, "")) || 0
}

export function GoalSettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const { activeCompany } = useCompany()
  const { fmt } = useCurrency()

  const [goals, setGoals] = useState<GoalV2[]>([])
  const [loading, setLoading] = useState(true)

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createPeriodType, setCreatePeriodType] = useState<"monthly" | "quarterly" | "yearly">("yearly")
  const [createTarget, setCreateTarget] = useState("")
  const [createPeriodStart, setCreatePeriodStart] = useState("2026-01-01")
  const [createPeriodEnd, setCreatePeriodEnd] = useState("2026-12-31")
  const [createWeightedForecast, setCreateWeightedForecast] = useState(false)
  const [creating, setCreating] = useState(false)

  // Edit dialog
  const [editGoal, setEditGoal] = useState<GoalV2 | null>(null)
  const [editName, setEditName] = useState("")
  const [editTarget, setEditTarget] = useState("")
  const [editPeriodStart, setEditPeriodStart] = useState("")
  const [editPeriodEnd, setEditPeriodEnd] = useState("")
  const [editWeightedForecast, setEditWeightedForecast] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete confirmation
  const [deleteGoalTarget, setDeleteGoalTarget] = useState<GoalV2 | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Dropdown menu
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from("goals_v2")
      .select("*")
      .eq("company_id", activeCompany.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
    setGoals((data as GoalV2[]) ?? [])
    setLoading(false)
  }, [activeCompany?.id, supabase])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = () => setMenuOpen(null)
    window.addEventListener("click", handler)
    return () => window.removeEventListener("click", handler)
  }, [menuOpen])

  const handleCreate = async () => {
    if (!activeCompany?.id || !createName.trim()) return
    setCreating(true)
    const result = await createGoalV2Action({
      company_id: activeCompany.id,
      name: createName.trim(),
      period_type: createPeriodType,
      target_amount: parseCurrencyInput(createTarget),
      is_active: true,
      attribution_basis: "event_date",
      monthly_cutoff_day: 25,
      per_month_cutoffs: null,
      weighted_forecast_enabled: createWeightedForecast,
      breakdown_config: [],
      breakdown_targets: {},
      monthly_weights: null,
      created_by: null,
      period_start: createPeriodStart,
      period_end: createPeriodEnd,
    })
    setCreating(false)
    if (result.success) {
      toast.success("Goal created successfully")
      setShowCreate(false)
      setCreateName("")
      setCreateTarget("")
      setCreatePeriodStart("2026-01-01")
      setCreatePeriodEnd("2026-12-31")
      setCreateWeightedForecast(false)
      loadData()
    } else {
      toast.error(result.error ?? "Failed to create goal")
    }
  }

  const openEdit = (goal: GoalV2) => {
    setEditGoal(goal)
    setEditName(goal.name)
    setEditTarget(formatCurrencyInput(goal.target_amount))
    setEditPeriodStart(goal.period_start || "2026-01-01")
    setEditPeriodEnd(goal.period_end || "2026-12-31")
    setEditWeightedForecast(goal.weighted_forecast_enabled)
    setMenuOpen(null)
  }

  const handleEdit = async () => {
    if (!editGoal) return
    setSaving(true)
    const result = await updateGoalV2Action(editGoal.id, {
      name: editName.trim(),
      target_amount: parseCurrencyInput(editTarget),
      period_start: editPeriodStart,
      period_end: editPeriodEnd,
      weighted_forecast_enabled: editWeightedForecast,
    })
    setSaving(false)
    if (result.success) {
      toast.success("Goal updated")
      setEditGoal(null)
      loadData()
    } else {
      toast.error(result.error ?? "Failed to update goal")
    }
  }

  const handleDelete = async () => {
    if (!deleteGoalTarget) return
    setDeleting(true)
    const result = await deleteGoalV2Action(deleteGoalTarget.id)
    setDeleting(false)
    if (result.success) {
      toast.success("Goal deleted")
      setDeleteGoalTarget(null)
      loadData()
    } else {
      toast.error(result.error ?? "Failed to delete goal")
    }
  }

  const periodTypeLabel = (t: string) => {
    const labels: Record<string, string> = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly" }
    return labels[t] ?? t
  }

  const periodTypeColor = (t: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      monthly: { bg: "rgba(59,130,246,.08)", text: "#3b82f6" },
      quarterly: { bg: "rgba(168,85,247,.08)", text: "#a855f7" },
      yearly: { bg: "rgba(16,185,129,.08)", text: "#10b981" },
    }
    return colors[t] ?? { bg: "#f1f3f5", text: "#64748b" }
  }

  // The first goal in the list is the "default" active one
  const defaultGoalId = goals.length > 0 ? goals[0].id : null

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
        <SettingsPageHeader
          title="Goal Settings"
          subtitle="Manage revenue targets and breakdown configurations for your company."
          breadcrumbs={[{ label: "Goals" }]}
          actions={
            <button
              onClick={() => setShowCreate(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "9px 18px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: "0 2px 8px rgba(99,102,241,.3)",
                transition: "all .15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
            >
              <Plus className="h-4 w-4" /> Create Goal
            </button>
          }
        />

        {/* Content */}
        <div className="px-8 pb-10 pt-4 max-w-[1200px] mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-[#8892a4] mb-3" />
              <p className="text-[13px] text-[#8892a4]">Loading goals...</p>
            </div>
          ) : goals.length === 0 ? (
            /* Empty State */
            <div style={{
              background: "#fff", border: "2px dashed #d1d5db", borderRadius: 14,
              padding: "48px 32px", textAlign: "center",
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: "linear-gradient(135deg, rgba(99,102,241,.1), rgba(168,85,247,.1))",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <Target className="h-7 w-7" style={{ color: "#6366f1" }} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f1729", marginBottom: 6 }}>
                No revenue goals yet
              </h3>
              <p style={{ fontSize: 13, color: "#8892a4", marginBottom: 20, maxWidth: 380, margin: "0 auto 20px" }}>
                Create your first revenue goal to define targets and track attainment across your team.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                  color: "#fff", border: "none", borderRadius: 8,
                  padding: "10px 22px", fontSize: 13, fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 2px 8px rgba(99,102,241,.3)",
                }}
              >
                <Plus className="h-4 w-4" /> Create Your First Goal
              </button>
            </div>
          ) : (
            /* Goal Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {goals.map((goal, idx) => {
                const isDefault = goal.id === defaultGoalId
                const ptColor = periodTypeColor(goal.period_type)
                const weights = goal.monthly_weights as number[] | null
                const hasWeights = weights && weights.length === 12

                return (
                  <div
                    key={goal.id}
                    style={{
                      background: "#fff",
                      border: isDefault ? "1.5px solid #f59e0b" : "1px solid #e5e8ed",
                      borderRadius: 12,
                      padding: 0,
                      boxShadow: isDefault
                        ? "0 2px 12px rgba(245,158,11,.12), 0 1px 3px rgba(0,0,0,.04)"
                        : "0 1px 3px rgba(0,0,0,.04)",
                      transition: "all .2s",
                      overflow: "hidden",
                      position: "relative",
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)"
                      e.currentTarget.style.transform = "translateY(-2px)"
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = isDefault
                        ? "0 2px 12px rgba(245,158,11,.12), 0 1px 3px rgba(0,0,0,.04)"
                        : "0 1px 3px rgba(0,0,0,.04)"
                      e.currentTarget.style.transform = "translateY(0)"
                    }}
                  >
                    {/* Card Header */}
                    <div style={{ padding: "16px 18px 12px", borderBottom: "1px solid #f1f3f5" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 9,
                            background: isDefault
                              ? "linear-gradient(135deg, rgba(245,158,11,.12), rgba(234,88,12,.08))"
                              : "linear-gradient(135deg, rgba(99,102,241,.08), rgba(168,85,247,.06))",
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            <Target className="h-4.5 w-4.5" style={{ color: isDefault ? "#f59e0b" : "#6366f1" }} />
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <h3 style={{
                              fontSize: 14, fontWeight: 700, color: "#0f1729",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>
                              {goal.name}
                            </h3>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                              <span style={{
                                fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 4,
                                background: ptColor.bg, color: ptColor.text,
                              }}>
                                {periodTypeLabel(goal.period_type)}
                              </span>
                              {isDefault && (
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                  background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                                  color: "#92400e", letterSpacing: .3,
                                  display: "flex", alignItems: "center", gap: 3,
                                }}>
                                  <Star className="h-2.5 w-2.5" style={{ fill: "#f59e0b", color: "#f59e0b" }} />
                                  DEFAULT
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Menu */}
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={e => { e.stopPropagation(); setMenuOpen(menuOpen === goal.id ? null : goal.id) }}
                            style={{
                              background: "none", border: "none", cursor: "pointer",
                              padding: 4, borderRadius: 6, color: "#94a3b8",
                              transition: "all .12s",
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#f1f3f5"; e.currentTarget.style.color = "#475569" }}
                            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#94a3b8" }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                          {menuOpen === goal.id && (
                            <div
                              onClick={e => e.stopPropagation()}
                              style={{
                                position: "absolute", right: 0, top: 28, zIndex: 20,
                                background: "#fff", border: "1px solid #e5e8ed", borderRadius: 8,
                                boxShadow: "0 4px 16px rgba(0,0,0,.1)", padding: 4, minWidth: 140,
                              }}
                            >
                              <button
                                onClick={() => openEdit(goal)}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: "7px 10px", border: "none", background: "none", borderRadius: 5,
                                  fontSize: 12, fontWeight: 500, color: "#334155", cursor: "pointer",
                                  fontFamily: "inherit", transition: "background .1s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                                onMouseLeave={e => (e.currentTarget.style.background = "none")}
                              >
                                <Pencil className="h-3.5 w-3.5" style={{ color: "#94a3b8" }} /> Edit Goal
                              </button>
                              <button
                                onClick={() => { setDeleteGoalTarget(goal); setMenuOpen(null) }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 8, width: "100%",
                                  padding: "7px 10px", border: "none", background: "none", borderRadius: 5,
                                  fontSize: 12, fontWeight: 500, color: "#ef4444", cursor: "pointer",
                                  fontFamily: "inherit", transition: "background .1s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#fef2f2")}
                                onMouseLeave={e => (e.currentTarget.style.background = "none")}
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div style={{ padding: "14px 18px" }}>
                      {/* Target Amount */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 9.5, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .5, marginBottom: 2 }}>
                          Annual Target
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#0f1729", letterSpacing: -.5 }}>
                          {fmt(goal.target_amount)}
                        </div>
                      </div>

                      {/* Mini Stats Row */}
                      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                        <div style={{
                          flex: 1, background: "#f8f9fb", borderRadius: 7, padding: "8px 10px",
                        }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", marginBottom: 2 }}>
                            <Calendar className="h-2.5 w-2.5 inline mr-1" style={{ verticalAlign: "middle" }} />
                            Period
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}>
                            {(() => {
                              const ps = goal.period_start ? new Date(goal.period_start) : null
                              const pe = goal.period_end ? new Date(goal.period_end) : null
                              if (ps && pe) {
                                const mo = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
                                return `${mo[ps.getMonth()]} ${ps.getFullYear()} – ${mo[pe.getMonth()]} ${pe.getFullYear()}`
                              }
                              return "Not set"
                            })()}
                          </div>
                        </div>
                        <div style={{
                          flex: 1, background: "#f8f9fb", borderRadius: 7, padding: "8px 10px",
                        }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", marginBottom: 2 }}>
                            <TrendingUp className="h-2.5 w-2.5 inline mr-1" style={{ verticalAlign: "middle" }} />
                            Forecast
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}>
                            {goal.weighted_forecast_enabled ? "Weighted" : "Standard"}
                          </div>
                        </div>
                      </div>

                      {/* Monthly Distribution Mini Bar */}
                      {hasWeights && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 600, color: "#94a3b8", marginBottom: 4 }}>Monthly Distribution</div>
                          <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 24 }}>
                            {weights.map((w, i) => (
                              <div key={i} style={{
                                flex: 1, background: isDefault
                                  ? `rgba(245,158,11,${0.2 + w / 15})`
                                  : `rgba(99,102,241,${0.15 + w / 15})`,
                                borderRadius: 2,
                                height: `${Math.max(4, (w / Math.max(...weights)) * 24)}px`,
                                transition: "height .3s",
                              }} />
                            ))}
                          </div>
                          <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                            {["J","F","M","A","M","J","J","A","S","O","N","D"].map((m, i) => (
                              <div key={i} style={{ flex: 1, fontSize: 7, color: "#c0c7d2", textAlign: "center" }}>{m}</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div style={{
                      padding: "10px 18px", borderTop: "1px solid #f1f3f5",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: "50%",
                          background: "#10b981", display: "inline-block",
                        }} />
                        <span style={{ fontSize: 11, fontWeight: 500, color: "#10b981" }}>Active</span>
                      </div>
                      <button
                        onClick={() => router.push(`/settings/goals/${goal.slug}`)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          background: isDefault
                            ? "linear-gradient(135deg, #f59e0b, #d97706)"
                            : "linear-gradient(135deg, #6366f1, #4f46e5)",
                          color: "#fff", border: "none", borderRadius: 7,
                          padding: "6px 14px", fontSize: 11.5, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
                          boxShadow: isDefault
                            ? "0 2px 6px rgba(245,158,11,.25)"
                            : "0 2px 6px rgba(99,102,241,.25)",
                          transition: "all .15s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                        onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                      >
                        Configure <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Add Goal Card (placeholder) */}
              <div
                onClick={() => setShowCreate(true)}
                style={{
                  background: "transparent", border: "2px dashed #d1d5db", borderRadius: 12,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  minHeight: 220, cursor: "pointer", transition: "all .2s",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "#6366f1"
                  e.currentTarget.style.background = "rgba(99,102,241,.02)"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "#d1d5db"
                  e.currentTarget.style.background = "transparent"
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: "rgba(99,102,241,.06)", display: "flex",
                  alignItems: "center", justifyContent: "center", marginBottom: 10,
                }}>
                  <Plus className="h-5 w-5" style={{ color: "#6366f1" }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#6366f1" }}>
                  Create New Goal
                </span>
                <span style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 2 }}>
                  Add another revenue target
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Goal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Revenue Goal</DialogTitle>
            <DialogDescription>Define a new revenue target for your company.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Goal Name</Label>
              <Input
                placeholder="e.g. 2026 Annual Revenue Target"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Period Type</Label>
              <Select
                value={createPeriodType}
                onValueChange={(v) => setCreatePeriodType(v as "monthly" | "quarterly" | "yearly")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Target Amount (IDR)</Label>
              <Input
                type="text"
                placeholder="e.g. 130.000.000.000"
                value={createTarget}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\./g, "").replace(/,/g, "")
                  if (raw === "" || /^\d+$/.test(raw)) {
                    setCreateTarget(raw ? parseInt(raw).toLocaleString("id-ID") : "")
                  }
                }}
              />
              {createTarget && (
                <p className="text-xs text-muted-foreground">
                  {fmt(parseCurrencyInput(createTarget))}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={createPeriodStart}
                  onChange={(e) => setCreatePeriodStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={createPeriodEnd}
                  onChange={(e) => setCreatePeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={createWeightedForecast}
                onCheckedChange={setCreateWeightedForecast}
              />
              <Label>Enable weighted forecast</Label>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Configure hierarchy levels and monthly weights after creation via the Configure page.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !createName.trim()}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Goal Dialog */}
      <Dialog open={!!editGoal} onOpenChange={(open) => { if (!open) setEditGoal(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Goal</DialogTitle>
            <DialogDescription>Update the goal name, target, and settings.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Goal Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Target Amount (IDR)</Label>
              <Input
                type="text"
                value={editTarget}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\./g, "").replace(/,/g, "")
                  if (raw === "" || /^\d+$/.test(raw)) {
                    setEditTarget(raw ? parseInt(raw).toLocaleString("id-ID") : "")
                  }
                }}
              />
              {editTarget && (
                <p className="text-xs text-muted-foreground">
                  {fmt(parseCurrencyInput(editTarget))}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Period Start</Label>
                <Input
                  type="date"
                  value={editPeriodStart}
                  onChange={(e) => setEditPeriodStart(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Period End</Label>
                <Input
                  type="date"
                  value={editPeriodEnd}
                  onChange={(e) => setEditPeriodEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={editWeightedForecast}
                onCheckedChange={setEditWeightedForecast}
              />
              <Label>Enable weighted forecast</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditGoal(null)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={saving || !editName.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteGoalTarget} onOpenChange={(open) => { if (!open) setDeleteGoalTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete goal &quot;{deleteGoalTarget?.name}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this goal and all its breakdown targets. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  )
}
