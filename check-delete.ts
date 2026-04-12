import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

async function run() {
    console.log("Checking master_options...")
    const { data: options, error: err1 } = await supabase.from("master_options").select("id, option_type, company_id").eq("option_type", "custom_companies__testing")
    console.log("Existing options:", options)
    
    if (options && options.length > 0) {
        console.log("Attempting to delete...")
        const { data: deleted, error: err2 } = await supabase.from("master_options").delete().eq("option_type", "custom_companies__testing").select()
        console.log("Deleted response:", deleted, err2)
    }
}

run()
