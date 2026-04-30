export default function GoalsLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="h-7 w-28 bg-muted animate-pulse rounded-md" />
                    <div className="h-4 w-56 bg-muted animate-pulse rounded-md" />
                </div>
                <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[200px] bg-card rounded-xl border shadow-sm animate-pulse" />
                ))}
            </div>
        </div>
    )
}
