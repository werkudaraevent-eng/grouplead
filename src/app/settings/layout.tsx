import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { requirePermission } from "@/lib/require-permission"

/**
 * Server-side guard for the entire Settings area.
 *
 * The client `<PermissionsProvider>` already hides Settings nav and renders an
 * access-denied state, but that is a UI affordance — it can go stale (e.g. a
 * role change that hasn't propagated to every cached membership row) and it
 * does nothing if someone navigates straight to `/settings/...` by URL. This
 * layout enforces the `settings.read` grant on the server for every request,
 * so access cannot be bypassed from the client.
 *
 * Exception: `/settings/profile` is every user's own account page (edit
 * profile, change password). It must stay reachable regardless of the
 * settings grant, so we skip the check for that path only.
 */
export default async function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const hdrs = await headers()
    const pathname = hdrs.get("x-pathname") ?? ""

    const isOwnProfile = pathname === "/settings/profile" || pathname.startsWith("/settings/profile/")

    if (!isOwnProfile) {
        const guard = await requirePermission("settings", "read")
        if (!guard.allowed) {
            redirect("/")
        }
    }

    return <>{children}</>
}
