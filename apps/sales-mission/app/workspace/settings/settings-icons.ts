import {
  Activity,
  CalendarCheck,
  ClipboardList,
  Database,
  FileText,
  History,
  Megaphone,
  MonitorPlay,
  MonitorSmartphone,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  UserCircle,
  UserSearch,
  type IconComponent,
} from "@/components/icons"
import type { SettingsIconKey } from "@/lib/settings/settings-nav"

/**
 * One glyph per Pengaturan page, neutral and each one different (DESIGN.md
 * "Settings index"): the Pengaturan list draws them; the desk menu beside a
 * settings page does not.
 */
export const SETTINGS_ICONS: Record<SettingsIconKey, IconComponent> = {
  profile: UserCircle,
  devices: MonitorSmartphone,
  "activity-form": CalendarCheck,
  "report-form": FileText,
  "prospect-form": UserSearch,
  "activity-rules": SlidersHorizontal,
  "follow-up": ClipboardList,
  "prospect-statuses": Tags,
  announcements: Megaphone,
  "public-links": MonitorPlay,
  history: History,
  usage: Activity,
  ai: Sparkles,
  "recycle-bin": Trash2,
  data: Database,
}
