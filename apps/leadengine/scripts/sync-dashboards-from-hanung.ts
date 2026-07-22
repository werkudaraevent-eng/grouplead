import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const SOURCE_EMAIL = 'hanungsastria13@gmail.com'

async function main() {
    // 1. Resolve Hanung's user id via the auth admin API (paginate to be safe).
    let sourceUserId: string | null = null
    let page = 1
    while (!sourceUserId) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
        if (error) { console.error('listUsers error:', error.message); return }
        if (!data.users.length) break
        const match = data.users.find(u => (u.email ?? '').toLowerCase() === SOURCE_EMAIL.toLowerCase())
        if (match) sourceUserId = match.id
        if (data.users.length < 200) break
        page++
    }
    if (!sourceUserId) { console.error(`❌ User ${SOURCE_EMAIL} not found`); return }
    console.log('Source user (Hanung):', sourceUserId)

    // 2. Get Hanung's default dashboard view (fallback to first).
    const { data: views, error: vErr } = await supabase
        .from('user_dashboard_views')
        .select('*')
        .eq('user_id', sourceUserId)
        .order('is_default', { ascending: false })
        .order('sort_order', { ascending: true })
    if (vErr) { console.error('view fetch error:', vErr.message); return }
    if (!views || views.length === 0) { console.error('❌ Hanung has no dashboard views to copy'); return }
    const src = views.find(v => v.is_default) ?? views[0]
    console.log('Source view:', src.name)
    console.log('  widgets in layout:', Array.isArray(src.layout_data) ? src.layout_data.length : 0)
    console.log('  hidden widgets:', Array.isArray(src.hidden_widgets) ? src.hidden_widgets.length : 0)

    // 3. Count target users (all active profiles except Hanung).
    const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, full_name')
        .neq('id', sourceUserId)
    if (pErr) { console.error('profiles error:', pErr.message); return }
    console.log(`\nTarget users (excluding Hanung): ${profiles?.length ?? 0}`)
    for (const p of profiles ?? []) console.log('  -', p.full_name ?? p.id)

    console.log('\n[DRY RUN] No changes made. Re-run with --apply to overwrite.')

    if (process.argv.includes('--apply')) {
        console.log('\n=== APPLYING ===')
        let ok = 0, fail = 0
        for (const p of profiles ?? []) {
            // Clean slate: remove existing views, then insert a copy of Hanung's.
            const del = await supabase.from('user_dashboard_views').delete().eq('user_id', p.id)
            if (del.error) { console.error('  delete fail', p.id, del.error.message); fail++; continue }
            const ins = await supabase.from('user_dashboard_views').insert({
                user_id: p.id,
                name: 'My Dashboard',
                layout_data: src.layout_data,
                hidden_widgets: src.hidden_widgets,
                filters: {}, // reset filters so each user sees data per their own access
                is_default: true,
                sort_order: 0,
            })
            if (ins.error) { console.error('  insert fail', p.id, ins.error.message); fail++; continue }
            ok++
        }
        console.log(`\nDone. Overwritten: ${ok}, failed: ${fail}`)
    }
}
main().catch(console.error)
