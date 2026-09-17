import type { Metadata } from "next"
import { resolveBoardToken } from "@/lib/board/board-access"
import { getBoardSnapshot } from "@/lib/board/board-queries"
import { parseBoardOptions } from "@/lib/board/board-options"
import { canPerform, getSalesMissionAccess } from "@/lib/sales-mission-access"
import { hasServiceClientConfig } from "@/utils/supabase/service"
import { BoardView } from "./board-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Papan Sales Activity",
  // A board URL carries a credential. Keeping it out of search indexes is the
  // cheapest part of not leaking it.
  robots: { index: false, follow: false },
}

function Refusal({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--board-surface)] px-8 text-center text-[var(--board-on-surface)]">
      <div>
        <p className="text-base text-[var(--board-on-surface-variant)]">Sales Activity</p>
        <h1 className="mt-3 text-3xl font-medium">{title}</h1>
        <p className="mt-3 max-w-md text-[var(--board-on-surface-variant)]">{body}</p>
      </div>
    </main>
  )
}

/**
 * The screen.
 *
 * Two ways in. A screen holds a token: the token decides the tenant and
 * whether client names show, and the URL decides the rest (range, people,
 * places, panels). A signed-in admin opens the same route from the dashboard
 * to see what a screen would show, with their session as the credential; that
 * preview may show names, because they can read them everywhere else anyway.
 *
 * Refreshes by reloading on a timer rather than subscribing to realtime. A TV
 * does not need sub-second updates, and a full reload survives the office
 * network dropping for a minute in a way a socket does not.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const token = Array.isArray(params.token) ? params.token[0] : params.token
  const options = parseBoardOptions(params)

  if (!hasServiceClientConfig()) {
    return (
      <Refusal
        title="Papan belum dikonfigurasi"
        body="Deployment ini belum punya SUPABASE_SERVICE_ROLE_KEY. Minta admin menambahkannya di Vercel lalu deploy ulang."
      />
    )
  }

  let companyId: string | null = null
  let masked = true
  let screenLabel: string | null = null
  let preview = false

  if (token) {
    const resolved = await resolveBoardToken(token, "screen")
    if (resolved) {
      companyId = resolved.companyId
      masked = !resolved.showClientNames
      screenLabel = resolved.label
    }
  } else {
    const access = await getSalesMissionAccess()
    if (access && (await canPerform(access, "sales_mission_mission", "read"))) {
      companyId = access.companyId
      masked = params.names !== "1"
      preview = true
    }
  }

  if (!companyId) {
    return (
      <Refusal
        title="Papan tidak dapat dibuka"
        body="Tautan papan tidak berlaku, sudah dicabut, atau kedaluwarsa. Minta admin membuat tautan baru dari Papan live."
      />
    )
  }

  const now = new Date()
  const snapshot = await getBoardSnapshot(companyId, now, {
    masked,
    range: options.range,
    sales: options.sales,
    location: options.location,
  })

  return (
    <>
      {/* Data is a minute old at most. The clock ticks on its own, and a long list keeps its scroll position across the reload. */}
      <meta httpEquiv="refresh" content="60" />
      <BoardView
        snapshot={snapshot}
        now={now}
        panels={options.panels.filter((panel) => panel !== "activity")}
        preview={preview}
        masked={masked}
        screenLabel={screenLabel}
      />
    </>
  )
}
