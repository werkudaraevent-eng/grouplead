const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = envContent.split(/\r?\n/).reduce((acc, line) => {
  const i = line.indexOf('=');
  if (i > 0) {
    acc[line.slice(0, i)] = line.slice(i + 1).replace(/^"|"$/g, '').trim();
  }
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function main() {
  // 1. Check companies table structure and data
  console.log("=== COMPANIES TABLE ===");
  const { data: companies, error: compErr } = await supabase.from("companies").select("*").limit(5);
  if (compErr) console.error("Companies error:", compErr.message);
  else {
    console.log("Companies count:", companies?.length);
    if (companies?.[0]) console.log("Companies columns:", Object.keys(companies[0]));
    companies?.forEach(c => console.log(`  - ${c.name} | tipe: ${c.tipe} | is_holding: ${c.is_holding}`));
  }

  // 2. Check client_companies
  console.log("\n=== CLIENT_COMPANIES TABLE ===");
  const { data: clients, error: clientErr } = await supabase.from("client_companies").select("name, company_id").limit(5);
  if (clientErr) console.error("Client companies error:", clientErr.message);
  else {
    console.log("Client companies count:", clients?.length);
    clients?.forEach(c => console.log(`  - ${c.name} (company_id: ${c.company_id})`));
  }

  // 3. Check profiles
  console.log("\n=== PROFILES TABLE ===");
  const { data: profiles, error: profErr } = await supabase.from("profiles").select("full_name, is_active, role").limit(5);
  if (profErr) console.error("Profiles error:", profErr.message);
  else {
    console.log("Profiles count:", profiles?.length);
    profiles?.forEach(p => console.log(`  - ${p.full_name} | active: ${p.is_active} | role: ${p.role}`));
  }

  // 4. Check master_options - what option_types exist?
  console.log("\n=== MASTER_OPTIONS - OPTION TYPES ===");
  const { data: allOpts, error: optErr } = await supabase.from("master_options").select("option_type, value, company_id, is_active");
  if (optErr) console.error("Master options error:", optErr.message);
  else {
    const typeMap = {};
    allOpts?.forEach(o => {
      if (!typeMap[o.option_type]) typeMap[o.option_type] = [];
      typeMap[o.option_type].push(o.value);
    });
    console.log("Total rows:", allOpts?.length);
    for (const [type, values] of Object.entries(typeMap)) {
      console.log(`  ${type}: [${values.slice(0, 5).join(", ")}]${values.length > 5 ? ` ...+${values.length - 5} more` : ""}`);
    }
  }

  // 5. Check specifically category
  console.log("\n=== CATEGORY SPECIFICALLY ===");
  const { data: cats, error: catErr } = await supabase.from("master_options").select("*").eq("option_type", "category").eq("is_active", true);
  if (catErr) console.error("Category error:", catErr.message);
  else {
    console.log("Category count:", cats?.length);
    cats?.forEach(c => console.log(`  - value: "${c.value}" | label: "${c.label}" | company_id: ${c.company_id}`));
  }

  // 6. Check what goal data we have to know company_id
  console.log("\n=== GOALS_V2 ===");
  const { data: goals, error: goalErr } = await supabase.from("goals_v2").select("id, name, company_id, target_amount").limit(3);
  if (goalErr) console.error("Goals error:", goalErr.message);
  else {
    goals?.forEach(g => console.log(`  - ${g.name} | company_id: ${g.company_id} | target: ${g.target_amount}`));
  }
}

main().catch(console.error);
