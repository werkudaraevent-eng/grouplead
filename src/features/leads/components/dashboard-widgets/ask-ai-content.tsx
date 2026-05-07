"use client"

import { useState, useRef, useEffect } from "react"
import { askAI } from "@/app/actions/ai-actions"
import { Send, Loader2, Bot, User } from "lucide-react"

interface Message {
  role: "user" | "assistant"
  content: string
}

/** Simple markdown-to-JSX renderer for AI responses */
function renderMarkdown(text: string) {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []

  lines.forEach((line, li) => {
    if (line.match(/^\s*[\*\-]\s+/)) {
      const content = line.replace(/^\s*[\*\-]\s+/, "")
      elements.push(<div key={li} style={{ display: "flex", gap: 6, marginLeft: 4 }}>
        <span style={{ color: "#94a3b8" }}>•</span>
        <span>{inlineFormat(content)}</span>
      </div>)
    } else if (line.match(/^\s*\d+\.\s+/)) {
      const match = line.match(/^(\s*\d+\.)\s+(.*)/)
      elements.push(<div key={li} style={{ display: "flex", gap: 6, marginLeft: 4 }}>
        <span style={{ color: "#64748b", fontWeight: 600, minWidth: 18 }}>{match?.[1]}</span>
        <span>{inlineFormat(match?.[2] || "")}</span>
      </div>)
    } else if (line.trim() === "") {
      elements.push(<div key={li} style={{ height: 4 }} />)
    } else {
      elements.push(<div key={li}>{inlineFormat(line)}</div>)
    }
  })

  return <>{elements}</>
}

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[2]) parts.push(<strong key={match.index} style={{ fontWeight: 700 }}>{match[2]}</strong>)
    else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>)
    else if (match[4]) parts.push(<code key={match.index} style={{ background: "#F1F5F9", padding: "1px 4px", borderRadius: 3, fontSize: "0.9em" }}>{match[4]}</code>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? <>{parts}</> : text
}

interface AskAIContentProps {
  dashboardData: Record<string, unknown>
}

export function AskAIContent({ dashboardData }: AskAIContentProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => { inputRef.current?.focus() }, [])

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
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Terjadi error, coba lagi." }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const suggestedQuestions = [
    "Bagaimana performa revenue bulan ini?",
    "Lead source mana yang paling efektif?",
    "Apa yang perlu diperbaiki di pipeline?",
    "Bandingkan win rate vs quarter lalu",
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 300 }}>
      {/* Messages */}
      <div style={{ flex: 1, overflow: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ paddingTop: 8 }}>
            <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 8px", fontWeight: 500 }}>
              Tanya tentang data dashboard:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setInput(q); inputRef.current?.focus() }}
                  style={{
                    background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 6,
                    padding: "6px 10px", fontSize: 11, color: "#475569",
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
            display: "flex", gap: 6,
            flexDirection: msg.role === "user" ? "row-reverse" : "row",
          }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0,
              background: msg.role === "user" ? "#EFF6FF" : "#F0FDF4",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {msg.role === "user" ? <User size={10} color="#3B82F6" /> : <Bot size={10} color="#10B981" />}
            </div>
            <div style={{
              background: msg.role === "user" ? "#EFF6FF" : "#F8FAFC",
              border: `1px solid ${msg.role === "user" ? "#BFDBFE" : "#F0F0F0"}`,
              borderRadius: 8, padding: "8px 10px",
              maxWidth: "85%",
            }}>
              <div style={{ fontSize: 11.5, color: "#1e293b", lineHeight: 1.6 }}>
                {msg.role === "assistant" ? renderMarkdown(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 6 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 5, flexShrink: 0,
              background: "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Bot size={10} color="#10B981" />
            </div>
            <div style={{ background: "#F8FAFC", border: "1px solid #F0F0F0", borderRadius: 8, padding: "8px 10px" }}>
              <Loader2 size={12} color="#64748b" style={{ animation: "spin 1s linear infinite" }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: "8px 14px 10px", borderTop: "1px solid #f0f0f0",
        display: "flex", gap: 6, alignItems: "center",
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
            borderRadius: 6, padding: "7px 10px", fontSize: 12,
            color: "#1e293b", fontFamily: "inherit", outline: "none",
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "#3B82F6")}
          onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          style={{
            width: 30, height: 30, borderRadius: 6, border: "none",
            background: input.trim() ? "linear-gradient(135deg, #3B82F6, #2563EB)" : "#E2E8F0",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: input.trim() ? "pointer" : "not-allowed",
          }}
        >
          <Send size={12} color={input.trim() ? "#fff" : "#94a3b8"} />
        </button>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
