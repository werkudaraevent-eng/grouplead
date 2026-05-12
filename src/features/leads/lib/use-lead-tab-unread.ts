"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
    fetchLeadTabUnreadStateAction,
    markLeadTabViewedAction,
    type LeadTab,
    type LeadTabUnreadState,
} from "@/app/actions/lead-tab-views-actions"

const POLL_INTERVAL_MS = 60_000 // 60 seconds — CRM standard (HubSpot/Pipedrive)

const EMPTY_STATE: LeadTabUnreadState = {
    scope: false,
    notes: false,
    timeline: false,
    tasks: false,
}

/**
 * Polls the server every 60s (paused while tab is hidden) for unread
 * state across the 4 lead detail tabs. Also exposes markViewed() that
 * clears the badge for a given tab and syncs it to the server.
 */
export function useLeadTabUnread(leadId: number | string | null | undefined) {
    const [unread, setUnread] = useState<LeadTabUnreadState>(EMPTY_STATE)
    const leadIdNum = typeof leadId === "number" ? leadId : leadId ? Number(leadId) : NaN
    const validId = Number.isFinite(leadIdNum) && leadIdNum > 0

    const latestReqRef = useRef(0)

    // ── Fetch once + expose a refresher ───────────────────
    const refresh = useCallback(async () => {
        if (!validId) return
        const reqId = ++latestReqRef.current
        const result = await fetchLeadTabUnreadStateAction(leadIdNum)
        // Drop stale responses if a newer request has fired
        if (reqId !== latestReqRef.current) return
        setUnread(result)
    }, [leadIdNum, validId])

    // ── Initial load ──────────────────────────────────────
    useEffect(() => {
        if (!validId) {
            setUnread(EMPTY_STATE)
            return
        }
        refresh()
    }, [validId, refresh])

    // ── Polling loop ──────────────────────────────────────
    useEffect(() => {
        if (!validId) return

        let intervalId: ReturnType<typeof setInterval> | null = null

        const start = () => {
            if (intervalId) return
            intervalId = setInterval(() => {
                if (typeof document !== "undefined" && document.hidden) return
                refresh()
            }, POLL_INTERVAL_MS)
        }

        const stop = () => {
            if (intervalId) {
                clearInterval(intervalId)
                intervalId = null
            }
        }

        // Start polling only when visible; refresh immediately on visibility return
        const onVisibility = () => {
            if (document.hidden) {
                stop()
            } else {
                refresh()
                start()
            }
        }

        if (typeof document !== "undefined" && !document.hidden) start()
        if (typeof document !== "undefined") {
            document.addEventListener("visibilitychange", onVisibility)
        }

        return () => {
            stop()
            if (typeof document !== "undefined") {
                document.removeEventListener("visibilitychange", onVisibility)
            }
        }
    }, [validId, refresh])

    // ── Optimistically clear a tab's badge + persist on server ──
    const markViewed = useCallback(
        async (tab: LeadTab) => {
            if (!validId) return
            // Optimistic local update
            setUnread((prev) => (prev[tab] ? { ...prev, [tab]: false } : prev))
            await markLeadTabViewedAction(leadIdNum, tab)
        },
        [leadIdNum, validId]
    )

    return { unread, markViewed, refresh }
}
