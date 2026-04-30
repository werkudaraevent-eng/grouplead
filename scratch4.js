const fs = require('fs');
let content = fs.readFileSync('src/features/goals/components/settings/goal-configuration-page.tsx', 'utf8');

// 1. Add imports
content = content.replace(
  'import { Loader2 } from "lucide-react";',
  'import { Loader2 } from "lucide-react";\nimport { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";'
);

// 2. Replace `<select>` block
const oldSelectBlock = `<select value={level.dimension} onChange={e => changeDimension(idx, e.target.value)} style={{ flex: 1, border: "none", fontSize: 13, fontWeight: 600, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                          
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

                        </select>`;

const newSelectBlock = `<div style={{ flex: 1 }}>
                          <Select value={level.dimension} onValueChange={e => changeDimension(idx, e)}>
                            <SelectTrigger className="w-full border-none shadow-none focus:ring-0 focus:ring-offset-0 px-2 py-1 h-auto bg-transparent hover:bg-slate-50 relative" style={{ fontSize: 13, fontWeight: 600 }}>
                              <SelectValue placeholder="Select dimension..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {Object.entries(DIMENSION_OPTIONS.reduce((acc, d) => {
                                const g = d.source === "entity" ? "Entities" : d.source === "segment" ? "Segments" : d.source === "lead_attribute" ? "Lead Attributes" : d.source === "company_attribute" ? "Company Attributes" : d.source === "contact_attribute" ? "Contact Attributes" : "Other";
                                if (!acc[g]) acc[g] = [];
                                acc[g].push(d);
                                return acc;
                              }, {})).map(([groupName, opts]) => (
                                <SelectGroup key={groupName}>
                                  <SelectLabel className="text-[10px] uppercase font-bold text-slate-400 py-1.5">{groupName}</SelectLabel>
                                  {opts.map(d => <SelectItem key={d.id} value={d.id} className="text-xs cursor-pointer">{d.label}</SelectItem>)}
                                </SelectGroup>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>`;

if (content.includes(oldSelectBlock)) {
  content = content.replace(oldSelectBlock, newSelectBlock);
  fs.writeFileSync('src/features/goals/components/settings/goal-configuration-page.tsx', content);
  console.log("Successfully patched select element");
} else {
  console.error("Could not find the select block to patch. Maybe it was formatted differently.");
}
