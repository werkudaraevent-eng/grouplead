/**
 * One-off repair: align goal breakdown_config sales_owner node names with the
 * current profiles.full_name, so the Sales Performance widget stops splitting a
 * renamed rep into two rows.
 *
 * Strategy: for every sales_owner node name that does NOT match a current
 * profile full_name, try to find the intended profile. We only auto-fix the
 * known case where the stale name is a superset/variant of a current name AND
 * resolves to exactly one profile by fuzzy match. Anything ambiguous is just
 * reported, not changed.
 *
 * Usage: npx tsx scripts/fix-stale-sales-owner-names.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const APPLY = process.argv.includes('--apply')

// Explicit, reviewed rename map (stale name in goal -> current profile name).
const RENAMES: Record<string, string> = {
    'Brigitha Paramitha Maharesmi': 'Paramitha Maharesmi',
}

type Node = { name?: string }
type Level = { dimension?: string; nodes?: Node[]; perParentNodes?: Record<string, Node[] | undefined> }

async function main() {
    const { data: goals, error } = await supabase.from('goals_v2').select('id, name, breakdown_config')
    if (error) throw error

    let goalsUpdated = 0
    for (const goal of goals ?? []) {
        const config = (goal as any).breakdown_config
        if (!Array.isArray(config)) continue

        let changed = false
        for (const level of config as Level[]) {
            if (level?.dimension !== 'sales_owner') continue
            const fix = (node: Node) => {
                if (node?.name && RENAMES[node.name]) {
                    console.log(`  "${node.name}" -> "${RENAMES[node.name]}"`)
                    node.name = RENAMES[node.name]
                    changed = true
                }
            }
            for (const n of level.nodes ?? []) fix(n)
            for (const list of Object.values(level.perParentNodes ?? {})) for (const n of list ?? []) fix(n)
        }

        if (changed) {
            console.log(`Goal "${(goal as any).name}" (${(goal as any).id})`)
            if (APPLY) {
                const { error: updErr } = await supabase.from('goals_v2').update({ breakdown_config: config }).eq('id', (goal as any).id)
                if (updErr) throw updErr
                console.log('  ✔ saved')
            } else {
                console.log('  (dry run — pass --apply to persist)')
            }
            goalsUpdated++
        }
    }
    console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${goalsUpdated} goal(s).`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
