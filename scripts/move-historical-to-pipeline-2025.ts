/**
 * Script: Move historical imported leads to "Group Lead 2025" pipeline
 * 
 * Run with: npx tsx scripts/move-historical-to-pipeline-2025.ts
 * 
 * What it does:
 * 1. Finds the "Group Lead 2025" pipeline
 * 2. Finds all leads imported via Historical Import (from lead_activities log)
 * 3. Finds the "Closed Won" stage in that pipeline
 * 4. Moves all historical leads to that pipeline + stage
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load .env.local
dotenv.config({ path: resolve(__dirname, '..', '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !serviceKey) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
    console.log('🔍 Finding "Group Lead 2025" pipeline...')

    // 1. Find the target pipeline
    const { data: pipeline, error: pipeErr } = await supabase
        .from('pipelines')
        .select('id, name')
        .ilike('name', '%2025%')
        .single()

    if (pipeErr || !pipeline) {
        console.error('❌ Pipeline "Group Lead 2025" not found:', pipeErr?.message)
        console.log('   Available pipelines:')
        const { data: all } = await supabase.from('pipelines').select('id, name')
        all?.forEach(p => console.log(`   - ${p.name} (${p.id})`))
        process.exit(1)
    }
    console.log(`✅ Found pipeline: "${pipeline.name}" (${pipeline.id})`)

    // 2. Find "Closed Won" stage in that pipeline
    const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, name, sort_order')
        .eq('pipeline_id', pipeline.id)
        .order('sort_order', { ascending: true })

    if (!stages || stages.length === 0) {
        console.error('❌ No stages found in pipeline. Please create stages first.')
        process.exit(1)
    }

    console.log(`   Stages in "${pipeline.name}":`)
    stages.forEach(s => console.log(`   - ${s.name} (${s.id})`))

    const closedWonStage = stages.find(s => s.name.toLowerCase().includes('closed won'))
    const fallbackStage = stages[0] // First stage as fallback

    const targetStage = closedWonStage || fallbackStage
    console.log(`\n🎯 Target stage: "${targetStage.name}" (${targetStage.id})`)

    // 3. Find all leads imported via Historical Import
    console.log('\n🔍 Finding historically imported leads...')

    const { data: activities, error: actErr } = await supabase
        .from('lead_activities')
        .select('lead_id')
        .ilike('description', '%Historical Import%')

    if (actErr) {
        console.error('❌ Error querying lead_activities:', actErr.message)
        process.exit(1)
    }

    if (!activities || activities.length === 0) {
        // Fallback: find leads imported via standard import that have old created_at dates
        console.log('   No "Historical Import" activities found.')
        console.log('   Trying fallback: leads imported via Import with created_at before 2026...')

        const { data: importActivities } = await supabase
            .from('lead_activities')
            .select('lead_id')
            .eq('action_type', 'Create')
            .ilike('description', '%Import%')

        if (!importActivities || importActivities.length === 0) {
            console.log('   No imported leads found at all.')
            process.exit(0)
        }

        // Get those leads and check their created_at
        const leadIds = [...new Set(importActivities.map(a => a.lead_id))]
        const { data: oldLeads } = await supabase
            .from('leads')
            .select('id, created_at, project_name')
            .in('id', leadIds)
            .lt('created_at', '2026-01-01')

        if (!oldLeads || oldLeads.length === 0) {
            console.log('   No leads with created_at before 2026 found.')
            
            // Last resort: find ALL imported leads that are in the current pipeline
            console.log('   Trying: all imported leads in current active pipeline...')
            const { data: currentPipeline } = await supabase
                .from('pipelines')
                .select('id, name')
                .neq('id', pipeline.id)
                .limit(1)
                .single()

            if (currentPipeline) {
                const { data: leadsInCurrent } = await supabase
                    .from('leads')
                    .select('id, project_name, pipeline_id')
                    .eq('pipeline_id', currentPipeline.id)
                    .in('id', leadIds)

                if (leadsInCurrent && leadsInCurrent.length > 0) {
                    console.log(`\n📦 Found ${leadsInCurrent.length} imported leads in "${currentPipeline.name}"`)
                    await moveLeads(leadsInCurrent.map(l => l.id), pipeline.id, targetStage.id)
                }
            }
            process.exit(0)
        }

        console.log(`\n📦 Found ${oldLeads.length} leads with created_at before 2026`)
        oldLeads.slice(0, 5).forEach(l => console.log(`   - [${l.id}] ${l.project_name} (${l.created_at})`))
        if (oldLeads.length > 5) console.log(`   ... and ${oldLeads.length - 5} more`)

        await moveLeads(oldLeads.map(l => l.id), pipeline.id, targetStage.id)
        return
    }

    const leadIds = [...new Set(activities.map(a => a.lead_id))]
    console.log(`📦 Found ${leadIds.length} historically imported leads`)

    // Show sample
    const { data: sampleLeads } = await supabase
        .from('leads')
        .select('id, project_name, created_at, pipeline_id')
        .in('id', leadIds.slice(0, 5))

    sampleLeads?.forEach(l => console.log(`   - [${l.id}] ${l.project_name} (created: ${l.created_at})`))
    if (leadIds.length > 5) console.log(`   ... and ${leadIds.length - 5} more`)

    await moveLeads(leadIds, pipeline.id, targetStage.id)
}

async function moveLeads(leadIds: number[], pipelineId: string, stageId: string) {
    console.log(`\n🚀 Moving ${leadIds.length} leads to pipeline...`)

    // Batch update in chunks of 100
    const chunkSize = 100
    let moved = 0

    for (let i = 0; i < leadIds.length; i += chunkSize) {
        const chunk = leadIds.slice(i, i + chunkSize)
        const { error } = await supabase
            .from('leads')
            .update({ pipeline_id: pipelineId, pipeline_stage_id: stageId })
            .in('id', chunk)

        if (error) {
            console.error(`   ❌ Error updating chunk ${i}-${i + chunk.length}:`, error.message)
        } else {
            moved += chunk.length
            console.log(`   ✅ Moved ${moved}/${leadIds.length}`)
        }
    }

    console.log(`\n✅ Done! ${moved} leads moved to pipeline.`)
    console.log('   They will now appear in the "Group Lead 2025" pipeline kanban.')
}

main().catch(console.error)
