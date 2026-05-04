export default function DashboardLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* Header skeleton */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="h-7 w-40 bg-muted animate-pulse rounded-md" />
                    <div className="h-4 w-64 bg-muted animate-pulse rounded-md" />
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-32 bg-muted animate-pulse rounded-lg" />
                    <div className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
                </div>
            </div>
            {/* KPI cards skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />
                ))}
            </div>
            {/* Chart skeletons */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-72 bg-card border border-border rounded-xl animate-pulse" />
                <div className="h-72 bg-card border border-border rounded-xl animate-pulse" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="h-64 bg-card border border-border rounded-xl animate-pulse" />
                <div className="h-64 bg-card border border-border rounded-xl animate-pulse" />
                <div className="h-64 bg-card border border-border rounded-xl animate-pulse" />
            </div>
        </div>
    )
}
