import { LucideIcon } from "lucide-react"
import { ReactNode } from "react"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  children?: ReactNode
  size?: "sm" | "md" | "lg"
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  children,
  size = "md"
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-6",
      icon: "w-10 h-10",
      title: "text-sm",
      description: "text-xs",
      button: "text-xs px-3 py-1.5"
    },
    md: {
      container: "py-12",
      icon: "w-12 h-12",
      title: "text-base",
      description: "text-sm",
      button: "text-sm px-4 py-2"
    },
    lg: {
      container: "py-16",
      icon: "w-16 h-16",
      title: "text-lg",
      description: "text-base",
      button: "text-base px-5 py-2.5"
    }
  }

  const classes = sizeClasses[size]

  return (
    <div className={`flex flex-col items-center justify-center text-center ${classes.container}`}>
      {Icon && (
        <div className="mb-4 rounded-full bg-slate-100 p-3">
          <Icon className={`${classes.icon} text-slate-400`} />
        </div>
      )}

      <h3 className={`font-semibold text-slate-700 ${classes.title}`}>
        {title}
      </h3>

      {description && (
        <p className={`mt-1 text-slate-500 max-w-sm ${classes.description}`}>
          {description}
        </p>
      )}

      {children && (
        <div className="mt-4">
          {children}
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className={`mt-4 rounded-md bg-blue-600 font-medium text-white hover:bg-blue-700 transition-colors ${classes.button}`}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

interface NoDataBadgeProps {
  message?: string
}

export function NoDataBadge({ message = "No data" }: NoDataBadgeProps) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
      {message}
    </div>
  )
}

interface NoTargetBadgeProps {
  message?: string
  variant?: "warning" | "subtle"
}

export function NoTargetBadge({ message = "Target not set", variant = "subtle" }: NoTargetBadgeProps) {
  if (variant === "warning") {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        {message}
      </div>
    )
  }

  // Subtle variant - less prominent
  return (
    <div className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-400 bg-slate-50">
      <span className="text-slate-300">—</span>
      {message}
    </div>
  )
}

interface LoadingSkeletonProps {
  type?: "card" | "chart" | "list" | "text"
  count?: number
}

export function LoadingSkeleton({ type = "card", count = 1 }: LoadingSkeletonProps) {
  const skeletons = Array.from({ length: count })

  if (type === "card") {
    return (
      <div className="space-y-3 animate-pulse">
        {skeletons.map((_, i) => (
          <div key={i} className="h-20 bg-slate-200 rounded-lg" />
        ))}
      </div>
    )
  }

  if (type === "chart") {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-slate-200 rounded-lg" />
      </div>
    )
  }

  if (type === "list") {
    return (
      <div className="space-y-2 animate-pulse">
        {skeletons.map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-10 w-10 bg-slate-200 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-2 bg-slate-200 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === "text") {
    return (
      <div className="space-y-2 animate-pulse">
        {skeletons.map((_, i) => (
          <div key={i} className="h-4 bg-slate-200 rounded w-full" />
        ))}
      </div>
    )
  }

  return null
}
