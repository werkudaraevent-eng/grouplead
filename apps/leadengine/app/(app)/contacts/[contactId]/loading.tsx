export default function ContactDetailLoading() {
    return (
        <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center gap-3">
                <div className="h-5 w-16 bg-muted animate-pulse rounded-md" />
                <div className="h-7 w-40 bg-muted animate-pulse rounded-md" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <div className="h-[180px] bg-card rounded-xl border shadow-sm animate-pulse" />
                    <div className="h-[250px] bg-card rounded-xl border shadow-sm animate-pulse" />
                </div>
                <div className="space-y-4">
                    <div className="h-[140px] bg-card rounded-xl border shadow-sm animate-pulse" />
                    <div className="h-[180px] bg-card rounded-xl border shadow-sm animate-pulse" />
                </div>
            </div>
        </div>
    )
}
