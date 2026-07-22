"use client"

import { useEffect, useState } from "react"
import { usePermissions } from "@/contexts/permissions-context"
import { getMaintenanceStatus } from "@/app/actions/maintenance-actions"
import { MaintenanceCard } from "./maintenance-card"

/**
 * Gate + loader for the maintenance control. Renders nothing unless the
 * current user is super_admin, then fetches the current flag and hands it to
 * the card. Keeps the Settings page free of maintenance-specific data wiring.
 */
export function MaintenanceSection() {
    const { userType, loading } = usePermissions()
    const isSuperAdmin = userType === "super_admin"
    const [status, setStatus] = useState<{ enabled: boolean; message: string | null } | null>(null)

    useEffect(() => {
        if (!isSuperAdmin) return
        let active = true
        getMaintenanceStatus().then((s) => {
            if (active) setStatus({ enabled: s.enabled, message: s.message })
        })
        return () => { active = false }
    }, [isSuperAdmin])

    if (loading || !isSuperAdmin || !status) return null

    return <MaintenanceCard initialEnabled={status.enabled} initialMessage={status.message} />
}
