export default function GoalConfigLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-4">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-md" />
                <div className="h-7 w-56 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="h-4 w-80 bg-muted animate-pulse rounded-md" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
                <div className="lg:col-span-2 h-96 bg-card border border-border rounded-xl animate-pulse" />
                <div className="h-96 bg-card border border-border rounded-xl animate-pulse" />
            </div>
        </div>
    )
}
