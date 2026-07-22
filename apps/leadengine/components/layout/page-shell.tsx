import { cn } from "@/lib/utils"

interface PageShellProps {
    children: React.ReactNode
    className?: string
}

export function PageShell({ children, className }: PageShellProps) {
    return (
        <div className={cn("px-4 sm:px-6 lg:px-8 py-6", className)}>
            {children}
        </div>
    )
}

interface PageHeaderProps {
    title: string
    subtitle?: string
    actions?: React.ReactNode
    className?: string
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
    return (
        <div className={cn("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6", className)}>
            <div>
                <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
    )
}
