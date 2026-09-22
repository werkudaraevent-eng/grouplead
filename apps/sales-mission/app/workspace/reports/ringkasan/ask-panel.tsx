"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { History, Loader2, Plus, Send, Sparkles } from "@/components/icons"
import { askSalesData } from "@/app/actions/ai-ask-actions"
import { deleteConversation, getConversation, listConversations } from "@/app/actions/ai-conversation-actions"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { ChipRow, ChoiceChip } from "@/components/ui/choice-chip"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCompact } from "@/hooks/use-compact"
import { parseAnswer, type Inline } from "@/lib/ai/answer-format"
import {
  CONVERSATION_RETENTION_DAYS,
  conversationDateLabel,
  conversationTurnCountLabel,
  isFromToday,
  type AskTurn,
  type ConversationSummary,
} from "@/lib/ai/ask-conversations"
import { cn } from "@/lib/utils"

const SUGGESTIONS = [
  "Kunjungan hari ini ke mana saja?",
  "Siapa yang belum ada laporan?",
  "Sales mana yang paling banyak laporan?",
  "Industri apa yang paling sering dikunjungi?",
  "Ada peluang apa saja, dan nilainya?",
]

const TITLE = "Tanya AI"
const DESCRIPTION = "Tentang periode dan sales yang sedang disaring di Ringkasan."

/**
 * Tanya AI in a supporting pane (M3 canonical layout): a side sheet on a
 * desk, a bottom sheet on a phone, opened from one button on the toolbar
 * whose period and people it answers about, so the board stays the page
 * (Gemini in Workspace, Einstein Copilot, Power BI Copilot). The answers
 * read top to bottom with the field at the foot, marked as the model's.
 * Suggestions are chips because the useful questions are few and the same
 * every week (Ask Attio, Pipedrive Sales Assistant, Zia). Nothing here
 * changes data.
 *
 * The conversation is kept per account, not per sitting: every question and
 * its answer is appended to a row of the person's own, so closing the pane,
 * walking to another page or coming back tomorrow finds the thread again —
 * what a chat pane is expected to do (Copilot, ChatGPT's side panes). The
 * context the model is given comes from that stored thread on the server,
 * never from this component's state. Opening the pane resumes today's most
 * recent thread and otherwise starts empty; **Riwayat** lists the rest as
 * 56dp rows with the tonal selected state on the one being read, and
 * **Percakapan baru** starts a fresh one. Deleting a row is one person
 * throwing away their own note, so it happens on the tap with a toast
 * rather than behind a confirm dialog.
 */
