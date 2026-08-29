"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DoorOpen, Loader2, Lock, LockOpen, UserMinus, UserPlus } from "lucide-react"
import {
  joinMission,
  leaveMission,
  removeSupportingSales,
  setMissionAllowJoin,
} from "@/app/actions/assignment-actions"
import { canJoin, joinBlockedReason, type JoinStatus } from "@/lib/missions/mission-join"
import { Button } from "@/components/ui/button"

/**
 * Join and team controls.
 *
 * The button is disabled for exactly the statuses the server also refuses, and
 * the reason is shown rather than left to guesswork — a greyed-out control with
 * no explanation reads as a bug.
 */
export function JoinButton({
  missionId,
  status,
  maxSupporting,
  size = "sm",
}: {
  missionId: string
  status: JoinStatus
  maxSupporting: number
  size?: "sm" | "default"
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  if (status === "ASSIGNED") return null

  const blocked = joinBlockedReason(status, maxSupporting)

  const handleJoin = () => {
    start(async () => {
      const result = await joinMission(missionId)
      if (result.success) {
        toast.success("Kamu bergabung ke mission ini")
        router.refresh()
      } else {
        toast.error(result.error ?? "Gagal bergabung")
      }
    })
  }

  return (
    <Button
      size={size}
      variant={canJoin(status) ? "default" : "outline"}
      disabled={!canJoin(status) || pending}
      onClick={handleJoin}
      title={blocked ?? undefined}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
      Join
    </Button>
  )
}

export function LeaveButton({ missionId }: { missionId: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await leaveMission(missionId)
          if (result.success) {
            toast.success("Kamu keluar dari mission ini")
            router.refresh()
          } else {
            toast.error(result.error ?? "Gagal keluar")
          }
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <DoorOpen className="h-4 w-4" />}
      Keluar
    </Button>
  )
}

export function RemoveMemberButton({ missionId, userId, name }: { missionId: string; userId: string; name: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      disabled={pending}
      aria-label={`Keluarkan ${name}`}
      title={`Keluarkan ${name}`}
      onClick={() =>
        start(async () => {
          const result = await removeSupportingSales(missionId, userId)
          if (result.success) {
            toast.success(`${name} dikeluarkan dari mission`)
            router.refresh()
          } else {
            toast.error(result.error ?? "Gagal mengeluarkan anggota")
          }
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
    </Button>
  )
}

/** Primary's veto over who may still join a sensitive meeting. */
export function AllowJoinToggle({ missionId, allowJoin }: { missionId: string; allowJoin: boolean }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setMissionAllowJoin(missionId, !allowJoin)
          if (result.success) {
            toast.success(allowJoin ? "Mission ditutup dari join" : "Mission dibuka untuk join")
            router.refresh()
          } else {
            toast.error(result.error ?? "Gagal menyimpan pengaturan")
          }
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : allowJoin ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
      {allowJoin ? "Tutup dari join" : "Buka untuk join"}
    </Button>
  )
}
