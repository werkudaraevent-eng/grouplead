/**
 * Read-only check: does leads.month_event_source exist yet?
 *   npx tsx scripts/verify-month-event-source.ts
 */
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import { resolve } from "path"

dotenv.config({ path: resolve(__dirname, "..", ".env.local") })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
    const { error } = await supabase.from("leads").select("id, month_event_source").limit(1)
    if (error) {
        console.log(`❌ NOT READY: ${error.message}`)
        console.log("   → Paste supabase/migrations/20260531120000_add_month_event_source_to_leads.sql into the Supabase SQL Editor and run it.")
        process.exit(1)
    }
    // Count how rows got tagged so far.
    const { count: autoCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("month_event_source", "auto")
    const { count: manualCount } = await supabase.from("leads").select("id", { count: "exact", head: true }).eq("month_event_source", "manual")
    console.log("✅ READY: leads.month_event_source exists.")
    console.log(`   auto: ${autoCount ?? 0}   manual: ${manualCount ?? 0}`)
}

main().catch(err => { console.error(err); process.exit(1) })
