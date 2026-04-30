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
  const { data, error } = await supabase.from('master_options').select('*').limit(1);
  if (error) console.error("Error:", error);
  else console.log("Data:", JSON.stringify(data, null, 2));
}

main().catch(console.error);
