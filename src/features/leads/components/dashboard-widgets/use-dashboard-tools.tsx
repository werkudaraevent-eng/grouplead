"use client"

import { useState, useCallback } from "react"
import { Sparkles, MessageCircle } from "lucide-react"
import { useDashboardExportPDF } from "./dashboard-export-pdf"
import { FloatingPanel } from "./floating-panel"
import { AIAnalysisContent } from "./ai-analysis-content"
import { AskAIContent } from "./ask-ai-content"
import { toast } from "sonner"

type PanelState = "closed" | "open" | "minimized"

/**
 * Headless hook that manages the dashboard's secondary tools (PDF export,
 * AI Analyze, Ask AI). It returns:
 *   • action handlers — wire these to whatever trigger you like (toolbar
 *     buttons, dropdown menu items, command palette, etc.)
 *   • status flags — for showing loading/active states on the trigger
 *   • a `<Panels />` element — render this somewhere in the tree to
 *     mount the floating panels. Panels stay mounted once opened so AI
 *     conversations are preserved while the user keeps working.
 */
export function useDashboardTools(dashboardData: Record<string, unknown>) {
    const [analyzeState, setAnalyzeState] = useState<PanelState>("closed")
    const [askState, setAskState] = useState<PanelState>("closed")
    const [analyzeEverOpened, setAnalyzeEverOpened] = useState(false)
    const [askEverOpened, setAskEverOpened] = useState(false)
    const [analyzeBadge, setAnalyzeBadge] = useState<string | undefined>()
    const [analyzeBadgeColor, setAnalyzeBadgeColor] = useState("#10B981")
    const { exportToPDF, exporting } = useDashboardExportPDF()

    const handleExportPDF = useCallback(async () => {
        try {
            await exportToPDF({ targetId: "dashboard-content", filename: "dashboard-report" })
            toast.success("PDF berhasil di-export!")
        } catch {
            toast.error("Gagal export PDF. Coba lagi.")
        }
    }, [exportToPDF])

    const handleOpenAnalyze = useCallback(() => {
        setAnalyzeEverOpened(true)
        setAnalyzeState(s => s === "open" ? "minimized" : "open")
    }, [])

    const handleOpenAsk = useCallback(() => {
        setAskEverOpened(true)
        setAskState(s => s === "open" ? "minimized" : "open")
    }, [])

    const handleAnalyzeStatus = useCallback((status: "idle" | "loading" | "done" | "error") => {
        if (status === "loading") { setAnalyzeBadge("Loading..."); setAnalyzeBadgeColor("#7C3AED") }
        else if (status === "done") { setAnalyzeBadge("✓ Ready"); setAnalyzeBadgeColor("#10B981") }
        else if (status === "error") { setAnalyzeBadge("⚠ Error"); setAnalyzeBadgeColor("#EF4444") }
        else { setAnalyzeBadge(undefined) }
    }, [])

    const Panels = (
        <>
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
        </>
    )

    return {
        // actions
        handleExportPDF,
        handleOpenAnalyze,
        handleOpenAsk,
        // status
        exporting,
        analyzeOpen: analyzeState === "open",
        askOpen: askState === "open",
        analyzeBadge,
        // render
        Panels,
    }
}
