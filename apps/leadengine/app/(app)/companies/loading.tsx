export default function CompaniesLoading() {
    return (
        <div className="flex flex-col py-6">
            <div className="mb-4 space-y-2 px-4 sm:px-6 lg:px-8">
                <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
            </div>
            <div className="flex h-10 items-center gap-3 border-b border-border px-4 pb-4 sm:px-6 lg:px-8" style={{ height: 56 }}>
                <div className="h-10 w-[22rem] animate-pulse rounded-full bg-muted" />
                <div className="h-8 w-28 animate-pulse rounded-full bg-muted" />
                <div className="h-8 w-24 animate-pulse rounded-full bg-muted" />
                <div className="h-8 w-32 animate-pulse rounded-full bg-muted" />
                <div className="ml-auto flex gap-1">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                    <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
                </div>
            </div>
            <div className="h-11 border-b border-border bg-muted" />
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-13 animate-pulse border-b border-border/70 bg-card" />
            ))}
        </div>
    )
}
