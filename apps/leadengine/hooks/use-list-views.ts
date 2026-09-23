"use client"

/**
 * useListViews — composable hook for any list page that wants
 * saved views, server-persisted.
 *
 * Responsibilities:
 *   • Fetch the user's views for the page key on mount.
 *   • Track `activeViewId`: the view last chosen, while the screen still
 *     is (or was changed from) that view.
 *   • Compare current config snapshot against saved config → `isDirty`.
 *   • Expose CRUD callbacks that hit server actions and refresh state.
 *
 * The actual filter / sort / column state lives in the page (on the list
 * pages, in the URL); the hook only stores a pointer to the active view and
 * the tools to compare snapshots.
 *
 * A saved view never overrides what the page was opened with. On load the
 * hook only marks the saved view that matches what is already on screen
 * (a link, the remembered view, or the plain list); it applies a view by
 * itself only when `applyDefaultOnLoad` says the page has nothing to show
 * yet (a list's first open on this browser), and then only the default
 * view. The remembered view of the list pages always wins on a bare open.
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
    /** localStorage key for "last chosen view" memory (per browser). */
    storageKey?: string
    /**
     * A comparable form of a config, so two configs that show the same
     * list compare equal (filter order, legacy sizes). JSON by default.
     */
    canonical?: (config: T) => string
    /** Apply the default view once the views arrive: the page has no view of its own yet. */
    applyDefaultOnLoad?: boolean
}

export function useListViews<T extends object>({
    pageKey,
    snapshot,
    applySnapshot,
    storageKey,
    canonical = (config: T) => JSON.stringify(config),
    applyDefaultOnLoad = false,
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

        const stored = readStored(lsKey)
        if (applyDefaultOnLoad) {
            // Nothing on screen yet (a first open on this browser): the
            // default view, if the person has one, chooses the view.
            const defView = views.find(v => v.is_default)
            if (defView) {
                setActiveViewId(defView.id)
                applySnapshot(defView.config as T)
                return
            }
        }
        // Otherwise the page keeps what it opened with; a saved view is only
        // marked when it is exactly what shows (the last chosen one first).
        const current = canonical(snapshot())
        const matches = (v: SavedListViewRow) => canonical(v.config as T) === current
        const match = views.find(v => v.id === stored && matches(v)) ?? views.find(matches)
        if (match) setActiveViewId(match.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, views])

    /* ───── Active view + dirty check ───── */
    const activeView = React.useMemo(
        () => views.find(v => v.id === activeViewId) ?? null,
        [views, activeViewId],
    )

    const currentSnapshot = snapshot()
    const currentKey = canonical(currentSnapshot)
    const isDirty = React.useMemo(() => {
        if (!activeView) return false
        return canonical(activeView.config as T) !== currentKey
    }, [activeView, currentKey, canonical])

    /* ───── Actions ───── */
    const selectView = React.useCallback(
        (id: string) => {
            const v = views.find(x => x.id === id)
            if (!v) return
            setActiveViewId(id)
            writeStored(lsKey, id)
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
                writeStored(lsKey, newId)
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
                writeStored(lsKey, null)
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

function readStored(key: string): string | null {
    try {
        return typeof window !== "undefined" ? localStorage.getItem(key) : null
    } catch {
        return null
    }
}

function writeStored(key: string, value: string | null) {
    try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
    } catch {
        // Storage unavailable: the pointer lives for this visit only.
    }
}
