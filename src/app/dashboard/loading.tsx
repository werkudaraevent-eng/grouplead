import { Loader2 } from "lucide-react"

export default function DashboardLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="space-y-1">
                <div className="h-7 w-48 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-72 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-[100px] bg-card rounded-xl border shadow-sm animate-pulse" />
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-[280px] bg-card rounded-xl border shadow-sm animate-pulse" />
                ))}
            </div>
        </div>
    )
}
