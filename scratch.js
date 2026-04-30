const fs = require('fs');
let content = fs.readFileSync('src/features/goals/components/settings/goal-configuration-page.tsx', 'utf8');

// 1. Remove max-w-7xl and mx-auto
content = content.replace(
  '<div className="target-config w-full max-w-7xl mx-auto min-h-screen bg-[#f2f3f6]">',
  '<div className="target-config w-full min-h-screen bg-[#f2f3f6]">'
);

// 2. Format weight values to 2 decimals
content = content.replace(
  '<div style={{ fontSize: 12, fontWeight: 600 }}>{w}%</div>',
  '<div style={{ fontSize: 12, fontWeight: 600 }}>{parseFloat(Number(w).toFixed(2))}%</div>'
);

// 3. Make Monthly Weights grid responsive
content = content.replace(
  '<div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 5 }}>',
  '<div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-12 gap-2">'
);

fs.writeFileSync('src/features/goals/components/settings/goal-configuration-page.tsx', content);
