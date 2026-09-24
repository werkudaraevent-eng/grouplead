"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createClient } from "@/utils/supabase/client"

/** What a lead card shows, chosen per person in the board's Card Settings. */
export interface KanbanCardConfig {
    badges: string[]
    metrics: string[]
}

export const DEFAULT_KANBAN_CONFIG: KanbanCardConfig = {
    badges: ["grade_lead", "main_stream", "event_format"],
    metrics: ["estimated_value", "target_close_date", "pic"],
}

/**
 * The person's Card Settings (`profiles.ui_preferences.kanban`): read once,
 * and saved back merged into the rest of their preferences. The desk's
 * kanban cards and the phone's lead cards read the same choice, so a chip
 * chosen on a desk shows on a phone too.
 */
export function useKanbanCardConfig() {
    const supabase = useMemo(() => createClient(), [])
    const [config, setConfig] = useState<KanbanCardConfig>(DEFAULT_KANBAN_CONFIG)
    const [loaded, setLoaded] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            const { data: authData } = await supabase.auth.getUser()
            if (authData?.user) {
                const { data: profile } = await supabase.from("profiles").select("ui_preferences").eq("id", authData.user.id).single()
                if (!cancelled && profile?.ui_preferences && typeof profile.ui_preferences === "object") {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const uiPrefs = profile.ui_preferences as any
                    if (uiPrefs.kanban) {
                        setConfig((prev) => ({ ...prev, ...uiPrefs.kanban }))
                    }
                }
            }
            if (!cancelled) setLoaded(true)
        }
        void load()
        return () => {
            cancelled = true
        }
    }, [supabase])

    const save = useCallback(
        async (next: KanbanCardConfig) => {
            setConfig(next)
            const { data: authData } = await supabase.auth.getUser()
            if (!authData?.user) return
            setSaving(true)
            const { data: profile } = await supabase.from("profiles").select("ui_preferences").eq("id", authData.user.id).single()
            const currentPrefs = typeof profile?.ui_preferences === "object" && profile?.ui_preferences ? profile.ui_preferences : {}
            await supabase
                .from("profiles")
                .update({ ui_preferences: { ...currentPrefs, kanban: next } })
                .eq("id", authData.user.id)
            setSaving(false)
            toast.success("Kanban card properties saved")
        },
        [supabase],
    )

    return { config, loaded, saving, save }
}
