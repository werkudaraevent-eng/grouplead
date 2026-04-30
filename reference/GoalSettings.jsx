import { useState, useRef, useEffect } from "react";

const LEVEL_COLORS = ["#6366f1","#0ea5e9","#8b5cf6","#10b981","#f59e0b","#ec4899"];
const DIMENSION_OPTIONS = [
  { id: "subsidiary", label: "Subsidiary", source: "companies table" },
  { id: "segment", label: "Segment", source: "leads.category" },
  { id: "stream", label: "Stream", source: "leads.stream_type" },
  { id: "region", label: "Region", source: "leads.area" },
  { id: "source_client", label: "Source Client", source: "leads.lead_source" },
  { id: "sales_person", label: "Sales Person", source: "profiles table" },
  { id: "destination", label: "Destination", source: "leads.destinations" },
];

const INITIAL_LEVELS = [
  {
    id: 1, dimension: "subsidiary", allocMode: "absolute",
    nodes: [
      { name: "Werkudara Nirwana Sakti", value: 45000000000, pct: 34.6 },
      { name: "Werkudara Nirwana Wisata", value: 35000000000, pct: 26.9 },
      { name: "Jogja", value: 22000000000, pct: 16.9 },
      { name: "TEE", value: 15000000000, pct: 11.5 },
      { name: "UK", value: 8000000000, pct: 6.2 },
      { name: "Creative", value: 5000000000, pct: 3.8 },
    ]
  },
  {
    id: 2, dimension: "segment", allocMode: "percentage", applyAll: true,
    nodes: [
      { name: "MICE", value: 0, pct: 30 },
      { name: "Travel", value: 0, pct: 20 },
      { name: "Creative", value: 0, pct: 15 },
      { name: "Retail", value: 0, pct: 15 },
      { name: "Training", value: 0, pct: 10 },
      { name: "Wellness", value: 0, pct: 7 },
      { name: "Healthcare", value: 0, pct: 3 },
    ]
  },
];

const DEFAULT_WEIGHTS = {1:2,2:4,3:5,4:10,5:13,6:14,7:15,8:9,9:9,10:9,11:2,12:8};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const TOTAL_TARGET = 130000000000;

