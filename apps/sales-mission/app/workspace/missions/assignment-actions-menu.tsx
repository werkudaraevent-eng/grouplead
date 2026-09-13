"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CalendarClock, Check, Loader2, MoreHorizontal, X } from "lucide-react"
import { respondToAssignment } from "@/app/actions/assignment-actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Answer an assignment from wherever the mission is listed.
 *
 * Material's rule for a row that needs a decision: the primary action is a
 * real button in the row, the rest sit behind an overflow menu. Before this,
 * the only way to accept was to open the detail page and scroll to the
 * bottom, and the list showed a shouting "PERLU JAWABAN ANDA" pill that could
 * not be pressed.
 *
 * Terima is one tap. Tolak and Minta jadwal ulang carry information, so they
 * get a menu: Tolak confirms inline, and the reschedule form lives on the
 * detail page where there is room for a date and a reason.
 */
export function AcceptAssignmentButton({
  missionId,
  size = "sm",
  className,
}: {
  missionId: string
  size?: "sm" | "default"
  className?: string
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const accept = () => {
    start(async () => {
      const result = await respondToAssignment(missionId, "ACCEPTED")
      if (result.success) {
        toast.success("Penugasan diterima")
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal menyimpan jawaban")
      }
    })
  }

  return (
    <Button size={size} onClick={accept} disabled={pending} className={className}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      Terima
    </Button>
  )
}

export function AssignmentOverflowMenu({ missionId }: { missionId: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const reject = () => {
    start(async () => {
      const result = await respondToAssignment(missionId, "REJECTED")
      if (result.success) {
        toast.success("Penugasan ditolak")
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal menyimpan jawaban")
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 md:h-8 md:w-8"
          aria-label="Jawaban lain"
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/workspace/missions/${missionId}#jawaban`}>
            <CalendarClock className="h-4 w-4" /> Minta jadwal ulang
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={reject} className="text-[var(--danger-foreground)] focus:text-[var(--danger-foreground)]">
          <X className="h-4 w-4" /> Tolak penugasan
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
