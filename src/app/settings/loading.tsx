export default function SettingsLoading() {
    return (
        <div className="min-h-screen bg-muted/30">
            <div className="px-6 pt-5 pb-3 border-b border-transparent space-y-1">
                <div className="h-7 w-32 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-64 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="px-6 pb-10 max-w-[1200px] pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-[120px] bg-card rounded-xl border shadow-sm animate-pulse" />
                    ))}
                </div>
            </div>
        </div>
    )
}
