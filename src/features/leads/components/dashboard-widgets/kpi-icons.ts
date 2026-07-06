// ─── KPI Card Icon Registry ───────────────────────────────────────────────
// Curated set of lucide icons a user can pick for a custom KPI card. Stored by
// stable string key in `config.icon` (JSON column — no migration needed) so the
// choice survives renames of the underlying component. The renderer and the
// configurator both resolve through `resolveKpiIcon` to stay in sync.
import {
    Hash,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Wallet,
    Target,
    Users,
    UserPlus,
    Briefcase,
    Trophy,
    Award,
    Activity,
    BarChart3,
    PieChart,
    Percent,
    Calendar,
    Clock,
    Zap,
    Flag,
    CheckCircle2,
    Star,
    Package,
    Building2,
    Gauge,
    type LucideIcon,
} from "lucide-react"

export interface KpiIconOption {
    /** Stable key persisted in `config.icon`. */
    key: string
    /** Human label for the picker tooltip / a11y. */
    label: string
    icon: LucideIcon
}

// Order here is the order shown in the picker grid.
export const KPI_ICONS: KpiIconOption[] = [
    { key: "hash", label: "Number", icon: Hash },
    { key: "trending-up", label: "Trending up", icon: TrendingUp },
    { key: "trending-down", label: "Trending down", icon: TrendingDown },
    { key: "dollar", label: "Revenue", icon: DollarSign },
    { key: "wallet", label: "Wallet", icon: Wallet },
    { key: "percent", label: "Percentage", icon: Percent },
    { key: "target", label: "Target", icon: Target },
    { key: "gauge", label: "Gauge", icon: Gauge },
    { key: "trophy", label: "Won / Trophy", icon: Trophy },
    { key: "award", label: "Award", icon: Award },
    { key: "star", label: "Star", icon: Star },
    { key: "check", label: "Success", icon: CheckCircle2 },
    { key: "flag", label: "Flag", icon: Flag },
    { key: "activity", label: "Activity", icon: Activity },
    { key: "zap", label: "Fast / Energy", icon: Zap },
    { key: "users", label: "Contacts", icon: Users },
    { key: "user-plus", label: "New lead", icon: UserPlus },
    { key: "briefcase", label: "Deals", icon: Briefcase },
    { key: "building", label: "Company", icon: Building2 },
    { key: "package", label: "Product", icon: Package },
    { key: "calendar", label: "Events", icon: Calendar },
    { key: "clock", label: "Cycle time", icon: Clock },
    { key: "bar-chart", label: "Bar chart", icon: BarChart3 },
    { key: "pie-chart", label: "Pie chart", icon: PieChart },
]

/** Default icon key used when a KPI card has no `config.icon` set. */
export const DEFAULT_KPI_ICON_KEY = "hash"

const ICON_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
    KPI_ICONS.map((o) => [o.key, o.icon]),
)

/** Resolve an icon key to its lucide component, falling back to Hash. */
export function resolveKpiIcon(key: string | null | undefined): LucideIcon {
    return (key && ICON_BY_KEY[key]) || Hash
}
