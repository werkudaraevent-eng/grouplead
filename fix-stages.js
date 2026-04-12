const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://lfudnmpcmgiopbtluukd.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmdWRubXBjbWdpb3BidGx1dWtkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTM4MzkxMCwiZXhwIjoyMDg2OTU5OTEwfQ.uXuBWFTab9EidE5ZnjJ7soXizO-jkaEVA1JfB8TLKqA'
const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    const { data, error } = await supabase.from('pipeline_stages').select('*').order('sort_order')
    if (error) {
        console.error("Error fetching stages:", error)
        return
    }

    console.log("Current stages by ID:", data.map(s => ({ id: s.id, name: s.name, sort_order: s.sort_order })))

    // Expected order logic based on typical sales pipeline / the screenshot:
    // Lead Masuk / Initial / New
    // Estimasi Project / Qualification
    // Proposal/ Quotation Sent
    // Proposal/ Quotation Revise
    // Negotiation
    // Closed Won
    // Closed Lost

    // Let's identify the current stages and sort them properly.
    const standardOrder = [
        "Lead In",
        "Lead Masuk",
        "Identify Needs",
        "Estimasi Project",
        "Pitching / Brainstorming",
        "Proposal/ Quotation Sent",
        "Proposal Sent",
        "Proposal/ Quotation Revise",
        "Negotiation",
        "Closed Won",
        "Closed Lost"
    ]

    const updates = []
    
    // Process main pipeline
    for (const stage of data) {
        let newOrder = standardOrder.indexOf(stage.name)
        if (newOrder === -1) {
            newOrder = 99 // Put unknown ones at the end before Closed Lost
        }
        updates.push({ ...stage, sort_order: newOrder })
    }

    // Now, let's fix any 99 overlap by assigning them consecutive numbers, 
    // but reserving large numbers for Closed Won and Closed Lost.

    updates.sort((a,b) => {
        const orderA = standardOrder.indexOf(a.name)
        const orderB = standardOrder.indexOf(b.name)
        
        let aVal = orderA !== -1 ? orderA : 50; // default unknown to middle
        let bVal = orderB !== -1 ? orderB : 50;

        if (a.name.toLowerCase().includes('won')) aVal = 100;
        if (a.name.toLowerCase().includes('lost')) aVal = 101;
        
        if (b.name.toLowerCase().includes('won')) bVal = 100;
        if (b.name.toLowerCase().includes('lost')) bVal = 101;

        return aVal - bVal;
    })

    console.log("Planned new order:")
    let i = 1;
    for (const u of updates) {
        console.log(`${i}. ${u.name} (Pipeline: ${u.pipeline_id})`)
        const { error: updErr } = await supabase.from('pipeline_stages').update({ sort_order: i }).eq('id', u.id)
        if (updErr) console.error("Update failed for", u.name, updErr)
        i++;
    }
}

main()
