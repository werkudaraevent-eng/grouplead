"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { GridLayout, type Layout, type LayoutItem } from "react-grid-layout"
import { Pencil, Check, X, RotateCcw, GripVertical, Plus, LayoutGrid } from "lucide-react"
import {
    getDefaultLayout,
    DEFAULT_HIDDEN_WIDGETS,
    GRID_COLS,
    GRID_ROW_HEIGHT,
    WIDGET_LABELS,
    type WidgetId,
} from "@/features/leads/lib/dashboard-layout"
import type { CustomWidget } from "@/types/custom-widget"

import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

// All 8 resize handles for Bigin-style resize from every edge/corner
const ALL_RESIZE_HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const

interface DashboardGridProps {
    children: React.ReactNode
    widgetIds: WidgetId[]
    customWidgets?: CustomWidget[]
    onCreateCustomWidget?: () => void
    onEditCustomWidget?: (widget: CustomWidget) => void
    onDeleteCustomWidget?: (widgetId: string) => void
    /**
     * View-aware integration (optional for backward compat).
     * Parent owns the persisted layout/hidden state for the active view.
     * When provided, the grid becomes controlled and bubbles changes up.
     */
    initialLayout?: LayoutItem[]
    initialHiddenWidgets?: WidgetId[]
    /** Opaque key to force re-seeding from props when active view changes. */
    viewKey?: string
    /** Called when the user clicks "Save" in edit mode. */
    onPersistLayout?: (layout: LayoutItem[], hiddenWidgets: WidgetId[]) => Promise<void> | void
    /** Called when user enters/exits edit mode (so parent can block view switching). */
    onEditModeChange?: (isEditing: boolean) => void
    /** Extra controls to render alongside Edit/Save buttons (e.g. view switcher). */
    extraHeaderControls?: React.ReactNode
    /** Name of the currently active view, for the Save button label. */
    activeViewName?: string
}

