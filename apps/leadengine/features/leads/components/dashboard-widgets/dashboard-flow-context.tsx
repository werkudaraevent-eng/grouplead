"use client"

import { createContext, useContext } from "react"

/**
 * True for a widget drawn in the dashboard's phone stream (below `lg`,
 * `flowItems` in `features/leads/lib/dashboard-flow.ts`) rather than in the
 * desk's resizable grid. A card there is as wide as the screen (or half of
 * it, for a number card) and as tall as its content or a fixed phone height,
 * so a widget uses it to thin its axis labels, narrow its label column and
 * stop fitting itself to a grid cell's height. Nothing on a desk changes.
 */
const DashboardFlowContext = createContext(false)

export const DashboardFlowProvider = DashboardFlowContext.Provider

export function useDashboardFlow(): boolean {
    return useContext(DashboardFlowContext)
}
