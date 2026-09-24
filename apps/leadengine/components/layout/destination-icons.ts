import { Building2, KanbanSquare, LayoutDashboard, Users, type IconComponent } from "@/components/icons"
import type { DestinationKey } from "@/lib/navigation/app-nav"

/** Each destination's glyph, the same in the drawer and the phone's navigation bar. */
export const DESTINATION_ICONS: Record<DestinationKey, IconComponent> = {
    dashboard: LayoutDashboard,
    pipeline: KanbanSquare,
    companies: Building2,
    contacts: Users,
}
