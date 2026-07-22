import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"

config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function seedOptions() {
    const months = [
        "Q1", "Q2", "Q3", "Q4",
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
        "TBA"
    ]

    const y = new Date().getFullYear()
    const years = [String(y - 1), String(y), String(y + 1), String(y + 2), String(y + 3), String(y + 4), "TBA"]

    console.log("Seeding tentative_month...")
    for (let i = 0; i < months.length; i++) {
        await supabase.from("master_options").upsert({
            option_type: "tentative_month",
            label: months[i],
            value: months[i],
            sort_order: i,
            is_active: true
        }, { onConflict: "option_type,value" }).select()
    }

    console.log("Seeding tentative_year...")
    for (let i = 0; i < years.length; i++) {
        await supabase.from("master_options").upsert({
            option_type: "tentative_year",
            label: years[i],
            value: years[i],
            sort_order: i,
            is_active: true
        }, { onConflict: "option_type,value" })
    }

    // Now make sure they appear in system_setting so they show up in MasterOptions UI
    // wait, we don't need system_setting for option categories, we just need them to exist. 
    // Wait, the master_options page might have a hardcoded list of tabs.
    console.log("Done!")
}

seedOptions()
