/**
 * A contact's page while it loads, in the page's own layout (DESIGN.md,
 * "Record pages"): on a desk the 56dp header row, the facts under it, the
 * tabs, the rail and one column of sections; below `lg` the header card and
 * the tabs. `data-fluid-page`, as the page itself carries, so the shell's
 * 900px floor never flashes on a phone while it loads.
 */
export default function ContactDetailLoading() {
    const bar = "animate-pulse rounded-md bg-muted"
    return (
        <div data-fluid-page className="min-h-full bg-background" aria-busy="true" aria-label="Loading contact">
            {/* Desk header row and facts */}
            <div className="hidden min-h-14 items-center gap-3 px-8 py-1.5 lg:flex">
                <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                <div className="space-y-1.5">
                    <div className={`${bar} h-3 w-16`} />
                    <div className={`${bar} h-5 w-48`} />
                </div>
                <div className="ml-auto flex gap-2">
                    <div className={`${bar} h-9 w-20`} />
                    <div className={`${bar} h-9 w-28`} />
                    <div className={`${bar} h-9 w-16`} />
                </div>
            </div>
            <div className="hidden space-y-2 pb-4 pl-[5.25rem] lg:block">
                <div className={`${bar} h-4 w-64`} />
                <div className={`${bar} h-4 w-40`} />
            </div>

            {/* Phone header card */}
            <div className="flex items-start gap-4 px-4 pb-4 pt-4 sm:px-6 lg:hidden">
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-full bg-muted" />
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                    <div className={`${bar} h-5 w-3/4`} />
                    <div className={`${bar} h-4 w-1/2`} />
                    <div className={`${bar} h-4 w-2/5`} />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex h-[49px] items-center gap-8 border-b border-border px-8 max-lg:justify-around max-lg:px-4">
                <div className={`${bar} h-4 w-16`} />
                <div className={`${bar} h-4 w-16`} />
            </div>

            <div className="flex gap-8 px-4 pt-4 sm:px-6 lg:px-8 lg:pt-6">
                <div className="hidden w-[220px] shrink-0 space-y-2 lg:block">
                    {[0, 1, 2, 3].map((row) => <div key={row} className={`${bar} h-10`} />)}
                </div>
                <div className="min-w-0 max-w-[840px] flex-1 space-y-6">
                    <div className="h-[132px] animate-pulse rounded-xl border bg-card" />
                    <div className={`${bar} h-5 w-44`} />
                    <div className="h-[320px] animate-pulse rounded-xl border bg-card" />
                </div>
            </div>
        </div>
    )
}
