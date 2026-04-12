import { useState, useEffect, useRef } from "react";

const kpiData = [
  { key: "leads", label: "Total Leads", value: "6", vsTarget: 4.2, vsPrev: 12.5, prefix: "", suffix: "", icon: "⊡", accent: "#6366f1" },
  { key: "revenue", label: "Won Revenue", value: "2.9B", vsTarget: 5.0, vsPrev: 24.8, prefix: "Rp ", suffix: "", icon: "◈", accent: "#0ea5e9" },
  { key: "winrate", label: "Deal Win Rate", value: "60.0", vsTarget: 1.5, vsPrev: -2.1, prefix: "", suffix: "%", icon: "◉", accent: "#10b981" },
  { key: "conversion", label: "Lead Conversion", value: "50.0", vsTarget: 8.0, vsPrev: 4.4, prefix: "", suffix: "%", icon: "◎", accent: "#8b5cf6" },
  { key: "dealsize", label: "Avg Deal Size", value: "950M", vsTarget: 1.2, vsPrev: 15.2, prefix: "Rp ", suffix: "", icon: "◇", accent: "#f59e0b" },
];

const revenueData = [
  { month: "Jan", actual: 800, target: 1200, prev: 600 },
  { month: "Feb", actual: 2900, target: 1400, prev: 900 },
  { month: "Mar", actual: 1800, target: 1300, prev: 1100 },
  { month: "Apr", actual: null, target: 1500, prev: 1300 },
  { month: "May", actual: null, target: 1600, prev: 1000 },
  { month: "Jun", actual: null, target: 1700, prev: 1400 },
  { month: "Jul", actual: null, target: 1500, prev: 1200 },
  { month: "Aug", actual: null, target: 1800, prev: 1500 },
  { month: "Sep", actual: null, target: 1600, prev: 1100 },
  { month: "Oct", actual: null, target: 1900, prev: 1600 },
  { month: "Nov", actual: null, target: 2000, prev: 1800 },
  { month: "Dec", actual: null, target: 2200, prev: 2100 },
];

const pipelineData = [
  { stage: "New Lead", count: 12, color: "#6366f1" },
  { stage: "Qualified", count: 8, color: "#8b5cf6" },
  { stage: "Proposal Sent", count: 4, color: "#f59e0b" },
  { stage: "Negotiation", count: 3, color: "#0ea5e9" },
  { stage: "Closed Won", count: 3, color: "#10b981" },
  { stage: "Closed Lost", count: 2, color: "#ef4444" },
];

const maxPipeline = Math.max(...pipelineData.map(p => p.count));
const maxRevenue = 3200;

function Badge({ value, label }) {
  const pos = value >= 0;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 2,
      fontSize: 10, fontWeight: 600, color: pos ? "#10b981" : "#ef4444",
      background: pos ? "rgba(16,185,129,.07)" : "rgba(239,68,68,.07)",
      padding: "1px 5px", borderRadius: 4, lineHeight: 1.5,
    }}>
      <span style={{ fontSize: 7 }}>{pos ? "▲" : "▼"}</span>
      {Math.abs(value)}% {label}
    </span>
  );
}

