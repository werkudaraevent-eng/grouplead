"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Send, Sparkles } from "@/components/icons"
import { askSalesData } from "@/app/actions/ai-ask-actions"
import { Button } from "@/components/ui/button"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { ChipRow, ChoiceChip } from "@/components/ui/choice-chip"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCompact } from "@/hooks/use-compact"

interface Turn {
  question: string
  answer: string
}

const SUGGESTIONS = [
  "Sales mana yang paling banyak laporan?",
  "Industri apa yang paling sering dikunjungi?",
  "Berapa laporan peluang, dan siapa saja?",
  "Klien mana yang paling sering dikunjungi?",
]

const TITLE = "Tanya AI"
const DESCRIPTION = "Tentang periode dan sales yang sedang disaring di Ringkasan."

/**
 * Tanya AI in a supporting pane (M3 canonical layout): a side sheet on a
 * desk, a bottom sheet on a phone, opened from one button on the toolbar
 * whose period and people it answers about, so the board stays the page
 * (Gemini in Workspace, Einstein Copilot, Power BI Copilot). The answers
 * read top to bottom with the field at the foot, marked as the model's;
 * the last few turns are kept so "dan bulan lalu?" reads in context, and
 * the conversation survives closing the pane. Suggestions are chips
 * because the useful questions are few and the same every week (Ask
 * Attio, Pipedrive Sales Assistant, Zia). Nothing here changes data.
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
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, start] = useTransition()
  const log = useRef<HTMLDivElement | null>(null)

  // The pane's own scroller goes to the newest answer; the page does not move.
  useEffect(() => {
    let node: HTMLElement | null = log.current
    while (node && !/(auto|scroll)/.test(getComputedStyle(node).overflowY)) node = node.parentElement
    if (node) node.scrollTop = node.scrollHeight
  }, [turns.length, pending, open])

  const ask = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    start(async () => {
      const result = await askSalesData({
        question: trimmed,
        range,
        sales,
        history: turns.slice(-3).map((turn) => ({ question: turn.question, answer: turn.answer })),
      })
      if (result.success && result.data) {
        setTurns((current) => [...current, { question: trimmed, answer: result.data!.answer }])
        setQuestion("")
      } else {
        toast.error(result.error ?? "AI tidak bisa menjawab.")
      }
    })
  }

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
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{turn.answer}</p>
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
        placeholder="Misal: siapa yang belum ada laporan minggu ini?"
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
        <div ref={log} className="px-4 pt-1">
          {conversation}
        </div>
      </BottomSheet>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-md" aria-busy={pending}>
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tonal)] text-[var(--tonal-foreground)]" aria-hidden="true">
              <Sparkles className="h-4 w-4" />
            </span>
            {TITLE}
          </SheetTitle>
          <SheetDescription>{DESCRIPTION}</SheetDescription>
        </SheetHeader>
        <div ref={log} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {conversation}
        </div>
        <SheetFooter className="border-t">{form}</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
