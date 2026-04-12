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
        "Incoming Lead",
        "Lead In",
        "Lead Masuk",
        "Identify Needs",
        "Estimasi Project",
        "Pitching / Brainstorming",
        "Proposal/ Quotation Sent",
        "Proposal/ Quotation Revise",
        "Follow up Quotation & Proposal",
        "Proposal Sent",
        "Negotiation",
        "Closed Won",
        "Closed Turndown",
        "Closed Postponed",
        "Closed Cancelled",
        "Closed Lost"
    ]

    for (const pipelineId of Object.keys(byPipeline)) {
        const stages = byPipeline[pipelineId]
        
        stages.sort((a,b) => {
            const orderA = standardOrder.indexOf(a.name)
            const orderB = standardOrder.indexOf(b.name)
            
            let aVal = orderA !== -1 ? orderA : 50;
            let bVal = orderB !== -1 ? orderB : 50;
            
            // force all closed status to the end
            if (a.name.toLowerCase().includes('closed')) {
                if (a.name.toLowerCase().includes('won')) aVal = 100;
                else aVal = 101 + standardOrder.indexOf(a.name); // keep relative order of other closed statuses if possible
            }
            if (b.name.toLowerCase().includes('closed')) {
                if (b.name.toLowerCase().includes('won')) bVal = 100;
                else bVal = 101 + standardOrder.indexOf(b.name);
            }

            return aVal - bVal;
        })

        console.log(`Pipeline ${pipelineId}:`)
        let i = 1;
        for (const u of stages) {
            console.log(`  ${i}. ${u.name}`)
            await supabase.from('pipeline_stages').update({ sort_order: i }).eq('id', u.id)
            i++
        }
    }
}

main()
