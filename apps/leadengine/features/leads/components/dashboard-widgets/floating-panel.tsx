"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Minus, X } from "lucide-react"

interface FloatingPanelProps {
  id: string
  title: string
  icon: React.ReactNode
  iconBg: string
  children: React.ReactNode
  onClose: () => void
  badge?: string
  badgeColor?: string
  minimized: boolean
  hidden?: boolean
  onMinimize: () => void
  onRestore: () => void
}

/**
 * Floating panel that ALWAYS renders the same DOM structure.
 * Visibility is controlled via CSS only — children never unmount.
 * This ensures chat history and analysis results persist.
 * Uses Portal to render at document.body level (avoids scroll/sticky issues).
 */
export function FloatingPanel({
  id, title, icon, iconBg, children, onClose,
  badge, badgeColor = "#10B981",
  minimized, hidden, onMinimize, onRestore,
}: FloatingPanelProps) {
  const isVisible = !hidden && !minimized
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return createPortal(
    <>
      {/* Main panel — always in DOM, visibility toggled */}
      <div style={{
        position: "fixed",
        bottom: 16, right: 16,
        width: 400, maxHeight: "calc(100vh - 90px)",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)",
        border: "1px solid #e5e7eb",
        zIndex: 50,
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        // Hide without unmounting
        visibility: isVisible ? "visible" : "hidden",
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? "auto" : "none",
        transform: isVisible ? "scale(1) translateY(0)" : "scale(0.95) translateY(8px)",
        transition: "opacity .2s ease, transform .2s ease, visibility 0s linear " + (isVisible ? "0s" : ".2s"),
      }}>
        {/* Header */}
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid #f0f0f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FAFBFC", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, background: iconBg,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {icon}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{title}</span>
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={onMinimize} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, borderRadius: 4, color: "#94a3b8", display: "flex",
            }} title="Minimize">
              <Minus size={14} />
            </button>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              padding: 4, borderRadius: 4, color: "#94a3b8", display: "flex",
            }} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content — always mounted */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {children}
        </div>
      </div>

      {/* Minimized badge — stacked vertically bottom-right */}
      {minimized && !hidden && (
        <div
          onClick={onRestore}
          style={{
            position: "fixed",
            bottom: id === "analyze" ? 72 : 20,
            right: 20,
            zIndex: 9999, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10,
            background: id === "analyze"
              ? "linear-gradient(135deg, #7C3AED, #6366F1)"
              : "linear-gradient(135deg, #1e40af, #3B82F6)",
            borderRadius: 50,
            padding: "10px 18px 10px 12px",
            boxShadow: "0 6px 24px rgba(59,130,246,.35), 0 2px 8px rgba(0,0,0,.12)",
            border: "none",
            transition: "transform .15s ease, box-shadow .15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px) scale(1.03)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(59,130,246,.4)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0) scale(1)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(59,130,246,.35)" }}
        >
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "rgba(255,255,255,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {icon}
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{title}</span>
          {badge && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: "#fff",
              background: "rgba(255,255,255,.25)", padding: "2px 8px", borderRadius: 10,
            }}>
              {badge}
            </span>
          )}
        </div>
      )}
    </>,
    document.body
  )
}
