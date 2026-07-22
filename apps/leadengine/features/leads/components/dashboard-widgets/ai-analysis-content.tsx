"use client"

import { useState, useEffect, useCallback } from "react"
import { analyzeDashboard, type DashboardAnalysis } from "@/app/actions/ai-actions"
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Lightbulb, FileText } from "lucide-react"

/** Safely convert any AI response item to a renderable string */
function stringify(val: unknown): string {
  if (typeof val === "string") return val
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>
    if (obj.title && obj.description) return `${obj.title}: ${obj.description}`
    if (obj.title) return String(obj.title)
    if (obj.text) return String(obj.text)
    if (obj.point) return String(obj.point)
    return JSON.stringify(val)
  }
  return String(val ?? "")
}

interface AIAnalysisContentProps {
  dashboardData: Record<string, unknown>
  onStatusChange?: (status: "idle" | "loading" | "done" | "error") => void
}

export function AIAnalysisContent({ dashboardData, onStatusChange }: AIAnalysisContentProps) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = useCallback(async () => {
    setLoading(true)
    setError(null)
    onStatusChange?.("loading")
    try {
      const result = await analyzeDashboard(dashboardData)
      if (result.success && result.data) {
        setAnalysis(result.data)
        onStatusChange?.("done")
      } else {
        setError(result.error || "Analysis failed")
        onStatusChange?.("error")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
      onStatusChange?.("error")
    } finally {
      setLoading(false)
    }
  }, [dashboardData, onStatusChange])

  // Auto-start analysis on mount
  useEffect(() => {
    if (!analysis && !loading && !error) {
      handleAnalyze()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ padding: "16px" }}>
      {loading && (
        <div style={{ textAlign: "center", paddingTop: 40, paddingBottom: 40 }}>
          <Loader2 size={24} color="#7C3AED" style={{ animation: "spin 1s linear infinite" }} />
          <p style={{ fontSize: 12, color: "#64748b", marginTop: 10 }}>Menganalisis data dashboard...</p>
        </div>
      )}

      {error && (
        <div style={{
          background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
          padding: "12px 16px", marginBottom: 12,
        }}>
          <p style={{ fontSize: 12, color: "#DC2626", margin: 0, fontWeight: 500 }}>
            Error: {error}
          </p>
          <button onClick={handleAnalyze} style={{
            marginTop: 8, fontSize: 11, color: "#7C3AED", background: "none",
            border: "none", cursor: "pointer", fontWeight: 600, padding: 0,
          }}>
            Coba lagi →
          </button>
        </div>
      )}

      {analysis && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Section icon={<FileText size={13} />} title="Ringkasan" color="#3B82F6">
            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0 }}>
              {stringify(analysis.summary)}
            </p>
          </Section>

          <Section icon={<TrendingUp size={13} />} title="Key Insights" color="#10B981">
            <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 4 }}>
              {analysis.insights?.map((insight, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.5 }}>{stringify(insight)}</li>
              ))}
            </ul>
          </Section>

          <Section icon={<Lightbulb size={13} />} title="Rekomendasi" color="#F59E0B">
            <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 4 }}>
              {analysis.recommendations?.map((rec, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.5 }}>{stringify(rec)}</li>
              ))}
            </ul>
          </Section>

          <Section icon={<AlertTriangle size={13} />} title="Risiko" color="#EF4444">
            <ul style={{ margin: 0, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 4 }}>
              {analysis.risks?.map((risk, i) => (
                <li key={i} style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.5 }}>{stringify(risk)}</li>
              ))}
            </ul>
          </Section>

          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              marginTop: 4, background: "#F8FAFC", border: "1px solid #E2E8F0",
              borderRadius: 6, padding: "6px 12px", fontSize: 11, fontWeight: 600,
              color: "#64748b", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            ↻ Analisis Ulang
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: "#FAFBFC", border: "1px solid #F0F0F0", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
        <div style={{
          width: 20, height: 20, borderRadius: 5, background: `${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center", color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b" }}>{title}</span>
      </div>
      {children}
    </div>
  )
}