function KPICard({ data, delay }) {
  const [vis, setVis] = useState(false);
  const [hov, setHov] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVis(true), delay); return () => clearTimeout(t); }, [delay]);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: "#fff", borderRadius: 10,
        padding: "12px 14px 10px",
        border: `1px solid ${hov ? data.accent + "35" : "#e5e8ed"}`,
        opacity: vis ? 1 : 0,
        transform: vis ? (hov ? "translateY(-2px)" : "translateY(0)") : "translateY(8px)",
        transition: "all .25s ease",
        display: "flex", flexDirection: "column", gap: 4, minWidth: 0,
        position: "relative", overflow: "hidden", cursor: "default",
        boxShadow: hov
          ? `0 6px 20px ${data.accent}10, 0 1px 4px rgba(0,0,0,.04)`
          : "0 1px 2px rgba(0,0,0,.03)",
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2.5,
        background: `linear-gradient(90deg, ${data.accent}, ${data.accent}66)`,
        opacity: hov ? 1 : 0.5, transition: "opacity .2s",
      }} />

      {/* Label + icon */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "#8892a4", letterSpacing: ".15px" }}>{data.label}</span>
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: data.accent + "0c",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, color: data.accent, flexShrink: 0,
        }}>{data.icon}</span>
      </div>

      {/* Value */}
      <div style={{
        fontSize: 26, fontWeight: 800, color: "#0f1729",
        letterSpacing: "-0.7px", lineHeight: 1,
      }}>
        {data.prefix}{data.value}{data.suffix}
      </div>

      {/* Badges */}
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap", marginTop: 2 }}>
        <Badge value={data.vsTarget} label="target" />
        <Badge value={data.vsPrev} label="YoY" />
      </div>
    </div>
  );
}