const fmt = (n) => {
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(0)}M`;
  return `${n}`;
};

function LevelBadge({ level }) {
  const c = LEVEL_COLORS[(level-1) % LEVEL_COLORS.length];
  return <span style={{ fontSize: 9, padding: "1px 5px", minWidth: 22, background: c+"18", color: c, fontWeight: 700, borderRadius: 4, textAlign: "center", display: "inline-block" }}>L{level}</span>;
}

function TreeNode({ node, level }) {
  const [open, setOpen] = useState(level < 3);
  const has = node.children?.length > 0;
  return (
    <div style={{ marginLeft: level === 0 ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2.5px 0", cursor: has ? "pointer" : "default" }} onClick={() => has && setOpen(!open)}>
        {has ? <span style={{ fontSize: 9, color: "#94a3b8", width: 10, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span> : <span style={{ width: 10 }} />}
        {level > 0 && <LevelBadge level={level} />}
        <span style={{ fontSize: level === 0 ? 11.5 : 10.5, fontWeight: level === 0 ? 700 : 400, color: "#374151", flex: 1 }}>{node.name}</span>
        {node.amount > 0 && <span style={{ fontSize: 9, color: "#94a3b8" }}>Rp {fmt(node.amount)}</span>}
      </div>
      {open && has && <div style={{ borderLeft: "1px solid #e5e8ed", marginLeft: 4 }}>{node.children.map((c, i) => <TreeNode key={i} node={c} level={level+1} />)}</div>}
    </div>
  );
}

export default function GoalSettings() {
  const [levels, setLevels] = useState(INITIAL_LEVELS);
  const [weights, setWeights] = useState({...DEFAULT_WEIGHTS});
  const [editWeight, setEditWeight] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelIdx, setPanelIdx] = useState(null);
  const [selectedParentIdx, setSelectedParentIdx] = useState(0);
  const [applyAllMode, setApplyAllMode] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const mainRef = useRef(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const h = () => setScrolled(el.scrollTop > 12);
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  const totalWeight = Object.values(weights).reduce((a,b) => a+b, 0);

  // Get parent amount for a given level index
  const getParentAmount = (levelIdx, parentNodeIdx = 0) => {
    if (levelIdx === 0) return TOTAL_TARGET;
    const parentLevel = levels[levelIdx - 1];
    if (!parentLevel || !parentLevel.nodes[parentNodeIdx]) return TOTAL_TARGET;
    const pn = parentLevel.nodes[parentNodeIdx];
    return pn.value > 0 ? pn.value : TOTAL_TARGET * pn.pct / 100;
  };

  const getParentNodes = (levelIdx) => {
    if (levelIdx === 0) return [{ name: "Company Goal", value: TOTAL_TARGET }];
    return levels[levelIdx - 1]?.nodes || [];
  };

  const openPanel = (idx) => {
    setPanelIdx(idx);
    setPanelOpen(true);
    setSelectedParentIdx(0);
    setApplyAllMode(levels[idx]?.applyAll !== false);
    setNewNodeName("");
  };

  const updateNodeValue = (levelIdx, nodeIdx, field, val) => {
    const updated = [...levels];
    const node = { ...updated[levelIdx].nodes[nodeIdx] };
    const parentAmt = getParentAmount(levelIdx, selectedParentIdx);
    if (field === "value") { node.value = val; node.pct = parentAmt > 0 ? (val / parentAmt) * 100 : 0; }
    else { node.pct = val; node.value = parentAmt * val / 100; }
    updated[levelIdx] = { ...updated[levelIdx], nodes: [...updated[levelIdx].nodes] };
    updated[levelIdx].nodes[nodeIdx] = node;
    setLevels(updated);
  };

  const toggleAllocMode = (idx) => {
    const updated = [...levels];
    updated[idx] = { ...updated[idx], allocMode: updated[idx].allocMode === "percentage" ? "absolute" : "percentage" };
    setLevels(updated);
  };

  const addNode = (levelIdx) => {
    if (!newNodeName.trim()) return;
    const updated = [...levels];
    updated[levelIdx] = { ...updated[levelIdx], nodes: [...updated[levelIdx].nodes, { name: newNodeName.trim(), value: 0, pct: 0 }] };
    setLevels(updated);
    setNewNodeName("");
  };

  const removeNode = (levelIdx, nodeIdx) => {
    const updated = [...levels];
    updated[levelIdx] = { ...updated[levelIdx], nodes: updated[levelIdx].nodes.filter((_,i) => i !== nodeIdx) };
    setLevels(updated);
  };

  const addLevel = () => {
    const used = levels.map(l => l.dimension);
    const avail = DIMENSION_OPTIONS.filter(d => !used.includes(d.id));
    if (!avail.length) return;
    setLevels([...levels, { id: Date.now(), dimension: avail[0].id, allocMode: "percentage", applyAll: true, nodes: [] }]);
  };

  const removeLevel = (idx) => setLevels(levels.filter((_,i) => i !== idx));
  const changeDimension = (idx, dimId) => { const u = [...levels]; u[idx] = { ...u[idx], dimension: dimId, nodes: [] }; setLevels(u); };

  // Build tree
  const buildTree = () => {
    if (!levels.length) return [];
    const root = { name: `Company Goal`, amount: TOTAL_TARGET, children: [] };
    root.children = levels[0].nodes.map(n1 => {
      const amt1 = n1.value > 0 ? n1.value : TOTAL_TARGET * n1.pct / 100;
      const nd1 = { name: n1.name, amount: amt1, children: [] };
      if (levels.length > 1) {
        nd1.children = levels[1].nodes.map(n2 => {
          const amt2 = amt1 * n2.pct / 100;
          const nd2 = { name: n2.name, amount: amt2, children: [] };
          if (levels.length > 2) nd2.children = levels[2].nodes.slice(0,3).map(n3 => ({ name: n3.name, amount: 0, children: [] }));
          return nd2;
        });
      }
      return nd1;
    });
    return [root];
  };

  const tree = buildTree();
  const panelLevel = panelIdx !== null ? levels[panelIdx] : null;
  const panelDim = panelLevel ? DIMENSION_OPTIONS.find(d => d.id === panelLevel.dimension) : null;
  const panelColor = panelIdx !== null ? LEVEL_COLORS[panelIdx % LEVEL_COLORS.length] : "#6366f1";
  const panelParents = panelIdx !== null ? getParentNodes(panelIdx) : [];
  const panelParentAmt = panelIdx !== null ? getParentAmount(panelIdx, selectedParentIdx) : 0;
  const panelIsRoot = panelIdx === 0;

  const panelAllocPct = panelLevel ? panelLevel.nodes.reduce((s,n) => s + (n.pct||0), 0) : 0;
  const panelAllocAmt = panelLevel ? panelLevel.nodes.reduce((s,n) => {
    return s + (panelLevel.allocMode === "absolute" ? (n.value||0) : panelParentAmt * (n.pct||0) / 100);
  }, 0) : 0;
  const panelRemaining = panelParentAmt - panelAllocAmt;

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',sans-serif", display: "flex", height: "100vh", background: "#f2f3f6", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#cdd2da;border-radius:2px}
        input:focus,select:focus{outline:2px solid #6366f1;outline-offset:1px}
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 218, background: "#0f1729", display: "flex", flexDirection: "column", flexShrink: 0, color: "#fff" }}>
        <div style={{ padding: "18px 14px 14px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800 }}>W</div>
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>Werkudara</div><div style={{ fontSize: 10, color: "rgba(255,255,255,.38)" }}>Group Lead</div></div>
          </div>
        </div>
        <nav style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.22)", letterSpacing: 1, padding: "0 7px 5px", textTransform: "uppercase" }}>Menu</div>
          {["Dashboard","Pipeline","Goals","Companies","Contacts"].map(l => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 6, marginBottom: 1, fontSize: 12.5, background: l==="Goals" ? "rgba(99,102,241,.13)" : "transparent", color: l==="Goals" ? "#a5b4fc" : "rgba(255,255,255,.48)", fontWeight: l==="Goals" ? 600 : 400 }}>
              <span style={{ fontSize: 12, opacity: .6 }}>{l==="Dashboard"?"◫":l==="Pipeline"?"◎":l==="Goals"?"⊕":l==="Companies"?"⊞":"◉"}</span>{l}
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.22)", letterSpacing: 1, padding: "16px 7px 5px", textTransform: "uppercase" }}>Administration</div>
          {["Settings","Goal Settings"].map(l => (
            <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 6, marginBottom: 1, fontSize: 12.5, background: l==="Goal Settings" ? "rgba(99,102,241,.13)" : "transparent", color: l==="Goal Settings" ? "#a5b4fc" : "rgba(255,255,255,.48)", fontWeight: l==="Goal Settings" ? 600 : 400 }}>
              <span style={{ fontSize: 12, opacity: .6 }}>⚙</span>{l}
            </div>
          ))}
        </nav>
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>N</div>
          <div><div style={{ fontSize: 12, fontWeight: 600 }}>Hanung Sastria</div><div style={{ fontSize: 9.5, color: "rgba(255,255,255,.28)" }}>Super Admin</div></div>
        </div>
      </aside>

      {/* Main */}
      <main ref={mainRef} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, height: 64, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 24px", background: scrolled ? "rgba(242,243,246,.88)" : "#f2f3f6", backdropFilter: scrolled ? "blur(14px)" : "none", borderBottom: scrolled ? "1px solid #dfe2e7" : "1px solid transparent", transition: "all .22s" }}>
          <div>
            <h1 style={{ fontSize: scrolled ? 15 : 19, fontWeight: 800, color: "#0f1729", transition: "font-size .22s" }}>Goal Configuration</h1>
            <p style={{ fontSize: 11.5, color: "#8892a4", marginTop: 1, opacity: scrolled ? 0 : 1, position: scrolled ? "absolute" : "relative", transition: "opacity .22s" }}>Design your revenue target breakdown structure</p>
          </div>
          <button style={{ background: "#fff", border: "1px solid #dfe2e7", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>📊 View Matrix</button>
        </div>

        <div style={{ padding: "8px 24px 32px" }}>
          {/* Goal Overview */}
          <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "14px 20px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
            <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
              <div><div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Annual target</div><div style={{ fontSize: 22, fontWeight: 800, color: "#0f1729" }}>Rp {fmt(TOTAL_TARGET)}</div></div>
              <div style={{ width: 1, height: 32, background: "#e5e8ed" }} />
              <div><div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Period</div><div style={{ fontSize: 13, fontWeight: 600 }}>Yearly 2026</div></div>
              <div style={{ width: 1, height: 32, background: "#e5e8ed" }} />
              <div><div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Status</div><span style={{ fontSize: 11, fontWeight: 600, color: "#10b981", background: "rgba(16,185,129,.08)", padding: "2px 8px", borderRadius: 4 }}>● Active</span></div>
            </div>
            <button style={{ background: "transparent", border: "1px solid #dfe2e7", borderRadius: 7, padding: "5px 12px", fontSize: 11, color: "#6366f1", cursor: "pointer", fontFamily: "inherit" }}>Edit ✎</button>
          </div>

          {/* 2-Column */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 12, marginBottom: 14 }}>
            {/* Hierarchy Builder */}
            <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Hierarchy builder</div>
              <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 14 }}>Define breakdown levels. Click "Manage nodes" to set names and allocations.</div>

              {levels.map((level, idx) => {
                const dim = DIMENSION_OPTIONS.find(d => d.id === level.dimension);
                const color = LEVEL_COLORS[idx % LEVEL_COLORS.length];
                const allocPct = level.nodes.reduce((s,n) => s + n.pct, 0);
                const parentLabel = idx === 0 ? "Company Goal" : levels[idx-1] ? DIMENSION_OPTIONS.find(d => d.id === levels[idx-1].dimension)?.label : "—";
                return (
                  <div key={level.id}>
                    <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#c0c7d2", cursor: "grab" }}>⠿</span>
                        <LevelBadge level={idx+1} />
                        <select value={level.dimension} onChange={e => changeDimension(idx, e.target.value)} style={{ flex: 1, border: "none", fontSize: 13, fontWeight: 600, background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                          {DIMENSION_OPTIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                        <div style={{ display: "flex", border: "1px solid #e5e8ed", borderRadius: 5, overflow: "hidden" }}>
                          {["percentage","absolute"].map(m => (
                            <button key={m} onClick={() => toggleAllocMode(idx)} style={{ padding: "2px 7px", fontSize: 9, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: level.allocMode === m ? color : "#fff", color: level.allocMode === m ? "#fff" : "#94a3b8" }}>{m==="percentage"?"%":"Rp"}</button>
                          ))}
                        </div>
                        <button onClick={() => removeLevel(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>🗑</button>
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginLeft: 28, marginBottom: 6 }}>
                        Parent: {parentLabel} · {level.nodes.length} nodes · {allocPct.toFixed(0)}% allocated
                      </div>
                      <div style={{ marginLeft: 28, marginBottom: 6, height: 4, background: "#f1f3f5", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(allocPct, 100)}%`, background: allocPct > 100 ? "#ef4444" : color, borderRadius: 2, transition: "width .2s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: 28, marginBottom: 6 }}>
                        {level.nodes.slice(0,5).map((n,ni) => (
                          <span key={ni} style={{ fontSize: 9.5, fontWeight: 500, color, background: color+"10", padding: "2px 7px", borderRadius: 4 }}>
                            {n.name} <strong style={{ opacity: .7 }}>{level.allocMode==="percentage" ? `${n.pct}%` : `Rp${fmt(n.value)}`}</strong>
                          </span>
                        ))}
                        {level.nodes.length > 5 && <span style={{ fontSize: 9.5, color: "#94a3b8" }}>+{level.nodes.length-5}</span>}
                      </div>
                      <div style={{ marginLeft: 28 }}>
                        <button onClick={() => openPanel(idx)} style={{ background: "none", border: "none", fontSize: 11, fontWeight: 600, color: "#6366f1", cursor: "pointer", fontFamily: "inherit" }}>Manage nodes & allocations →</button>
                      </div>
                    </div>
                    {idx < levels.length-1 && <div style={{ display: "flex", justifyContent: "center", padding: "3px 0" }}><div style={{ width: 1.5, height: 18, background: "#d1d5db", position: "relative" }}><div style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", fontSize: 7, color: "#d1d5db" }}>▼</div></div></div>}
                  </div>
                );
              })}

              {levels.length > 0 && <div style={{ display: "flex", justifyContent: "center", padding: "3px 0 6px" }}><div style={{ width: 1.5, height: 14, background: "#d1d5db", position: "relative" }}><div style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", fontSize: 7, color: "#d1d5db" }}>▼</div></div></div>}
              <button onClick={addLevel} style={{ width: "100%", border: "2px dashed #c7d2fe", background: "transparent", borderRadius: 10, padding: "12px", cursor: "pointer", fontFamily: "inherit", transition: "all .15s" }}
                onMouseEnter={e => { e.currentTarget.style.background="#eef2ff"; e.currentTarget.style.borderColor="#6366f1"; }}
                onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#c7d2fe"; }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6366f1" }}>+ Add level</div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>Choose a dimension to break down further</div>
              </button>
            </div>

            {/* Tree Preview */}
            <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "14px", boxShadow: "0 1px 2px rgba(0,0,0,.03)", position: "sticky", top: 80, alignSelf: "start", maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>Live preview</div>
              <div style={{ fontSize: 10, color: "#8892a4", marginBottom: 10 }}>Updates as you change structure</div>
              {!levels.length ? (
                <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8" }}><div style={{ fontSize: 24, opacity: .3, marginBottom: 6 }}>🎯</div><div style={{ fontSize: 11.5 }}>Add levels to see the tree</div></div>
              ) : (
                <div style={{ fontSize: 11 }}>{tree.map((r,i) => <TreeNode key={i} node={r} level={0} />)}</div>
              )}
              {levels.length > 0 && <div style={{ borderTop: "1px solid #f1f3f5", marginTop: 10, paddingTop: 8, fontSize: 9.5, color: "#94a3b8", lineHeight: 1.6 }}>Depth: {levels.length} levels</div>}
            </div>
          </div>

          {/* Monthly Weights */}
          <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "14px 18px", marginBottom: 12, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>Monthly weight distribution</div><div style={{ fontSize: 10.5, color: "#8892a4" }}>Distribute annual target across months</div></div>
              <div style={{ display: "flex", border: "1px solid #e5e8ed", borderRadius: 7, overflow: "hidden" }}>
                {["Equal","Seasonal","Custom"].map(p => (
                  <button key={p} onClick={() => { if(p==="Equal") setWeights(Object.fromEntries(MONTHS.map((_,i)=>[i+1,8.33]))); else if(p==="Seasonal") setWeights({...DEFAULT_WEIGHTS}); }}
                    style={{ padding: "3px 11px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: p==="Custom"?"#6366f1":"#fff", color: p==="Custom"?"#fff":"#5a6178" }}>{p}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(12,1fr)", gap: 5 }}>
              {MONTHS.map((m,i) => {
                const w = weights[i+1]||0;
                const maxW = Math.max(...Object.values(weights));
                const barH = maxW>0 ? (w/maxW)*24 : 0;
                return (
                  <div key={m} style={{ border: editWeight===i?"1.5px solid #6366f1":"1px solid #f1f3f5", borderRadius: 6, padding: "5px 3px", textAlign: "center", cursor: "pointer" }} onClick={() => setEditWeight(i)}>
                    <div style={{ fontSize: 8, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", marginBottom: 3 }}>{m}</div>
                    {editWeight===i ? (
                      <input autoFocus type="number" value={w} onChange={e => setWeights({...weights,[i+1]:parseFloat(e.target.value)||0})} onBlur={() => setEditWeight(null)} onKeyDown={e => {if(e.key==="Enter") setEditWeight(null)}}
                        style={{ width: "100%", fontSize: 12, fontWeight: 600, textAlign: "center", border: "none", background: "transparent", fontFamily: "inherit" }} />
                    ) : <div style={{ fontSize: 12, fontWeight: 600 }}>{w}%</div>}
                    <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>Rp{fmt(TOTAL_TARGET*w/100)}</div>
                    <div style={{ display: "flex", justifyContent: "center", marginTop: 3 }}><div style={{ width: "65%", height: barH, background: "#6366f1", opacity: .45, borderRadius: "2px 2px 0 0", transition: "height .2s" }} /></div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 600, color: Math.abs(totalWeight-100)<.5?"#10b981":totalWeight>100?"#ef4444":"#f59e0b" }}>
              <span>Total: {totalWeight.toFixed(1)}% {Math.abs(totalWeight-100)<.5?"✓":totalWeight>100?"❌":"⚠"}</span>
            </div>
          </div>

          {/* Defaults */}
          <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "14px 18px", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Allocation & attribution defaults</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>
              {[{l:"Allocation mode",o:["Percentage","Absolute"],d:"Each node group can override."},{l:"Attribution basis",o:["Event date","Closed won"],d:"Which period revenue counts toward."}].map(c => (
                <div key={c.l}><div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 5 }}>{c.l}</div>
                  <div style={{ display: "flex", border: "1px solid #e5e8ed", borderRadius: 7, overflow: "hidden" }}>
                    {c.o.map((o,oi) => <button key={o} style={{ flex: 1, padding: "5px 0", fontSize: 10.5, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: oi===0?"#6366f1":"#fff", color: oi===0?"#fff":"#5a6178" }}>{o}</button>)}
                  </div>
                  <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{c.d}</div>
                </div>
              ))}
              <div><div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 5 }}>Monthly cutoff</div>
                <input type="number" defaultValue={25} min={1} max={28} style={{ width: 56, padding: "5px 8px", border: "1px solid #e5e8ed", borderRadius: 7, fontSize: 13, fontWeight: 600, textAlign: "center", fontFamily: "inherit" }} />
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>Day cutoff per month.</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══ NODE MANAGER SIDE PANEL ═══ */}
      {panelOpen && panelLevel && (
        <>
          <div onClick={() => setPanelOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.12)", zIndex: 40 }} />
          <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "#fff", zIndex: 50, borderLeft: "1px solid #e5e8ed", boxShadow: "-8px 0 30px rgba(0,0,0,.08)", display: "flex", flexDirection: "column", animation: "slideIn .25s ease-out" }}>
            <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f3f5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>Manage {panelDim?.label} nodes</div>
                  <div style={{ fontSize: 11.5, color: "#8892a4" }}>Level {panelIdx+1} · Set names and allocations</div>
                </div>
                <button onClick={() => setPanelOpen(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}>✕</button>
              </div>

              {/* ── Parent selector (for Level 2+) ── */}
              {!panelIsRoot && (
                <div style={{ background: "#f8f9fb", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: "#8892a4", textTransform: "uppercase", letterSpacing: .5, marginBottom: 6 }}>
                    Parent ({DIMENSION_OPTIONS.find(d => d.id === levels[panelIdx-1]?.dimension)?.label})
                  </div>

                  {/* Apply mode toggle */}
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button onClick={() => setApplyAllMode(true)} style={{
                      flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: applyAllMode ? panelColor : "#fff", color: applyAllMode ? "#fff" : "#5a6178",
                      boxShadow: applyAllMode ? "none" : "inset 0 0 0 1px #e5e8ed",
                    }}>Same for all parents</button>
                    <button onClick={() => setApplyAllMode(false)} style={{
                      flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: !applyAllMode ? panelColor : "#fff", color: !applyAllMode ? "#fff" : "#5a6178",
                      boxShadow: !applyAllMode ? "none" : "inset 0 0 0 1px #e5e8ed",
                    }}>Customize per parent</button>
                  </div>

                  {/* Parent tabs/selector (when customize mode) */}
                  {!applyAllMode ? (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {panelParents.map((p, pi) => {
                        const isActive = pi === selectedParentIdx;
                        const parentColor = LEVEL_COLORS[(panelIdx-1) % LEVEL_COLORS.length];
                        return (
                          <button key={pi} onClick={() => setSelectedParentIdx(pi)} style={{
                            padding: "4px 10px", borderRadius: 6, fontSize: 10.5, fontWeight: isActive ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                            background: isActive ? parentColor+"15" : "#fff", color: isActive ? parentColor : "#5a6178",
                            border: isActive ? `1.5px solid ${parentColor}40` : "1px solid #e5e8ed",
                            transition: "all .12s",
                          }}>
                            {p.name.length > 20 ? p.name.slice(0,18)+"…" : p.name}
                            <span style={{ marginLeft: 4, fontWeight: 700, opacity: .6 }}>Rp {fmt(p.value > 0 ? p.value : TOTAL_TARGET * p.pct / 100)}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ fontSize: 10.5, color: "#5a6178" }}>
                      Percentages below apply to <strong>each</strong> parent equally. Rp amounts vary per parent.
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                        {panelParents.slice(0,4).map((p,pi) => (
                          <span key={pi} style={{ fontSize: 9.5, background: "#f1f3f5", padding: "2px 6px", borderRadius: 4, color: "#5a6178" }}>
                            {p.name.length > 14 ? p.name.slice(0,12)+"…" : p.name}: Rp {fmt(p.value > 0 ? p.value : TOTAL_TARGET * (p.pct||0) / 100)}
                          </span>
                        ))}
                        {panelParents.length > 4 && <span style={{ fontSize: 9.5, color: "#94a3b8" }}>+{panelParents.length-4} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Alloc mode */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "#8892a4" }}>Input mode:</span>
                <div style={{ display: "flex", border: `1.5px solid ${panelColor}30`, borderRadius: 7, overflow: "hidden" }}>
                  {["percentage","absolute"].map(m => (
                    <button key={m} onClick={() => toggleAllocMode(panelIdx)} style={{
                      padding: "4px 14px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit",
                      background: panelLevel.allocMode === m ? panelColor : "#fff", color: panelLevel.allocMode === m ? "#fff" : "#5a6178",
                    }}>{m==="percentage"?"Percentage (%)":"Absolute (Rp)"}</button>
                  ))}
                </div>
              </div>

              {/* Allocation bar */}
              <div style={{ background: "#f8f9fb", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10.5, color: "#5a6178" }}>
                    {panelIsRoot ? "Goal" : (!applyAllMode ? panelParents[selectedParentIdx]?.name : "Per parent")}: <strong>Rp {fmt(panelParentAmt)}</strong>
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: panelRemaining < -1 ? "#ef4444" : Math.abs(panelRemaining) < 1 ? "#10b981" : "#f59e0b" }}>
                    {panelRemaining < -1 ? `Over by Rp ${fmt(Math.abs(panelRemaining))}` : Math.abs(panelRemaining) < 1 ? "Fully allocated ✓" : `Remaining: Rp ${fmt(panelRemaining)}`}
                  </span>
                </div>
                <div style={{ height: 5, background: "#e5e8ed", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 3, transition: "width .2s", width: `${Math.min((panelAllocAmt/panelParentAmt)*100,100)}%`, background: panelRemaining < -1 ? "#ef4444" : Math.abs(panelRemaining) < 1 ? "#10b981" : panelColor }} />
                </div>
              </div>
            </div>

            {/* Body: node list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px" }}>
              <div style={{ display: "flex", padding: "0 10px 6px", borderBottom: "1px solid #f1f3f5", marginBottom: 4 }}>
                <span style={{ width: 20 }} />
                <span style={{ flex: 1, fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .5 }}>Node name</span>
                <span style={{ width: 85, fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", textAlign: "right" }}>
                  {panelLevel.allocMode==="percentage" ? "Percent" : "Amount"}
                </span>
                <span style={{ width: 80, fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", textAlign: "right" }}>
                  {panelLevel.allocMode==="percentage" ? "Amount" : "Percent"}
                </span>
                {/* Per-parent breakdown column (when applyAll + not root) */}
                {!panelIsRoot && applyAllMode && <span style={{ width: 90, fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", textAlign: "right" }}>Per parent</span>}
                <span style={{ width: 28 }} />
              </div>

              {panelLevel.nodes.map((n, ni) => {
                const computedAmt = panelLevel.allocMode==="percentage" ? panelParentAmt * n.pct / 100 : n.value;
                const computedPct = panelLevel.allocMode==="absolute" ? (panelParentAmt > 0 ? n.value/panelParentAmt*100 : 0) : n.pct;
                return (
                  <div key={ni} style={{ display: "flex", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid #f8f9fb" }}
                    onMouseEnter={e => e.currentTarget.style.background="#fafbfc"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <span style={{ fontSize: 11, color: "#c0c7d2", cursor: "grab", width: 20 }}>⠿</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{n.name}</span>

                    {/* Primary input */}
                    <div style={{ width: 85, textAlign: "right" }}>
                      <input type="number"
                        value={panelLevel.allocMode==="percentage" ? n.pct : Math.round(n.value/1e6)}
                        onChange={e => {
                          const v = parseFloat(e.target.value)||0;
                          if (panelLevel.allocMode==="percentage") updateNodeValue(panelIdx, ni, "pct", v);
                          else updateNodeValue(panelIdx, ni, "value", v*1e6);
                        }}
                        style={{ width: 64, padding: "3px 5px", border: "1px solid #e5e8ed", borderRadius: 5, fontSize: 12, fontWeight: 600, textAlign: "right", fontFamily: "inherit" }} />
                      <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 2 }}>{panelLevel.allocMode==="percentage"?"%":"M"}</span>
                    </div>

                    {/* Computed */}
                    <div style={{ width: 80, textAlign: "right", fontSize: 10.5, color: "#94a3b8" }}>
                      {panelLevel.allocMode==="percentage" ? `Rp ${fmt(computedAmt)}` : `${computedPct.toFixed(1)}%`}
                    </div>

                    {/* Per-parent mini breakdown (when applyAll + not root) */}
                    {!panelIsRoot && applyAllMode && (
                      <div style={{ width: 90, textAlign: "right", fontSize: 9, color: "#b0b8c8", lineHeight: 1.3 }}>
                        {panelParents.slice(0,2).map((p,pi) => {
                          const pa = p.value > 0 ? p.value : TOTAL_TARGET * (p.pct||0) / 100;
                          return <div key={pi}>{p.name.slice(0,8)}: Rp {fmt(pa * n.pct / 100)}</div>;
                        })}
                        {panelParents.length > 2 && <div>+{panelParents.length-2} more</div>}
                      </div>
                    )}

                    <button onClick={() => removeNode(panelIdx, ni)} style={{ width: 28, background: "none", border: "none", fontSize: 12, cursor: "pointer", color: "#d1d5db" }}
                      onMouseEnter={e => e.currentTarget.style.color="#ef4444"} onMouseLeave={e => e.currentTarget.style.color="#d1d5db"}>🗑</button>
                  </div>
                );
              })}

              <div style={{ display: "flex", gap: 6, marginTop: 8, padding: "0 10px" }}>
                <input value={newNodeName} onChange={e => setNewNodeName(e.target.value)} onKeyDown={e => { if(e.key==="Enter") addNode(panelIdx); }}
                  placeholder={`Add ${panelDim?.label.toLowerCase()}...`}
                  style={{ flex: 1, padding: "6px 10px", border: "1px solid #e5e8ed", borderRadius: 7, fontSize: 12, fontFamily: "inherit" }} />
                <button onClick={() => addNode(panelIdx)} style={{ background: panelColor, border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 11, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>+ Add</button>
              </div>

              {/* Apply mode (for non-root only) */}
              {!panelIsRoot && (
                <div style={{ borderTop: "1px solid #f1f3f5", marginTop: 14, paddingTop: 12 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Apply mode</div>
                  {[
                    { label: "Same nodes & percentages for all parents", desc: `Every ${DIMENSION_OPTIONS.find(d=>d.id===levels[panelIdx-1]?.dimension)?.label.toLowerCase()} gets identical ${panelDim?.label.toLowerCase()} breakdown`, val: true },
                    { label: "Customize per parent", desc: `Select a ${DIMENSION_OPTIONS.find(d=>d.id===levels[panelIdx-1]?.dimension)?.label.toLowerCase()} above to configure its specific ${panelDim?.label.toLowerCase()} nodes`, val: false },
                  ].map(opt => (
                    <label key={String(opt.val)} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12, color: "#374151", marginBottom: 6 }}>
                      <input type="radio" name="applyMode" checked={applyAllMode === opt.val} onChange={() => setApplyAllMode(opt.val)} style={{ marginTop: 3 }} />
                      <div><div style={{ fontWeight: 500 }}>{opt.label}</div><div style={{ fontSize: 10, color: "#94a3b8" }}>{opt.desc}</div></div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e8ed", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setPanelOpen(false)} style={{ padding: "7px 16px", border: "1px solid #dfe2e7", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#5a6178", cursor: "pointer", background: "#fff", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => setPanelOpen(false)} style={{ padding: "7px 16px", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", background: "#6366f1", fontFamily: "inherit" }}>Save nodes</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
