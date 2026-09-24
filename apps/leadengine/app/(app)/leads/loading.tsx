export default function LeadsLoading() {
    return (
        // `data-fluid-phone`, as the Pipeline itself: below `md` the skeleton
        // has the phone's width, never the shell's 900px floor.
        <div data-fluid-phone>
            {/* Phone: the stage tabs and the lead cards the page opens on. */}
            <div className="md:hidden" aria-hidden="true">
                <div className="flex h-[49px] items-center gap-6 border-b border-border bg-background px-4">
                    {[88, 112, 96].map((width) => (
                        <span key={width} className="flex flex-col gap-1.5">
                            <span className="block h-3 animate-pulse rounded bg-muted" style={{ width }} />
                            <span className="block h-2.5 w-10 animate-pulse rounded bg-muted" />
                        </span>
                    ))}
                </div>
                <div className="space-y-3 px-4 pt-3">
                    <div className="h-11 animate-pulse rounded-md bg-muted" />
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-[154px] animate-pulse rounded-xl border border-border bg-card" />
                    ))}
                </div>
            </div>
            <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4 max-md:hidden">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <div className="h-7 w-32 bg-muted animate-pulse rounded-md" />
                        <div className="h-4 w-56 bg-muted animate-pulse rounded-md" />
                    </div>
                    <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
                </div>
                <div className="h-10 w-full bg-muted animate-pulse rounded-lg" />
                <div className="space-y-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="h-[52px] bg-card border-b border-border animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    )
}
