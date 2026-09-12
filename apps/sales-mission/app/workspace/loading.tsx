/**
 * Loading state for every workspace page.
 *
 * All of these pages are `force-dynamic` and await Supabase before rendering.
 * Without a boundary, moving between them on a field connection leaves the
 * previous screen frozen with no sign that anything is happening — which reads
 * as a broken app rather than a slow one.
 *
 * The shape mirrors WorkspacePage (header block, then content) so the skeleton
 * settles into the real layout instead of jumping.
 */
export default function WorkspaceLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background" role="status" aria-live="polite">
      <span className="sr-only">Memuat halaman…</span>

      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="h-6 w-56 animate-pulse rounded bg-muted" />
            <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted" />
        </div>
      </div>

      <div className="flex-1 space-y-4 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  )
}
