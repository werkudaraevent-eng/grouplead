import type { Metadata } from "next"
import { resolveBoardToken } from "@/lib/board/board-access"
import { getBoardSnapshot } from "@/lib/board/board-queries"
import { BoardView } from "./board-view"

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
  const resolved = token ? await resolveBoardToken(token) : null

  if (!resolved) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#0d1117] px-8 text-center text-white">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#F9BB46]">Sales Mission</p>
          <h1 className="mt-3 text-3xl font-bold">Papan tidak dapat dibuka</h1>
          <p className="mt-3 max-w-md text-white/50">
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
      {/* No client component needed for a page that only has to reload itself. */}
      <meta httpEquiv="refresh" content="30" />
      <BoardView snapshot={snapshot} subtitle={resolved.label} now={now} />
    </>
  )
}
