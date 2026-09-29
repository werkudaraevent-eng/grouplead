import {
    Activity,
    Building,
    Database,
    GitBranch,
    History,
    Megaphone,
    MonitorSmartphone,
    Shield,
    Sparkles,
    Target,
    Trash2,
    UserCircle,
    Users,
} from "@/components/icons"
import type { SettingsIconKey } from "@/lib/navigation/settings-nav"

/**
 * One glyph per Settings page, neutral and each one different (DESIGN.md
 * "Settings index"): the Settings page draws them; the desk menu beside a
 * settings page does not.
 */
export const SETTINGS_ICONS: Record<SettingsIconKey, typeof Users> = {
    profile: UserCircle,
    devices: MonitorSmartphone,
    "master-options": Database,
    pipeline: GitBranch,
    goals: Target,
    companies: Building,
    users: Users,
    announcements: Megaphone,
    history: History,
    usage: Activity,
    permissions: Shield,
    "recycle-bin": Trash2,
    ai: Sparkles,
}
