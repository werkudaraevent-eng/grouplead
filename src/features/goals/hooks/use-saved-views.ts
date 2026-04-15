"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import {
  createSavedViewAction,
  updateSavedViewAction,
  deleteSavedViewAction,
} from "@/app/actions/goal-actions"
import type { SavedView, SavedViewConfig } from "@/types/goals"
import { toast } from "sonner"

export function useSavedViews() {
  const { activeCompany } = useCompany()
  const [views, setViews] = useState<SavedView[]>([])
  const [loading, setLoading] = useState(true)

  const fetchViews = useCallback(async () => {
    if (!activeCompany?.id) {
      setViews([])
      setLoading(false)
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("saved_views")
      .select("*")
      .order("updated_at", { ascending: false })

    setViews((data as SavedView[]) ?? [])
    setLoading(false)
  }, [activeCompany?.id])

  useEffect(() => {
    fetchViews()
  }, [fetchViews])

  const saveView = useCallback(
    async (name: string, config: SavedViewConfig, isShared = false) => {
      if (!activeCompany?.id) return
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const result = await createSavedViewAction({
        company_id: activeCompany.id,
        user_id: user.id,
        name,
        is_shared: isShared,
        view_config: config,
      })
      if (result.success) {
        toast.success("View saved")
        fetchViews()
      } else {
        toast.error(result.error ?? "Failed to save view")
      }
    },
    [activeCompany?.id, fetchViews]
  )

  const deleteView = useCallback(
    async (viewId: string) => {
      const result = await deleteSavedViewAction(viewId)
      if (result.success) {
        toast.success("View deleted")
        setViews((prev) => prev.filter((v) => v.id !== viewId))
      } else {
        toast.error(result.error ?? "Failed to delete view")
      }
    },
    []
  )

  const loadView = useCallback(
    (viewId: string): SavedViewConfig | null => {
      const view = views.find((v) => v.id === viewId)
      return view?.view_config ?? null
    },
    [views]
  )

  return { views, loading, saveView, deleteView, loadView }
}
