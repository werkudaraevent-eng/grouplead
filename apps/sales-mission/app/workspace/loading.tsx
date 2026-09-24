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
    <div className="flex h-full w-full flex-col overflow-clip bg-background" role="status" aria-live="polite">
      <span className="sr-only">Memuat halaman…</span>

      {/* The one 56dp title row, then a line of description. On a phone the
          title is in the top app bar, so only the description shows here. */}
      <div className="shrink-0 space-y-3 px-4 pb-3 pt-3 sm:px-6 lg:space-y-0 lg:px-8 lg:pt-0">
        <div className="hidden min-h-14 items-center justify-between gap-3 lg:flex">
          <div className="h-6 w-56 animate-pulse rounded bg-muted" />
          <div className="h-9 w-32 shrink-0 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
      </div>

      <div className="flex-1 space-y-4 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-xl border bg-card" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  )
}
