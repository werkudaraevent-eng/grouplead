"use client"

/**
 * useListViews — composable hook for any list page that wants
 * saved views, server-persisted.
 *
 * Responsibilities:
 *   • Fetch the user's views for the page key on mount.
 *   • Track `activeViewId` (default: server's default view, then first).
 *   • Compare current config snapshot against saved config → `isDirty`.
 *   • Expose CRUD callbacks that hit server actions and refresh state.
 *
 * The actual filter / sort / column state lives in the page; the hook
 * only stores a pointer to the active view and the tools to compare
 * snapshots.
 */

import * as React from "react"
import { toast } from "sonner"
import {
    listUserListViewsAction,
    createUserListViewAction,
    updateUserListViewAction,
    setUserListViewDefaultAction,
    deleteUserListViewAction,
    type SavedListViewRow,
} from "@/app/actions/list-views-actions"

interface UseListViewsOptions<T> {
    pageKey: string
    /** Build the canonical config snapshot from current local state. */
    snapshot: () => T
    /** Apply a saved config back into local state. */
    applySnapshot: (config: T) => void
    /** localStorage key for "last opened view" memory (per browser). */
    storageKey?: string
}

export function useListViews<T extends object>({
    pageKey,
    snapshot,
    applySnapshot,
    storageKey,
}: UseListViewsOptions<T>) {
    const [views, setViews] = React.useState<SavedListViewRow[]>([])
    const [activeViewId, setActiveViewId] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const initRef = React.useRef(false)

    const lsKey = storageKey ?? `list_view_${pageKey}_active`

    /* ───── Fetch on mount ───── */
    const refetch = React.useCallback(async () => {
        const res = await listUserListViewsAction(pageKey)
        if (!res.success) {
            // Non-fatal: views feature degrades gracefully
            console.warn("[useListViews] fetch failed:", res.error)
            setViews([])
            setLoading(false)
            return
        }
        setViews(res.data ?? [])
        setLoading(false)
    }, [pageKey])

    React.useEffect(() => {
        refetch()
    }, [refetch])

    /* ───── Initial selection ───── */
    React.useEffect(() => {
        if (initRef.current) return
        if (loading) return
        initRef.current = true

        // Priority: localStorage → default view → first → none
        const stored = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null
        const exists = stored && views.some(v => v.id === stored)
        if (exists) {
            setActiveViewId(stored)
            const v = views.find(x => x.id === stored)
            if (v) applySnapshot(v.config as T)
            return
        }
        const defView = views.find(v => v.is_default)
        if (defView) {
            setActiveViewId(defView.id)
            applySnapshot(defView.config as T)
            return
        }
        if (views.length > 0) {
            setActiveViewId(views[0].id)
            applySnapshot(views[0].config as T)
        }
        // No views: leave state alone, user can save current as new view.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, views])

    /* ───── Active view + dirty check ───── */
    const activeView = React.useMemo(
        () => views.find(v => v.id === activeViewId) ?? null,
        [views, activeViewId],
    )

    const currentSnapshot = snapshot()
    const isDirty = React.useMemo(() => {
        if (!activeView) return false
        return JSON.stringify(activeView.config) !== JSON.stringify(currentSnapshot)
    }, [activeView, currentSnapshot])

    /* ───── Actions ───── */
    const selectView = React.useCallback(
        (id: string) => {
            const v = views.find(x => x.id === id)
            if (!v) return
            setActiveViewId(id)
            if (typeof window !== "undefined") localStorage.setItem(lsKey, id)
            applySnapshot(v.config as T)
        },
        [views, lsKey, applySnapshot],
    )

    const saveCurrent = React.useCallback(async () => {
        if (!activeView) return
        const res = await updateUserListViewAction(activeView.id, { config: currentSnapshot as Record<string, unknown> })
        if (!res.success) {
            toast.error(res.error ?? "Failed to save view")
            return
        }
        toast.success("View updated")
        await refetch()
    }, [activeView, currentSnapshot, refetch])

    const saveAs = React.useCallback(
        async (name: string) => {
            const res = await createUserListViewAction(pageKey, name, { config: currentSnapshot as Record<string, unknown> })
            if (!res.success) {
                toast.error(res.error ?? "Failed to create view")
                return
            }
            toast.success(`View "${name}" saved`)
            const newId = res.data?.id
            if (newId) {
                if (typeof window !== "undefined") localStorage.setItem(lsKey, newId)
                setActiveViewId(newId)
            }
            await refetch()
        },
        [pageKey, currentSnapshot, lsKey, refetch],
    )

    const renameView = React.useCallback(
        async (id: string, name: string) => {
            const res = await updateUserListViewAction(id, { name })
            if (!res.success) {
                toast.error(res.error ?? "Failed to rename view")
                return
            }
            toast.success("View renamed")
            await refetch()
        },
        [refetch],
    )

    const deleteView = React.useCallback(
        async (id: string) => {
            const res = await deleteUserListViewAction(id)
            if (!res.success) {
                toast.error(res.error ?? "Failed to delete view")
                return
            }
            if (id === activeViewId) {
                setActiveViewId(null)
                if (typeof window !== "undefined") localStorage.removeItem(lsKey)
            }
            toast.success("View deleted")
            await refetch()
        },
        [activeViewId, lsKey, refetch],
    )

    const makeDefault = React.useCallback(
        async (id: string) => {
            const res = await setUserListViewDefaultAction(id, pageKey)
            if (!res.success) {
                toast.error(res.error ?? "Failed to set default")
                return
            }
            toast.success("Set as default view")
            await refetch()
        },
        [pageKey, refetch],
    )

    return {
        views,
        activeView,
        activeViewId,
        loading,
        isDirty,
        selectView,
        saveCurrent,
        saveAs,
        renameView,
        deleteView,
        makeDefault,
    }
}
