export default function GoalSettingsLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4">
            <div className="h-7 w-48 bg-muted animate-pulse rounded-md" />
            <div className="h-4 w-72 bg-muted animate-pulse rounded-md" />
            <div className="space-y-3 mt-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 bg-card border border-border rounded-xl animate-pulse" />
                ))}
            </div>
        </div>
    )
}
