"use client"

import { createContext, useContext } from "react"
import type { GoalV2, GoalNode, GoalNodeTree, GoalUserTarget, GoalSettingsV2, Lead } from "@/types"

export interface GoalDataContextValue {
  activeGoal: GoalV2 | null
  goalNodes: (GoalNode | GoalNodeTree)[]
  userTargets: GoalUserTarget[]
  goalSettings: GoalSettingsV2 | null
  leads: Lead[]
}

const GoalDataContext = createContext<GoalDataContextValue | null>(null)

export function GoalDataProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: GoalDataContextValue
}) {
  return (
    <GoalDataContext.Provider value={value}>
      {children}
    </GoalDataContext.Provider>
  )
}

export function useGoalDataContext() {
  const ctx = useContext(GoalDataContext)
  if (!ctx) {
    throw new Error("useGoalDataContext must be used within a GoalDataProvider")
  }
  return ctx
}
