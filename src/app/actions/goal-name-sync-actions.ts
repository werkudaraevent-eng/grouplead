"use server"

import { createServiceClient } from "@/utils/supabase/service"

/**
 * Propagate a sales rep rename into goal `breakdown_config` JSON.
 *
 * Why this exists:
 *   `goals_v2.breakdown_config` stores sales_owner targets keyed by the rep's
 *   DISPLAY NAME (string), not their user id. The Sales Performance widget
 *   resolves those names back to a `profiles.id` via `full_name`. When an admin
 *   renames a user, the profile name changes but the goal config keeps the old
 *   name — so the rep splits into two dashboard rows: a "tracked" row for the
 *   stale-named target (0%) and an "untracked" row for the won-deal revenue
 *   (keyed by the still-correct `pic_sales_id`).
 *
 * This walks every goal's `breakdown_config`, rewrites `sales_owner` node names
 * matching `oldName` to `newName` (in both `nodes` and `perParentNodes`), and
 * persists the change. Idempotent and a no-op when `oldName === newName` or no
 * node references the old name.
 *
 * Returns the number of goals updated.
 */
export async function propagateSalesOwnerRename(
    oldName: string,
    newName: string,
): Promise<{ success: boolean; goalsUpdated: number; error?: string }> {
    const trimmedOld = oldName?.trim()
    const trimmedNew = newName?.trim()
    if (!trimmedOld || !trimmedNew || trimmedOld === trimmedNew) {
        return { success: true, goalsUpdated: 0 }
    }

    try {
        const supabase = createServiceClient()

        const { data: goals, error } = await supabase
            .from("goals_v2")
            .select("id, breakdown_config")

        if (error) return { success: false, goalsUpdated: 0, error: error.message }

        type Node = { name?: string }
        type Level = {
            dimension?: string
            nodes?: Node[]
            perParentNodes?: Record<string, Node[] | undefined>
        }

        let goalsUpdated = 0

        for (const goal of goals ?? []) {
            const config = (goal as { breakdown_config: unknown }).breakdown_config
            if (!Array.isArray(config)) continue

            let changed = false
            for (const level of config as Level[]) {
                if (level?.dimension !== "sales_owner") continue

                for (const node of level.nodes ?? []) {
                    if (node?.name === trimmedOld) {
                        node.name = trimmedNew
                        changed = true
                    }
                }
                for (const list of Object.values(level.perParentNodes ?? {})) {
                    for (const node of list ?? []) {
                        if (node?.name === trimmedOld) {
                            node.name = trimmedNew
                            changed = true
                        }
                    }
                }
            }

            if (changed) {
                const { error: updErr } = await supabase
                    .from("goals_v2")
                    .update({ breakdown_config: config })
                    .eq("id", (goal as { id: string }).id)
                if (updErr) return { success: false, goalsUpdated, error: updErr.message }
                goalsUpdated++
            }
        }

        return { success: true, goalsUpdated }
    } catch (err) {
        return {
            success: false,
            goalsUpdated: 0,
            error: err instanceof Error ? err.message : "Unknown error",
        }
    }
}
