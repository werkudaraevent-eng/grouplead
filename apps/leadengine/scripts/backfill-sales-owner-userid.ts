/**
 * Backfill `userId` onto every sales_owner node in goals_v2.breakdown_config.
 *
 * Why: nodes historically stored only a display name. The Sales Performance
 * widget now prefers `node.userId` to key targets (rename-proof). This script
 * resolves each node's name to a current profiles.id and writes it in, so
 * existing goals become rename-proof too.
 *
 * Resolution: exact match on profiles.full_name. Names that don't resolve are
 * reported and left untouched (no guessing).
 *
 * Usage: npx tsx scripts/backfill-sales-owner-userid.ts [--apply]
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

const APPLY = process.argv.includes('--apply')

type Node = { name?: string; userId?: string }
type Level = { dimension?: string; nodes?: Node[]; perParentNodes?: Record<string, Node[] | undefined> }

async function main() {
    // Build name -> id map from all profiles.
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name')
    if (pErr) throw pErr
    const idByName = new Map<string, string>()
    for (const p of profiles ?? []) if (p.full_name) idByName.set(p.full_name, p.id)

    const { data: goals, error } = await supabase.from('goals_v2').select('id, name, breakdown_config')
    if (error) throw error

    const unresolved = new Set<string>()
    let goalsUpdated = 0

    for (const goal of goals ?? []) {
        const config = (goal as any).breakdown_config
        if (!Array.isArray(config)) continue

        let changed = false
        const apply = (node: Node) => {
            if (!node?.name || node.userId) return
            const id = idByName.get(node.name)
            if (id) { node.userId = id; changed = true }
            else unresolved.add(node.name)
        }

        for (const level of config as Level[]) {
            if (level?.dimension !== 'sales_owner') continue
            for (const n of level.nodes ?? []) apply(n)
            for (const list of Object.values(level.perParentNodes ?? {})) for (const n of list ?? []) apply(n)
        }

        if (changed) {
            console.log(`Goal "${(goal as any).name}" (${(goal as any).id}) — added userId to nodes`)
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

    if (unresolved.size > 0) {
        console.log('\n⚠ Unresolved names (no matching profile.full_name) — left untouched:')
        for (const n of unresolved) console.log('  -', n)
    }
    console.log(`\n${APPLY ? 'Updated' : 'Would update'} ${goalsUpdated} goal(s).`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