export function AskPanel({
  open,
  onOpenChange,
  range,
  sales,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  range: { from: string; to: string }
  sales: string[]
}) {
  const compact = useCompact()
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<AskTurn[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  // Two waits, because they mean different things: `pending` is the model
  // answering (the pane says so), `busy` is a conversation being opened or thrown away.
  const [pending, start] = useTransition()
  const [busy, startBusy] = useTransition()
  const [resumed, setResumed] = useState(false)
  const log = useRef<HTMLDivElement | null>(null)

  // The pane's own scroller goes to the newest answer; the page does not move.
  useEffect(() => {
    if (historyOpen) return
    let node: HTMLElement | null = log.current
    while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement
    if (node) node.scrollTop = node.scrollHeight
  }, [turns.length, pending, open, historyOpen])

  // First open of the sitting: carry on today's thread if there is one.
  useEffect(() => {
    if (!open || resumed) return
    setResumed(true)
    let cancelled = false
    ;(async () => {
      const list = await listConversations()
      if (cancelled || !list.success || !list.data) return
      setConversations(list.data)
      const latest = list.data[0]
      if (!latest || !isFromToday(latest.updatedAt, new Date())) return
      const found = await getConversation(latest.id)
      if (cancelled || !found.success || !found.data) return
      setTurns(found.data.turns)
      setConversationId(found.data.id)
    })()
    return () => {
      cancelled = true
    }
  }, [open, resumed])

  const refreshHistory = async () => {
    setHistoryLoading(true)
    const list = await listConversations()
    setHistoryLoading(false)
    if (list.success && list.data) setConversations(list.data)
  }

  const showHistory = () => {
    setHistoryOpen(true)
    void refreshHistory()
  }

  const startNew = () => {
    setHistoryOpen(false)
    setTurns([])
    setConversationId(null)
    setQuestion("")
  }

  const resume = (id: string) => {
    startBusy(async () => {
      const found = await getConversation(id)
      if (found.success && found.data) {
        setTurns(found.data.turns)
        setConversationId(found.data.id)
        setHistoryOpen(false)
      } else {
        toast.error(found.error ?? "Percakapan tidak bisa dibuka.")
      }
    })
  }

  const remove = (id: string) => {
    startBusy(async () => {
      const result = await deleteConversation(id)
      if (!result.success) {
        toast.error(result.error ?? "Percakapan tidak bisa dihapus.")
        return
      }
      setConversations((current) => current.filter((item) => item.id !== id))
      if (conversationId === id) {
        setTurns([])
        setConversationId(null)
      }
      toast.success("Percakapan dihapus.")
    })
  }

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    setHistoryOpen(false)
    start(async () => {
      const result = await askSalesData({
        question: trimmed,
        range,
        sales,
        // With a conversation the server takes the context from the stored row; without one
        // (a first question, or a deployment that cannot keep them yet) this sitting is the context.
        ...(conversationId ? { conversationId } : { history: turns.slice(-3).map((turn) => ({ question: turn.question, answer: turn.answer })) }),
      })
      if (result.success && result.data) {
        const answer = result.data.answer
        setTurns((current) => [...current, { question: trimmed, answer, askedAt: new Date().toISOString() }])
        setConversationId(result.data.conversationId)
        setQuestion("")
      } else {
        toast.error(result.error ?? "AI tidak bisa menjawab.")
      }
    })
  }

  /* M3 pane header actions: what the pane can do besides answer, in sentence case, before the content. */
  const actions = (
    <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
      <Button type="button" variant="ghost" size="sm" onClick={startNew} disabled={pending || busy}>
        <Plus className="h-4 w-4" /> Percakapan baru
      </Button>
      <Button
        type="button"
        variant={historyOpen ? "tonal" : "ghost"}
        size="sm"
        aria-pressed={historyOpen}
        onClick={() => (historyOpen ? setHistoryOpen(false) : showHistory())}
        disabled={pending || busy}
      >
        <History className="h-4 w-4" /> Riwayat
      </Button>
    </div>
  )

  const history = (
    <div className="space-y-2 py-2">
      <h3 className="px-2 text-xs font-semibold text-muted-foreground">Percakapan tersimpan</h3>
      {historyLoading ? (
        <p className="flex items-center gap-2 px-2 py-1 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat riwayat…
        </p>
      ) : conversations.length === 0 ? (
        <p className="px-2 py-1 text-sm text-muted-foreground">Belum ada percakapan tersimpan.</p>
      ) : (
        <ul className="space-y-0.5">
          {conversations.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex min-h-14 items-center gap-1 rounded-xl pr-1 transition-colors",
                item.id === conversationId ? "bg-[var(--tonal)] text-[var(--tonal-foreground)]" : "hover:bg-muted"
              )}
            >
              <button type="button" className="flex min-h-14 min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 text-left" onClick={() => resume(item.id)} disabled={pending || busy}>
                <span className="line-clamp-2 text-sm">{item.title}</span>
                <span className={cn("text-xs", item.id === conversationId ? "text-[var(--tonal-foreground)]/80" : "text-muted-foreground")}>
                  {conversationDateLabel(item.updatedAt, new Date())} · {conversationTurnCountLabel(item.turnCount)}
                </span>
              </button>
              <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={() => remove(item.id)} disabled={pending || busy}>
                Hapus
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-2 pt-1 text-xs text-muted-foreground">Percakapan disimpan {CONVERSATION_RETENTION_DAYS} hari, hanya untuk akun Anda.</p>
    </div>
  )

  const conversation = (
    <div className="space-y-4">
      {turns.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Coba tanya:</p>
          <ChipRow>
            {SUGGESTIONS.map((suggestion) => (
              <ChoiceChip key={suggestion} selected={false} onClick={() => ask(suggestion)} disabled={pending}>
                {suggestion}
              </ChoiceChip>
            ))}
          </ChipRow>
        </div>
      )}
      {turns.length > 0 && (
        <ol className="space-y-4">
          {turns.map((turn, index) => (
            <li key={index} className="space-y-1.5">
              <p className="ml-6 rounded-xl rounded-tr-sm bg-[var(--tonal)] px-3 py-2 text-sm text-[var(--tonal-foreground)]">{turn.question}</p>
              <div className="mr-6 space-y-1 px-1">
                <AnswerText text={turn.answer} />
                <p className="text-[11px] text-muted-foreground">Dibuat AI · angkanya sama dengan kartu Ringkasan; cek di sana.</p>
              </div>
            </li>
          ))}
        </ol>
      )}
      {pending && (
        <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> Menghitung jawaban…
        </p>
      )}
    </div>
  )

  const form = (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        ask(question)
      }}
    >
      <Input
        aria-label="Pertanyaan"
        className="h-12 md:h-10"
        maxLength={300}
        placeholder="Misal: besok jam berapa saja ada kunjungan?"
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        disabled={pending}
      />
      <Button type="submit" className="h-12 md:h-10" disabled={pending || question.trim().length < 3} aria-label="Tanya">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        <span className="hidden sm:inline">Tanya</span>
      </Button>
    </form>
  )

  if (compact) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={TITLE} description={DESCRIPTION} footer={form} className="h-[85dvh]">
        {/* The sheet's body is the scroller, so the pane's actions ride along at its top instead of scrolling out of reach. */}
        <div className="sticky top-0 z-10 -mx-2 bg-card">{actions}</div>
        <div ref={log} className="px-4 pt-1">
          {historyOpen ? history : conversation}
        </div>
      </BottomSheet>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md" aria-busy={pending || busy}>
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tonal)] text-[var(--tonal-foreground)]" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </span>
            {TITLE}
          </SheetTitle>
          <SheetDescription>{DESCRIPTION}</SheetDescription>
        </SheetHeader>
        {actions}
        <div ref={log} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {historyOpen ? history : conversation}
        </div>
        <SheetFooter className="border-t">{form}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/** The answer as paragraphs and lists with bold where the model bolded, never raw Markdown marks. */
function AnswerText({ text }: { text: string }) {
  const runs = (items: Inline[]) => items.map((run, index) => (run.strong ? <strong key={index} className="font-semibold">{run.text}</strong> : <span key={index}>{run.text}</span>))
  return (
    <div className="space-y-2 text-sm leading-relaxed text-foreground">
      {parseAnswer(text).map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index}>{runs(block.runs)}</p>
        ) : block.ordered ? (
          <ol key={index} className="list-decimal space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{runs(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={index} className="list-disc space-y-1 pl-5">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{runs(item)}</li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
