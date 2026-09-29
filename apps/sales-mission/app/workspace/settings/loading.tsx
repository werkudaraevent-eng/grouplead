/**
 * Loading state for a settings page, inside the settings frame: the menu
 * stays where it is and only the column beside it waits. Same shape as
 * `WorkspacePage` in a settings column (the 56dp title row, a line of
 * description, then cards), at the column's own width.
 */
export default function SettingsLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-clip bg-background" role="status" aria-live="polite">
      <span className="sr-only">Memuat halaman…</span>
      <div className="shrink-0 px-4 pb-3 pt-3 sm:px-6 lg:px-8 lg:pt-0">
        <div className="space-y-3 lg:max-w-settings lg:space-y-0">
          <div className="hidden min-h-14 items-center lg:flex">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-4 w-72 max-w-full animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="flex-1 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="space-y-4 lg:max-w-settings">
          <div className="h-40 animate-pulse rounded-xl border bg-card" />
          <div className="h-56 animate-pulse rounded-xl border bg-card" />
        </div>
      </div>
    </div>
  )
}
