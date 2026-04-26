"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { GridLayout, type Layout, type LayoutItem } from "react-grid-layout"
import { Pencil, Check, X, RotateCcw, GripVertical, Plus, LayoutGrid } from "lucide-react"
import {
    getDefaultLayout,
    DEFAULT_HIDDEN_WIDGETS,
    WIDGET_IDS,
    GRID_COLS,
    GRID_ROW_HEIGHT,
    WIDGET_LABELS,
    type WidgetId,
    saveLayoutToLocal,
    loadLayoutFromLocal,
    clearLocalLayout,
    saveLayoutToSupabase,
    loadLayoutFromSupabase,
    resetLayoutInSupabase,
    saveHiddenToLocal,
    loadHiddenFromLocal,
    clearHiddenLocal,
} from "@/features/leads/lib/dashboard-layout"

import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

// All 8 resize handles for Bigin-style resize from every edge/corner
const ALL_RESIZE_HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const

interface DashboardGridProps {
    children: React.ReactNode
    widgetIds: WidgetId[]
    customWidgets?: { id: string; title: string }[]
    onCreateCustomWidget?: () => void
    onEditCustomWidget?: (widget: any) => void
    onDeleteCustomWidget?: (widgetId: string) => void
}

export function DashboardGrid({ children, widgetIds, customWidgets = [], onCreateCustomWidget, onEditCustomWidget, onDeleteCustomWidget }: DashboardGridProps) {
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

    // Validate that a saved layout contains all current widget IDs
    const isLayoutValid = useCallback((saved: any): boolean => {
        const layoutItems = Array.isArray(saved) ? saved : (saved?.lg || Object.values(saved)[0])
        if (!layoutItems || !Array.isArray(layoutItems)) return false
        const savedIds = new Set(layoutItems.map((item: any) => item.i))
        return WIDGET_IDS.every(id => savedIds.has(id))
    }, [])

    // Load saved layout on mount
    useEffect(() => {
        let cancelled = false
        async function load() {
            // Try Supabase first
            try {
                const remote = await loadLayoutFromSupabase()
                console.log('[DashboardGrid:load] Supabase result:', JSON.stringify({
                    hasLayout: !!remote.layout,
                    itemCount: remote.layout?.length ?? 0,
                    valid: remote.layout ? isLayoutValid(remote.layout) : false,
                    hasHidden: !!remote.hiddenWidgets,
                    sample: remote.layout?.[0] ? `${remote.layout[0].i}: w=${remote.layout[0].w}` : 'none',
                }))
                if (!cancelled && remote.layout && isLayoutValid(remote.layout)) {
                    setLayout([...remote.layout])
                    saveLayoutToLocal(remote.layout)
                    if (remote.hiddenWidgets) {
                        setHiddenWidgets(new Set(remote.hiddenWidgets))
                        saveHiddenToLocal(remote.hiddenWidgets)
                    }
                    setLoaded(true)
                    return
                }
            } catch (err) {
                console.warn('[DashboardGrid:load] Supabase error:', err)
            }

            // Try localStorage
            const local = loadLayoutFromLocal()
            console.log('[DashboardGrid:load] localStorage result:', JSON.stringify({
                hasLayout: !!local,
                itemCount: local?.length ?? 0,
                valid: local ? isLayoutValid(local) : false,
            }))
            if (!cancelled && local && isLayoutValid(local)) {
                setLayout([...local])
                const localHidden = loadHiddenFromLocal()
                if (localHidden) setHiddenWidgets(new Set(localHidden))
                setLoaded(true)
                return
            }

            // Fall back to defaults
            if (!cancelled) {
                console.log('[DashboardGrid:load] Using defaults')
                const defaults = getDefaultLayout()
                setLayout([...defaults])
                setHiddenWidgets(new Set(DEFAULT_HIDDEN_WIDGETS))
                saveLayoutToLocal(defaults)
                saveHiddenToLocal([...DEFAULT_HIDDEN_WIDGETS])
                saveLayoutToSupabase(defaults, [...DEFAULT_HIDDEN_WIDGETS])
                setLoaded(true)
            }
        }
        load()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Ensure custom widgets have layout entries
    useEffect(() => {
        if (!loaded || customIds.length === 0) return
        const layoutIds = new Set(layout.map(item => item.i))
        const missing = customIds.filter(id => !layoutIds.has(id))
        if (missing.length === 0) return

        const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
        const newItems = missing.map((id, idx) => ({
            i: id,
            x: (idx * 4) % 12,
            y: maxY + Math.floor((idx * 4) / 12) * 5,
            w: 4,
            h: 5,
            minW: 3,
            minH: 3,
        }))
        setLayout(prev => [...prev, ...newItems])
    }, [loaded, customIds, layout])

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
    }, [layout, hiddenWidgets])

    const handleSave = useCallback(async () => {
        setSaving(true)
        const hiddenArray = [...hiddenWidgets] as WidgetId[]
        const kpi = layout.find(item => item.i === 'kpi-won-revenue')
        console.log('[DashboardGrid] Saving layout:', layout.length, 'items. kpi-won-revenue:', kpi ? `w=${kpi.w} h=${kpi.h}` : 'not found')
        saveLayoutToLocal(layout)
        saveHiddenToLocal(hiddenArray)
        const saved = await saveLayoutToSupabase(layout, hiddenArray)
        console.log('[DashboardGrid] Supabase save result:', saved)
        setSaving(false)
        setIsEditing(false)
        setSelectedWidget(null)
        preEditLayoutRef.current = null
        preEditHiddenRef.current = null
    }, [layout, hiddenWidgets])

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
    }, [])

    const handleReset = useCallback(async () => {
        const defaults = getDefaultLayout()
        const defaultHidden = new Set(DEFAULT_HIDDEN_WIDGETS)
        setLayout([...defaults])
        setHiddenWidgets(defaultHidden)
        setShowGallery(false)
        clearLocalLayout()
        clearHiddenLocal()
        setSaving(true)
        await resetLayoutInSupabase()
        saveLayoutToLocal(defaults)
        saveHiddenToLocal([...DEFAULT_HIDDEN_WIDGETS])
        await saveLayoutToSupabase(defaults, [...DEFAULT_HIDDEN_WIDGETS])
        setSaving(false)
    }, [])

    const handleRemoveWidget = useCallback((id: WidgetId) => {
        setHiddenWidgets(prev => {
            const next = new Set(prev)
            next.add(id)
            return next
        })
        setSelectedWidget(null)
    }, [])

    const handleAddWidget = useCallback((id: WidgetId) => {
        setHiddenWidgets(prev => {
            const next = new Set(prev)
            next.delete(id)
            return next
        })
        // Add widget to bottom of current layout
        const maxY = layout.reduce((max, item) => {
            if (hiddenWidgets.has(item.i as WidgetId) && item.i !== id) return max
            return Math.max(max, item.y + item.h)
        }, 0)
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
        const visibleRows = 25

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
    }, [isEditing, width])

    const activeLayout = useMemo(() => {
        if (isEditing) return layout
        return layout.filter(item => !hiddenWidgets.has(item.i as WidgetId))
    }, [layout, hiddenWidgets, isEditing])

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
                        background: "#6366f1", border: "1px solid #6366f1", borderRadius: 7,
                        padding: "5px 10px", fontSize: 11, fontWeight: 600, color: "#fff",
                        cursor: saving ? "default" : "pointer",
                        fontFamily: "inherit",
                        boxShadow: "0 1px 4px rgba(99,102,241,.15)",
                        opacity: saving ? 0.5 : 1,
                    }}
                >
                    <Plus style={{ width: 12, height: 12 }} /> Add Widget
                    {hiddenWidgets.size > 0 && (
                        <span style={{
                            background: "rgba(255,255,255,.25)", borderRadius: 4,
                            padding: "0 4px", fontSize: 9, marginLeft: 2,
                        }}>
                            {hiddenWidgets.size}
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
                    style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "#6366f1", border: "1px solid #6366f1", borderRadius: 7,
                        padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#fff",
                        cursor: "pointer", fontFamily: "inherit",
                        boxShadow: "0 1px 4px rgba(99,102,241,.25)",
                        opacity: saving ? 0.7 : 1,
                    }}
                >
                    <Check style={{ width: 12, height: 12 }} /> {saving ? "Saving..." : "Save Layout"}
                </button>
            </div>
        ) : (
            <button
                onClick={handleStartEdit}
                style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "#fff", border: "1px solid #e5e8ed", borderRadius: 7,
                    padding: "5px 12px", fontSize: 11, fontWeight: 600, color: "#6366f1",
                    cursor: "pointer", fontFamily: "inherit",
                    boxShadow: "0 1px 2px rgba(0,0,0,.03)",
                }}
            >
                <Pencil style={{ width: 12, height: 12 }} /> Edit Dashboard
            </button>
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
                        borderTopColor: "#6366f1", borderRadius: "50%",
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

                            // Hidden widgets are completely removed from the grid
                            if (isHidden) return null

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
                                        overflow: "hidden",
                                        transition: "all .15s ease",
                                        borderRadius: isSelected ? 4 : 6,
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
                                                                background: "rgba(99,102,241,.85)",
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
                                <LayoutGrid style={{ width: 16, height: 16, color: "#6366f1" }} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                                    Add Widgets
                                </span>
                                <span style={{
                                    fontSize: 10, fontWeight: 600, color: "#6366f1",
                                    background: "#eef2ff", padding: "2px 6px", borderRadius: 4,
                                }}>
                                    {hiddenWidgets.size} available
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
                                        if (hiddenWidgets.size <= 1) setShowGallery(false)
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
                                        e.currentTarget.style.borderColor = "#6366f1"
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
                                        <Plus style={{ width: 14, height: 14, color: "#6366f1" }} />
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
                        {hiddenWidgets.size === 0 && !onCreateCustomWidget && (
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
