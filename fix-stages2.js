const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://lfudnmpcmgiopbtluukd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdWRubXBjbWdpb3BidGx1dWtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM4MzkxMCwiZXhwIjoyMDg2OTU5OTEwfQ.uXuBWFTab9EidE5ZnjJ7soXizO-jkaEVA1JfB8TLKqA'
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase.from('pipeline_stages').select('*').order('sort_order')
    if (error) return

    const byPipeline = {}
    for (const d of data) {
        byPipeline[d.pipeline_id] = byPipeline[d.pipeline_id] || []
        byPipeline[d.pipeline_id].push(d)
    }

    const standardOrder = [
        "Lead In",
        "Lead Masuk",
        "Identify Needs",
        "Estimasi Project",
        "Pitching / Brainstorming",
        "Proposal/ Quotation Sent",
        "Proposal/ Quotation Revise",
        "Proposal Sent",
        "Negotiation",
        "Closed Won",
        "Closed Lost"
    ]

    for (const pipelineId of Object.keys(byPipeline)) {
        const stages = byPipeline[pipelineId]
        console.log(`Pipeline ${pipelineId}:`)
        
        stages.sort((a,b) => {
            const orderA = standardOrder.indexOf(a.name)
            const orderB = standardOrder.indexOf(b.name)
            
            let aVal = orderA !== -1 ? orderA : 50;
            let bVal = orderB !== -1 ? orderB : 50;

            if (a.name.toLowerCase().includes('won')) aVal = 100;
            if (a.name.toLowerCase().includes('lost')) aVal = 101;
            
            if (b.name.toLowerCase().includes('won')) bVal = 100;
            if (b.name.toLowerCase().includes('lost')) bVal = 101;

            return aVal - bVal;
        })

        let i = 1;
        for (const u of stages) {
            console.log(`  ${i}. ${u.name}`)
            await supabase.from('pipeline_stages').update({ sort_order: i }).eq('id', u.id)
            i++
        }
    }
}

main()
