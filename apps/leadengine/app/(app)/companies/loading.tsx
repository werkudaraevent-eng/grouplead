export default function CompaniesLoading() {
    return (
        <div className="py-6 flex flex-col">
            <div className="mb-6 px-4 sm:px-6 lg:px-8 space-y-1">
                <div className="h-7 w-40 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-64 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 pb-4 border-b border-border">
                <div className="h-9 w-[280px] bg-muted animate-pulse rounded-lg" />
                <div className="flex gap-2">
                    <div className="h-9 w-24 bg-muted animate-pulse rounded-lg" />
                    <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
                </div>
            </div>
            <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-[48px] bg-card border-b border-border animate-pulse" />
                ))}
            </div>
        </div>
    )
}
