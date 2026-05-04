// @ts-nocheck
"use client";
/* TODO: Remove @ts-nocheck and fix 59 type errors in this file.
   Main issues: untyped parameters (any), null vs number state, untyped reduce accumulators.
   Tracked as tech-debt — this file needs a refactor into smaller typed components. */
import type { GoalV2 } from '@/types/goals';

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { updateGoalV2Action } from "@/app/actions/goal-actions";
import { createClient } from "@/utils/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/contexts/currency-context";

const LEVEL_COLORS = ["#6366f1","#0ea5e9","#8b5cf6","#10b981","#f59e0b","#ec4899"];


const INITIAL_LEVELS: any[] = [];
const DEFAULT_WEIGHTS = {1:8.33, 2:8.33, 3:8.33, 4:8.33, 5:8.33, 6:8.33, 7:8.33, 8:8.33, 9:8.33, 10:8.33, 11:8.33, 12:8.33};
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];


/** Compact number formatter (no currency prefix) — for display in hierarchy nodes */
const fmtCompactNumber = (n: number) => {
  if (n >= 1e12) return `${(n/1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n/1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n/1e6).toFixed(0)}M`;
  return `${n}`;
};

/** Format a number with thousand separators (Indonesian style: dots) — for input fields */
const fmtNumber = (n: number): string => {
  if (n === 0) return "0";
  return Math.round(n).toLocaleString("id-ID");
};

function LevelBadge({ level }: { level: number }) {
  const c = LEVEL_COLORS[(level-1) % LEVEL_COLORS.length];
  return <span style={{ fontSize: 9, padding: "1px 5px", minWidth: 22, background: c+"18", color: c, fontWeight: 700, borderRadius: 4, textAlign: "center", display: "inline-block" }}>L{level}</span>;
}

function TreeNode({ node, level }: { node: any; level: number }) {
  const [open, setOpen] = useState(level < 3);
  const { fmt } = useCurrency();
  const has = node.children?.length > 0;
  return (
    <div style={{ marginLeft: level === 0 ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "2.5px 0", cursor: has ? "pointer" : "default" }} onClick={() => has && setOpen(!open)}>
        {has ? <span style={{ fontSize: 9, color: "#94a3b8", width: 10, transition: "transform .15s", transform: open ? "rotate(90deg)" : "none" }}>▶</span> : <span style={{ width: 10 }} />}
        {level > 0 && <LevelBadge level={level} />}
        <span style={{ fontSize: level === 0 ? 11.5 : 10.5, fontWeight: level === 0 ? 700 : 400, color: "#374151", flex: 1 }}>{node.name}</span>
        {node.amount > 0 && <span style={{ fontSize: 9, color: "#94a3b8" }}>{fmt(node.amount)}</span>}
      </div>
      {open && has && <div style={{ borderLeft: "1px solid #e5e8ed", marginLeft: 4 }}>{node.children.map((c: any, i: number) => <TreeNode key={i} node={c} level={level+1} />)}</div>}
    </div>
  );
}

import type { DimensionOption } from '@/config/dimension-registry';

