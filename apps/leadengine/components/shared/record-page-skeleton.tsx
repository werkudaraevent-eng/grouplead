import { cn } from "@/lib/utils"

/**
 * A record's page while it loads, in the page's own layout (DESIGN.md,
 * "Record pages"): on a desk the header (the parent link, a 48dp avatar or
 * tile, the name, the actions, the facts), the tabs, then the main column
 * (composer, Recent activity) beside the 380px side column; below `lg` the
 * centred header with its quick actions, the tabs and the Overview's
 * cards. `data-fluid-page`, as the pages carry, so the shell's 900px
 * floor never flashes on a phone while one loads.
 */
export function RecordPageSkeleton({ label, shape, tabs, quickActions }: {
    label: string
    /** A person is round, an organisation square. */
    shape: "circle" | "square"
    tabs: number
    quickActions: number
}) {
    const bar = "animate-pulse rounded-md bg-muted"
    const card = "animate-pulse rounded-[12px] border border-border bg-card"
    const avatarShape = shape === "circle" ? "rounded-full" : "rounded-[12px]"
    return (
        <div data-fluid-page className="min-h-full bg-background" aria-busy="true" aria-label={label}>
            {/* Desk header */}
            <div className="hidden bg-card px-8 pt-4 lg:block">
                <div className={cn(bar, "h-4 w-24")} />
                <div className="flex items-center justify-between gap-6 pt-3">
                    <div className="flex items-center gap-4">
                        <div className={cn("h-12 w-12 animate-pulse bg-muted", avatarShape)} />
                        <div className="space-y-2">
                            <div className={cn(bar, "h-7 w-60")} />
                            <div className={cn(bar, "h-4 w-72")} />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className={cn(bar, "h-9 w-20 rounded-full")} />
                        {[64, 72, 56, 96].map((width) => <div key={width} className={cn(bar, "h-9 rounded-[8px]")} style={{ width }} />)}
                    </div>
                </div>
                <div className="flex gap-12 pb-5 pl-16 pt-6">
                    {[120, 130, 190, 120].map((width, index) => (
                        <div key={index} className="space-y-1.5">
                            <div className={cn(bar, "h-3 w-14")} />
                            <div className={cn(bar, "h-4")} style={{ width }} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Phone header */}
            <div className="flex flex-col items-center gap-3.5 bg-card px-4 pb-4 pt-5 lg:hidden">
                <div className={cn("h-16 w-16 animate-pulse bg-muted", shape === "circle" ? "rounded-full" : "rounded-[16px]")} />
                <div className="flex flex-col items-center gap-2">
                    <div className={cn(bar, "h-6 w-44")} />
                    <div className={cn(bar, "h-4 w-32")} />
                    <div className={cn(bar, "h-4 w-40")} />
                </div>
                <div className="flex gap-3">
                    {Array.from({ length: quickActions }, (_, index) => (
                        <div key={index} className="flex flex-col items-center gap-1.5">
                            <div className="h-10 w-16 animate-pulse rounded-full bg-muted" />
                            <div className={cn(bar, "h-3 w-10")} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex h-12 items-center gap-8 border-b border-border bg-card px-4 max-lg:justify-around lg:h-[43px] lg:px-12">
                {Array.from({ length: tabs }, (_, index) => <div key={index} className={cn(bar, "h-4 w-14")} />)}
            </div>

            {/* Overview */}
            <div className="flex flex-col gap-3 px-4 pb-6 pt-3 lg:flex-row lg:items-start lg:gap-6 lg:px-8 lg:pt-6">
                <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-5">
                    <div className={cn(card, "h-[220px] lg:hidden")} />
                    <div className={cn(card, "h-12 lg:hidden")} />
                    <div className={cn(card, "hidden h-[186px] lg:block")} />
                    <div className={cn(card, "h-[240px] lg:h-[300px]")} />
                </div>
                <div className="flex flex-col gap-3 lg:w-[320px] xl:w-[380px] lg:shrink-0 lg:gap-5">
                    <div className={cn(card, "h-[300px] lg:h-[360px]")} />
                    <div className={cn(card, "hidden h-[120px] lg:block")} />
                    <div className={cn(card, "hidden h-[200px] lg:block")} />
                </div>
            </div>
        </div>
    )
}
