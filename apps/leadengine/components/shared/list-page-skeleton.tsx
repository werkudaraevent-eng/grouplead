import { ListCardSkeleton } from "@/components/shared/list-table"

/**
 * The loading shape of a list page (Contacts, Companies) while the route
 * resolves: the header's one row, the toolbar and rows on a desk; below
 * `lg` no header row (the top app bar carries the title), then the search
 * with its Filter button and cards on a phone. It carries
 * `data-fluid-page` like the pages it stands in for, so a phone never sees
 * the shell's 900px floor (and a sideways scroll) for the moment it shows.
 */
export function ListPageSkeleton() {
    return (
        <div data-fluid-page className="flex w-full flex-col pb-6" aria-busy="true">
            {/* The header's one 56dp row; no description line, which most
                people have dismissed (PageIntro), so the list does not jump. */}
            <div className="flex min-h-14 items-center justify-between gap-3 px-4 max-lg:hidden sm:px-6 lg:px-8">
                <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
                <div className="flex gap-2">
                    <div className="h-8 w-28 animate-pulse rounded-md bg-muted" />
                    <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
                    <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
                </div>
            </div>
            {/* The controls' band: on a phone 12px above and below the search, with
                no hairline at rest, as `ListControls` draws it. */}
            <div className="flex items-center gap-2 px-4 py-3 sm:px-6 md:border-b md:border-border md:pb-4 lg:px-8 lg:pt-0">
                <div className="h-11 min-w-0 flex-1 animate-pulse rounded-md bg-muted md:h-9 md:max-w-[22rem]" />
                <div className="h-11 w-24 shrink-0 animate-pulse rounded-md bg-muted md:hidden" />
                <div className="hidden h-9 w-28 animate-pulse rounded-md bg-muted md:block" />
                <div className="hidden h-9 w-24 animate-pulse rounded-md bg-muted md:block" />
                <div className="hidden h-9 w-32 animate-pulse rounded-md bg-muted md:block" />
            </div>
            <div className="hidden md:block">
                <div className="h-11 border-b border-border bg-muted" />
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-13 animate-pulse border-b border-border/70 bg-card" />
                ))}
            </div>
            {/* The phone's cards, drawn by the same skeleton the list shows before its first page. */}
            <div className="px-4 pb-3 md:hidden">
                <ListCardSkeleton />
            </div>
        </div>
    )
}
