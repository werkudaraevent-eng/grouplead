import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/require-permission"
import { isOpenSettingsPath } from "@/lib/navigation/settings-nav"
import { SettingsFrame } from "@/components/layout/settings-frame"

/**
 * One layout for every page under Settings: the server-side guard, and the
 * settings frame (the menu beside the page on a desk; DESIGN.md "Settings
 * layout and page width").
 *
 * The client `<PermissionsProvider>` already hides Settings nav and renders an
 * access-denied state, but that is a UI affordance — it can go stale (e.g. a
 * role change that hasn't propagated to every cached membership row) and it
 * does nothing if someone navigates straight to `/settings/...` by URL. This
 * layout enforces the `settings.read` grant on the server for every request,
 * so access cannot be bypassed from the client.
 *
 * Exception: Settings › Account (`/settings/profile`, `/settings/devices`)
 * is every user's own, and the Settings page itself is where a phone's back
 * arrow from those pages lands (it then lists Account only). They stay
 * reachable regardless of the settings grant (`isOpenSettingsPath`).
 */
export default async function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const hdrs = await headers()
    const pathname = hdrs.get("x-pathname") ?? ""

    if (!isOpenSettingsPath(pathname)) {
        const guard = await requirePermission("settings", "read")
        if (!guard.allowed) {
            redirect("/")
        }
    }

    return <SettingsFrame>{children}</SettingsFrame>
}
