"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import type { Pipeline, PipelineStage, TransitionRule, ClosureRestriction, FormSchema } from "@/types/index"
import { ArrowLeft, Check, X, Plus, ListChecks, FileText, Paperclip, Loader2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useCompany } from "@/contexts/company-context"
import { FIELD_LABELS, DEFAULT_LAYOUTS } from "@/features/settings/components/form-layout-builder"

function getColorHex(color: string) {
    const map: Record<string, string> = {
        blue: "#6366f1", violet: "#8b5cf6", sky: "#0ea5e9", emerald: "#10b981",
        amber: "#f59e0b", red: "#ef4444", pink: "#ec4899", orange: "#f97316",
        teal: "#14b8a6", slate: "#64748b"
    }
    return map[color] || "#64748b"
}

export default function PipelineDetailSettingsPage() {
    const router = useRouter()
    const params = useParams()
    const supabase = createClient()
    const pipelineId = params.pipelineId as string

    const { companies } = useCompany()
    const [loading, setLoading] = useState(true)
    const [pipeline, setPipeline] = useState<Pipeline | null>(null)
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [rules, setRules] = useState<TransitionRule[]>([])
    const [restrictions, setRestrictions] = useState<ClosureRestriction[]>([])
    const [availableFields, setAvailableFields] = useState<{ key: string; label: string }[]>([])
    const [activeTab, setActiveTab] = useState<'rules' | 'restrictions'>('rules')
    const [scrolled, setScrolled] = useState(false)

    useEffect(() => {
        const handler = () => setScrolled(window.scrollY > 10)
        window.addEventListener('scroll', handler, { passive: true })
        return () => window.removeEventListener('scroll', handler)
    }, [])

    // ─── Load Available Fields from Layout Config ─────────────
    useEffect(() => {
        const fetchFields = async () => {
            const companyIds = companies.map(c => c.id)
            // Fetch layout config
            const { data: optData } = await supabase.from('master_options').select('*')
                .eq('option_type', 'system_setting').eq('label', 'form_layout_config')

            // Fetch custom schemas
            let csQuery = supabase.from('form_schemas').select('*')
                .eq('module_name', 'leads').eq('is_active', true).order('sort_order')
            if (companyIds.length > 0) {
                const orClauses = companyIds.map(id => `company_id.eq.${id}`).join(',')
                csQuery = csQuery.or(`${orClauses},company_id.is.null`)
            }
            const { data: csData } = await csQuery

            // Parse layout to get non-hidden native fields
            let layoutConfig = { ...DEFAULT_LAYOUTS.leads }
            if (optData && optData.length > 0) {
                try {
                    const parsed = JSON.parse(optData[0].value)
                    if (parsed.tabs) {
                        layoutConfig = { ...DEFAULT_LAYOUTS.leads, ...parsed.tabs }
                    } else {
                        layoutConfig = { ...DEFAULT_LAYOUTS.leads, ...parsed }
                    }
                } catch (e) { /* use defaults */ }
            }

            // Extract ALL native fields (including hidden — they may be used in transition rules)
            const fields: { key: string; label: string }[] = []
            const seen = new Set<string>()
            for (const [tab, fieldIds] of Object.entries(layoutConfig)) {
                for (const fieldId of (fieldIds as string[])) {
                    if (!fieldId.startsWith('native:')) continue
                    const key = fieldId.replace('native:', '')
                    if (key === 'pipeline_stage_id') continue // not a data field
                    if (seen.has(key)) continue
                    seen.add(key)
                    fields.push({ key, label: FIELD_LABELS[fieldId] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) })
                }
            }

            // Add custom fields
            if (csData) {
                for (const schema of (csData as FormSchema[])) {
                    if (!seen.has(schema.field_key)) {
                        seen.add(schema.field_key)
                        fields.push({ key: `custom:${schema.field_key}`, label: `${schema.field_name} (Custom)` })
                    }
                }
            }

            setAvailableFields(fields)
        }
        fetchFields()
    }, [supabase, companies])

    const loadData = useCallback(async () => {
        setLoading(true)
        const [pRes, sRes, rRes, crRes] = await Promise.all([
            supabase.from('pipelines').select('*').eq('id', pipelineId).single(),
            supabase.from('pipeline_stages').select('*').eq('pipeline_id', pipelineId).order('sort_order'),
            supabase.from('pipeline_transition_rules').select('*').eq('pipeline_id', pipelineId),
            supabase.from('pipeline_closure_restrictions').select('*').eq('pipeline_id', pipelineId),
        ])
        if (pRes.data) setPipeline(pRes.data as Pipeline)
        if (sRes.data) setStages(sRes.data as PipelineStage[])
        if (rRes.data) setRules(rRes.data as TransitionRule[])
        if (crRes.data) setRestrictions(crRes.data as ClosureRestriction[])
        setLoading(false)
    }, [pipelineId, supabase])

    useEffect(() => { loadData() }, [loadData])

    const openStages = useMemo(() => stages.filter(s => s.stage_type === 'open'), [stages])
    const closedStages = useMemo(() => stages.filter(s => s.stage_type === 'closed'), [stages])

    // ─── Rule Slide Panel ────────────────────────────────────
    const [panelOpen, setPanelOpen] = useState(false)
    const [panelRule, setPanelRule] = useState<Partial<TransitionRule> | null>(null)

    const openPanel = (rule?: TransitionRule) => {
        setPanelRule(rule ? { ...rule } : {
            pipeline_id: pipelineId,
            from_stage_id: null,
            to_stage_id: "",
            required_fields: [],
            note_required: false,
            attachment_required: false,
            checklist: []
        })
        setPanelOpen(true)
    }

    const saveRule = async () => {
        if (!panelRule?.to_stage_id) { toast.error("Please select a target stage"); return }
        const payload = {
            pipeline_id: pipelineId,
            from_stage_id: panelRule.from_stage_id || null,
            to_stage_id: panelRule.to_stage_id,
            required_fields: panelRule.required_fields || [],
            note_required: panelRule.note_required || false,
            attachment_required: panelRule.attachment_required || false,
            checklist: panelRule.checklist || []
        }
        const res = panelRule.id
            ? await supabase.from('pipeline_transition_rules').update(payload).eq('id', panelRule.id).select()
            : await supabase.from('pipeline_transition_rules').insert(payload).select()
        if (res.error) {
            toast.error(res.error.message.includes('unique') ? "A rule already exists for this transition" : "Failed to save rule")
        } else {
            toast.success("Rule saved"); setPanelOpen(false); loadData()
        }
    }

    const deleteRule = async (id: string) => {
        if (!window.confirm("Delete this transition rule?")) return
        await supabase.from('pipeline_transition_rules').delete().eq('id', id)
        toast.success("Rule deleted"); loadData()
    }

    // ─── Restrictions ────────────────────────────────────────
    const [dirtyRestrictions, setDirtyRestrictions] = useState<Record<string, string[]>>({})

    useEffect(() => {
        const initialMap: Record<string, string[]> = {}
        closedStages.forEach(cs => {
            const r = restrictions.find(x => x.closed_stage_id === cs.id)
            initialMap[cs.id] = r ? (r.allowed_from_stage_ids || []) : openStages.map(s => s.id)
        })
        setDirtyRestrictions(initialMap)
    }, [restrictions, closedStages, openStages])

    const saveRestrictions = async () => {
        const promises = Object.entries(dirtyRestrictions).map(async ([closedStageId, allowedIds]) => {
            const existing = restrictions.find(r => r.closed_stage_id === closedStageId)
            if (existing) {
                await supabase.from('pipeline_closure_restrictions').update({ allowed_from_stage_ids: allowedIds }).eq('id', existing.id)
            } else {
                await supabase.from('pipeline_closure_restrictions').insert({ pipeline_id: pipelineId, closed_stage_id: closedStageId, allowed_from_stage_ids: allowedIds })
            }
        })
        await Promise.all(promises)
        toast.success("Restrictions saved"); loadData()
    }

    const toggleRestriction = (closedStageId: string, openStageId: string) => {
        setDirtyRestrictions(prev => {
            const list = prev[closedStageId] || []
            return { ...prev, [closedStageId]: list.includes(openStageId) ? list.filter(id => id !== openStageId) : [...list, openStageId] }
        })
    }

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>
    if (!pipeline) return <div className="p-10 text-center text-[#8892a4]">Pipeline not found.</div>

    return (
        <div className="min-h-screen bg-[#f2f3f6]">
            {/* Sticky Header */}
            <div className={`sticky top-0 z-30 bg-[#f2f3f6] transition-shadow duration-200 ${scrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,.06)]' : ''}`}>
                <div className="px-8 pt-6 pb-4 max-w-[1400px] mx-auto">
                    <button onClick={() => router.push("/settings/pipeline")} className="text-[12px] font-[500] text-[#8892a4] hover:text-[#4f46e5] flex items-center gap-1.5 mb-3 transition-colors">
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to Pipeline Configuration
                    </button>
                    <div className="flex items-center gap-2 mb-0.5">
                        {pipeline.is_default && <Star className="h-4 w-4 text-[#f59e0b] fill-[#f59e0b]" />}
                        <h1 className="text-[17px] font-[800] text-[#0f1729]">{pipeline.name}</h1>
                    </div>
                    <p className="text-[12px] text-[#8892a4]">{stages.length} stages{pipeline.is_default ? " · DEFAULT" : ""}</p>

                    {/* Flow preview — compact, wrapping */}
                    <div className="bg-white border border-[#e5e8ed] rounded-[10px] px-4 py-3 mt-4 flex items-center flex-wrap gap-x-1 gap-y-2">
                        {openStages.map((s, i) => (
                            <div key={s.id} className="flex items-center shrink-0">
                                {i > 0 && <span className="text-[#c0c7d2] mr-1.5">→</span>}
                                <div className="h-[10px] w-[10px] rounded-full border-[1.5px] bg-white shrink-0" style={{ borderColor: getColorHex(s.color) }} />
                                <span className="text-[12px] font-[500] ml-1.5 text-[#0f1729] whitespace-nowrap">{s.name}</span>
                            </div>
                        ))}
                        {openStages.length > 0 && closedStages.length > 0 && <span className="text-[#c0c7d2] mx-1">→</span>}
                        {closedStages.map((s, i) => {
                            const isWon = s.closed_status === 'won'
                            return (
                                <div key={s.id} className="flex items-center shrink-0">
                                    {i > 0 && <span className="text-[#c0c7d2] mr-1.5">/</span>}
                                    <div className={`h-[10px] w-[10px] rounded-full flex items-center justify-center shrink-0 ${isWon ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                        {isWon ? <Check className="h-[6px] w-[6px] text-white" strokeWidth={3} /> : <X className="h-[6px] w-[6px] text-white" strokeWidth={3} />}
                                    </div>
                                    <span className="text-[12px] font-[500] ml-1.5 text-[#0f1729] whitespace-nowrap">{s.name}</span>
                                </div>
                            )
                        })}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-[#e5e8ed] mt-5">
                        <button onClick={() => setActiveTab('rules')} className={`pb-3 px-1 text-[13px] font-[600] mr-6 transition-colors ${activeTab === 'rules' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8892a4] hover:text-[#0f1729]'}`}>
                            Transition Rules
                        </button>
                        <button onClick={() => setActiveTab('restrictions')} className={`pb-3 px-1 text-[13px] font-[600] transition-colors ${activeTab === 'restrictions' ? 'text-[#4f46e5] border-b-2 border-[#4f46e5]' : 'text-[#8892a4] hover:text-[#0f1729]'}`}>
                            Closure Restrictions
                        </button>
                    </div>
                </div>
            </div>

            {/* Tab Content — full width */}
            <div className="px-8 pb-8 max-w-[1400px] mx-auto mt-6">
                {/* Rules Tab */}
                {activeTab === 'rules' && (
                    <div className="space-y-4">
                        <div className="flex justify-end mb-2">
                            <Button onClick={() => openPanel()} className="bg-[#4f46e5] hover:bg-[#4338ca] text-[11.5px] h-8 px-3.5"><Plus className="h-4 w-4 mr-1.5" /> New Rule</Button>
                        </div>
                        {rules.length === 0 ? (
                            <div className="text-center py-20 bg-white border border-[#e5e8ed] rounded-[10px]">
                                <div className="text-[14px] font-[600] text-[#0f1729] mb-1">No transition rules yet</div>
                                <div className="text-[12px] text-[#8892a4] mb-4 max-w-md mx-auto">Rules ensure data quality by requiring specific information when leads move between pipeline stages.</div>
                                <Button onClick={() => openPanel()} variant="outline" className="text-[#4f46e5] border-[#4f46e5] shadow-none">Create your first rule</Button>
                            </div>
                        ) : (
                            rules.map(rule => {
                                const fromS = stages.find(s => s.id === rule.from_stage_id)
                                const toS = stages.find(s => s.id === rule.to_stage_id)
                                const toIsWon = toS?.closed_status === 'won'
                                return (
                                    <div key={rule.id} className="bg-white border border-[#e5e8ed] rounded-[10px] p-5 group hover:border-[#c7c3f5] transition-colors relative">
                                        {/* Transition header */}
                                        <div className="flex items-center gap-3 mb-3">
                                            {rule.from_stage_id ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getColorHex(fromS?.color || 'slate') }} />
                                                    <span className="text-[12.5px] font-[600] text-[#0f1729]">{fromS?.name}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <div className="h-2.5 w-2.5 rounded-full border-[1.5px] border-gray-400" />
                                                    <span className="text-[12.5px] font-[500] italic text-[#8892a4]">Any Stage</span>
                                                </div>
                                            )}
                                            <span className="text-[#c0c7d2] text-xs">────→</span>
                                            <div className="flex items-center gap-2">
                                                {toS?.stage_type === 'closed' ? (
                                                    <div className={`h-3 w-3 rounded-full flex items-center justify-center ${toIsWon ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                                        {toIsWon ? <Check className="h-2 w-2 text-white" strokeWidth={3} /> : <X className="h-2 w-2 text-white" strokeWidth={3} />}
                                                    </div>
                                                ) : (
                                                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getColorHex(toS?.color || 'slate') }} />
                                                )}
                                                <span className="text-[12.5px] font-[600] text-[#0f1729]">{toS?.name}</span>
                                            </div>
                                        </div>

                                        {/* Requirements */}
                                        <div>
                                            <div className="text-[10px] font-[600] text-[#94a3b8] uppercase tracking-[0.8px] mb-1.5">Required:</div>
                                            <div className="flex flex-wrap gap-1.5 items-center">
                                                {rule.required_fields.map(fk => {
                                                    const f = availableFields.find(x => x.key === fk)
                                                    return <span key={fk} className="bg-[#eef2ff] text-[#4338ca] px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500]">{f?.label || fk}</span>
                                                })}
                                                {rule.note_required && <span className="text-[10.5px] text-[#8892a4]">+ Note required</span>}
                                                {rule.attachment_required && <span className="text-[10.5px] text-[#8892a4]">+ File required</span>}
                                                {rule.required_fields.length === 0 && !rule.note_required && !rule.attachment_required && <span className="text-[10.5px] text-[#94a3b8] italic">None specified</span>}
                                            </div>
                                        </div>
                                        {rule.checklist.length > 0 && <div className="mt-2 text-[10.5px] text-[#8892a4]">Checklist: {rule.checklist.length} items</div>}

                                        {/* Actions */}
                                        <div className="absolute top-5 right-5 flex gap-3">
                                            <button onClick={() => openPanel(rule)} className="text-[#4f46e5] text-[11px] font-[600] hover:underline">Edit</button>
                                            <button onClick={() => deleteRule(rule.id)} className="text-red-500 text-[11px] font-[600] opacity-0 group-hover:opacity-100 transition-opacity hover:underline">Delete</button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                {/* Restrictions Tab */}
                {activeTab === 'restrictions' && (
                    <div className="space-y-4">
                        <p className="text-[12px] text-[#8892a4] mb-2">Control which stages can directly transition to closed states.</p>
                        {closedStages.map(cs => {
                            const allowed = dirtyRestrictions[cs.id] || []
                            const isWon = cs.closed_status === 'won'
                            return (
                                <div key={cs.id} className="bg-white border border-[#e5e8ed] rounded-[10px] p-5">
                                    <h3 className="text-[13px] font-[700] text-[#0f1729] flex items-center gap-2 mb-1">
                                        <div className={`h-3.5 w-3.5 rounded-full flex items-center justify-center ${isWon ? 'bg-emerald-500' : 'bg-red-500'}`}>
                                            {isWon ? <Check className="h-2 w-2 text-white" strokeWidth={3} /> : <X className="h-2 w-2 text-white" strokeWidth={3} />}
                                        </div>
                                        {cs.name} <span className="text-[11px] font-normal text-[#8892a4]">— can be reached from:</span>
                                    </h3>

                                    <div className="mt-3 border border-[#f1f3f5] rounded-lg p-3 bg-[#fafbfc] space-y-2">
                                        {openStages.map(os => {
                                            const isChecked = allowed.includes(os.id)
                                            return (
                                                <label key={os.id} className="flex items-center gap-3 cursor-pointer py-1 px-1 rounded hover:bg-white transition-colors">
                                                    <input type="checkbox" checked={isChecked} onChange={() => toggleRestriction(cs.id, os.id)}
                                                        className="w-3.5 h-3.5 text-[#6366f1] border-slate-300 rounded focus:ring-[#6366f1] accent-[#6366f1]" />
                                                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getColorHex(os.color) }} />
                                                    <span className={`text-[12px] font-[500] ${isChecked ? "text-[#0f1729]" : "text-[#94a3b8]"}`}>{os.name}</span>
                                                    <span className={`text-[11px] ml-auto ${isChecked ? "text-[#10b981]" : "text-[#94a3b8]"}`}>
                                                        {isChecked ? 'Allowed' : 'Blocked'}
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                    <div className="mt-3 text-[10.5px] text-[#8892a4]">
                                        Summary: {allowed.length === openStages.length ? `All stages can close as ${cs.name}` : allowed.length === 0 ? (<span className="text-red-500">⚠ No stages can transition here</span>) : `Can close from ${openStages.filter(x => allowed.includes(x.id)).map(x => x.name).join(', ')}`}
                                    </div>
                                </div>
                            )
                        })}
                        <div className="flex justify-start pt-2">
                            <Button onClick={saveRestrictions} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white">Save Restrictions</Button>
                        </div>
                        <div className="bg-[#eef2ff] border border-[#c7d2fe] rounded-lg px-4 py-3 text-[11.5px] text-[#4338ca] flex items-start gap-2 mt-4">
                            <span className="text-base">💡</span>
                            <span>Restricting early-stage closures ensures leads progress through proper qualification before closing.</span>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── Rule Slide Panel ────────────────────────────── */}
            {panelOpen && panelRule && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-black/12" onClick={() => setPanelOpen(false)} />
                    <div className="relative w-[480px] bg-white h-full border-l border-[#e5e8ed] shadow-[-8px_0_30px_rgba(0,0,0,.08)] flex flex-col animate-in slide-in-from-right duration-250">
                        {/* Panel Header */}
                        <div className="px-5 py-5 border-b border-[#f1f3f5] flex justify-between items-center shrink-0">
                            <h2 className="text-[16px] font-[700] text-[#0f1729]">{panelRule.id ? 'Edit Transition Rule' : 'Create Transition Rule'}</h2>
                            <button onClick={() => setPanelOpen(false)} className="text-[#94a3b8] hover:text-[#0f1729] transition-colors"><X className="h-5 w-5" /></button>
                        </div>

                        {/* Panel Body */}
                        <div className="flex-1 overflow-y-auto px-5 py-4">
                            <p className="text-[12.5px] text-[#8892a4] mb-5">When a lead moves between these stages, users must provide the following information.</p>

                            {/* Stage Transition */}
                            <div className="text-[10px] font-[700] uppercase tracking-[0.8px] text-[#94a3b8] mb-3 border-b border-[#f1f3f5] pb-1">Stage Transition</div>
                            <div className="space-y-3 mb-6">
                                <div>
                                    <Label className="text-[12px] mb-1.5 block">From Stage</Label>
                                    <Select value={panelRule.from_stage_id || "any"} onValueChange={v => setPanelRule({ ...panelRule, from_stage_id: v === 'any' ? null : v })}>
                                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="any"><span className="italic text-slate-500">○ Any Stage</span></SelectItem>
                                            {openStages.map(s => <SelectItem key={s.id} value={s.id}><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full" style={{ backgroundColor: getColorHex(s.color) }} />{s.name}</div></SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex justify-center text-[#d1d5db]"><ArrowLeft className="h-4 w-4 -rotate-90" /></div>
                                <div>
                                    <Label className="text-[12px] mb-1.5 block">To Stage</Label>
                                    <Select value={panelRule.to_stage_id || ""} onValueChange={v => setPanelRule({ ...panelRule, to_stage_id: v })}>
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Choose a stage" /></SelectTrigger>
                                        <SelectContent>
                                            {stages.map(s => {
                                                const isClosed = s.stage_type === 'closed'
                                                const isWon = s.closed_status === 'won'
                                                return (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        <div className="flex items-center gap-2">
                                                            {isClosed ? (
                                                                <div className={`h-2 w-2 rounded-full ${isWon ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                                            ) : (
                                                                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: getColorHex(s.color) }} />
                                                            )}
                                                            {s.name}
                                                        </div>
                                                    </SelectItem>
                                                )
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Mandatory Information */}
                            <div className="text-[10px] font-[700] uppercase tracking-[0.8px] text-[#94a3b8] mb-3 border-b border-[#f1f3f5] pb-1">Mandatory Information</div>
                            <div className="space-y-4 mb-6">
                                <div>
                                    <Label className="text-[12px] mb-1.5 flex items-center gap-2"><ListChecks className="h-3.5 w-3.5 text-slate-400" /> Required Fields</Label>
                                    <div className="border border-[#e5e8ed] rounded-lg p-3">
                                        {(panelRule.required_fields || []).length > 0 && (
                                            <div className="flex flex-wrap gap-1.5 mb-2">
                                                {(panelRule.required_fields || []).map(k => (
                                                    <div key={k} className="bg-[#eef2ff] text-[#4338ca] text-[10.5px] font-[500] px-2 py-0.5 rounded-[5px] flex items-center gap-1">
                                                        {availableFields.find(x => x.key === k)?.label || k}
                                                        <button onClick={() => setPanelRule({ ...panelRule, required_fields: panelRule.required_fields?.filter(x => x !== k) })}><X className="h-3 w-3 opacity-60 hover:opacity-100" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <Select value="" onValueChange={v => { if (!panelRule.required_fields?.includes(v)) setPanelRule({ ...panelRule, required_fields: [...(panelRule.required_fields || []), v] }) }}>
                                            <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Add field requirement..." /></SelectTrigger>
                                            <SelectContent>
                                                {availableFields.filter(f => !panelRule.required_fields?.includes(f.key)).map(f => (
                                                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <label className="flex items-start gap-3 cursor-pointer px-1">
                                    <input type="checkbox" checked={panelRule.note_required || false} onChange={e => setPanelRule({ ...panelRule, note_required: e.target.checked })}
                                        className="mt-0.5 w-3.5 h-3.5 text-[#6366f1] border-slate-300 rounded focus:ring-[#6366f1] accent-[#6366f1]" />
                                    <div>
                                        <div className="text-[13px] font-[500] text-[#0f1729] flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-slate-400" /> Note</div>
                                        <div className="text-[11.5px] text-[#8892a4]">Require a note when transitioning</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 cursor-pointer px-1">
                                    <input type="checkbox" checked={panelRule.attachment_required || false} onChange={e => setPanelRule({ ...panelRule, attachment_required: e.target.checked })}
                                        className="mt-0.5 w-3.5 h-3.5 text-[#6366f1] border-slate-300 rounded focus:ring-[#6366f1] accent-[#6366f1]" />
                                    <div>
                                        <div className="text-[13px] font-[500] text-[#0f1729] flex items-center gap-1.5"><Paperclip className="h-3.5 w-3.5 text-slate-400" /> File Attachment</div>
                                        <div className="text-[11.5px] text-[#8892a4]">Require a file upload</div>
                                    </div>
                                </label>
                            </div>

                            {/* Checklist */}
                            <div className="text-[10px] font-[700] uppercase tracking-[0.8px] text-[#94a3b8] mb-3 border-b border-[#f1f3f5] pb-1">Checklist</div>
                            <div className="space-y-2">
                                {(panelRule.checklist || []).map((item, i) => (
                                    <div key={i} className="flex gap-2 items-center group/item">
                                        <div className="h-3.5 w-3.5 border border-slate-300 rounded shrink-0" />
                                        <Input value={item} className="h-7 text-[12px] border-none shadow-none focus-visible:ring-0 px-1 rounded-none border-b border-transparent hover:border-[#e5e8ed] focus-visible:border-b-2 focus-visible:border-[#4f46e5]"
                                            placeholder="Checklist item..."
                                            onChange={e => { const cl = [...(panelRule.checklist || [])]; cl[i] = e.target.value; setPanelRule({ ...panelRule, checklist: cl }) }} />
                                        <button onClick={() => setPanelRule({ ...panelRule, checklist: panelRule.checklist?.filter((_, idx) => idx !== i) })}
                                            className="text-red-400 hover:text-red-600 opacity-0 group-hover/item:opacity-100 transition-opacity"><X className="h-3.5 w-3.5" /></button>
                                    </div>
                                ))}
                                <button onClick={() => setPanelRule({ ...panelRule, checklist: [...(panelRule.checklist || []), ""] })}
                                    className="text-[#6366f1] text-[11px] font-[500] hover:underline flex items-center gap-1 mt-1"><Plus className="h-3 w-3" /> Add checklist item</button>
                            </div>
                        </div>

                        {/* Panel Footer */}
                        <div className="px-5 py-4 border-t border-[#e5e8ed] bg-white flex justify-end gap-3 shrink-0">
                            <Button variant="outline" onClick={() => setPanelOpen(false)} className="px-5">Cancel</Button>
                            <Button onClick={saveRule} className="bg-[#4f46e5] hover:bg-[#4338ca] text-white px-5">Save Rule</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
