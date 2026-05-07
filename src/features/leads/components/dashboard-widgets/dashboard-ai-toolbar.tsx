"use client"

import { useState, useCallback } from "react"
import { FileDown, Sparkles, MessageCircle, Loader2 } from "lucide-react"
import { useDashboardExportPDF } from "./dashboard-export-pdf"
import { FloatingPanel } from "./floating-panel"
import { AIAnalysisContent } from "./ai-analysis-content"
import { AskAIContent } from "./ask-ai-content"
import { toast } from "sonner"

type PanelState = "closed" | "open" | "minimized"

interface DashboardAIToolbarProps {
  /** Serializable dashboard data for AI context */
  dashboardData: Record<string, unknown>
}

export function DashboardAIToolbar({ dashboardData }: DashboardAIToolbarProps) {
  const [analyzeState, setAnalyzeState] = useState<PanelState>("closed")
  const [askState, setAskState] = useState<PanelState>("closed")
  // Track if panel was ever opened (to keep it mounted)
  const [analyzeEverOpened, setAnalyzeEverOpened] = useState(false)
  const [askEverOpened, setAskEverOpened] = useState(false)
  const [analyzeBadge, setAnalyzeBadge] = useState<string | undefined>()
  const [analyzeBadgeColor, setAnalyzeBadgeColor] = useState("#10B981")
  const { exportToPDF, exporting } = useDashboardExportPDF()

  const handleExport = async () => {
    try {
      await exportToPDF({ targetId: "dashboard-content", filename: "dashboard-report" })
      toast.success("PDF berhasil di-export!")
    } catch {
      toast.error("Gagal export PDF. Coba lagi.")
    }
  }

  const handleAnalyzeStatus = useCallback((status: "idle" | "loading" | "done" | "error") => {
    if (status === "loading") { setAnalyzeBadge("Loading..."); setAnalyzeBadgeColor("#7C3AED") }
    else if (status === "done") { setAnalyzeBadge("✓ Ready"); setAnalyzeBadgeColor("#10B981") }
    else if (status === "error") { setAnalyzeBadge("⚠ Error"); setAnalyzeBadgeColor("#EF4444") }
    else { setAnalyzeBadge(undefined) }
  }, [])

  return (
    <>
      {/* Toolbar buttons */}
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <ToolbarButton
          icon={exporting ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <FileDown size={13} />}
          label="PDF"
          onClick={handleExport}
          disabled={exporting}
        />

        <ToolbarButton
          icon={<Sparkles size={13} />}
          label="Analyze"
          onClick={() => { setAnalyzeEverOpened(true); setAnalyzeState(s => s === "open" ? "minimized" : "open") }}
          active={analyzeState === "open"}
          gradient
          badge={analyzeState !== "open" && analyzeBadge ? analyzeBadge : undefined}
        />

        <ToolbarButton
          icon={<MessageCircle size={13} />}
          label="Ask AI"
          onClick={() => { setAskEverOpened(true); setAskState(s => s === "open" ? "minimized" : "open") }}
          active={askState === "open"}
          gradient
        />
      </div>

      {/* Floating Analyze Panel — stays mounted once opened, hidden when closed */}
      {analyzeEverOpened && (
        <FloatingPanel
          id="analyze"
          title="AI Analysis"
          icon={<Sparkles size={12} color="#fff" />}
          iconBg="linear-gradient(135deg, #8B5CF6, #6366F1)"
          minimized={analyzeState === "minimized"}
          hidden={analyzeState === "closed"}
          onMinimize={() => setAnalyzeState("minimized")}
          onRestore={() => setAnalyzeState("open")}
          onClose={() => setAnalyzeState("closed")}
          badge={analyzeBadge}
          badgeColor={analyzeBadgeColor}
        >
          <AIAnalysisContent
            dashboardData={dashboardData}
            onStatusChange={handleAnalyzeStatus}
          />
        </FloatingPanel>
      )}

      {/* Floating Ask AI Panel — stays mounted once opened, hidden when closed */}
      {askEverOpened && (
        <FloatingPanel
          id="ask"
          title="Ask AI"
          icon={<MessageCircle size={12} color="#fff" />}
          iconBg="linear-gradient(135deg, #06B6D4, #3B82F6)"
          minimized={askState === "minimized"}
          hidden={askState === "closed"}
          onMinimize={() => setAskState("minimized")}
          onRestore={() => setAskState("open")}
          onClose={() => setAskState("closed")}
        >
          <AskAIContent dashboardData={dashboardData} />
        </FloatingPanel>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}

// ─── Toolbar Button ─────────────────────────────────────────────────────────

function ToolbarButton({ icon, label, onClick, disabled, active, gradient, badge }: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  gradient?: boolean
  badge?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: "5px 10px", borderRadius: 6, border: "none",
        fontSize: 11, fontWeight: 600, fontFamily: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        background: active
          ? (gradient ? "linear-gradient(135deg, #7C3AED, #6366F1)" : "#1e293b")
          : "#f1f5f9",
        color: active ? "#fff" : "#475569",
        opacity: disabled ? 0.6 : 1,
        transition: "all .15s ease",
        position: "relative",
      }}
      onMouseEnter={e => {
        if (!active && !disabled) {
          e.currentTarget.style.background = gradient
            ? "linear-gradient(135deg, #7C3AED, #6366F1)"
            : "#e2e8f0"
          if (gradient) e.currentTarget.style.color = "#fff"
        }
      }}
      onMouseLeave={e => {
        if (!active && !disabled) {
          e.currentTarget.style.background = "#f1f5f9"
          e.currentTarget.style.color = "#475569"
        }
      }}
    >
      {icon}
      {label}
      {badge && (
        <span style={{
          position: "absolute", top: -4, right: -4,
          width: 8, height: 8, borderRadius: "50%",
          background: "#10B981", border: "2px solid #fff",
        }} />
      )}
    </button>
  )
}
