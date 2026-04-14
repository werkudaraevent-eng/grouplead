"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { createPortal } from "react-dom"
import { GridLayout, type Layout, type LayoutItem } from "react-grid-layout"
import { Pencil, Check, X, RotateCcw, GripVertical } from "lucide-react"
import {
    getDefaultLayout,
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
} from "@/features/leads/lib/dashboard-layout"

import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

// All 8 resize handles for Bigin-style resize from every edge/corner
const ALL_RESIZE_HANDLES = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const

interface DashboardGridProps {
    children: React.ReactNode
    widgetIds: WidgetId[]
}

export function DashboardGrid({ children, widgetIds }: DashboardGridProps) {
    const [isEditing, setIsEditing] = useState(false)
    const [layout, setLayout] = useState<LayoutItem[]>([...getDefaultLayout()])
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)
    const [selectedWidget, setSelectedWidget] = useState<string | null>(null)
    const preEditLayoutRef = useRef<LayoutItem[] | null>(null)
    
    // Custom width observer guarantees zooming issues are bypassed.
    // We do NOT use RGL's WidthProvider — it miscalculates during browser zoom.
    const containerRef = useRef<HTMLDivElement>(null)
    const [width, setWidth] = useState(0)
    const [mounted, setMounted] = useState(false)

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
            const remote = await loadLayoutFromSupabase()
            if (!cancelled && remote && isLayoutValid(remote)) {
                const layoutItems = Array.isArray(remote) ? remote : ((remote as any).lg || Object.values(remote as any)[0])
                setLayout([...layoutItems])
                saveLayoutToLocal(layoutItems)
                setLoaded(true)
                return
            }
            const local = loadLayoutFromLocal()
            if (!cancelled && local && isLayoutValid(local)) {
                const layoutItems = Array.isArray(local) ? local : ((local as any).lg || Object.values(local as any)[0])
                setLayout([...layoutItems])
                setLoaded(true)
                return
            }
            // No valid saved layout — use defaults & persist to replace stale data
            if (!cancelled) {
                const defaults = getDefaultLayout()
                setLayout([...defaults])
                saveLayoutToLocal(defaults)
                saveLayoutToSupabase(defaults)
                setLoaded(true)
            }
        }
        load()
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleLayoutChange = useCallback((currentLayout: Layout) => {
        if (isEditing) {
            // Layout is readonly LayoutItem[], spread to get mutable copy
            setLayout([...currentLayout])
        }
    }, [isEditing])

    const handleStartEdit = useCallback(() => {
        preEditLayoutRef.current = JSON.parse(JSON.stringify(layout))
        setIsEditing(true)
    }, [layout])

    const handleSave = useCallback(async () => {
        setSaving(true)
        saveLayoutToLocal(layout)
        await saveLayoutToSupabase(layout)
        setSaving(false)
        setIsEditing(false)
        setSelectedWidget(null)
        preEditLayoutRef.current = null
    }, [layout])

    const handleCancel = useCallback(() => {
        if (preEditLayoutRef.current) {
            setLayout(preEditLayoutRef.current)
        }
        setIsEditing(false)
        setSelectedWidget(null)
        preEditLayoutRef.current = null
    }, [])

    const handleReset = useCallback(async () => {
        const defaults = getDefaultLayout()
        setLayout([...defaults])
        clearLocalLayout()
        setSaving(true)
        await resetLayoutInSupabase()
        saveLayoutToLocal(defaults)
        await saveLayoutToSupabase(defaults)
        setSaving(false)
    }, [])

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

    const isReady = loaded && width > 0

    // Build controls JSX — will be rendered by parent via renderControls callback
    const controlsJsx = isReady ? (
        isEditing ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
                minWidth: 0,
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
                        layout={layout}
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
                        {widgetIds.map((id, idx) => {
                            const childArray = Array.isArray(children) ? children : [children]
                            const child = childArray[idx]
                            const isSelected = isEditing && selectedWidget === id
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
                                            /* Bigin-style: blue dashed border only on selected */
                                            border: "2px dashed #4285f4",
                                        } : isEditing ? {
                                            /* Subtle hint for non-selected widgets */
                                            border: "1.5px solid #e0e4ec",
                                            cursor: "pointer",
                                        } : {}),
                                    }}>
                                        {/* Drag handle (only in edit mode) */}
                                        {isEditing && (
                                            <div
                                                className="dashboard-drag-handle"
                                                style={{
                                                    position: "absolute", top: 4, left: 4, zIndex: 10,
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
                                                {WIDGET_LABELS[id]}
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