function MiniBarChart() {
  const [hovered, setHovered] = useState(null);
  const chartH = 190;

  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "16px 16px 14px",
      border: "1px solid #e5e8ed", gridColumn: "span 2",
      boxShadow: "0 1px 2px rgba(0,0,0,.03)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f1729" }}>Monthly Revenue vs Target</div>
          <div style={{ fontSize: 10.5, color: "#8892a4", marginTop: 1 }}>Actual vs Target vs Last Year</div>
        </div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#0f1729", background: "#f4f5f7",
          padding: "3px 9px", borderRadius: 5, cursor: "pointer", border: "1px solid #e5e8ed",
        }}>2026 ▾</div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        {[
          { color: "#6366f1", label: "Actual 2026" },
          { color: "#ddd6fe", label: "Last Year" },
          { color: "transparent", label: "Target", border: true },
        ].map(l => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9.5, color: "#94a3b8" }}>
            <div style={{
              width: 7, height: 7, borderRadius: 2, background: l.color,
              border: l.border ? "1.5px dashed #b0b8c8" : "none",
            }} />
            {l.label}
          </div>
        ))}
      </div>

      <div style={{ position: "relative", height: chartH + 24 }}>
        {[0, 800, 1600, 2400, 3200].map((v, i) => (
          <div key={v} style={{
            position: "absolute", left: 0, bottom: 22 + (chartH * i / 4),
            fontSize: 9, color: "#b0b8c8", width: 40, textAlign: "right", transform: "translateY(50%)",
          }}>
            {v >= 1000 ? `${(v/1000).toFixed(1)}B` : `${v}M`}
          </div>
        ))}
        {[0,1,2,3,4].map(i => (
          <div key={i} style={{
            position: "absolute", left: 46, right: 0, bottom: 22 + (chartH * i / 4),
            height: 1, background: i === 0 ? "#e2e5ea" : "#f3f4f6",
          }} />
        ))}
        <div style={{
          position: "absolute", left: 46, right: 0, bottom: 0, height: chartH + 24,
          display: "flex", alignItems: "flex-end", justifyContent: "space-around",
        }}>
          {revenueData.map((d, i) => {
            const actualH = d.actual ? (d.actual / maxRevenue) * chartH : 0;
            const prevH = (d.prev / maxRevenue) * chartH;
            const targetH = (d.target / maxRevenue) * chartH;
            const isHov = hovered === i;
            return (
              <div key={d.month}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative", cursor: "pointer" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              >
                {isHov && (
                  <div style={{
                    position: "absolute", bottom: Math.max(actualH, prevH, targetH) + 32, left: "50%", transform: "translateX(-50%)",
                    background: "#0f1729", color: "#fff", padding: "6px 9px", borderRadius: 6,
                    fontSize: 9.5, whiteSpace: "nowrap", zIndex: 10, lineHeight: 1.6,
                    boxShadow: "0 3px 12px rgba(0,0,0,.2)",
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 1 }}>{d.month} 2026</div>
                    {d.actual !== null && <div>Actual: Rp {d.actual}M</div>}
                    <div>Target: Rp {d.target}M</div>
                    <div>Last Year: Rp {d.prev}M</div>
                    <div style={{
                      position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%) rotate(45deg)",
                      width: 6, height: 6, background: "#0f1729",
                    }} />
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, position: "relative" }}>
                  <div style={{
                    width: 12, height: prevH, background: "#ddd6fe", borderRadius: "3px 3px 0 0",
                    transition: "all .12s", opacity: isHov ? 1 : 0.6,
                  }} />
                  {d.actual !== null ? (
                    <div style={{
                      width: 20, height: actualH, borderRadius: "3px 3px 0 0",
                      background: isHov ? "#4f46e5" : "#6366f1",
                      transition: "all .12s", boxShadow: isHov ? "0 2px 8px rgba(99,102,241,.28)" : "none",
                    }} />
                  ) : <div style={{ width: 20 }} />}
                  <div style={{
                    position: "absolute", bottom: targetH, left: -2, right: -2,
                    borderTop: "1.5px dashed #c0c7d2",
                  }} />
                </div>
                <div style={{ fontSize: 9, color: isHov ? "#0f1729" : "#94a3b8", marginTop: 5, fontWeight: isHov ? 600 : 400, transition: "all .12s" }}>{d.month}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PipelineStages() {
  const [hovIdx, setHovIdx] = useState(null);
  return (
    <div style={{
      background: "#fff", borderRadius: 10, padding: "16px",
      border: "1px solid #e5e8ed", boxShadow: "0 1px 2px rgba(0,0,0,.03)",
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f1729", marginBottom: 1 }}>Pipeline Stages</div>
      <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 14 }}>Lead distribution by stage</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pipelineData.map((p, i) => (
          <div key={p.stage}
            onMouseEnter={() => setHovIdx(i)}
            onMouseLeave={() => setHovIdx(null)}
            style={{ cursor: "default" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: hovIdx === i ? "#0f1729" : "#5a6178", transition: "color .12s" }}>{p.stage}</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#fff",
                background: hovIdx === i ? p.color : "#bcc3d0",
                padding: "0 5px", borderRadius: 3, minWidth: 20, textAlign: "center",
                transition: "background .12s", lineHeight: "16px",
              }}>{p.count}</span>
            </div>
            <div style={{ height: 5, background: "#f1f3f5", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${(p.count / maxPipeline) * 100}%`,
                background: `linear-gradient(90deg, ${p.color}, ${p.color}bb)`,
                borderRadius: 3, transition: "width .45s ease",
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [period, setPeriod] = useState("This Quarter");
  const [sideHover, setSideHover] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const mainRef = useRef(null);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const h = () => setScrolled(el.scrollTop > 10);
    el.addEventListener("scroll", h, { passive: true });
    return () => el.removeEventListener("scroll", h);
  }, []);

  const navItems = [
    { icon: "◫", label: "Dashboard", active: true },
    { icon: "◎", label: "Pipeline" },
    { icon: "⊞", label: "Companies" },
    { icon: "◉", label: "Contacts" },
  ];

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      display: "flex", height: "100vh", background: "#f2f3f6", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cdd2da; border-radius: 2px; }
        select:focus { outline: 2px solid #6366f1; outline-offset: 1px; }
      `}</style>

      {/* Sidebar */}
      <aside style={{ width: 218, background: "#0f1729", display: "flex", flexDirection: "column", flexShrink: 0, color: "#fff" }}>
        <div style={{ padding: "18px 14px 14px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800,
            }}>W</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Werkudara</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.38)", fontWeight: 500 }}>Group Lead</div>
            </div>
          </div>
        </div>

        <div style={{ padding: "8px 8px 0" }}>
          <button style={{
            width: "100%", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.06)",
            borderRadius: 7, padding: "7px 9px", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 11.5, fontWeight: 500, fontFamily: "inherit",
          }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11, opacity: .55 }}>⊕</span> All Companies
            </span>
            <span style={{ fontSize: 8, color: "rgba(255,255,255,.28)" }}>▾</span>
          </button>
        </div>

        <nav style={{ padding: "12px 8px", flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.22)", letterSpacing: 1, padding: "0 7px 5px", textTransform: "uppercase" }}>Menu</div>
          {navItems.map(item => (
            <div key={item.label}
              onMouseEnter={() => setSideHover(item.label)}
              onMouseLeave={() => setSideHover(null)}
              style={{
                display: "flex", alignItems: "center", gap: 8, padding: "7px 9px",
                borderRadius: 6, cursor: "pointer", marginBottom: 1,
                background: item.active ? "rgba(99,102,241,.13)" : sideHover === item.label ? "rgba(255,255,255,.04)" : "transparent",
                color: item.active ? "#a5b4fc" : "rgba(255,255,255,.48)",
                fontWeight: item.active ? 600 : 400, fontSize: 12.5, transition: "all .1s",
              }}>
              <span style={{ fontSize: 12, opacity: .6 }}>{item.icon}</span>{item.label}
            </div>
          ))}
          <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.22)", letterSpacing: 1, padding: "16px 7px 5px", textTransform: "uppercase" }}>Administration</div>
          <div onMouseEnter={() => setSideHover("S")} onMouseLeave={() => setSideHover(null)}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", borderRadius: 6, cursor: "pointer",
              background: sideHover === "S" ? "rgba(255,255,255,.04)" : "transparent",
              color: "rgba(255,255,255,.48)", fontSize: 12.5, transition: "all .1s",
            }}>
            <span style={{ fontSize: 12, opacity: .6 }}>⚙</span>Settings
          </div>
        </nav>

        <div style={{ padding: "0 8px 4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 6, cursor: "pointer", fontSize: 10.5, color: "rgba(255,255,255,.3)" }}>☀ Light Mode</div>
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,.06)", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
          }}>N</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>Hanung Sastria</div>
            <div style={{ fontSize: 9.5, color: "rgba(255,255,255,.28)" }}>Super Admin</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main ref={mainRef} style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 20,
          background: scrolled ? "rgba(242,243,246,.88)" : "#f2f3f6",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled ? "1px solid #dfe2e7" : "1px solid transparent",
          padding: scrolled ? "10px 24px" : "20px 24px 12px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          transition: "all .22s ease",
        }}>
          <div>
            <h1 style={{ fontSize: scrolled ? 15 : 19, fontWeight: 800, color: "#0f1729", letterSpacing: "-0.3px", transition: "font-size .22s ease", lineHeight: 1.3 }}>
              Performance Dashboard
            </h1>
            <p style={{
              fontSize: 11.5, color: "#8892a4", marginTop: 1,
              maxHeight: scrolled ? 0 : 20, opacity: scrolled ? 0 : 1, overflow: "hidden",
              transition: "all .22s ease",
            }}>Strategic sales & pipeline analytics</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", lineHeight: 1.4 }}>
              <div style={{ fontWeight: 600, color: "#5a6178", fontSize: 10.5 }}>Subsidiary</div>
              <div>All Companies</div>
            </div>
            <select value={period} onChange={e => setPeriod(e.target.value)} style={{
              appearance: "none", background: "#fff", border: "1px solid #dfe2e7", borderRadius: 7,
              padding: "6px 24px 6px 10px", fontSize: 11.5, fontWeight: 600, color: "#0f1729",
              cursor: "pointer", fontFamily: "inherit",
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='9' height='9' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center",
              boxShadow: "0 1px 2px rgba(0,0,0,.03)",
            }}>
              {["This Month","This Quarter","This Year","All Time"].map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: "6px 24px 24px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 12 }}>
            {kpiData.map((d, i) => <KPICard key={d.key} data={d} delay={i * 60} />)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
            <MiniBarChart />
            <PipelineStages />
          </div>
        </div>
      </main>
    </div>
  );
}
