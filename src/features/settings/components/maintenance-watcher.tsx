"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getMaintenanceStatus } from "@/app/actions/maintenance-actions"
import { usePermissions } from "@/contexts/permissions-context"

const POLL_MS = 45_000
const REDIRECT_DELAY_MS = 6_000

/**
 * Watches global maintenance status while a user is active in the app.
 * Behaviour (Option B — graceful kick-out):
 *   • Polls every ~45s.
 *   • When maintenance flips ON for a non-super-admin, shows a warning toast,
 *     then redirects to /maintenance after a short delay so the user isn't
 *     yanked mid-action without warning.
 *   • Super admins are never redirected (they keep working).
 * Mount once inside the authenticated app shell.
 */
export function MaintenanceWatcher() {
    const router = useRouter()
    const { userType, loading } = usePermissions()
    const redirectingRef = useRef(false)

    useEffect(() => {
        if (loading) return
        // Super admins bypass the lockdown entirely — no need to poll.
        if (userType === "super_admin") return

        let active = true
        let timer: ReturnType<typeof setTimeout> | null = null

        const check = async () => {
            if (!active || redirectingRef.current) return
            const status = await getMaintenanceStatus()
            if (!active || redirectingRef.current) return
            if (status.enabled) {
                redirectingRef.current = true
                toast.warning("The platform is entering maintenance. You'll be redirected shortly.", {
                    duration: REDIRECT_DELAY_MS,
                })
                setTimeout(() => {
                    if (active) router.push("/maintenance")
                }, REDIRECT_DELAY_MS)
            }
        }

        // Initial check on mount, then interval.
        void check()
        const interval = setInterval(check, POLL_MS)

        return () => {
            active = false
            if (timer) clearTimeout(timer)
            clearInterval(interval)
        }
    }, [userType, loading, router])

    return null
}
