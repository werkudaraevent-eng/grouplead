"use client"

import { useEffect, useState } from "react"
import { MISSION_TIME_ZONE } from "@/lib/missions/mission-schema"

/**
 * The wall's clock, ticking on the client. The page reloads for data once
 * a minute; the clock should not wait for that, or it reads a minute slow
 * half the time. Small, because nobody looks at a wall to learn the time.
 */
export function BoardClock({ initial, className }: { initial: string; className?: string }) {
  const [text, setText] = useState(initial)
  useEffect(() => {
    const format = new Intl.DateTimeFormat("id-ID", { timeZone: MISSION_TIME_ZONE, hour: "2-digit", minute: "2-digit" })
    const tick = () => setText(format.format(new Date()))
    tick()
    const timer = window.setInterval(tick, 15_000)
    return () => window.clearInterval(timer)
  }, [])
  return (
    <p className={className} suppressHydrationWarning>
      {text}
    </p>
  )
}
