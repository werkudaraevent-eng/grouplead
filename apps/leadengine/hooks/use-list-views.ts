"use client"

/**
 * useListViews — composable hook for any list page that wants
 * saved views, server-persisted.
 *
 * Responsibilities:
 *   • Fetch the user's views for the page key on mount.
 *   • Track `activeViewId`: the view last chosen, while the screen still
 *     is (or was changed from) that view.
 *   • Name the view the screen shows exactly → `marked` (the Views menu's
 *     label and check), the view the menu's actions act on → `target`
 *     (the marked one, else the one last chosen), and whether that last
 *     chosen view has been changed → `dirty` ("Save changes").
 *   • Compare current config snapshot against saved config → `isDirty`
 *     (the phone's chip row, which marks the view last chosen).
 *   • Expose CRUD callbacks that hit server actions and refresh state;
 *     a deleted view comes back from the snackbar's Undo.
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
    clearUserListViewDefaultAction,
    deleteUserListViewAction,
    type SavedListViewRow,
} from "@/app/actions/list-views-actions"
import { markedView } from "@/lib/lists/list-state"

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

/** What a list page and its Views menu get from `useListViews`. */
export interface ListViewsApi {
    views: SavedListViewRow[]
    /** False when the views could not be read: the menu is not drawn. */
    available: boolean
    activeView: SavedListViewRow | null
    activeViewId: string | null
    loading: boolean
    /** The view last chosen differs from the screen (the phone's chip row). */
    isDirty: boolean
    /** The saved view the screen shows exactly, the last chosen first. */
    marked: SavedListViewRow | null
    /** The view the per-view actions act on: the marked one, else the one last chosen. */
    target: SavedListViewRow | null
    /** The view last chosen has been changed and no saved view is the screen: "Save changes". */
    dirty: boolean
    selectView: (id: string) => void
    /** Forget the view last chosen (the menu's "Default view"; the page resets the list). */
    clearView: () => void
    saveCurrent: () => Promise<void>
    saveAs: (name: string) => Promise<void>
    renameView: (id: string, name: string) => Promise<void>
    deleteView: (id: string) => Promise<void>
    makeDefault: (id: string) => Promise<void>
    unsetDefault: (id: string) => Promise<void>
}

export function useListViews<T extends object>({
    pageKey,
    snapshot,
    applySnapshot,
    storageKey,
    canonical = (config: T) => JSON.stringify(config),
    applyDefaultOnLoad = false,
}: UseListViewsOptions<T>): ListViewsApi {
    const [views, setViews] = React.useState<SavedListViewRow[]>([])
    const [activeViewId, setActiveViewId] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const [available, setAvailable] = React.useState(true)
    const initRef = React.useRef(false)

    const lsKey = storageKey ?? `list_view_${pageKey}_active`

    /* ───── Fetch on mount ───── */
    const refetch = React.useCallback(async () => {
        const res = await listUserListViewsAction(pageKey)
        if (!res.success) {
            // Non-fatal: views feature degrades gracefully
            console.warn("[useListViews] fetch failed:", res.error)
            setViews([])
            setAvailable(false)
            setLoading(false)
            return
        }
        setViews(res.data ?? [])
        setAvailable(true)
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

    const marked = React.useMemo(
        () => markedView(views, (v) => canonical(v.config as T), currentKey, [activeViewId]),
        [views, canonical, currentKey, activeViewId],
    )
    const target = marked ?? activeView
    const dirty = !marked && isDirty

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

    const clearView = React.useCallback(() => {
        setActiveViewId(null)
        writeStored(lsKey, null)
    }, [lsKey])

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

    // A person's own shortcut, so the menu asks nothing: the snackbar's
    // Undo saves it again, name, view and default included (Sales
    // Activity's saved views; M3 snackbar with an action).
    const deleteView = React.useCallback(
        async (id: string) => {
            const removed = views.find(v => v.id === id)
            const res = await deleteUserListViewAction(id)
            if (!res.success) {
                toast.error(res.error ?? "Failed to delete view")
                return
            }
            const wasActive = id === activeViewId
            if (wasActive) {
                setActiveViewId(null)
                writeStored(lsKey, null)
            }
            await refetch()
            if (!removed) {
                toast.success("View deleted")
                return
            }
            toast.success(`View "${removed.name}" deleted`, {
                duration: 6000,
                action: {
                    label: "Undo",
                    onClick: async () => {
                        const restored = await createUserListViewAction(pageKey, removed.name, {
                            config: removed.config,
                            isDefault: removed.is_default,
                        })
                        if (!restored.success) {
                            toast.error(restored.error ?? "The view could not be restored")
                            return
                        }
                        const newId = restored.data?.id
                        if (wasActive && newId) {
                            writeStored(lsKey, newId)
                            setActiveViewId(newId)
                        }
                        await refetch()
                    },
                },
            })
        },
        [views, activeViewId, lsKey, pageKey, refetch],
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

    const unsetDefault = React.useCallback(
        async (id: string) => {
            const res = await clearUserListViewDefaultAction(id)
            if (!res.success) {
                toast.error(res.error ?? "Failed to remove the default")
                return
            }
            toast.success("No longer the default view")
            await refetch()
        },
        [refetch],
    )

    return {
        views,
        available,
        activeView,
        activeViewId,
        loading,
        isDirty,
        marked,
        target,
        dirty,
        selectView,
        clearView,
        saveCurrent,
        saveAs,
        renameView,
        deleteView,
        makeDefault,
        unsetDefault,
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
