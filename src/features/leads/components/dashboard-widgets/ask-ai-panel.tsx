"use client"

import { useState, useRef, useEffect } from "react"
import { askAI, type AskAIResponse } from "@/app/actions/ai-actions"
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

/** Simple markdown-to-JSX renderer for AI responses */
function renderMarkdown(text: string) {
  // Split by lines, process each
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []

  lines.forEach((line, li) => {
    // Bullet points
    if (line.match(/^\s*[\*\-]\s+/)) {
      const content = line.replace(/^\s*[\*\-]\s+/, "")
      elements.push(<div key={li} style={{ display: "flex", gap: 6, marginLeft: 4 }}>
        <span style={{ color: "#94a3b8" }}>•</span>
        <span>{inlineFormat(content)}</span>
      </div>)
    }
    // Numbered list
    else if (line.match(/^\s*\d+\.\s+/)) {
      const match = line.match(/^(\s*\d+\.)\s+(.*)/)
      elements.push(<div key={li} style={{ display: "flex", gap: 6, marginLeft: 4 }}>
        <span style={{ color: "#64748b", fontWeight: 600, minWidth: 18 }}>{match?.[1]}</span>
        <span>{inlineFormat(match?.[2] || "")}</span>
      </div>)
    }
    // Empty line = spacing
    else if (line.trim() === "") {
      elements.push(<div key={li} style={{ height: 6 }} />)
    }
    // Normal paragraph
    else {
      elements.push(<div key={li}>{inlineFormat(line)}</div>)
    }
  })

  return <>{elements}</>
}

/** Process inline formatting: **bold**, *italic*, `code` */
function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    if (match[2]) {
      // **bold**
      parts.push(<strong key={match.index} style={{ fontWeight: 700 }}>{match[2]}</strong>)
    } else if (match[3]) {
      // *italic*
      parts.push(<em key={match.index}>{match[3]}</em>)
    } else if (match[4]) {
      // `code`
      parts.push(<code key={match.index} style={{
        background: "#F1F5F9", padding: "1px 4px", borderRadius: 3,
        fontSize: "0.9em", fontFamily: "monospace",
      }}>{match[4]}</code>)
    }
    lastIndex = match.index + match[0].length
  }
  // Remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts.length > 0 ? <>{parts}</> : text
}

interface AskAIPanelProps {
  dashboardData: Record<string, unknown>
  onClose: () => void
}

export function AskAIPanel({ dashboardData, onClose }: AskAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = async () => {
    const question = input.trim()
    if (!question || loading) return

    setInput("")
    setMessages(prev => [...prev, { role: "user", content: question }])
    setLoading(true)

    try {
      const result = await askAI(question, dashboardData)
      if (result.success && result.data) {
        setMessages(prev => [...prev, { role: "assistant", content: result.data!.answer }])
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${result.error || "Gagal mendapatkan jawaban"}` }])
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Terjadi error, coba lagi." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const suggestedQuestions = [
    "Bagaimana performa revenue bulan ini?",
    "Lead source mana yang paling efektif?",
    "Apa yang perlu diperbaiki di pipeline?",
    "Bandingkan win rate vs quarter lalu",
  ]

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
            background: "linear-gradient(135deg, #06B6D4, #3B82F6)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageCircle size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>Ask AI</span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 4, borderRadius: 4, color: "#94a3b8",
        }}>
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: 20 }}>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px", fontWeight: 500 }}>
              Tanya apa saja tentang data dashboard kamu:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  style={{
                    background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8,
                    padding: "8px 12px", fontSize: 12, color: "#475569",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    transition: "all .15s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.background = "#EFF6FF" }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#E2E8F0"; e.currentTarget.style.background = "#F8FAFC" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            display: "flex", gap: 8,
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: msg.role === "user" ? "#EFF6FF" : "#F0FDF4",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {msg.role === "user" ? <User size={12} color="#3B82F6" /> : <Bot size={12} color="#10B981" />}
            </div>
            <div style={{
              background: msg.role === "user" ? "#EFF6FF" : "#F8FAFC",
              border: `1px solid ${msg.role === "user" ? "#BFDBFE" : "#F0F0F0"}`,
              borderRadius: 10, padding: "10px 14px",
              maxWidth: "80%",
            }}>
              <div style={{
                fontSize: 12.5, color: "#1e293b", margin: 0, lineHeight: 1.6,
              }}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={12} color="#10B981" />
            </div>
            <div style={{
              background: "#F8FAFC", border: "1px solid #F0F0F0",
              borderRadius: 10, padding: "10px 14px",
            }}>
              <Loader2 size={14} color="#64748b" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "12px 20px 16px", borderTop: "1px solid #f0f0f0",
        display: "flex", gap: 8, alignItems: "center",
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tanya tentang dashboard..."
          disabled={loading}
          style={{
            flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0",
            borderRadius: 8, padding: "10px 14px", fontSize: 13,
            color: "#1e293b", fontFamily: "inherit", outline: "none",
            transition: "border-color .15s ease",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#3B82F6")}
          onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            width: 36, height: 36, borderRadius: 8, border: "none",
            background: input.trim() ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#E2E8F0",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: input.trim() ? "pointer" : "not-allowed",
            transition: "all .15s ease",
          }}
        >
          <Send size={14} color={input.trim() ? "#fff" : "#94a3b8"} />
        </button>
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
