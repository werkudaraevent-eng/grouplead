"use client"

import { X } from "@/components/icons"
import { useDismissHint, useHintSeen } from "@/components/coach-mark"
import { cn } from "@/lib/utils"

/**
 * A list page's description, shown until the person closes it.
 *
 * The sentence under a list's title teaches (what the list holds, whose
 * rows you see, what a yellow edge means). A newcomer needs it once; on
 * every later visit it is two lines between the title and the records.
 * M3 keeps supporting text that has done its job out of the way, and the
 * product already teaches once per account, on every device, through the
 * coach marks, so the description follows the same rule and the same
 * store: it shows with a ✕ ("Tutup") at its end until closed, and closing
 * it writes the key to `sales_mission.user_hints` (with localStorage for a
 * close that never reaches the server), so it stays closed on the person's
 * phone and laptop alike. The key is per list (`list-intro-<list>`).
 */
export function ListIntro({ hintKey, children, className }: { hintKey: string; children: React.ReactNode; className?: string }) {
  const seen = useHintSeen(hintKey)
  const dismiss = useDismissHint()
  if (seen) return null
  return (
    <div className={cn("flex max-w-3xl items-start gap-1", className)}>
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</p>
      <button
        type="button"
        onClick={() => dismiss(hintKey)}
        aria-label="Tutup keterangan"
        title="Tutup"
        // Centred on the first line without making the line taller.
        className="-my-2.5 grid h-10 w-10 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:-my-1.5 md:h-8 md:w-8"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