export function DashboardGrid({
    children,
    widgetIds,
    customWidgets = [],
    onCreateCustomWidget,
    onEditCustomWidget,
    onDeleteCustomWidget,
    initialLayout,
    initialHiddenWidgets,
    viewKey,
    onPersistLayout,
    onEditModeChange,
    extraHeaderControls,
    activeViewName,
}: DashboardGridProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [layout, setLayout] = useState<LayoutItem[]>([...getDefaultLayout()])
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedWidget, setSelectedWidget] = useState<string | null>(null)
    const [hiddenWidgets, setHiddenWidgets] = useState<Set<WidgetId>>(new Set())
    const preEditHiddenRef = useRef<Set<WidgetId> | null>(null)
    const [showGallery, setShowGallery] = useState(false)
    const preEditLayoutRef = useRef<LayoutItem[] | null>(null)
    
    // Custom width observer guarantees zooming issues are bypassed.
    // We do NOT use RGL's WidthProvider — it miscalculates during browser zoom.
    const containerRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [mounted, setMounted] = useState(false)

    const customIds = useMemo(() => customWidgets.map(w => `custom-${w.id}`), [customWidgets])
    const allWidgetIds = useMemo(() => [...widgetIds, ...customIds], [widgetIds, customIds])

    useEffect(() => {
        if (!containerRef.current) return

        const measure = () => {
            if (containerRef.current) {
                const w = containerRef.current.getBoundingClientRect().width
                if (w > 0) setWidth(w)
            }
        }

        // Seed initial width
        measure()
        setMounted(true)

        // Primary: ResizeObserver for container dimension changes
        const obs = new ResizeObserver(() => {
            measure()
        })
        obs.observe(containerRef.current)

        // Backup: window resize fires on browser zoom changes
        // ResizeObserver does NOT always fire during zoom because the CSS pixel
        // width of the element may not change if the parent has overflow constraints.
        const handleWindowResize = () => {
            requestAnimationFrame(measure)
        }
        window.addEventListener("resize", handleWindowResize)

        return () => {
            obs.disconnect()
            window.removeEventListener("resize", handleWindowResize)
        }
    }, [])

    // Merge saved layout with defaults: keep saved positions for widgets that
    // are still present, fill any missing widgets from the current defaults.
    // This lets us adopt new widgets without invalidating older saved layouts.
    const mergeWithDefaults = useCallback((saved: LayoutItem[] | null | undefined): LayoutItem[] => {
        const defaults = getDefaultLayout()
        if (!saved || saved.length === 0) return [...defaults]
        const savedById = new Map(saved.map(item => [item.i, item]))
        return defaults.map(def => savedById.get(def.i) ?? def).concat(
            // Preserve any custom widget layouts (not in defaults) from saved.
            saved.filter(item => !defaults.some(d => d.i === item.i)),
        )
    }, [])

    // Seed layout/hidden from the active view whenever it changes.
    // `viewKey` changes when the parent switches to a different view, forcing a
    // fresh re-seed even if the layout arrays happen to share a reference.
    useEffect(() => {
        if (initialLayout !== undefined || initialHiddenWidgets !== undefined) {
            const nextLayout = mergeWithDefaults(initialLayout)
            setLayout(nextLayout)
            setHiddenWidgets(new Set(initialHiddenWidgets ?? []))
            setLoaded(true)
            return
        }
        // Legacy fallback: when the grid is rendered without view props,
        // use built-in defaults. Real persistence flows through the parent now.
        setLayout([...getDefaultLayout()])
        setHiddenWidgets(new Set(DEFAULT_HIDDEN_WIDGETS))
        setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewKey])

    // IMPORTANT: Custom widgets are NOT auto-added to the layout anymore.
    // Previously this leaked widgets across views: creating a custom widget
    // in view A made it appear in view B because `customIds` is global per user
    // and the effect mutated the in-memory layout of whatever view happened to
    // be active. A custom widget is now part of a view only if its id has an
    // entry in that view's saved `layout_data`. The parent coordinates adoption
    // via `addWidgetToLayoutRef` below.

    const handleLayoutChange = useCallback((currentLayout: Layout) => {
        if (isEditing) {
            // RGL only reports items currently rendered in the grid.
            // Hidden widgets are filtered out of activeLayout, so they won't
            // appear in currentLayout. We must merge the visible layout changes
            // with the existing hidden widget entries to preserve all 19 items.
            const visibleIds = new Set(currentLayout.map(item => item.i))
            const hiddenEntries = layout.filter(item => !visibleIds.has(item.i))
            setLayout([...currentLayout, ...hiddenEntries])
        }
    }, [isEditing, layout])

    const handleStartEdit = useCallback(() => {
        preEditLayoutRef.current = JSON.parse(JSON.stringify(layout))
        preEditHiddenRef.current = new Set(hiddenWidgets)
        setIsEditing(true)
        onEditModeChange?.(true)
    }, [layout, hiddenWidgets, onEditModeChange])

    const handleSave = useCallback(async () => {
        setSaving(true)
        const hiddenArray = [...hiddenWidgets] as WidgetId[]
        try {
            if (onPersistLayout) {
                await onPersistLayout(layout, hiddenArray)
            }
        } finally {
            setSaving(false)
            setIsEditing(false)
            setSelectedWidget(null)
            preEditLayoutRef.current = null
            preEditHiddenRef.current = null
            onEditModeChange?.(false)
        }
    }, [layout, hiddenWidgets, onPersistLayout, onEditModeChange])

    const handleCancel = useCallback(() => {
        if (preEditLayoutRef.current) {
            setLayout(preEditLayoutRef.current)
        }
        if (preEditHiddenRef.current) {
            setHiddenWidgets(preEditHiddenRef.current)
        }
        setShowGallery(false)
        setIsEditing(false)
        setSelectedWidget(null)
        preEditLayoutRef.current = null
        preEditHiddenRef.current = null
        onEditModeChange?.(false)
    }, [onEditModeChange])

    const handleReset = useCallback(async () => {
        // Reset the in-memory edit buffer to built-in defaults. Persistence
        // happens only when the user clicks Save, which keeps cancel safe.
        const defaults = getDefaultLayout()
        setLayout([...defaults])
        setHiddenWidgets(new Set(DEFAULT_HIDDEN_WIDGETS))
        setShowGallery(false)
    }, [])

    const handleRemoveWidget = useCallback((id: string) => {
        // Built-in widgets: add to hidden set so layout slot is preserved.
        // Custom widgets: strip their layout entry completely, so they become
        // addable from the gallery again and disappear from the grid.
        if (id.startsWith("custom-")) {
            setLayout(prev => prev.filter(item => item.i !== id))
        } else {
            setHiddenWidgets(prev => {
                const next = new Set(prev)
                next.add(id as WidgetId)
                return next
            })
        }
        setSelectedWidget(null)
    }, [])

    const handleAddWidget = useCallback((id: string) => {
        // Compute next y below current layout for both branches.
        const computeMaxY = (lay: LayoutItem[], exclude?: string) =>
            lay.reduce((max, item) => {
                if (exclude && item.i === exclude) return max
                if (hiddenWidgets.has(item.i as WidgetId)) return max
                return Math.max(max, item.y + item.h)
            }, 0)

        if (id.startsWith("custom-")) {
            // Custom widget: insert a fresh layout entry at the bottom.
            setLayout(prev => {
                if (prev.some(item => item.i === id)) return prev
                const maxY = computeMaxY(prev)
                return [
                    ...prev,
                    { i: id, x: 0, y: maxY, w: 4, h: 5, minW: 3, minH: 3 },
                ]
            })
            return
        }

        // Built-in widget: unhide and bring its layout entry to the bottom.
        setHiddenWidgets(prev => {
            const next = new Set(prev)
            next.delete(id as WidgetId)
            return next
        })
        const maxY = computeMaxY(layout, id)
        const defaultItem = getDefaultLayout().find(item => item.i === id)
        if (defaultItem) {
            setLayout(prev => prev.map(item =>
                item.i === id ? { ...item, x: 0, y: maxY, w: defaultItem.w, h: defaultItem.h } : item
            ))
        }
    }, [layout, hiddenWidgets])

    // Grid overlay cells for edit mode — absolutely positioned to match react-grid-layout formula
    // MUST be before any early return to satisfy Rules of Hooks
    const gridOverlayCells = useMemo(() => {
        if (!isEditing || !width) return null
        const cols = 12
        const margin = 10
        // react-grid-layout formula: colWidth = (containerWidth - margin * (cols - 1)) / cols
        const colWidth = (width - margin * (cols - 1)) / cols
        const rowHeight = GRID_ROW_HEIGHT
        // Extend the dashed backdrop past the last widget so there's always
        // room to drag things lower. Floor: 25 rows (reasonable for an empty
        // view). Otherwise: last widget bottom + 8 buffer rows.
        const maxY = layout.reduce((m, item) => Math.max(m, item.y + item.h), 0)
        const visibleRows = Math.max(25, maxY + 8)

        const cells = []
        for (let row = 0; row < visibleRows; row++) {
            for (let col = 0; col < cols; col++) {
                const left = (colWidth + margin) * col
                const top = (rowHeight + margin) * row
                cells.push(
                    <div
                        key={`${row}-${col}`}
                        style={{
                            position: "absolute",
                            left,
                            top,
                            width: colWidth,
                            height: rowHeight,
                            background: "#eef0f4",
                            border: "1.5px dashed #d0d5e0",
                            borderRadius: 6,
                        }}
                    />
                )
            }
        }
        return cells
    }, [isEditing, width, layout])

    const activeLayout = useMemo(() => {
        if (isEditing) return layout
        return layout.filter(item => !hiddenWidgets.has(item.i as WidgetId))
    }, [layout, hiddenWidgets, isEditing])

    // Custom widgets that exist in the user's library but are not yet added
    // to this view's layout. These show up in the "Add Widget" gallery so the
    // user can pull them in per-view instead of them auto-appearing everywhere.
    const addableCustomWidgets = useMemo(() => {
        const layoutIds = new Set(layout.map(item => item.i))
        return customWidgets.filter(cw => !layoutIds.has(`custom-${cw.id}`))
    }, [customWidgets, layout])

    const galleryCount = hiddenWidgets.size + addableCustomWidgets.length

    const isReady = loaded && width > 0

    // Build controls JSX — will be rendered by parent via renderControls callback
    const controlsJsx = isReady ? (
        isEditing ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                    onClick={() => setShowGallery(true)}
                    disabled={saving}
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#02378D", border: "1px solid #02378D", borderRadius: 7,
                        padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#fff",
                        cursor: saving ? "default" : "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 1px 4px rgba(2,55,141,.15)",
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    <Plus style={{ width: 12, height: 12 }} /> Add Widget
                    {galleryCount > 0 && (
                        <span style={{
                            background: "rgba(255,255,255,.25)", borderRadius: 4,
                            padding: "0 4px", fontSize: 9, marginLeft: 2,
                        }}>
                            {galleryCount}
                        </span>
                    )}
                </button>
                <button
                    onClick={handleReset}
                    disabled={saving}
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#fff", border: "1px solid #e5e8ed", borderRadius: 7,
                        padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#8892a4",
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    <RotateCcw style={{ width: 12, height: 12 }} /> Reset
                </button>
                <button
                    onClick={handleCancel}
                    disabled={saving}
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#fff", border: "1px solid #e5e8ed", borderRadius: 7,
                        padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#ef4444",
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    <X style={{ width: 12, height: 12 }} /> Cancel
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    title={activeViewName ? `Saves to "${activeViewName}"` : "Save layout"}
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#02378D", border: "1px solid #02378D", borderRadius: 7,
                        padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#fff",
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 1px 4px rgba(2,55,141,.25)",
                        opacity: saving ? 0.7 : 1,
                        maxWidth: 220,
                    }}
                >
                    <Check style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {saving
                            ? "Saving…"
                            : activeViewName
                                ? `Save to "${activeViewName}"`
                                : "Save Layout"}
                    </span>
                </button>
            </div>
        ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {/* Parent-injected controls (e.g. saved-view switcher). */}
                {extraHeaderControls}
                <button
                    onClick={handleStartEdit}
                    style={{
                        display: "flex", alignItems: "center", gap: 6,
                        background: "#fff", border: "1px solid #e5e8ed", borderRadius: 7,
                        padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#02378D",
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 1px 2px rgba(0,0,0,.03)",
                        whiteSpace: "nowrap",
                    }}
                >
                    <Pencil style={{ width: 12, height: 12 }} /> Edit Dashboard
                </button>
            </div>
        )
    ) : null

    // Portal target: render controls into the sticky header slot
    const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null)
    useEffect(() => {
        setPortalTarget(document.getElementById("dashboard-edit-controls"))
    }, [])

    return (
        <div
            ref={containerRef}
            style={{
                position: "relative",
                width: "100%",
                minWidth: 900,
                boxSizing: "border-box",
            }}
            onClick={() => {
                if (isEditing) setSelectedWidget(null)
            }}
        >
            {!isReady ? (
                <div style={{ padding: 24, display: "flex", justifyContent: "center" }}>
                    <div style={{
                        width: 24, height: 24, border: "2.5px solid #e5e8ed",
                        borderTopColor: "#02378D", borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                    }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
            ) : (
                <>
                {/* Portal controls into the sticky header slot, fallback to inline */}
                {controlsJsx && (
                    portalTarget
                        ? createPortal(controlsJsx, portalTarget)
                        : (
                            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                                {controlsJsx}
                            </div>
                        )
                )}

            {/* Edit-mode banner: tells the user which view they're currently editing */}
            {isEditing && activeViewName && (
                <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 12px", marginBottom: 10,
                    background: "#eef2ff", border: "1px solid #c7d2fe",
                    borderRadius: 8, fontSize: 11, color: "#1e3a8a",
                }}>
                    <Pencil style={{ width: 12, height: 12, color: "#3730a3", flexShrink: 0 }} />
                    <span>
                        Editing <strong>{activeViewName}</strong>. Changes save to this view only.
                    </span>
                </div>
            )}

            <div
                style={{
                    position: "relative",
                    ...(isEditing ? {
                        border: "1.5px solid #c7d2fe",
                        borderRadius: 8,
                        background: "#fafbff",
                    } : {}),
                }}
            >
                {/* Visible grid cell overlay (behind widgets) */}
                {isEditing && gridOverlayCells && (
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            zIndex: 0,
                            pointerEvents: "none",
                        }}
                    >
                        {gridOverlayCells}
                    </div>
                )}
                {mounted && (
                    <GridLayout
                        className="dashboard-grid-layout"
                        width={width}
                        layout={activeLayout}
                        gridConfig={{
                            cols: GRID_COLS,
                            rowHeight: GRID_ROW_HEIGHT,
                            margin: [10, 10] as const,
                            containerPadding: [0, 0] as const,
                        }}
                        dragConfig={{
                            enabled: isEditing,
                            handle: ".dashboard-drag-handle",
                            bounded: true,
                            threshold: 3,
                        }}
                        resizeConfig={{
                            enabled: isEditing,
                            handles: [...ALL_RESIZE_HANDLES],
                        }}
                        onLayoutChange={handleLayoutChange}
                    >
                        {allWidgetIds.map((id, idx) => {
                            const childArray = Array.isArray(children) ? children : [children]
                            const child = childArray[idx]
                            const isHidden = hiddenWidgets.has(id as WidgetId)
                            const isSelected = isEditing && selectedWidget === id
                            const isCustom = id.startsWith("custom-")
                            const hasLayoutEntry = layout.some(item => item.i === id)

                            // Hidden widgets are completely removed from the grid
                            if (isHidden) return null
                            // Custom widgets not yet added to this view: skip render.
                            // They still live in `customWidgets` (global per user) but
                            // only appear on the grid when added explicitly via the
                            // "Add Widget" gallery of the current view.
                            if (isCustom && !hasLayoutEntry) return null

                            return (
                                <div
                                    key={id}
                                    className={isSelected ? "widget-selected" : ""}
                                    style={{ overflow: "visible" }}
                                    onClick={(e) => {
                                        if (isEditing) {
                                            e.stopPropagation()
                                            setSelectedWidget(id)
                                        }
                                    }}
                                >
                                    <div style={{
                                        height: "100%",
                                        position: "relative",
                                        overflow: isEditing ? "hidden" : "visible",
                                        transition: "all .15s ease",
                                        borderRadius: isEditing ? (isSelected ? 4 : 6) : 0,
                                        // Opaque background in edit mode so the dashed grid
                                        // backdrop does not bleed through widgets whose own
                                        // bodies are transparent (e.g. chart empty states).
                                        ...(isEditing ? { background: "#ffffff" } : {}),
                                        ...(isSelected ? {
                                            border: "2px dashed #4285f4",
                                        } : isEditing ? {
                                            border: "1.5px solid #e0e4ec",
                                            cursor: "pointer",
                                        } : {}),
                                    }}>
                                        {isEditing && (
                                            <div
                                                style={{
                                                    position: "absolute", top: 4, left: 4, right: 4, zIndex: 30,
                                                    display: "flex", alignItems: "center", justifyContent: "space-between",
                                                }}
                                            >
                                                <div
                                                    className="dashboard-drag-handle"
                                                    style={{
                                                        display: "flex", alignItems: "center", gap: 2,
                                                        background: isSelected ? "rgba(66,133,244,.92)" : "rgba(90,97,120,.75)",
                                                        color: "#fff",
                                                        padding: "2px 6px 2px 3px",
                                                        borderRadius: 5,
                                                        fontSize: 9,
                                                        fontWeight: 600,
                                                        cursor: "grab",
                                                        userSelect: "none",
                                                        boxShadow: isSelected ? "0 1px 4px rgba(66,133,244,.3)" : "0 1px 3px rgba(0,0,0,.1)",
                                                        transition: "all .15s",
                                                    }}
                                                >
                                                    <GripVertical style={{ width: 10, height: 10 }} />
                                                    {WIDGET_LABELS[id as WidgetId] || customWidgets.find(w => `custom-${w.id}` === id)?.title || 'Custom'}
                                                </div>
                                                <div style={{ display: 'flex', gap: 3 }}>
                                                    {id.startsWith('custom-') && onEditCustomWidget && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                const cw = customWidgets.find(w => `custom-${w.id}` === id)
                                                                if (cw) onEditCustomWidget(cw)
                                                            }}
                                                            style={{
                                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                                width: 20, height: 20,
                                                                background: "rgba(2,55,141,.85)",
                                                                color: "#fff", border: "none", borderRadius: 5,
                                                                cursor: "pointer", pointerEvents: "auto",
                                                                boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                                                            }}
                                                            title="Edit widget config"
                                                        >
                                                            <Pencil style={{ width: 9, height: 9 }} />
                                                        </button>
                                                    )}
                                                    {id.startsWith('custom-') && onDeleteCustomWidget && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                if (confirm('Delete this custom widget permanently?')) {
                                                                    onDeleteCustomWidget(id.replace('custom-', ''))
                                                                }
                                                            }}
                                                            style={{
                                                                display: "flex", alignItems: "center", justifyContent: "center",
                                                                width: 20, height: 20,
                                                                background: "rgba(220,38,38,.85)",
                                                                color: "#fff", border: "none", borderRadius: 5,
                                                                cursor: "pointer", pointerEvents: "auto",
                                                                boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                                                            }}
                                                            title="Delete widget permanently"
                                                        >
                                                            <X style={{ width: 9, height: 9 }} />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleRemoveWidget(id as WidgetId)
                                                        }}
                                                        style={{
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            width: 20, height: 20,
                                                            background: "rgba(239,68,68,.85)",
                                                            color: "#fff",
                                                            border: "none",
                                                            borderRadius: 5,
                                                            cursor: "pointer",
                                                            pointerEvents: "auto",
                                                            boxShadow: "0 1px 3px rgba(0,0,0,.15)",
                                                            transition: "all .15s",
                                                        }}
                                                        title="Remove from dashboard"
                                                    >
                                                        <X style={{ width: 11, height: 11 }} />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {child}
                                    </div>
                                </div>
                            )
                        })}
                    </GridLayout>
                )}
                
            </div>

            {/* Widget Gallery Modal */}
            {showGallery && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 1000,
                        background: "rgba(0,0,0,.4)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        backdropFilter: "blur(2px)",
                    }}
                    onClick={() => setShowGallery(false)}
                >
                    <div
                        style={{
                            background: "#fff", borderRadius: 12,
                            width: "min(560px, 90vw)", maxHeight: "70vh",
                            boxShadow: "0 20px 60px rgba(0,0,0,.2)",
                            display: "flex", flexDirection: "column",
                            overflow: "hidden",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "16px 20px", borderBottom: "1px solid #e5e8ed",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <LayoutGrid style={{ width: 16, height: 16, color: "#02378D" }} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                                    Add Widgets
                                </span>
                                <span style={{
                                    fontSize: 10, fontWeight: 600, color: "#02378D",
                                    background: "#eef2ff", padding: "2px 6px", borderRadius: 4,
                                }}>
                                    {galleryCount} available
                                </span>
                            </div>
                            <button
                                onClick={() => setShowGallery(false)}
                                style={{
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    width: 28, height: 28, background: "#f4f5f7",
                                    border: "none", borderRadius: 6, cursor: "pointer",
                                }}
                            >
                                <X style={{ width: 14, height: 14, color: "#64748b" }} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div style={{
                            padding: "16px 20px", overflowY: "auto",
                            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
                        }}>
                            {[...hiddenWidgets].map(id => (
                                <button
                                    key={id}
                                    onClick={() => {
                                        handleAddWidget(id)
                                        if (galleryCount <= 1) setShowGallery(false)
                                    }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "12px 14px",
                                        background: "#f8fafc", border: "1.5px solid #e2e8f0",
                                        borderRadius: 8, cursor: "pointer",
                                        fontFamily: "inherit",
                                        transition: "all .15s",
                                        textAlign: "left",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "#02378D"
                                        e.currentTarget.style.background = "#eef2ff"
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "#e2e8f0"
                                        e.currentTarget.style.background = "#f8fafc"
                                    }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 6,
                                        background: "#e0e7ff",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0,
                                    }}>
                                        <Plus style={{ width: 14, height: 14, color: "#02378D" }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>
                                            {WIDGET_LABELS[id]}
                                        </div>
                                        <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>
                                            Click to add to dashboard
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {/* User's custom widgets not yet in this view */}
                            {addableCustomWidgets.map(cw => (
                                <button
                                    key={`custom-${cw.id}`}
                                    onClick={() => {
                                        handleAddWidget(`custom-${cw.id}`)
                                        if (galleryCount <= 1) setShowGallery(false)
                                    }}
                                    style={{
                                        display: "flex", alignItems: "center", gap: 10,
                                        padding: "12px 14px",
                                        background: "#fffbeb", border: "1.5px solid #fde68a",
                                        borderRadius: 8, cursor: "pointer",
                                        fontFamily: "inherit",
                                        transition: "all .15s",
                                        textAlign: "left",
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = "#d97706"
                                        e.currentTarget.style.background = "#fef3c7"
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = "#fde68a"
                                        e.currentTarget.style.background = "#fffbeb"
                                    }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 6,
                                        background: "#fde68a",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        flexShrink: 0,
                                    }}>
                                        <Plus style={{ width: 14, height: 14, color: "#b45309" }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>
                                            {cw.title}
                                        </div>
                                        <div style={{ fontSize: 9, color: "#b45309", marginTop: 1 }}>
                                            Custom widget · add to this view
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {/* Create Custom Widget button */}
                            {onCreateCustomWidget && (
                                <button
                                    onClick={() => {
                                        setShowGallery(false)
                                        onCreateCustomWidget()
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '12px 14px',
                                        background: '#f0fdf4', border: '1.5px dashed #22c55e',
                                        borderRadius: 8, cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        transition: 'all .15s',
                                        textAlign: 'left',
                                        gridColumn: '1 / -1',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = '#16a34a'
                                        e.currentTarget.style.background = '#dcfce7'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = '#22c55e'
                                        e.currentTarget.style.background = '#f0fdf4'
                                    }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 6,
                                        background: '#dcfce7',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0,
                                    }}>
                                        <Plus style={{ width: 14, height: 14, color: '#16a34a' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: '#166534' }}>
                                            Create Custom Widget
                                        </div>
                                        <div style={{ fontSize: 9, color: '#4ade80' }}>
                                            Build your own chart or KPI
                                        </div>
                                    </div>
                                </button>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {galleryCount === 0 && !onCreateCustomWidget && (
                            <div style={{
                                padding: "20px", textAlign: "center",
                                color: "#94a3b8", fontSize: 12,
                            }}>
                                All widgets are on the dashboard
                            </div>
                        )}
                    </div>
                </div>
            )}
            
            <style>{`
                /* Improve handle hitboxes */
                .react-resizable-handle { 
                    opacity: 0; 
                    transition: opacity .15s; 
                    z-index: 20;
                }
                .widget-selected .react-resizable-handle {
                    opacity: 1;
                }
                .react-grid-item:hover .react-resizable-handle {
                    opacity: 1;
                }
                .react-resizable-handle-se {
                    bottom: 0px !important;
                    right: 0px !important;
                    width: 20px !important;
                    height: 20px !important;
                }
            `}</style>
                </>
            )}
        </div>
    )
}
