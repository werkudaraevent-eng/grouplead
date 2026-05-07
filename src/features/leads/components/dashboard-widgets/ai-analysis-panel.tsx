"use client"

import { useState } from "react"
import { analyzeDashboard, type DashboardAnalysis } from "@/app/actions/ai-actions"
import { Sparkles, X, Loader2, TrendingUp, AlertTriangle, Lightbulb, FileText } from "lucide-react"

/** Safely convert any AI response item to a renderable string */
function stringify(val: unknown): string {
  if (typeof val === "string") return val
  if (val && typeof val === "object") {
    const obj = val as Record<string, unknown>
    // Common patterns: {title, description}, {point}, {text}
    if (obj.title && obj.description) return `${obj.title}: ${obj.description}`
    if (obj.title) return String(obj.title)
    if (obj.text) return String(obj.text)
    if (obj.point) return String(obj.point)
    return JSON.stringify(val)
  }
  return String(val ?? "")
}

interface AIAnalysisPanelProps {
  dashboardData: Record<string, unknown>
  onClose: () => void
}

export function AIAnalysisPanel({ dashboardData, onClose }: AIAnalysisPanelProps) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<DashboardAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await analyzeDashboard(dashboardData)
      if (result.success && result.data) {
        setAnalysis(result.data)
      } else {
        setError(result.error || "Analysis failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, bottom: 0, width: 420,
      background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,.08)",
      zIndex: 50, display: "flex", flexDirection: "column",
      borderLeft: "1px solid #e5e7eb",
      animation: "slideInRight .25s cubic-bezier(0.23, 1, 0.32, 1)",
    }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", borderBottom: "1px solid #f0f0f0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: "linear-gradient(135deg, #8B5CF6, #6366F1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>AI Analysis</span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 4, borderRadius: 4, color: "#94a3b8",
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
        {!analysis && !loading && !error && (
          <div style={{ textAlign: "center", paddingTop: 60 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
              background: "linear-gradient(135deg, #EDE9FE, #E0E7FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Sparkles size={24} color="#7C3AED" />
            </div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", margin: "0 0 6px" }}>
              Analyze Dashboard dengan AI
            </p>
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 20px", lineHeight: 1.5 }}>
              AI akan menganalisis data KPI, revenue, pipeline, dan goal kamu untuk memberikan insights dan rekomendasi.
            </p>
            <button
              onClick={handleAnalyze}
              style={{
                background: "linear-gradient(135deg, #7C3AED, #6366F1)",
                color: "#fff", border: "none", borderRadius: 8,
                padding: "10px 20px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                transition: "transform .1s ease, box-shadow .15s ease",
                boxShadow: "0 2px 8px rgba(124,58,237,.25)",
              }}
              onMouseDown={e => (e.currentTarget.style.transform = "scale(0.97)")}
              onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} /> Mulai Analisis
              </span>
            </button>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <Loader2 size={28} color="#7C3AED" style={{ animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>Menganalisis data dashboard...</p>
          </div>
        )}

        {error && (
          <div style={{
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8,
            padding: "12px 16px", marginBottom: 16,
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
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Summary */}
            <Section icon={<FileText size={14} />} title="Ringkasan" color="#3B82F6">
              <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                {stringify(analysis.summary)}
              </p>
            </Section>

            {/* Insights */}
            <Section icon={<TrendingUp size={14} />} title="Key Insights" color="#10B981">
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {analysis.insights?.map((insight, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{stringify(insight)}</li>
                ))}
              </ul>
            </Section>

            {/* Recommendations */}
            <Section icon={<Lightbulb size={14} />} title="Rekomendasi" color="#F59E0B">
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {analysis.recommendations?.map((rec, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{stringify(rec)}</li>
                ))}
              </ul>
            </Section>

            {/* Risks */}
            <Section icon={<AlertTriangle size={14} />} title="Risiko & Perhatian" color="#EF4444">
              <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {analysis.risks?.map((risk, i) => (
                  <li key={i} style={{ fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{stringify(risk)}</li>
                ))}
              </ul>
            </Section>

            {/* Re-analyze button */}
            <button
              onClick={handleAnalyze}
              style={{
                marginTop: 8, background: "#F8FAFC", border: "1px solid #E2E8F0",
                borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600,
                color: "#64748b", cursor: "pointer", fontFamily: "inherit",
                transition: "all .15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; e.currentTarget.style.color = "#7C3AED" }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.color = "#64748b" }}
            >
              ↻ Analisis Ulang
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// ─── Section helper ─────────────────────────────────────────────────────────

function Section({ icon, title, color, children }: {
  icon: React.ReactNode
  title: string
  color: string
  children: React.ReactNode
}) {
  return (
    <div style={{
      background: "#FAFBFC", border: "1px solid #F0F0F0", borderRadius: 10,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 6, background: `${color}15`,
          display: "flex", alignItems: "center", justifyContent: "center", color,
        }}>
          {icon}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>{title}</span>
      </div>
      {children}
    </div>
  )
}
