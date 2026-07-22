/**
 * Run the latest migration directly against Supabase.
 * Usage: npx tsx scripts/run-migration.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync } from 'fs'

dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
    console.error('❌ Missing env vars')
    process.exit(1)
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
    const migrationFile = resolve(__dirname, '..', 'supabase/migrations/20260507010000_add_bio_to_profiles_and_audit_logs.sql')
    const sql = readFileSync(migrationFile, 'utf-8')

    console.log('🚀 Running migration...')
    console.log('   File:', migrationFile.split('migrations/')[1])

    // Split by semicolons and run each statement
    const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

    for (const stmt of statements) {
        const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' }).single()
        if (error) {
            // Try direct query via REST if rpc doesn't exist
            console.log(`   ⚠️  RPC not available, trying raw...`)
            break
        }
    }

    // Fallback: run via fetch to Supabase REST SQL endpoint
    const res = await fetch(`${url}/rest/v1/rpc/`, {
        method: 'POST',
        headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
        },
    })

    // Actually, let's just run each statement individually via the postgres connection
    // The simplest approach: use supabase.from() for DDL won't work.
    // Let's use the SQL editor endpoint instead.

    console.log('\n📋 Migration SQL to run manually in Supabase SQL Editor:')
    console.log('─'.repeat(60))
    console.log(sql)
    console.log('─'.repeat(60))
    console.log('\n✅ Copy the SQL above and paste it in:')
    console.log('   Supabase Dashboard → SQL Editor → New Query → Run')
    console.log('\n   URL: ' + url.replace('.supabase.co', '.supabase.co/project/default/sql'))
}

main().catch(console.error)