export function GoalConfigurationPage({ goal, dimensions }: { goal: GoalV2; dimensions: DimensionOption[] }) {
  const { fmt } = useCurrency();
  const DIMENSION_OPTIONS = dimensions.map(d => ({ id: d.value, label: d.label, source: d.group }));
  const [levels, setLevels] = useState(() => {
    // Restore saved hierarchy from breakdown_config if available
    if (goal.breakdown_config && Array.isArray(goal.breakdown_config) && goal.breakdown_config.length > 0) {
      return goal.breakdown_config.map((lv: any, i: number) => ({
        id: `restored-${i}-${Date.now()}`,
        dimension: lv.dimension || "",
        allocMode: lv.allocMode || "percentage",
        applyAll: lv.applyAll !== false,
        nodes: (lv.nodes || []).map((n: any) => ({
          name: n.name || "",
          pct: n.pct || 0,
          value: n.value || 0,
          monthlyWeights: n.monthlyWeights || null, // null = inherit from global
        })),
        // Restore per-parent node overrides if saved
        perParentNodes: lv.perParentNodes
          ? Object.fromEntries(
              Object.entries(lv.perParentNodes).map(([parentName, nodes]: [string, any[]]) => [
                parentName,
                (nodes || []).map((n: any) => ({ name: n.name || "", pct: n.pct || 0, value: n.value || 0, monthlyWeights: n.monthlyWeights || null })),
              ])
            )
          : {},
      }));
    }
    return INITIAL_LEVELS;
  });
  const [weights, setWeights] = useState(() => {
    if (goal.monthly_weights) {
      const w = goal.monthly_weights;
      return Object.fromEntries(Object.keys(w).map(k => [k, w[k] * 100]));
    }
    return {...DEFAULT_WEIGHTS};
  });
  const [editWeight, setEditWeight] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelIdx, setPanelIdx] = useState(null);
  const [selectedParentIdx, setSelectedParentIdx] = useState(0);
  const [applyAllMode, setApplyAllMode] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [newNodeName, setNewNodeName] = useState("");
  const [monthlyWeightsOpen, setMonthlyWeightsOpen] = useState(false);
  const [overviewEditing, setOverviewEditing] = useState(false);
  const [targetAmount, setTargetAmount] = useState(goal.target_amount);
  const [targetDisplay, setTargetDisplay] = useState(fmtNumber(goal.target_amount));
  const [goalName, setGoalName] = useState(goal.name);
  const [periodStart, setPeriodStart] = useState(goal.period_start || '2026-01-01');
  const [periodEnd, setPeriodEnd] = useState(goal.period_end || '2026-12-31');
  const [isActive, setIsActive] = useState(goal.is_active);
  const [conversionTarget, setConversionTarget] = useState("");
  // Stash original values for cancel
  const [origOverview] = useState({ target: goal.target_amount, name: goal.name, periodStart: goal.period_start || '2026-01-01', periodEnd: goal.period_end || '2026-12-31', active: goal.is_active, conversionTarget: "" });

  // Auto-sync month nodes when period changes
  // Uses a ref to track last-applied period to avoid unnecessary rerenders
  const lastAppliedPeriod = useRef(`${periodStart}|${periodEnd}`);
  useEffect(() => {
    const periodKey = `${periodStart}|${periodEnd}`;
    const isInitial = lastAppliedPeriod.current === periodKey;
    
    const allMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const startDate = new Date(periodStart);
    const endDate = new Date(periodEnd);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;
    const startMonth = startDate.getMonth();
    const endMonth = endDate.getMonth();

    let validMonths: string[];
    if (startDate.getFullYear() === endDate.getFullYear()) {
      validMonths = allMonths.slice(startMonth, endMonth + 1);
    } else {
      validMonths = [...allMonths];
    }

    const equalPct = parseFloat((100 / validMonths.length).toFixed(2));
    lastAppliedPeriod.current = periodKey;

    setLevels(prev => {
      let changed = false;
      const next = prev.map(level => {
        if (level.dimension !== 'month') return level;
        const currentNames = level.nodes.map((n: any) => n.name);
        const namesMatch = currentNames.length === validMonths.length && validMonths.every((m, i) => m === currentNames[i]);
        
        if (!namesMatch) {
          // Months changed — full rebuild
          changed = true;
          return { ...level, nodes: validMonths.map(name => ({ name, pct: equalPct, value: 0, monthlyWeights: null })), perParentNodes: {} };
        }
        
        // Names match but check if percentages need fixing (on initial load from DB)
        const totalPct = level.nodes.reduce((s: number, n: any) => s + (n.pct || 0), 0);
        if (Math.abs(totalPct - 100) >= 0.5) {
          changed = true;
          return { ...level, nodes: level.nodes.map((n: any) => ({ ...n, pct: equalPct })) };
        }
        
        return level;
      });
      return changed ? next : prev;
    });
  }, [periodStart, periodEnd, levels.length]);  // also trigger when levels are added/removed

  // Load conversion target from goal_settings_v2
  useEffect(() => {
    if (!goal.company_id) return;
    const supabase = createClient();
    supabase.from("goal_settings_v2").select("conversion_target_pct").eq("company_id", goal.company_id).maybeSingle()
      .then(({ data }) => {
        const val = data?.conversion_target_pct ? String(data.conversion_target_pct) : "";
        setConversionTarget(val);
        origOverview.conversionTarget = val;
      });
  }, [goal.company_id]);

  // Format period for display
  const fmtPeriod = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[s.getMonth()]} ${s.getFullYear()} \u2013 ${months[e.getMonth()]} ${e.getFullYear()}`;
  };

  // Handle currency input
  const handleTargetInput = (raw: string) => {
    const cleaned = raw.replace(/\./g, '').replace(/[^0-9]/g, '');
    const num = parseInt(cleaned) || 0;
    setTargetAmount(num);
    setTargetDisplay(num > 0 ? fmtNumber(num) : '');
  };
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = (e: any) => {
      const target = e.target as Element | Document | null;
      if (!target) return;
      
      // Only react to scroll on the page's scrollable ancestor (layout main) or window
      // Ignore scroll from child containers like Live Preview
      if (target !== document && target !== document.documentElement && target !== document.body) {
        // Check if mainRef is a descendant of the scroll target (= it's a parent scroller, OK)
        // If mainRef is an ancestor of the scroll target (= it's a child scroller, IGNORE)
        if (mainRef.current && target !== mainRef.current && !target.contains(mainRef.current)) return;
      }
      
      const top = (target instanceof Element && target !== document.documentElement && target !== document.body)
        ? target.scrollTop
        : (window.scrollY || document.documentElement.scrollTop || 0);
      setScrolled(top > 12);
    };
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, []);

  
  const [savingGlobal, setSavingGlobal] = useState(false);
  

  const [fetchingNodes, setFetchingNodes] = useState(false);
  const autoPopulateNodes = async (idx: number, dimOverride?: string) => {
    setFetchingNodes(true);
    try {
      const supabase = createClient();
      const dim = dimOverride || levels[idx]?.dimension;
      if (!dim) { setFetchingNodes(false); return; }
      let newNodes: string[] = [];

      if (dim === "month") {
        // Month dimension: auto-populate based on goal period (start-end)
        const allMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const startDate = new Date(periodStart);
        const endDate = new Date(periodEnd);
        const startMonth = startDate.getMonth(); // 0-based
        const endMonth = endDate.getMonth();
        // Generate months within the period range
        const periodMonths: { name: string; monthIdx: number }[] = [];
        if (startDate.getFullYear() === endDate.getFullYear()) {
          for (let m = startMonth; m <= endMonth; m++) {
            periodMonths.push({ name: allMonths[m], monthIdx: m });
          }
        } else {
          // Cross-year: include all 12 months
          for (let m = 0; m < 12; m++) {
            periodMonths.push({ name: allMonths[m], monthIdx: m });
          }
        }
        // Distribute weights equally across period months
        const equalPct = periodMonths.length > 0 ? 100 / periodMonths.length : 8.33;
        setLevels(prev => {
          const next = [...prev];
          if (!next[idx]) return prev;
          next[idx] = {
            ...next[idx],
            nodes: periodMonths.map(({ name, monthIdx }) => ({
              name,
              pct: parseFloat(equalPct.toFixed(2)),
              value: 0,
              monthlyWeights: null,
            })),
          };
          return next;
        });
        toast.success(`Auto-populated ${periodMonths.length} months (${allMonths[startMonth]} - ${allMonths[endMonth]}) with equal distribution!`);
        setFetchingNodes(false);
        return;
      } else if (dim === "subsidiary") {
        // Subsidiaries are companies where is_holding is false
        const { data, error } = await supabase.from("companies").select("name").eq("is_holding", false);
        if (error) throw error;
        newNodes = data?.map(d => d.name) || [];
      } else if (dim === "client_company") {
        const { data, error } = await supabase.from("client_companies").select("name").eq("company_id", goal.company_id);
        if (error) throw error;
        newNodes = data?.map(d => d.name) || [];
      } else if (dim === "sales_owner") {
        const { data, error } = await supabase.from("profiles").select("full_name").eq("is_active", true);
        if (error) throw error;
        newNodes = data?.map(d => d.full_name) || [];
      } else if (dim.startsWith("segment:")) {
        toast.info("Segments must be added manually currently.");
      } else {
        // For master_options attributes, we need to find the original option_type.
        // The dimension value might be a fieldKey (same as option_type for most cases).
        // We also need to check custom prefixed types like custom_companies__segment.
        // Try the dimension value directly as option_type first, also check via dimensions prop.
        const dimInfo = dimensions.find(d => d.value === dim);
        const optionType = dimInfo?.field || dim;
        
        const { data, error } = await supabase
          .from("master_options")
          .select("value")
          .eq("option_type", optionType)
          .eq("is_active", true);
        if (error) throw error;
        newNodes = data?.map(d => d.value).filter(Boolean) || [];
      }
      
      if (newNodes.length > 0) {
        setLevels(prev => {
          const next = [...prev];
          if (!next[idx]) return prev;
          const existingNames = new Set(next[idx].nodes.map(n => n.name));
          const added = newNodes.filter(n => !existingNames.has(n) && Boolean(n));
          if (added.length > 0) {
            next[idx] = { ...next[idx], nodes: [...next[idx].nodes, ...added.map(name => ({ name, value: 0, pct: 0, monthlyWeights: null }))] };
            toast.success(`Auto-added ${added.length} options from DB!`);
          } else {
            toast.info("All options from DB are already here.");
          }
          return next;
        });
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

    setSavingGlobal(true);
    try {
      // Validate weights
      const totalPct = totalWeight;
      if (Math.abs(totalPct - 100) > 0.5) throw new Error("Monthly weights must total 100%");
      
      const parsedWeights = Object.fromEntries(Object.keys(weights).map(k => [String(k), weights[k] / 100]));

      // Serialize hierarchy levels into breakdown_config
      const breakdownConfig = levels.map(lv => ({
        dimension: lv.dimension,
        allocMode: lv.allocMode,
        applyAll: lv.applyAll,
        nodes: lv.nodes.map(n => ({
          name: n.name,
          pct: n.pct,
          value: n.value,
          monthlyWeights: n.monthlyWeights || undefined,
        })),
        // Save per-parent overrides when customize mode was used
        perParentNodes: lv.perParentNodes && Object.keys(lv.perParentNodes).length > 0
          ? Object.fromEntries(
              Object.entries(lv.perParentNodes).map(([parentName, nodes]: [string, any[]]) => [
                parentName,
                (nodes || []).map(n => ({ name: n.name, pct: n.pct, value: n.value, monthlyWeights: n.monthlyWeights || undefined })),
              ])
            )
          : undefined,
      }));
      
      const payload = {
        name: goalName,
        target_amount: targetAmount,
        period_start: periodStart,
        period_end: periodEnd,
        is_active: isActive,
        monthly_weights: parsedWeights,
        breakdown_config: breakdownConfig,
      };
      console.log('[GoalConfig] Saving payload:', JSON.stringify({ goalId: goal.id, levelsCount: breakdownConfig.length, weightsKeys: Object.keys(parsedWeights), target: targetAmount }));
      const res = await updateGoalV2Action(goal.id, payload);
      console.log('[GoalConfig] Save result:', JSON.stringify(res));
      
      // Save conversion target to goal_settings_v2
      const convPct = parseFloat(conversionTarget);
      const supabase = createClient();
      await supabase.from("goal_settings_v2").upsert({
        company_id: goal.company_id,
        conversion_target_pct: !isNaN(convPct) && convPct > 0 ? convPct : null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "company_id" });

      if (res.success) toast.success("Configuration saved!");
      else toast.error(res.error || "Failed to save configuration");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingGlobal(false);
    }
  };

  const TOTAL_TARGET = targetAmount;
  const totalWeight = Object.values(weights).reduce((a,b) => a+b, 0);

  // Get effective parent nodes for a level, merging from perParentNodes if needed
  const getParentNodesEffective = (levelIdx: number): any[] => {
    if (levelIdx === 0) return [{ name: "Company Goal", value: TOTAL_TARGET, pct: 100 }];
    const parentLevel = levels[levelIdx - 1];
    if (!parentLevel) return [];
    // If parent uses shared nodes, return them directly
    if (parentLevel.applyAll !== false || !parentLevel.perParentNodes || Object.keys(parentLevel.perParentNodes).length === 0) {
      return parentLevel.nodes;
    }
    // Parent uses customize-per-parent: merge unique nodes with allocation > 0
    const merged = new Map<string, any>();
    const gpLevel = levelIdx >= 2 ? levels[levelIdx - 2] : null;
    for (const [gpName, nodes] of Object.entries(parentLevel.perParentNodes) as [string, any[]][]) {
      let gpAmt = TOTAL_TARGET;
      if (gpLevel) {
        const gpNode = gpLevel.nodes.find((gn: any) => gn.name === gpName);
        if (gpNode) gpAmt = gpNode.value > 0 ? gpNode.value : TOTAL_TARGET * gpNode.pct / 100;
      }
      for (const n of nodes) {
        if (n.pct > 0 || n.value > 0) {
          const nodeValue = n.value > 0 ? n.value : gpAmt * n.pct / 100;
          // Accumulate values if same person appears under multiple parents
          if (merged.has(n.name)) {
            const existing = merged.get(n.name);
            merged.set(n.name, { ...existing, value: existing.value + nodeValue });
          } else {
            merged.set(n.name, { ...n, value: nodeValue });
          }
        }
      }
    }
    return merged.size > 0 ? Array.from(merged.values()) : parentLevel.nodes;
  };

  // Get parent amount for a given level index
  const getParentAmount = (levelIdx: number, parentNodeIdx = 0) => {
    if (levelIdx === 0) return TOTAL_TARGET;
    const effectiveParents = getParentNodesEffective(levelIdx);
    const pn = effectiveParents[parentNodeIdx];
    if (!pn) return TOTAL_TARGET;
    return pn.value > 0 ? pn.value : 0;
  };

  const getParentNodes = (levelIdx: number) => {
    if (levelIdx === 0) return [{ name: "Company Goal", value: TOTAL_TARGET }];
    return getParentNodesEffective(levelIdx);
  };

  // Helper: get the active nodes array for a level, respecting applyAll vs per-parent mode
  const getActiveNodes = (levelIdx: number, parentIdx: number, isApplyAll: boolean) => {
    const level = levels[levelIdx];
    if (!level) return [];
    if (levelIdx === 0 || isApplyAll) return level.nodes;
    // Per-parent mode: look up by parent name
    const parents = getParentNodes(levelIdx);
    const parentName = parents[parentIdx]?.name;
    if (!parentName) return level.nodes;
    return level.perParentNodes?.[parentName] || level.nodes;
  };

  // Helper: set nodes for the active context (shared or per-parent)
  const setActiveNodes = (levelIdx: number, parentIdx: number, isApplyAll: boolean, newNodes: any[]) => {
    setLevels(prev => {
      const next = [...prev];
      const level = { ...next[levelIdx] };
      if (levelIdx === 0 || isApplyAll) {
        level.nodes = newNodes;
      } else {
        const parents = getParentNodes(levelIdx);
        const parentName = parents[parentIdx]?.name;
        if (!parentName) {
          level.nodes = newNodes;
        } else {
          level.perParentNodes = { ...(level.perParentNodes || {}), [parentName]: newNodes };
        }
      }
      next[levelIdx] = level;
      return next;
    });
  };

  const openPanel = (idx: number) => {
    setPanelIdx(idx);
    setPanelOpen(true);
    setSelectedParentIdx(0);
    setApplyAllMode(levels[idx]?.applyAll !== false);
    setNewNodeName("");
  };

  const updateNodeValue = (levelIdx: number, nodeIdx: number, field: string, val: number) => {
    const currentNodes = getActiveNodes(levelIdx, selectedParentIdx, applyAllMode);
    const node = { ...currentNodes[nodeIdx] };
    const parentAmt = getParentAmount(levelIdx, selectedParentIdx);
    if (field === "value") { node.value = val; node.pct = parentAmt > 0 ? (val / parentAmt) * 100 : 0; }
    else { node.pct = val; node.value = parentAmt * val / 100; }
    const newNodes = [...currentNodes];
    newNodes[nodeIdx] = node;
    setActiveNodes(levelIdx, selectedParentIdx, applyAllMode, newNodes);
  };

  const toggleAllocMode = (idx: number) => {
    const updated = [...levels];
    updated[idx] = { ...updated[idx], allocMode: updated[idx].allocMode === "percentage" ? "absolute" : "percentage" };
    setLevels(updated);
  };

  const addNode = (levelIdx: number) => {
    if (!newNodeName.trim()) return;
    const currentNodes = getActiveNodes(levelIdx, selectedParentIdx, applyAllMode);
    setActiveNodes(levelIdx, selectedParentIdx, applyAllMode, [...currentNodes, { name: newNodeName.trim(), value: 0, pct: 0, monthlyWeights: null }]);
    setNewNodeName("");
  };

  const removeNode = (levelIdx: number, nodeIdx: number) => {
    const currentNodes = getActiveNodes(levelIdx, selectedParentIdx, applyAllMode);
    setActiveNodes(levelIdx, selectedParentIdx, applyAllMode, currentNodes.filter((_: any, i: number) => i !== nodeIdx));
  };

  const addLevel = () => {
    setLevels([...levels, { id: Date.now(), dimension: "", allocMode: "percentage", applyAll: true, nodes: [], perParentNodes: {} }]);
  };

  const removeLevel = (idx: number) => setLevels(levels.filter((_: any, i: number) => i !== idx));
  const changeDimension = (idx: number, dimId: string) => {
    const u = [...levels];
    u[idx] = { ...u[idx], dimension: dimId, nodes: [] };
    setLevels(u);
    // Auto-fetch nodes only when a real dimension is selected
    if (dimId) autoPopulateNodes(idx, dimId);
  };

  // Helper: get nodes for a level under a specific parent, respecting perParentNodes
  const getNodesForParent = (levelIdx: number, parentName: string) => {
    const level = levels[levelIdx];
    if (!level) return [];
    if (level.applyAll !== false) return level.nodes;
    // Customize per parent: use perParentNodes if available
    const perParent = level.perParentNodes?.[parentName];
    if (perParent) {
      // Filter to only nodes with allocation > 0
      const active = perParent.filter((n: any) => n.pct > 0 || n.value > 0);
      return active.length > 0 ? active : perParent;
    }
    return level.nodes;
  };

  // Build tree
  const buildTree = () => {
    if (!levels.length) return [];
    const root = { name: `Company Goal`, amount: TOTAL_TARGET, children: [] };
    root.children = levels[0].nodes.map(n1 => {
      const amt1 = n1.value > 0 ? n1.value : TOTAL_TARGET * n1.pct / 100;
      const nd1 = { name: n1.name, amount: amt1, children: [] };
      if (levels.length > 1) {
        const l2Nodes = getNodesForParent(1, n1.name);
        nd1.children = l2Nodes.map(n2 => {
          const amt2 = n2.value > 0 ? n2.value : amt1 * n2.pct / 100;
          const nd2 = { name: n2.name, amount: amt2, children: [] };
          if (levels.length > 2) {
            const l3Nodes = getNodesForParent(2, n2.name);
            nd2.children = l3Nodes.slice(0,3).map(n3 => {
              const amt3 = n3.value > 0 ? n3.value : amt2 * n3.pct / 100;
              return { name: n3.name, amount: amt3, children: [] };
            });
          }
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
  const panelIsRoot = panelIdx === 0;
  
  // For "Same for all parents": show total across all parents as reference
  // For "Customize per parent": show selected parent's amount
  const panelSingleParentAmt = panelIdx !== null ? getParentAmount(panelIdx, selectedParentIdx) : 0;
  const panelTotalParentsAmt = panelParents.reduce((s: number, p: any) => s + (p.value > 0 ? p.value : TOTAL_TARGET * (p.pct || 0) / 100), 0);
  const panelParentAmt = (!panelIsRoot && applyAllMode) ? panelTotalParentsAmt : panelSingleParentAmt;

  // Use active nodes (per-parent or shared) for allocation calculations
  const panelActiveNodes = panelIdx !== null ? getActiveNodes(panelIdx, selectedParentIdx, applyAllMode) : [];
  const panelAllocPct = panelActiveNodes.reduce((s,n) => s + (n.pct||0), 0);
  const panelAllocAmt = panelLevel ? panelActiveNodes.reduce((s,n) => {
    return s + (panelLevel.allocMode === "absolute" ? (n.value||0) : panelParentAmt * (n.pct||0) / 100);
  }, 0) : 0;
  const panelRemaining = panelParentAmt - panelAllocAmt;

  return (
    <div className="target-config w-full min-h-screen bg-[#f2f3f6]">
      <style>{`
        .target-config input:focus, .target-config select:focus { outline: 2px solid #6366f1; outline-offset: 1px; }
        .target-config input[type=number]::-webkit-inner-spin-button,
        .target-config input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .target-config input[type=number] { -moz-appearance: textfield; }
      `}</style>

      {/* Main */}
      <main ref={mainRef} style={{ flex: 1, isolation: "isolate" }}>
        {/* Sticky Header Section */}
        <div style={{ 
          zIndex: 40, display: "flex", justifyContent: "space-between", alignItems: "center", 
          padding: scrolled ? "12px 24px" : "16px 24px", 
          background: "#ffffff",
          borderBottom: scrolled ? "1px solid #e5e8ed" : "1px solid transparent", 
          boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,.06)" : "none",
          transition: "padding .2s ease, border-color .2s ease, box-shadow .2s ease", 
          position: "sticky", top: 0 
        }}>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <h1 style={{ fontSize: scrolled ? 17 : 22, fontWeight: 800, color: "#0f1729", transition: "all .25s cubic-bezier(0.4, 0, 0.2, 1)", letterSpacing: -.3, margin: 0 }}>Goal Configuration</h1>
            <div style={{
              height: scrolled ? 0 : 20,
              opacity: scrolled ? 0 : 1,
              transform: scrolled ? "translateY(-4px)" : "translateY(0)",
              overflow: "hidden",
              transition: "height .25s cubic-bezier(0.4, 0, 0.2, 1), opacity .15s ease, transform .2s ease"
            }}>
              <p style={{ 
                fontSize: 12, color: "#8892a4", margin: 0, 
                paddingTop: 2, whiteSpace: "nowrap"
              }}>
                Design your revenue target breakdown structure
              </p>
            </div>
          </div>
          <button onClick={saveConfiguration} disabled={savingGlobal} style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #6366f1, #4f46e5)",
            color: "#fff", border: "none", borderRadius: 8,
            padding: "9px 18px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(99,102,241,.3)",
            transition: "all .15s",
          }}
            onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          >
            {savingGlobal && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save Configuration
          </button>
        </div>

        <div style={{ padding: "0px 24px 32px", position: "relative", zIndex: 0 }}>
          {/* Breadcrumb Navigation (Non-sticky, in content area) */}
          <nav style={{ padding: "8px 0 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
            <Link href="/settings" style={{ color: "#8892a4", textDecoration: "none", fontWeight: 500, transition: "color .12s" }} onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")} onMouseLeave={e => (e.currentTarget.style.color = "#8892a4")}>Settings</Link>
            <span style={{ color: "#c0c7d2" }}>/</span>
            <Link href="/settings/goals" style={{ color: "#8892a4", textDecoration: "none", fontWeight: 500, transition: "color .12s" }} onMouseEnter={e => (e.currentTarget.style.color = "#4f46e5")} onMouseLeave={e => (e.currentTarget.style.color = "#8892a4")}>Goals</Link>
            <span style={{ color: "#c0c7d2" }}>/</span>
            <span style={{ color: "#334155", fontWeight: 600 }}>{goal.name}</span>
          </nav>

          {/* Goal Overview — locked by default, edit via button with warning */}
          <div style={{ background: "#fff", border: overviewEditing ? "1.5px solid #f59e0b" : "1px solid #e5e8ed", borderRadius: 10, padding: "14px 20px", marginBottom: 14, boxShadow: "0 1px 2px rgba(0,0,0,.03)", transition: "border .2s" }}>
            {overviewEditing && (
              <div style={{ background: "#fef3c7", border: "1px solid #f59e0b30", borderRadius: 6, padding: "8px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#92400e" }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <div><strong>Editing goal parameters</strong> — Changes to target amount will cascade to all breakdown levels. Review carefully before saving.</div>
              </div>
            )}
            {overviewEditing ? (
              /* ---- EDIT MODE: clean 2x2 grid form ---- */
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Annual Target (IDR)</label>
                    <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
                      <span style={{ padding: "0 0 0 12px", fontSize: 13, color: "#94a3b8", fontWeight: 600, flexShrink: 0 }}>Rp</span>
                      <input type="text" value={targetDisplay} onChange={e => handleTargetInput(e.target.value)}
                        style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#0f1729", border: "none", outline: "none", padding: "10px 12px 10px 6px", fontFamily: "inherit", background: "transparent", minWidth: 0 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Goal Name</label>
                    <input type="text" value={goalName} onChange={e => setGoalName(e.target.value)}
                      style={{ width: "100%", fontSize: 14, fontWeight: 600, color: "#0f1729", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Period</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)}
                        style={{ flex: 1, fontSize: 13, fontWeight: 500, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 10px", fontFamily: "inherit", minWidth: 0 }} />
                      <span style={{ fontSize: 13, color: "#94a3b8" }}>–</span>
                      <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)}
                        style={{ flex: 1, fontSize: 13, fontWeight: 500, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 10px", fontFamily: "inherit", minWidth: 0 }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Status</label>
                    <button onClick={() => setIsActive(!isActive)} style={{
                      fontSize: 13, fontWeight: 600, border: "1.5px solid #e2e8f0", padding: "9px 16px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                      color: isActive ? "#10b981" : "#ef4444", background: isActive ? "rgba(16,185,129,.06)" : "rgba(239,68,68,.06)",
                    }}>{isActive ? "● Active" : "● Inactive"}</button>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 6 }}>Lead Conversion Target (%)</label>
                    <input type="number" min="0" max="100" step="0.1" placeholder="e.g. 30" value={conversionTarget} onChange={e => setConversionTarget(e.target.value)}
                      style={{ width: "100%", fontSize: 14, fontWeight: 600, color: "#0f172a", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontFamily: "inherit", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid #f1f3f5" }}>
                  <button onClick={() => { setTargetAmount(origOverview.target); setTargetDisplay(fmtNumber(origOverview.target)); setGoalName(origOverview.name); setPeriodStart(origOverview.periodStart); setPeriodEnd(origOverview.periodEnd); setIsActive(origOverview.active); setConversionTarget(origOverview.conversionTarget); setOverviewEditing(false); }}
                    style={{ padding: "8px 20px", fontSize: 12, fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#64748b", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={() => setOverviewEditing(false)}
                    style={{ padding: "8px 20px", fontSize: 12, fontWeight: 600, border: "none", borderRadius: 8, background: "#f59e0b", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Done</button>
                </div>
              </div>
            ) : (
              /* ---- READ MODE: compact row ---- */
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Annual target</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#0f1729" }}>{fmt(targetAmount)}</div>
                  </div>
                  <div style={{ width: 1, height: 36, background: "#e5e8ed" }} />
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Goal Name</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{goalName}</div>
                  </div>
                  <div style={{ width: 1, height: 36, background: "#e5e8ed" }} />
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Period</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtPeriod(periodStart, periodEnd)}</div>
                  </div>
                  <div style={{ width: 1, height: 36, background: "#e5e8ed" }} />
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Conversion Target</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{conversionTarget ? `${conversionTarget}%` : "—"}</div>
                  </div>
                  <div style={{ width: 1, height: 36, background: "#e5e8ed" }} />
                  <div>
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", marginBottom: 2 }}>Status</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#10b981" : "#ef4444", background: isActive ? "rgba(16,185,129,.08)" : "rgba(239,68,68,.08)", padding: "2px 8px", borderRadius: 4 }}>
                      {isActive ? "● Active" : "● Inactive"}
                    </span>
                  </div>
                </div>
                <button onClick={() => setOverviewEditing(true)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "7px 14px", fontSize: 11, fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fff", color: "#64748b", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                  ✏️ Edit
                </button>
              </div>
            )}
          </div>

          {/* 2-Column Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 mb-4">
            {/* Hierarchy Builder */}
            <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "16px 18px", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Hierarchy builder</div>
              <div style={{ fontSize: 10.5, color: "#8892a4", marginBottom: 14 }}>Define breakdown levels. Click "Manage nodes" to set names and allocations.</div>

              {levels.map((level, idx) => {
                const dim = DIMENSION_OPTIONS.find(d => d.id === level.dimension);
                const color = LEVEL_COLORS[idx % LEVEL_COLORS.length];
                // Calculate allocation: if customize-per-parent, show best summary across all parents
                let allocPct = level.nodes.reduce((s,n) => s + n.pct, 0);
                let summaryNodes = level.nodes;
                if (!level.applyAll && level.perParentNodes && Object.keys(level.perParentNodes).length > 0) {
                  // Show max allocation across parents as summary indicator
                  const parentEntries = Object.values(level.perParentNodes) as any[][];
                  const parentPcts = parentEntries.map(nodes => nodes.reduce((s: number, n: any) => s + (n.pct || 0), 0));
                  allocPct = parentPcts.length > 0 ? Math.max(...parentPcts) : 0;
                  // For node pills, merge unique names from all parents
                  const allNames = new Map<string, any>();
                  parentEntries.forEach(nodes => nodes.forEach((n: any) => {
                    if (n.pct > 0 || n.value > 0) allNames.set(n.name, n);
                  }));
                  if (allNames.size > 0) summaryNodes = Array.from(allNames.values());
                }
                const parentLabel = idx === 0 ? "Company Goal" : levels[idx-1] ? DIMENSION_OPTIONS.find(d => d.id === levels[idx-1].dimension)?.label : "—";
                return (
                  <div key={level.id}>
                    <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderLeft: `3px solid ${color}`, borderRadius: 10, padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: "#c0c7d2", cursor: "grab" }}>⠿</span>
                        <LevelBadge level={idx+1} />
                        <div style={{ flex: 1 }}>
                          <Select value={level.dimension || undefined} onValueChange={e => changeDimension(idx, e)}>
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
                        </div>
                        <div style={{ display: "flex", border: "1px solid #e5e8ed", borderRadius: 5, overflow: "hidden" }}>
                          {["percentage","absolute"].map(m => (
                            <button key={m} onClick={() => toggleAllocMode(idx)} style={{ padding: "2px 7px", fontSize: 9, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: level.allocMode === m ? color : "#fff", color: level.allocMode === m ? "#fff" : "#94a3b8" }}>{m==="percentage"?"%":"Rp"}</button>
                          ))}
                        </div>
                        <button onClick={() => removeLevel(idx)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 13 }}>🗑</button>
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginLeft: 28, marginBottom: 6 }}>
                        Parent: {parentLabel} · {summaryNodes.length} nodes · {allocPct.toFixed(0)}% allocated{!level.applyAll && level.perParentNodes && Object.keys(level.perParentNodes).length > 0 ? " (per parent)" : ""}
                      </div>
                      <div style={{ marginLeft: 28, marginBottom: 6, height: 4, background: "#f1f3f5", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(allocPct, 100)}%`, background: allocPct > 100 ? "#ef4444" : color, borderRadius: 2, transition: "width .2s" }} />
                      </div>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginLeft: 28, marginBottom: 6 }}>
                        {summaryNodes.slice(0,5).map((n,ni) => (
                          <span key={ni} style={{ fontSize: 9.5, fontWeight: 500, color, background: color+"10", padding: "2px 7px", borderRadius: 4 }}>
                            {n.name} <strong style={{ opacity: .7 }}>{level.allocMode==="percentage" ? `${n.pct}%` : fmt(n.value)}</strong>
                          </span>
                        ))}
                        {summaryNodes.length > 5 && <span style={{ fontSize: 9.5, color: "#94a3b8" }}>+{summaryNodes.length-5}</span>}
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

            {/* Tree Preview — sticky, header fixed, tree scrollable */}
            <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, boxShadow: "0 1px 2px rgba(0,0,0,.03)", position: "sticky", top: 16, alignSelf: "start", maxHeight: "calc(100vh - 100px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Fixed header */}
              <div style={{ padding: "14px 14px 0", flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>Live preview</div>
                <div style={{ fontSize: 10, color: "#8892a4", marginBottom: 10 }}>Updates as you change structure</div>

                {/* Mismatch warning: L1 total vs annual target */}
                {levels.length > 0 && levels[0].nodes.length > 0 && (() => {
                  const l1Total = levels[0].nodes.reduce((s: number, n: any) => {
                    const amt = n.value > 0 ? n.value : TOTAL_TARGET * (n.pct || 0) / 100;
                    return s + amt;
                  }, 0);
                  const diff = TOTAL_TARGET - l1Total;
                  const pctDiff = TOTAL_TARGET > 0 ? Math.abs(diff / TOTAL_TARGET) * 100 : 0;
                  if (pctDiff > 0.5) {
                    return (
                      <div onClick={() => openPanel(0)} style={{
                        background: diff > 0 ? "#fef3c7" : "#fee2e2",
                        border: `1px solid ${diff > 0 ? "#f59e0b" : "#ef4444"}30`,
                        borderRadius: 6, padding: "8px 10px", marginBottom: 10, fontSize: 10, lineHeight: 1.5,
                        color: diff > 0 ? "#92400e" : "#991b1b",
                        cursor: "pointer", transition: "opacity .15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.opacity = "0.85"} onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                          <span style={{ fontWeight: 700 }}>{diff > 0 ? "⚠ Under-allocated" : "❌ Over-allocated"}</span>
                          <span style={{ fontWeight: 600 }}>→ Fix</span>
                        </div>
                        <div>
                          Annual Target: <strong>{fmt(TOTAL_TARGET)}</strong><br/>
                          L1 Breakdown Total: <strong>{fmt(l1Total)}</strong><br/>
                          {diff > 0
                            ? <>Remaining: <strong>{fmt(diff)}</strong> ({pctDiff.toFixed(1)}% unallocated)</>
                            : <>Over by: <strong>{fmt(Math.abs(diff))}</strong> ({pctDiff.toFixed(1)}% excess)</>}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div style={{ background: "#ecfdf5", border: "1px solid #10b98130", borderRadius: 6, padding: "6px 10px", marginBottom: 10, fontSize: 10, color: "#065f46", fontWeight: 600 }}>
                      ✓ L1 Fully allocated — {fmt(l1Total)} = Annual Target
                    </div>
                  );
                })()}

                {/* Per-level allocation warnings */}
                {levels.map((level, idx) => {
                  if (idx === 0 || level.nodes.length === 0) return null;
                  const dim = DIMENSION_OPTIONS.find(d => d.id === level.dimension);
                  
                  // Check allocation: use perParentNodes if customize mode
                  let isFullyAllocated = true;
                  let summaryPct = 0;
                  
                  if (level.applyAll !== false || !level.perParentNodes || Object.keys(level.perParentNodes).length === 0) {
                    // Shared mode: check level.nodes
                    summaryPct = level.nodes.reduce((s: number, n: any) => s + (n.pct || 0), 0);
                    isFullyAllocated = Math.abs(summaryPct - 100) < 0.5;
                  } else {
                    // Customize per parent: only check parents that still exist in the parent level
                    const parentLevel = levels[idx - 1];
                    const activeParentNames = new Set(parentLevel ? parentLevel.nodes.map((n: any) => n.name) : []);
                    const parentEntries = (Object.entries(level.perParentNodes) as [string, any[]][]).filter(([name]) => activeParentNames.has(name));
                    const underAllocated: string[] = [];
                    for (const [parentName, nodes] of parentEntries) {
                      const pct = (nodes || []).reduce((s: number, n: any) => s + (n.pct || 0), 0);
                      if (Math.abs(pct - 100) >= 0.5) underAllocated.push(parentName);
                    }
                    isFullyAllocated = underAllocated.length === 0 && parentEntries.length > 0;
                    if (!isFullyAllocated && parentEntries.length > 0) {
                      return (
                        <div key={idx} onClick={() => openPanel(idx)} style={{ background: "#fef3c7", border: "1px solid #f59e0b30", borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 10, color: "#92400e", cursor: "pointer", transition: "background .15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fde68a"} onMouseLeave={e => e.currentTarget.style.background = "#fef3c7"}>
                          ⚠ L{idx + 1} {dim?.label}: {underAllocated.length} parent{underAllocated.length > 1 ? 's' : ''} not fully allocated <span style={{ float: "right", fontWeight: 600 }}>→ Fix</span>
                        </div>
                      );
                    }
                  }
                  
                  if (isFullyAllocated) return null;
                  return (
                    <div key={idx} onClick={() => openPanel(idx)} style={{ background: "#fef3c7", border: "1px solid #f59e0b30", borderRadius: 6, padding: "6px 10px", marginBottom: 6, fontSize: 10, color: "#92400e", cursor: "pointer", transition: "background .15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#fde68a"} onMouseLeave={e => e.currentTarget.style.background = "#fef3c7"}>
                      ⚠ L{idx + 1} {dim?.label || level.dimension}: {summaryPct.toFixed(1)}% allocated (need 100%) <span style={{ float: "right", fontWeight: 600 }}>→ Fix</span>
                    </div>
                  );
                })}
              </div>

              {/* Scrollable tree */}
              <div className="thin-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px", minHeight: 0 }}>
                {!levels.length ? (
                  <div style={{ textAlign: "center", padding: "28px 12px", color: "#94a3b8" }}><div style={{ fontSize: 24, opacity: .3, marginBottom: 6 }}>🎯</div><div style={{ fontSize: 11.5 }}>Add levels to see the tree</div></div>
                ) : (
                  <div style={{ fontSize: 11 }}>{tree.map((r,i) => <TreeNode key={i} node={r} level={0} />)}</div>
                )}
                {levels.length > 0 && <div style={{ borderTop: "1px solid #f1f3f5", marginTop: 10, paddingTop: 8, fontSize: 9.5, color: "#94a3b8", lineHeight: 1.6 }}>Depth: {levels.length} levels</div>}
              </div>
            </div>
          </div>

          {/* Monthly Weights (collapsible — serves as global default, nodes can override) */}
          <div style={{ background: "#fff", border: "1px solid #e5e8ed", borderRadius: 10, padding: "14px 18px", marginBottom: 12, boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: monthlyWeightsOpen ? 10 : 0, cursor: "pointer" }} onClick={() => setMonthlyWeightsOpen(!monthlyWeightsOpen)}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 9, color: "#94a3b8", transition: "transform .15s", transform: monthlyWeightsOpen ? "rotate(90deg)" : "none" }}>▶</span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Monthly weight distribution</span>
                  <span style={{ fontSize: 9, padding: "1px 6px", background: "#f1f3f5", borderRadius: 4, color: "#8892a4", fontWeight: 600 }}>Default</span>
                </div>
                <div style={{ fontSize: 10.5, color: "#8892a4", marginLeft: 15 }}>{monthlyWeightsOpen ? "Distribute annual target across months" : `${Object.values(weights).filter(w => Math.abs(w - 8.33) > 0.1).length > 0 ? "Custom" : "Equal"} distribution · Total: ${totalWeight.toFixed(1)}%`}</div>
              </div>
              <div style={{ display: "flex", border: "1px solid #e5e8ed", borderRadius: 7, overflow: "hidden" }}>
                {["Equal","Seasonal","Custom"].map(p => (
                  <button key={p} onClick={(e) => { e.stopPropagation(); if(p==="Equal") setWeights(Object.fromEntries(MONTHS.map((_,i)=>[i+1,8.33]))); else if(p==="Seasonal") setWeights({...DEFAULT_WEIGHTS}); }}
                    style={{ padding: "3px 11px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "inherit", background: p==="Custom"?"#6366f1":"#fff", color: p==="Custom"?"#fff":"#5a6178" }}>{p}</button>
                ))}
              </div>
            </div>
            {monthlyWeightsOpen && (
              <>
                <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-12 gap-2">
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
                        ) : <div style={{ fontSize: 12, fontWeight: 600 }}>{parseFloat(Number(w).toFixed(2))}%</div>}
                        <div style={{ fontSize: 8, color: "#94a3b8", marginTop: 1 }}>{fmt(TOTAL_TARGET*w/100)}</div>
                        <div style={{ display: "flex", justifyContent: "center", marginTop: 3 }}><div style={{ width: "65%", height: barH, background: "#6366f1", opacity: .45, borderRadius: "2px 2px 0 0", transition: "height .2s" }} /></div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, fontWeight: 600, color: Math.abs(totalWeight-100)<.5?"#10b981":totalWeight>100?"#ef4444":"#f59e0b" }}>
                  <span>Total: {totalWeight.toFixed(1)}% {Math.abs(totalWeight-100)<.5?"✓":totalWeight>100?"❌":"⚠"}</span>
                </div>
              </>
            )}
          </div>

          {/* Allocation & attribution defaults — removed: allocation mode is per-level,
              attribution basis is set at goal creation, cutoff lives in System Rules */}
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
                    <button onClick={() => {
                      setApplyAllMode(true);
                      setSelectedParentIdx(0);
                      // Sync applyAll flag + fix month percentages if needed
                      setLevels(prev => {
                        const next = [...prev];
                        const level = { ...next[panelIdx], applyAll: true };
                        // If month dimension, ensure shared nodes have correct equal distribution
                        if (level.dimension === 'month' && level.nodes.length > 0) {
                          const totalPct = level.nodes.reduce((s: number, n: any) => s + (n.pct || 0), 0);
                          if (Math.abs(totalPct - 100) >= 0.5) {
                            const equalPct = parseFloat((100 / level.nodes.length).toFixed(2));
                            level.nodes = level.nodes.map((n: any) => ({ ...n, pct: equalPct }));
                          }
                        }
                        next[panelIdx] = level;
                        return next;
                      });
                    }} style={{
                      flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none",
                      background: applyAllMode ? panelColor : "#fff", color: applyAllMode ? "#fff" : "#5a6178",
                      boxShadow: applyAllMode ? "none" : "inset 0 0 0 1px #e5e8ed",
                    }}>Same for all parents</button>
                    <button onClick={() => {
                      setApplyAllMode(false);
                      setSelectedParentIdx(0);
                      // Initialize perParentNodes from shared nodes if empty
                      setLevels(prev => {
                        const next = [...prev];
                        const level = { ...next[panelIdx], applyAll: false };
                        const parents = getParentNodes(panelIdx);
                        const existingPerParent = level.perParentNodes || {};
                        const newPerParent = { ...existingPerParent };
                        // For each parent that doesn't have custom nodes yet, copy from shared nodes
                        parents.forEach(p => {
                          if (!newPerParent[p.name]) {
                            newPerParent[p.name] = level.nodes.map(n => ({ ...n, pct: 0, value: 0 }));
                          }
                        });
                        level.perParentNodes = newPerParent;
                        next[panelIdx] = level;
                        return next;
                      });
                    }} style={{
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
                            <span style={{ marginLeft: 4, fontWeight: 700, opacity: .6 }}>{fmt(p.value > 0 ? p.value : TOTAL_TARGET * p.pct / 100)}</span>
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
                            {p.name.length > 14 ? p.name.slice(0,12)+"…" : p.name}: {fmt(p.value > 0 ? p.value : TOTAL_TARGET * (p.pct||0) / 100)}
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
                    {panelIsRoot ? "Goal" : (!applyAllMode ? panelParents[selectedParentIdx]?.name : "All parents total")}: <strong>{fmt(panelParentAmt)}</strong>
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: panelRemaining < -1 ? "#ef4444" : Math.abs(panelRemaining) < 1 ? "#10b981" : "#f59e0b" }}>
                    {panelRemaining < -1 ? `Over by ${fmt(Math.abs(panelRemaining))}` : Math.abs(panelRemaining) < 1 ? "Fully allocated ✓" : `Remaining: ${fmt(panelRemaining)}`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#8892a4" }}>Allocated: <strong style={{ color: panelAllocPct > 100.5 ? "#ef4444" : Math.abs(panelAllocPct - 100) < 0.5 ? "#10b981" : "#5a6178" }}>{panelAllocPct.toFixed(1)}%</strong></span>
                  <span style={{ fontSize: 10, color: "#8892a4" }}>{fmt(panelAllocAmt)} / {fmt(panelParentAmt)}</span>
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

              {panelActiveNodes.map((n, ni) => {
                const computedAmt = panelLevel.allocMode==="percentage" ? panelParentAmt * n.pct / 100 : n.value;
                const computedPct = panelLevel.allocMode==="absolute" ? (panelParentAmt > 0 ? n.value/panelParentAmt*100 : 0) : n.pct;
                return (
                  <div key={ni} style={{ display: "flex", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid #f8f9fb" }}
                    onMouseEnter={e => e.currentTarget.style.background="#fafbfc"} onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <span style={{ fontSize: 11, color: "#c0c7d2", cursor: "grab", width: 20 }}>⠿</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{n.name}</span>

                    {/* Primary input */}
                    <div style={{ width: panelLevel.allocMode==="percentage" ? 85 : 150, textAlign: "right" }}>
                      {panelLevel.allocMode==="percentage" ? (
                        <input type="text" inputMode="decimal"
                          defaultValue={n.pct || ""}
                          key={`pct-${panelIdx}-${ni}-${panelLevel.allocMode}`}
                          onBlur={e => {
                            const raw = e.target.value.replace(/,/g, ".");
                            const v = parseFloat(raw)||0;
                            updateNodeValue(panelIdx, ni, "pct", v);
                          }}
                          onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                          style={{ width: 64, padding: "3px 5px", border: "1px solid #e5e8ed", borderRadius: 5, fontSize: 12, fontWeight: 600, textAlign: "right", fontFamily: "inherit" }} />
                      ) : (
                        <input type="text"
                          value={fmtNumber(n.value)}
                          onChange={e => {
                            const raw = e.target.value.replace(/\./g, "").replace(/,/g, "");
                            const v = parseFloat(raw)||0;
                            updateNodeValue(panelIdx, ni, "value", v);
                          }}
                          style={{ width: 130, padding: "3px 5px", border: "1px solid #e5e8ed", borderRadius: 5, fontSize: 12, fontWeight: 600, textAlign: "right", fontFamily: "inherit" }} />
                      )}
                      <span style={{ fontSize: 9, color: "#94a3b8", marginLeft: 2 }}>{panelLevel.allocMode==="percentage"?"%":"Rp"}</span>
                    </div>

                    {/* Computed */}
                    <div style={{ width: 80, textAlign: "right", fontSize: 10.5, color: "#94a3b8" }}>
                      {panelLevel.allocMode==="percentage" ? fmt(computedAmt) : `${computedPct.toFixed(1)}%`}
                    </div>

                    {/* Per-parent mini breakdown (when applyAll + not root) */}
                    {!panelIsRoot && applyAllMode && (
                      <div style={{ width: 90, textAlign: "right", fontSize: 9, color: "#b0b8c8", lineHeight: 1.3 }}>
                        {panelParents.slice(0,2).map((p,pi) => {
                          const pa = p.value > 0 ? p.value : TOTAL_TARGET * (p.pct||0) / 100;
                          return <div key={pi}>{p.name.slice(0,8)}: {fmt(pa * n.pct / 100)}</div>;
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

              {/* Monthly Distribution per Node — hide when dimension is already 'month' */}
              {panelActiveNodes.length > 0 && panelLevel?.dimension !== 'month' && (
                <div style={{ borderTop: "1px solid #f1f3f5", marginTop: 14, paddingTop: 12 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Monthly distribution per node</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 10 }}>Override monthly weights for individual nodes. Nodes without overrides inherit the global distribution.</div>
                  {panelActiveNodes.map((n, ni) => {
                    const hasCustomWeights = !!n.monthlyWeights;
                    const nodeWeights = n.monthlyWeights || weights;
                    const nodeTotal = Object.values(nodeWeights).reduce((a: number, b: number) => a + (b as number), 0);
                    const nodeAmt = panelLevel.allocMode === "percentage" ? panelParentAmt * n.pct / 100 : n.value;
                    return (
                      <div key={ni} style={{ marginBottom: 10, border: "1px solid #f1f3f5", borderRadius: 8, padding: "8px 10px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasCustomWeights ? 8 : 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>{n.name}</span>
                          <label style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: 10, color: "#8892a4" }}>
                            <input type="checkbox" checked={hasCustomWeights} onChange={(e) => {
                              const currentNodes = [...panelActiveNodes];
                              if (e.target.checked) {
                                currentNodes[ni] = { ...currentNodes[ni], monthlyWeights: { ...weights } };
                              } else {
                                currentNodes[ni] = { ...currentNodes[ni], monthlyWeights: null };
                              }
                              setActiveNodes(panelIdx, selectedParentIdx, applyAllMode, currentNodes);
                            }} />
                            Custom monthly
                          </label>
                        </div>
                        {hasCustomWeights && (
                          <div>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
                              {MONTHS.map((m, mi) => {
                                const w = nodeWeights[mi + 1] || 0;
                                return (
                                  <div key={m} style={{ textAlign: "center", border: "1px solid #f1f3f5", borderRadius: 4, padding: "3px 2px" }}>
                                    <div style={{ fontSize: 7, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{m}</div>
                                    <input
                                      type="number"
                                      value={parseFloat(Number(w).toFixed(2))}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        const currentNodes = [...panelActiveNodes];
                                        currentNodes[ni] = {
                                          ...currentNodes[ni],
                                          monthlyWeights: { ...currentNodes[ni].monthlyWeights, [mi + 1]: val }
                                        };
                                        setActiveNodes(panelIdx, selectedParentIdx, applyAllMode, currentNodes);
                                      }}
                                      style={{ width: "100%", fontSize: 10, fontWeight: 600, textAlign: "center", border: "none", background: "transparent", fontFamily: "inherit" }}
                                    />
                                    <div style={{ fontSize: 7, color: "#b0b8c8" }}>{fmt(nodeAmt * w / 100)}</div>
                                  </div>
                                );
                              })}
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, fontWeight: 600, color: Math.abs(nodeTotal - 100) < .5 ? "#10b981" : nodeTotal > 100 ? "#ef4444" : "#f59e0b" }}>
                              <span>Total: {nodeTotal.toFixed(1)}% {Math.abs(nodeTotal - 100) < .5 ? "✓" : nodeTotal > 100 ? "❌" : "⚠"}</span>
                              <button onClick={() => {
                                const currentNodes = [...panelActiveNodes];
                                currentNodes[ni] = { ...currentNodes[ni], monthlyWeights: { ...DEFAULT_WEIGHTS } };
                                setActiveNodes(panelIdx, selectedParentIdx, applyAllMode, currentNodes);
                              }} style={{ background: "none", border: "none", color: panelColor, cursor: "pointer", fontSize: 9, fontWeight: 600, fontFamily: "inherit" }}>Reset to equal</button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Apply mode (for non-root only) */}
              {!panelIsRoot && (
                <div style={{ borderTop: "1px solid #f1f3f5", marginTop: 14, paddingTop: 12 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8892a4", textTransform: "uppercase", letterSpacing: .5, marginBottom: 8 }}>Apply mode</div>
                  {[
                    { label: "Same nodes & percentages for all parents", desc: `Every ${DIMENSION_OPTIONS.find(d=>d.id===levels[panelIdx-1]?.dimension)?.label.toLowerCase()} gets identical ${panelDim?.label.toLowerCase()} breakdown`, val: true },
                    { label: "Customize per parent", desc: `Select a ${DIMENSION_OPTIONS.find(d=>d.id===levels[panelIdx-1]?.dimension)?.label.toLowerCase()} above to configure its specific ${panelDim?.label.toLowerCase()} nodes`, val: false },
                  ].map(opt => (
                    <label key={String(opt.val)} style={{ display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer", fontSize: 12, color: "#374151", marginBottom: 6 }}>
                      <input type="radio" name="applyMode" checked={applyAllMode === opt.val} onChange={() => {
                        setApplyAllMode(opt.val);
                        setSelectedParentIdx(0);
                        // Sync applyAll flag and initialize perParentNodes when switching to customize
                        setLevels(prev => {
                          const next = [...prev];
                          const level = { ...next[panelIdx], applyAll: opt.val };
                          if (!opt.val) {
                            // Switching to customize: init perParentNodes from shared nodes
                            const parents = getParentNodes(panelIdx);
                            const existingPerParent = level.perParentNodes || {};
                            const newPerParent = { ...existingPerParent };
                            parents.forEach(p => {
                              if (!newPerParent[p.name]) {
                                newPerParent[p.name] = level.nodes.map(n => ({ ...n, pct: 0, value: 0, monthlyWeights: null }));
                              }
                            });
                            level.perParentNodes = newPerParent;
                          }
                          next[panelIdx] = level;
                          return next;
                        });
                      }} style={{ marginTop: 3 }} />
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
