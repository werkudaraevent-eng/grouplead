"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Loader2, Send, Sparkles } from "@/components/icons"
import { askSalesData } from "@/app/actions/ai-ask-actions"
import { Button } from "@/components/ui/button"
import { ChipRow, ChoiceChip } from "@/components/ui/choice-chip"
import { Input } from "@/components/ui/input"

interface Turn {
  question: string
  answer: string
  model: string
}

const SUGGESTIONS = [
  "Sales mana yang paling banyak laporan?",
  "Industri apa yang paling sering dikunjungi?",
  "Berapa laporan yang menandai peluang, dan siapa saja?",
  "Klien mana yang paling sering dikunjungi?",
]

/**
 * Tanya AI: one text field and the answers under it, on the period and
 * people the board is showing. The answer is marked as the model's, keeps
 * the last few turns so "dan bulan lalu?" reads in context, and never
 * changes anything. Suggestions are chips because the useful questions are
 * few and the same every week (Ask Attio, Pipedrive Sales Assistant, Zia).
 */
export function AskCard({ range, sales }: { range: { from: string; to: string }; sales: string[] }) {
  const [question, setQuestion] = useState("")
  const [turns, setTurns] = useState<Turn[]>([])
  const [pending, start] = useTransition()

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
        setTurns((current) => [...current, { question: trimmed, answer: result.data!.answer, model: result.data!.model }])
        setQuestion("")
      } else {
        toast.error(result.error ?? "AI tidak bisa menjawab.")
      }
    })
  }

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="ask-title" aria-busy={pending}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 pt-4">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tonal)] text-[var(--tonal-foreground)]" aria-hidden="true">
          <Sparkles className="h-4 w-4" />
        </span>
        <h2 id="ask-title" className="text-base font-semibold text-foreground">Tanya AI</h2>
        <span className="text-xs text-muted-foreground">tentang periode dan sales yang sedang disaring</span>
      </header>

      <div className="space-y-3 px-5 pb-4 pt-3">
        {turns.length > 0 && (
          <ol className="space-y-3">
            {turns.map((turn, index) => (
              <li key={index} className="space-y-1">
                <p className="text-sm font-medium text-foreground">{turn.question}</p>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{turn.answer}</p>
                <p className="text-[11px] text-muted-foreground">Dibuat AI</p>
              </li>
            ))}
          </ol>
        )}
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
        {turns.length === 0 && (
          <ChipRow>
            {SUGGESTIONS.map((suggestion) => (
              <ChoiceChip key={suggestion} selected={false} onClick={() => ask(suggestion)} disabled={pending}>
                {suggestion}
              </ChoiceChip>
            ))}
          </ChipRow>
        )}
        <p className="text-xs text-muted-foreground">Jawaban dihitung dari angka yang sama dengan kartu di bawah; AI bisa keliru, cek angkanya di kartu.</p>
      </div>
    </section>
  )
}
