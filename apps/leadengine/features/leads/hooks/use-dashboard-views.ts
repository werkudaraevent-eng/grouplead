"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  createDashboardViewAction,
  deleteDashboardViewAction,
  duplicateDashboardViewAction,
  listDashboardViewsAction,
  renameDashboardViewAction,
  setDefaultDashboardViewAction,
  updateDashboardViewAction,
} from "@/app/actions/dashboard-view-actions"
import type { DashboardView, DashboardViewInput } from "@/types/dashboard-view"

const ACTIVE_VIEW_LS_KEY = "dashboard-active-view-id-v1"

function readActiveViewIdFromStorage(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(ACTIVE_VIEW_LS_KEY)
  } catch {
    return null
  }
}

function writeActiveViewIdToStorage(id: string | null) {
  if (typeof window === "undefined") return
  try {
    if (id) window.localStorage.setItem(ACTIVE_VIEW_LS_KEY, id)
    else window.localStorage.removeItem(ACTIVE_VIEW_LS_KEY)
  } catch {
    /* quota or disabled */
  }
}

/**
 * Central hook for managing dashboard views.
 *
 * Responsibilities:
 *  - Load views on mount (auto-creates a default view if none exist).
 *  - Resolve active view from localStorage → default → first view.
 *  - Expose mutation helpers that keep local state in sync with the server.
 *
 * Edge cases handled:
 *  - Active view deleted elsewhere → falls back to default or first view.
 *  - No default marked → promotes the first view server-side on list call.
 *  - localStorage unavailable (SSR, private mode) → silently ignored.
 */
export function useDashboardViews() {
  const [views, setViews] = useState<DashboardView[]>([])
  const [activeViewId, setActiveViewIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const resolveInitialActiveId = useCallback(
    (list: DashboardView[]): string | null => {
      if (list.length === 0) return null
      const fromStorage = readActiveViewIdFromStorage()
      if (fromStorage && list.some(v => v.id === fromStorage)) return fromStorage
      const fallback = list.find(v => v.is_default)?.id ?? list[0].id
      return fallback
    },
    [],
  )

  const loadViews = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listDashboardViewsAction()
    if (!mountedRef.current) return
    if (!result.success || !result.data) {
      setError(result.error ?? "Failed to load views")
      setLoading(false)
      return
    }
    setViews(result.data)
    setActiveViewIdState(prev => {
      // Preserve current active if still valid, else resolve fresh.
      if (prev && result.data!.some(v => v.id === prev)) return prev
      return resolveInitialActiveId(result.data!)
    })
    setLoading(false)
  }, [resolveInitialActiveId])

  useEffect(() => {
    // Initial load on mount. setState inside is intentional for data fetching.
    loadViews() // eslint-disable-line react-hooks/set-state-in-effect
  }, [loadViews])

  const setActiveViewId = useCallback((id: string | null) => {
    setActiveViewIdState(id)
    writeActiveViewIdToStorage(id)
  }, [])

  const activeView = views.find(v => v.id === activeViewId) ?? null

  const createView = useCallback(
    async (input: DashboardViewInput): Promise<DashboardView | null> => {
      const result = await createDashboardViewAction(input)
      if (!result.success || !result.data) {
        const msg = result.error ?? "Failed to create view"
        setError(msg)
        toast.error(msg)
        return null
      }
      setViews(prev => [...prev, result.data!])
      setActiveViewId(result.data.id)
      toast.success(`View "${result.data.name}" created`)
      return result.data
    },
    [setActiveViewId],
  )

  const updateView = useCallback(
    async (input: DashboardViewInput & { id: string }): Promise<DashboardView | null> => {
      const result = await updateDashboardViewAction(input)
      if (!result.success || !result.data) {
        const msg = result.error ?? "Failed to save view"
        setError(msg)
        toast.error(msg)
        return null
      }
      setViews(prev => prev.map(v => (v.id === input.id ? result.data! : v)))
      toast.success(`"${result.data.name}" saved`)
      return result.data
    },
    [],
  )

  const renameView = useCallback(
    async (id: string, name: string): Promise<boolean> => {
      const result = await renameDashboardViewAction(id, name)
      if (!result.success || !result.data) {
        const msg = result.error ?? "Failed to rename view"
        setError(msg)
        toast.error(msg)
        return false
      }
      setViews(prev => prev.map(v => (v.id === id ? result.data! : v)))
      toast.success(`Renamed to "${result.data.name}"`)
      return true
    },
    [],
  )

  const setDefault = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await setDefaultDashboardViewAction(id)
      if (!result.success) {
        const msg = result.error ?? "Failed to set default"
        setError(msg)
        toast.error(msg)
        return false
      }
      setViews(prev => prev.map(v => ({ ...v, is_default: v.id === id })))
      toast.success("Default view updated")
      return true
    },
    [],
  )

  const duplicateView = useCallback(
    async (id: string): Promise<DashboardView | null> => {
      const result = await duplicateDashboardViewAction(id)
      if (!result.success || !result.data) {
        const msg = result.error ?? "Failed to duplicate view"
        setError(msg)
        toast.error(msg)
        return null
      }
      setViews(prev => [...prev, result.data!])
      setActiveViewId(result.data.id)
      toast.success(`Duplicated as "${result.data.name}"`)
      return result.data
    },
    [setActiveViewId],
  )

  const deleteView = useCallback(
    async (id: string): Promise<boolean> => {
      const result = await deleteDashboardViewAction(id)
      if (!result.success) {
        const msg = result.error ?? "Failed to delete view"
        setError(msg)
        toast.error(msg)
        return false
      }
      // Capture name before removing (for toast text).
      const removed = views.find(v => v.id === id)
      // Optimistically update local state.
      setViews(prev => {
        const remaining = prev.filter(v => v.id !== id)
        // Apply new default if server promoted one.
        const newDefaultId = result.data?.newDefaultId
        if (newDefaultId) {
          return remaining.map(v => ({ ...v, is_default: v.id === newDefaultId }))
        }
        return remaining
      })
      // If we deleted the active view, switch to default/first remaining.
      setActiveViewIdState(prev => {
        if (prev !== id) return prev
        const nextId = result.data?.newDefaultId ?? null
        writeActiveViewIdToStorage(nextId)
        return nextId
      })
      toast.success(removed ? `"${removed.name}" deleted` : "View deleted")
      return true
    },
    [views],
  )

  return {
    views,
    activeView,
    activeViewId,
    loading,
    error,
    setActiveViewId,
    createView,
    updateView,
    renameView,
    setDefault,
    duplicateView,
    deleteView,
    reload: loadViews,
  }
}

export type UseDashboardViewsReturn = ReturnType<typeof useDashboardViews>
