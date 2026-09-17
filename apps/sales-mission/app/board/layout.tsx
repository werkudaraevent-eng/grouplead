import { Roboto_Flex } from "next/font/google"
import { cn } from "@/lib/utils"

/**
 * The screen's own shell.
 *
 * The font is loaded here rather than in the root layout because it is for the
 * wall only: the app keeps Plus Jakarta Sans, and nobody using the app pays for
 * a face they never see. Roboto Flex is Material's own reference face, it is
 * variable on the optical-size axis (the 2.3em times get the display cut, the
 * 0.85em column labels the text cut, from one file), and it carries tabular
 * figures — which is why the board has no monospace any more. A column of mono
 * numerals reads as a terminal; a departures board sets its times in the same
 * face as its words, just with equal-width digits.
 */
const boardFont = Roboto_Flex({ subsets: ["latin"], axes: ["opsz"], display: "swap" })

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(boardFont.className, "board-root min-h-dvh bg-[var(--board-surface)] text-[var(--board-on-surface)]")}
      style={{ colorScheme: "dark" }}
    >
      {/* The root layout paints `<html>` light with an inline style, which a
          stylesheet rule cannot beat — so the page would flash light on every
          one of the board's minute reloads without this. */}
      <style>{"html, body { background: var(--board-surface) !important; }"}</style>
      {children}
    </div>
  )
}
