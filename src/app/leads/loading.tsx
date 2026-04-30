export default function LeadsLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4">
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
    )
}
