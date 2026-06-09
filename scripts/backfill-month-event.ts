/**
 * Script: Backfill Revenue-Recognition month (`month_event`) from event dates.
 *
 * WHY: Until now the System Rules "Event Cut-Off Date" only affected the
 * Excel import path. Leads created/edited through the form derived
 * `month_event` from manual dropdowns and (due to bugs) sometimes used the
 * event START date or ignored the cut-off entirely. This recomputes
 * `month_event` for every lead that has `event_dates`, using the canonical
 * rule (END date + cut-off → next month) so the dashboard revenue-recognition
 * basis is correct.
 *
 * SAFE BY DEFAULT: runs as a DRY RUN unless you pass `--apply`.
 *
 *   Preview (no writes):   npx tsx scripts/backfill-month-event.ts
 *   Apply changes:         npx tsx scripts/backfill-month-event.ts --apply
 *
 * Notes:
 *   - Only touches leads where event_dates is a non-empty array.
 *   - Leaves a lead unchanged if the recomputed value equals the stored one.
 *   - Cut-off day is read from master_options (system_setting / event_cutoff_date),
 *     falling back to 25 to match the form + import default.
 */

import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { resolve } from "path"
import { computeMonthEvent } from "../src/features/leads/lib/compute-month-event"

dotenv.config({ path: resolve(__dirname, "..", ".env.local") })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

const APPLY = process.argv.includes("--apply")

type LeadRow = {
    id: string
    project_name: string | null
    event_dates: string[] | null
    month_event: string | null
    month_event_source: "auto" | "manual" | null
}

async function resolveCutoffDay(): Promise<number> {
    const { data } = await supabase
        .from("master_options")
        .select("value")
        .eq("option_type", "system_setting")
        .eq("label", "event_cutoff_date")
        .maybeSingle()
    const n = data?.value ? parseInt(data.value, 10) : NaN
    return Number.isFinite(n) && n >= 1 && n <= 31 ? n : 25
}

async function main() {
    console.log(`\n${APPLY ? "🟢 APPLY MODE — changes WILL be written" : "🔍 DRY RUN — no changes will be written (pass --apply to commit)"}\n`)

    const cutoffDay = await resolveCutoffDay()
    console.log(`Cut-off day: ${cutoffDay}\n`)

    // Page through leads that have event_dates. Supabase caps rows per request,
    // so we fetch in batches to be safe on large datasets.
    const PAGE = 1000
    let from = 0
    const all: LeadRow[] = []
    for (;;) {
        const { data, error } = await supabase
            .from("leads")
            .select("id, project_name, event_dates, month_event, month_event_source")
            .not("event_dates", "is", null)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1)
        if (error) {
            console.error("❌ Query failed:", error.message)
            process.exit(1)
        }
        if (!data || data.length === 0) break
        all.push(...(data as LeadRow[]))
        if (data.length < PAGE) break
        from += PAGE
    }

    console.log(`Fetched ${all.length} leads with event_dates.\n`)

    const changes: { id: string; name: string; from: string | null; to: string }[] = []
    let unchanged = 0
    let skippedNoDates = 0
    let skippedManual = 0

    for (const lead of all) {
        // Never overwrite a deliberate manual override.
        if (lead.month_event_source === "manual") { skippedManual++; continue }
        const dates = Array.isArray(lead.event_dates) ? lead.event_dates : []
        if (dates.length === 0) { skippedNoDates++; continue }
        const computed = computeMonthEvent(dates, cutoffDay)
        if (!computed) { skippedNoDates++; continue }
        // Already correct AND already tagged auto → nothing to do. If the
        // value matches but the source flag is missing, we still write so the
        // row gets tagged 'auto' going forward.
        if (computed === lead.month_event && lead.month_event_source === "auto") { unchanged++; continue }
        changes.push({ id: lead.id, name: lead.project_name ?? "(untitled)", from: lead.month_event, to: computed })
    }

    console.log(`Summary:`)
    console.log(`  • ${changes.length} would change`)
    console.log(`  • ${unchanged} already correct`)
    console.log(`  • ${skippedManual} skipped (manual override — protected)`)
    console.log(`  • ${skippedNoDates} skipped (no usable dates)\n`)

    if (changes.length > 0) {
        console.log("Changes (showing up to 50):")
        for (const c of changes.slice(0, 50)) {
            console.log(`  ${c.id}  "${c.name}"  ${c.from ?? "∅"}  →  ${c.to}`)
        }
        if (changes.length > 50) console.log(`  …and ${changes.length - 50} more`)
        console.log("")
    }

    if (!APPLY) {
        console.log("🔍 Dry run complete. Re-run with --apply to write these changes.\n")
        return
    }

    if (changes.length === 0) {
        console.log("✅ Nothing to apply.\n")
        return
    }

    console.log(`Applying ${changes.length} updates…`)
    let ok = 0
    let failed = 0
    for (const c of changes) {
        // Tag as 'auto' so future recalculate runs recognise these as
        // rule-derived and keep them in sync (and never treat them as manual).
        const { error } = await supabase.from("leads").update({ month_event: c.to, month_event_source: "auto" }).eq("id", c.id)
        if (error) { failed++; console.error(`  ❌ ${c.id}: ${error.message}`) }
        else ok++
    }
    console.log(`\n✅ Done. ${ok} updated, ${failed} failed.\n`)
}

main().catch(err => { console.error(err); process.exit(1) })
