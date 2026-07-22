/**
 * Verify pipeline_stages ordering after the sort_order fix.
 * Writes current per-pipeline order to scripts/.stage-order.json (UTF-8).
 * Usage: npx tsx scripts/verify-stage-sort-order.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { writeFileSync } from 'fs'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

async function main() {
    const { data: pipelines } = await supabase.from('pipelines').select('id, name')
    const pName = new Map((pipelines ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))

    const { data } = await supabase
        .from('pipeline_stages')
        .select('pipeline_id, name, stage_type, closed_status, sort_order')
        .order('sort_order', { ascending: true })

    const grouped: Record<string, { sort: number; name: string; type: string; closed: string | null }[]> = {}
    for (const s of (data ?? []) as { pipeline_id: string; name: string; stage_type: string; closed_status: string | null; sort_order: number }[]) {
        const key = pName.get(s.pipeline_id) ?? s.pipeline_id
        if (!grouped[key]) grouped[key] = []
        grouped[key].push({ sort: s.sort_order, name: s.name, type: s.stage_type, closed: s.closed_status })
    }

    writeFileSync(resolve(__dirname, '.stage-order.json'), JSON.stringify(grouped, null, 2), 'utf-8')
}

main().catch((e) => { console.error(e); process.exit(1) })
