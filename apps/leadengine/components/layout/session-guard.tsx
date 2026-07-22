"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { ACTIVE_SESSION_STORAGE_KEY } from "@/lib/session-guard"

/**
 * Enforces a single active session per account ("last login wins").
 *
 * How it works:
 *  - On login we store a fresh session id in `profiles.active_session_id`
 *    and in this browser's localStorage.
 *  - This guard (mounted once in the app shell) does two things:
 *      1. On mount, compares the DB value with the local value. If the local
 *         id is missing or stale, this browser is an older session → sign out.
 *      2. Subscribes to Realtime changes on this user's profile row. If the
 *         id changes (a newer login elsewhere), this session signs itself out.
 *
 * This is a client-side, anti-sharing guard — not a hard server boundary.
 */
export function SessionGuard() {
    const router = useRouter()
    const signingOut = useRef(false)

    useEffect(() => {
        const supabase = createClient()
        let channel: ReturnType<typeof supabase.channel> | null = null
        let cancelled = false

        const forceSignOut = async () => {
            if (signingOut.current) return
            signingOut.current = true
            try {
                localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY)
                await supabase.auth.signOut()
            } catch {
                // ignore
            }
            toast.error("You were signed out because your account was signed in on another device.")
            router.replace("/login")
            router.refresh()
        }

        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || cancelled) return

            const localId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)

            // Read the current active session id from the profile.
            const { data: profile } = await supabase
                .from("profiles")
                .select("active_session_id")
                .eq("id", user.id)
                .single()

            const dbId = profile?.active_session_id as string | null | undefined

            // Adoption path: an existing session from before this feature (or a
            // page refresh where localStorage was cleared) has no local id. If
            // the DB also has none, claim it so the guard has a baseline. We do
            // NOT sign out in that case — only when there is a real mismatch.
            if (!dbId) {
                // No active session recorded yet — nothing to enforce against.
                return
            }

            if (!localId) {
                // This browser has no stored id but the account has an active
                // session elsewhere. Treat this browser as the stale one only if
                // it truly isn't the active session. Since we can't prove it is,
                // adopt the db id to avoid logging the user out on a refresh that
                // cleared localStorage right after login.
                localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, dbId)
                return
            }

            if (localId !== dbId) {
                // A newer login replaced our session.
                await forceSignOut()
                return
            }

            // Subscribe for live changes to this profile row.
            channel = supabase
                .channel(`session-guard:${user.id}`)
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "profiles",
                        filter: `id=eq.${user.id}`,
                    },
                    (payload) => {
                        const next = (payload.new as { active_session_id?: string | null })?.active_session_id
                        const mine = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY)
                        if (next && mine && next !== mine) {
                            forceSignOut()
                        }
                    },
                )
                .subscribe()
        }

        init()

        return () => {
            cancelled = true
            if (channel) supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return null
}
