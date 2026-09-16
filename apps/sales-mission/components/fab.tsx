import Link from "next/link"
import { Plus } from "@/components/icons"
import { cn } from "@/lib/utils"
import { CoachMark } from "@/components/coach-mark"

export interface FabHint {
  key: string
  title: string
  body: string
  learnHref?: string
}

/**
 * Material's extended FAB: the one primary action of a screen, on a phone.
 *
 * Bottom-right, 16dp from the edges, floating above the navigation bar
 * (whose height is 80dp plus the safe area). Icon and label, 56dp tall,
 * primary container. Hidden from `lg` up, where the same action is a filled
 * button in the page header.
 */
export function Fab({ href, label, className, hint }: { href: string; label: string; className?: string; hint?: FabHint }) {
  const link = (
    <Link
      href={href}
      className={cn(
        "fixed right-4 z-30 inline-flex h-14 items-center gap-3 rounded-2xl bg-primary pl-4 pr-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.97] lg:hidden",
        "bottom-[calc(5rem+env(safe-area-inset-bottom)+1rem)]",
        className
      )}
    >
      <Plus className="h-6 w-6" aria-hidden="true" />
      {label}
    </Link>
  )
  if (!hint) return link
  return (
    <CoachMark hintKey={hint.key} title={hint.title} body={hint.body} learnHref={hint.learnHref} side="top" align="end">
      {link}
    </CoachMark>
  )
}
