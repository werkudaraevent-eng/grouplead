const fs = require('fs');
let content = fs.readFileSync('src/features/goals/components/settings/goal-configuration-page.tsx', 'utf8');

// 1. Group the DIMENSION_OPTIONS mapping
// Replace: {DIMENSION_OPTIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
// With a mapped grouped options.
// Wait, the group is available in `d.source` because I mapped it earlier: `source: d.group`.
const groupMapping = `
{Object.entries(DIMENSION_OPTIONS.reduce((acc, d) => {
  const g = d.source === "entity" ? "Entities" : d.source === "segment" ? "Segments" : d.source === "lead_attribute" ? "Lead Attributes" : "Other";
  if (!acc[g]) acc[g] = [];
  acc[g].push(d);
  return acc;
}, {})).map(([groupName, opts]) => (
  <optgroup key={groupName} label={groupName}>
    {opts.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
  </optgroup>
))}
`;

content = content.replace(
  '{DIMENSION_OPTIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}',
  groupMapping
);

// 2. Add an auto-populate action to the Add Node area.
// Put it below the add node input.
content = content.replace(
  'import { updateGoalV2Action } from "@/app/actions/goal-actions";',
  'import { updateGoalV2Action } from "@/app/actions/goal-actions";\nimport { createClient } from "@/utils/supabase/client";'
);

const autoPopulateLogic = `
  const [fetchingNodes, setFetchingNodes] = useState(false);
  const autoPopulateNodes = async (idx) => {
    setFetchingNodes(true);
    try {
      const supabase = createClient();
      const dim = levels[idx].dimension;
      let newNodes = [];
      if (dim === "subsidiary") {
        const { data } = await supabase.from("companies").select("name").eq("tipe", "Subsidiary");
        newNodes = data?.map(d => d.name) || [];
      } else if (dim === "client_company") {
        const { data } = await supabase.from("client_companies").select("name").eq("company_id", goal.company_id);
        newNodes = data?.map(d => d.name) || [];
      } else if (dim === "sales_owner") {
        const { data } = await supabase.from("profiles").select("full_name");
        // we might filter by is_sales if it exists, otherwise just take names
        newNodes = data?.map(d => d.full_name) || [];
      } else if (dim.startsWith("segment:")) {
        toast.info("Segments must be added manually currently.");
      } else {
        const { data } = await supabase.from("master_options").select("name").eq("option_type", dim).eq("is_active", true);
        newNodes = data?.map(d => d.name) || [];
      }
      
      if (newNodes.length > 0) {
        const existingNames = new Set(levels[idx].nodes.map(n => n.name));
        const added = newNodes.filter(n => !Boolean(existingNames.has(n)) && Boolean(n));
        if (added.length > 0) {
          const next = [...levels];
          for(const name of added) next[idx].nodes.push({ name, value: 0, pct: 0 });
          setLevels(next);
          toast.success(\`Auto-added \${added.length} options from DB!\`);
        } else {
           toast.info("All options from DB are already here.");
        }
      } else {
         toast.error("No values found in DB for this module.");
      }
    } catch(e) {
      console.error(e);
      toast.error(e.message);
    } finally {
      setFetchingNodes(false);
    }
  };

  const saveConfiguration = async () => {
`;
content = content.replace('  const saveConfiguration = async () => {', autoPopulateLogic);

const autoPopulateButton = `
              <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "0 10px" }}>
                <input value={newNodeName} onChange={e => setNewNodeName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") addNode(panelIdx); }}
                  placeholder={\`Add \${panelDim?.label.toLowerCase()}...\`}
                  style={{ flex: 1, padding: "6px 10px", border: "1px solid #e5e8ed", borderRadius: 7, fontSize: 12, fontFamily: "inherit" }} />
                <button onClick={() => addNode(panelIdx)} style={{ background: panelColor, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>
              <div style={{ padding: "8px 10px 0" }}>
                <button onClick={() => autoPopulateNodes(panelIdx)} disabled={fetchingNodes} style={{ width: "100%", padding: "6px 0", background: "#f8f9fb", border: "1px solid #e5e8ed", borderRadius: 7, fontSize: 10.5, fontWeight: 600, color: "#6366f1", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  {fetchingNodes ? <Loader2 className="h-3 w-3 animate-spin"/> : "⚡"} Auto-fetch available {panelDim?.label.toLowerCase()} from DB
                </button>
              </div>
`;

content = content.replace(
  '<div style={{ display: "flex", gap: 6, marginTop: 8, padding: "0 10px" }}>\n                <input value={newNodeName} onChange={e => setNewNodeName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") addNode(panelIdx); }}\n                  placeholder={`Add ${panelDim?.label.toLowerCase()}...`}\n                  style={{ flex: 1, padding: "6px 10px", border: "1px solid #e5e8ed", borderRadius: 7, fontSize: 12, fontFamily: "inherit" }} />\n                <button onClick={() => addNode(panelIdx)} style={{ background: panelColor, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>\n              </div>',
  autoPopulateButton
);

fs.writeFileSync('src/features/goals/components/settings/goal-configuration-page.tsx', content);
