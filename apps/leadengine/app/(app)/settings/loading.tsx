export default function SettingsLoading() {
    const CONTAINER = "w-full max-w-[1200px]"
    return (
        <div className="min-h-[100dvh] bg-background">
            {/* Header skeleton — matches shared SettingsPageHeader */}
            <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-3 border-b border-transparent space-y-1.5">
                <div className="h-7 w-32 bg-muted animate-pulse rounded-md" />
                <div className="h-4 w-72 max-w-full bg-muted/70 animate-pulse rounded-md" />
            </div>

            <div className="px-4 sm:px-6 lg:px-8 pb-20">
                <div className={CONTAINER}>
                    {[
                        { rows: 3 },
                        { rows: 2 },
                        { rows: 2 },
                    ].map((section, i) => (
                        <section key={i} className="mt-10 first:mt-6">
                            <div className="px-1 space-y-2">
                                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                                <div className="h-3 w-56 max-w-full bg-muted/70 animate-pulse rounded" />
                            </div>
                            <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                                {Array.from({ length: section.rows }).map((_, r) => (
                                    <li key={r} className="flex items-center gap-4 px-4 py-3.5">
                                        <div className="h-9 w-9 shrink-0 rounded-md bg-muted animate-pulse" />
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            <div className="h-3.5 w-40 bg-muted animate-pulse rounded" />
                                            <div className="h-3 w-64 max-w-full bg-muted/70 animate-pulse rounded" />
                                        </div>
                                        <div className="h-4 w-4 shrink-0 rounded bg-muted animate-pulse" />
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    )
}
