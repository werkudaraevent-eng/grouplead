/**
 * Fix pipeline_stages.sort_order so CLOSED stages always sort LAST.
 *
 * Symptom: lead detail stepper shows "Closed Won" at position #2 because the
 * stepper renders strictly by sort_order ASC and the historical pipeline's
 * closed stage has a low sort_order.
 *
 * Re-numbers sort_order per pipeline:
 *   1. open stages first (keep existing relative order)
 *   2. then Closed Won
 *   3. then Closed Lost / any other closed stages
 *
 * Usage: npx tsx scripts/fix-stage-sort-order.ts
 * Idempotent — only updates rows whose sort_order actually changes.
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
    console.error('❌ Missing env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
    process.exit(1)
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

interface Stage {
    id: string
    pipeline_id: string
    name: string
    stage_type: 'open' | 'closed'
    closed_status: 'won' | 'lost' | null
    sort_order: number
}

function rankKey(s: Stage): [number, number, number, string] {
    const isClosed = s.stage_type === 'closed' || s.closed_status != null
    const closedRank = s.closed_status === 'won' ? 0 : s.closed_status === 'lost' ? 1 : 2
    return [isClosed ? 1 : 0, closedRank, s.sort_order, s.name]
}

function compareStages(a: Stage, b: Stage): number {
    const ka = rankKey(a)
    const kb = rankKey(b)
    for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return -1
        if (ka[i] > kb[i]) return 1
    }
    return 0
}

async function main() {
    console.log('🚀 Loading pipeline stages…')
    const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, pipeline_id, name, stage_type, closed_status, sort_order')

    if (error) {
        console.error('❌ Failed to load pipeline_stages:', error.message)
        process.exit(1)
    }

    const stages = (data ?? []) as Stage[]
    if (stages.length === 0) {
        console.log('ℹ️  No pipeline stages found. Nothing to do.')
        return
    }

    // Resolve pipeline names for nicer logging.
    const { data: pipelines } = await supabase.from('pipelines').select('id, name')
    const pipelineName = new Map((pipelines ?? []).map((p: { id: string; name: string }) => [p.id, p.name]))

    // Group by pipeline.
    const byPipeline = new Map<string, Stage[]>()
    for (const s of stages) {
        if (!byPipeline.has(s.pipeline_id)) byPipeline.set(s.pipeline_id, [])
        byPipeline.get(s.pipeline_id)!.push(s)
    }

    const updates: { id: string; sort_order: number; name: string; pipeline: string }[] = []

    for (const [pid, group] of byPipeline) {
        const sorted = [...group].sort(compareStages)
        sorted.forEach((s, idx) => {
            const newSort = idx + 1
            if (s.sort_order !== newSort) {
                updates.push({
                    id: s.id,
                    sort_order: newSort,
                    name: s.name,
                    pipeline: pipelineName.get(pid) ?? pid,
                })
            }
        })

        // Log resulting order for visibility.
        console.log(`\n📊 ${pipelineName.get(pid) ?? pid}`)
        sorted.forEach((s, idx) =>
            console.log(`   ${idx + 1}. ${s.name}${s.closed_status ? ` (${s.closed_status})` : ''}${s.sort_order !== idx + 1 ? `  ← was ${s.sort_order}` : ''}`)
        )
    }

    if (updates.length === 0) {
        console.log('\n✅ All pipelines already ordered correctly. No changes needed.')
        return
    }

    console.log(`\n✍️  Updating ${updates.length} stage row(s)…`)
    let ok = 0
    let failed = 0
    for (const u of updates) {
        const { error: upErr } = await supabase
            .from('pipeline_stages')
            .update({ sort_order: u.sort_order })
            .eq('id', u.id)
        if (upErr) {
            failed++
            console.error(`   ❌ ${u.pipeline} / ${u.name}: ${upErr.message}`)
        } else {
            ok++
        }
    }

    console.log(`\n${failed === 0 ? '✅' : '⚠️'} Done. ${ok} updated, ${failed} failed.`)
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
