"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { usePermissions } from "@/contexts/permissions-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { GoalMatrixBoard } from "./goal-matrix-board"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import type { GoalV2 } from "@/types/goals"

export function GoalsPageClient() {
  const supabase = createClient()
  const { activeCompany } = useCompany()

  const [goals, setGoals] = useState<GoalV2[]>([])
  const [selectedGoalId, setSelectedGoalId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const { can, userType } = usePermissions()
  const canManage = can("goal_settings", "update") || userType === "super_admin" || userType === "admin"

  // Scroll state for sticky header
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      const y = el.scrollTop
      setScrolled(y > 20)
    }
    el.addEventListener("scroll", handler, { passive: true })
    return () => el.removeEventListener("scroll", handler)
  }, [])

  const loadGoals = useCallback(async () => {
    if (!activeCompany?.id) return
    setLoading(true)
    const { data } = await supabase
      .from("goals_v2")
      .select("*")
      .eq("company_id", activeCompany.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
    const list = (data as GoalV2[]) ?? []
    setGoals(list)
    if (list.length > 0 && !selectedGoalId) {
      setSelectedGoalId(list[0].id)
    }
    setLoading(false)
  }, [activeCompany?.id, supabase, selectedGoalId])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? null

  return (
    <PermissionGate
      resource="management_dashboard"
      action="read"
      fallback={
        <div className="p-8 text-muted-foreground">
          You do not have permission to view goals.
        </div>
      }
    >
      <div ref={scrollRef} className="h-screen overflow-y-auto bg-[#f2f3f6]">
        {/* Sticky header per spec §4 — 64px, blur on scroll, hysteresis */}
        {goals.length > 1 && (
          <div className={`sticky top-0 z-40 border-b transition-all duration-200 ${
            scrolled 
              ? "bg-white/85 backdrop-blur-md shadow-sm border-slate-200" 
              : "bg-white border-transparent"
          }`} style={{ height: 64 }}>
            <div className="px-8 h-full max-w-[1600px] mx-auto flex items-center gap-4">
              <span className="text-xs font-medium text-slate-500">Active Goal:</span>
              <Select value={selectedGoalId} onValueChange={setSelectedGoalId}>
                <SelectTrigger className="w-[280px] h-8 text-xs">
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
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-8 py-6 max-w-[1600px] mx-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedGoal ? (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No goals configured. Create a goal in Settings to get started.
            </div>
          ) : (
            <GoalMatrixBoard
              goalId={selectedGoal.id}
              goal={selectedGoal}
              readOnly={!canManage}
              onGoalUpdated={loadGoals}
            />
          )}
        </div>
      </div>
    </PermissionGate>
  )
}
