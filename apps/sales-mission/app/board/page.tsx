import type { Metadata } from "next"
import { resolveBoardToken } from "@/lib/board/board-access"
import { getBoardSnapshot } from "@/lib/board/board-queries"
import { BoardView } from "./board-view"
import { hasServiceClientConfig } from "@/utils/supabase/service"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Papan Sales Mission",
  // A board URL carries a credential. Keeping it out of search indexes is the
  // cheapest part of not leaking it.
  robots: { index: false, follow: false },
}

/**
 * TV board.
 *
 * Opened by a screen holding a token, never by a signed-in person, so client
 * identity is masked: this hangs where visitors, candidates and vendors walk
 * past, and a photograph of it travels further than anyone intends.
 *
 * Refreshes by reloading on a timer rather than subscribing to realtime. A TV
 * does not need sub-second updates, and a full reload survives the office
 * network dropping for a minute in a way a socket does not.
 */
export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!hasServiceClientConfig()) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--board-bg)] px-8 text-center text-[var(--board-text)]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--board-accent)]">Sales Mission</p>
          <h1 className="mt-3 text-3xl font-bold">Papan belum dikonfigurasi</h1>
          <p className="mt-3 max-w-md text-[var(--board-text-dim)]">
            Deployment ini belum punya SUPABASE_SERVICE_ROLE_KEY. Minta admin menambahkannya di Vercel lalu deploy ulang.
          </p>
        </div>
      </main>
    )
  }

  const resolved = token ? await resolveBoardToken(token) : null

  if (!resolved) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--board-bg)] px-8 text-center text-[var(--board-text)]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--board-accent)]">Sales Mission</p>
          <h1 className="mt-3 text-3xl font-bold">Papan tidak dapat dibuka</h1>
          <p className="mt-3 max-w-md text-[var(--board-text-dim)]">
            Tautan papan tidak berlaku, sudah dicabut, atau kedaluwarsa. Minta admin membuat tautan baru
            dari Pengaturan.
          </p>
        </div>
      </main>
    )
  }

  const now = new Date()
  const snapshot = await getBoardSnapshot(resolved.companyId, now, { masked: true })

  return (
    <>
      {/*
        A document reload is the right tool here and only here: the TV has no
        shell to lose, nobody interacts with it, and a hard reload recovers the
        screen if the page has crashed overnight. The internal board uses
        router.refresh() instead — see app/workspace/board/auto-refresh.tsx.
      */}
      <meta httpEquiv="refresh" content="30" />
      <BoardView snapshot={snapshot} subtitle={resolved.label} now={now} />
    </>
  )
}
