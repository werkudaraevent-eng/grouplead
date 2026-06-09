"use client"

import { useEffect, useState, useTransition, useRef } from "react"
import { useForm, useWatch, useFieldArray } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useCompany } from "@/contexts/company-context"
import { usePermissions } from "@/contexts/permissions-context"
import { createLeadAction, updateLeadAction } from "@/app/actions/lead-actions"
import { useMasterOptions } from "@/hooks/use-master-options"
import { computeAccountStatus } from "@/features/leads/lib/compute-account-status"
import type { FormSchema, Lead } from "@/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Form, FormControl, FormField, FormItem, FormMessage
} from "@/components/ui/form"
import { CompanyCombobox, ContactCombobox } from "@/components/shared/entity-combobox"
import { CurrencyInput } from "@/components/shared/currency-input"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { LayoutItemsMap, VisibilityRules } from "@/features/settings/components/form-layout-builder"
import { mergeMissingNativeFields } from "@/features/settings/lib/layout-self-heal"
import { formatTabLabel, getVisibleTabIds } from "@/features/settings/lib/form-layout-tabs"
import { DynamicField } from "./dynamic-field"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { DatePickerField } from "@/components/shared/date-picker-field"

const DEFAULT_LAYOUT: LayoutItemsMap = {
    project: ["native:project_name", "native:pipeline_stage_id", "native:category", "native:grade_lead", "native:client_company_id", "native:account_status", "native:contact_id", "native:pic_sales_id", "native:lead_source", "native:referral_source", "native:received_date", "native:target_close_date"],
    event: ["native:event_dates", "native:month_event", "native:pax_count", "native:event_format", "native:destinations", "native:virtual_platform"],
    classification: ["native:main_stream", "native:stream_type", "native:business_purpose", "native:area"],
    financial: ["native:estimated_value"],
    hidden: []
}
import { Save, Loader2, Check, ChevronsUpDown, Plus, Trash2, X, CalendarIcon, Settings2 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MultiDatePicker } from "@/components/shared/multi-date-picker"
import { Switch } from "@/components/ui/switch"
import { computeMonthEvent } from "@/features/leads/lib/compute-month-event"
import { format } from "date-fns"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"



const addLeadSchema = z.object({
    project_name: z.string().min(1, "Project name is required"),
    company_id: z.string().nullable().optional(),
    pipeline_stage_id: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    grade_lead: z.string().nullable().optional(),
    lead_source: z.string().nullable().optional(),
    referral_source: z.string().nullable().optional(),
    pic_sales_id: z.string().nullable().optional(),
    target_close_date: z.string().nullable().optional(),
    received_date: z.string().nullable().optional(),
    closed_won_date: z.string().optional().or(z.literal("")),
    closed_lost_date: z.string().optional().or(z.literal("")),
    estimated_value: z.coerce.number().nullable().optional(),
    event_date_start: z.string().nullable().optional(),
    event_date_end: z.string().nullable().optional(),
    event_dates: z.array(z.string()).optional().default([]),
    destinations: z.array(z.object({
        city: z.string().min(1, "City is required"),
        venue: z.string().optional().default(""),
    })).optional().default([]),
    pax_count: z.coerce.number().min(1, "Pax count must be at least 1").nullable().optional(),
    event_format: z.string().nullable().optional(),
    virtual_platform: z.string().nullable().optional(),
    month_event: z.string().nullable().optional(),
    tentative_month: z.string().nullable().optional(),
    tentative_year: z.string().nullable().optional(),
    main_stream: z.string().nullable().optional(),
    stream_type: z.string().nullable().optional(),
    business_purpose: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    general_brief: z.string().nullable().optional(),
    production_sow: z.string().nullable().optional(),
    special_remarks: z.string().nullable().optional(),
    lost_reason: z.string().nullable().optional(),
    lost_reason_details: z.string().nullable().optional(),
    account_status: z.string().nullable().optional(),
    custom_data: z.record(z.string(), z.unknown()).optional(),
}) // removed date validation refine because MultiDatePicker inherently avoids invalid ranges

// account_status used to be a derived read-only echo of the client company’s
// status. It now lives on the lead itself, so it is fully user-editable.
const READONLY_FIELDS = new Set<string>()

const getDynamicSchema = (requiredIds: string[]) => {
    return addLeadSchema.superRefine((data, ctx) => {
        requiredIds.forEach(fieldId => {
            if (fieldId.startsWith('native:')) {
                const key = fieldId.replace('native:', '')
                if (READONLY_FIELDS.has(key)) return // skip read-only derived fields
                let val = (data as any)[key]
                if (key === "month_event") {
                    val = [data.tentative_month, data.tentative_year].filter(Boolean).join(" ")
                }
                
                if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "This field is marked as mandatory by admin",
                        path: [key === "month_event" ? "tentative_month" : key]
                    })
                }
            }
        })
    })
}

type AddLeadValues = z.infer<typeof addLeadSchema>

interface LeadFormProps {
    onSuccess?: () => void
    onClose?: () => void
    pipelineId?: string
    defaultStageId?: string
    initialData?: Lead | null
}

export function LeadForm({ onSuccess, onClose, pipelineId, defaultStageId, initialData }: LeadFormProps) {
    const isEditing = !!initialData
    const [subsidiaries, setSubsidiaries] = useState<{ id: string; name: string }[]>([])
    const [pipelineStages, setPipelineStages] = useState<{ id: string; name: string }[]>([])
    const [customSchemas, setCustomSchemas] = useState<FormSchema[]>([])
    const [customValues, setCustomValues] = useState<Record<string, any>>({})
    // Auto-fill PIC sales preference — fetched from profiles.ui_preferences.
    // Defaults to true so new users get the convenience without configuring.
    const [defaultPicSalesId, setDefaultPicSalesId] = useState<string | null>(null)

    const { can } = usePermissions()
    const canManageLayout = can("master_options", "update")

    // Default 25 matches the canonical computeMonthEvent + import path so the
    // recognition month behaves identically before the System Rules setting
    // loads (or if the setting row is absent).
    const [cutoffDate, setCutoffDate] = useState<number>(25)
    const [layoutConfig, setLayoutConfig] = useState<LayoutItemsMap>(DEFAULT_LAYOUT)
    const [requiredOverrides, setRequiredOverrides] = useState<string[]>(["native:project_name"])
    const [tabSettings, setTabSettings] = useState<any>({})
    const [visibilityRules, setVisibilityRules] = useState<VisibilityRules>({})
    const [showWarning, setShowWarning] = useState(false)
    const [activeTab, setActiveTab] = useState("project")
    const [isPending, startTransition] = useTransition()
    const [clientAccountStatus, setClientAccountStatus] = useState<string | null>(null)
    const [accountStatusReason, setAccountStatusReason] = useState<string | null>(null)
    const accountStatusSource = (initialData as Lead | null)?.account_status_source ?? null
    const supabase = createClient()
    const router = useRouter()
    const { activeCompany, isHoldingView, companies } = useCompany()
    // Cascade tracking refs — initialized from props, synced on form.reset()
    const prevMainStream = useRef<string | null | undefined>(initialData?.main_stream || null)
    const prevStreamType = useRef<string | null | undefined>(initialData?.stream_type || null)

    const companyIds = companies.map((c) => c.id)
    const { options: categoryOptions } = useMasterOptions("category", companyIds)
    const { options: gradeLeadOptions } = useMasterOptions("grade_lead", companyIds)
    const { options: leadSourceOptions } = useMasterOptions("lead_source", companyIds)
    const { options: mainStreamOptions } = useMasterOptions("main_stream", companyIds)
    const { options: allStreamTypeOptions } = useMasterOptions("stream_type", companyIds)
    const { options: allBusinessPurposeOptions } = useMasterOptions("business_purpose", companyIds)
    const { options: areaOptions } = useMasterOptions("area", companyIds)
    const { options: eventCityOptions } = useMasterOptions("event_city", companyIds)
    const { options: eventFormatOptions } = useMasterOptions("event_format", companyIds)
    const { options: lostReasonOptions } = useMasterOptions("lost_reason", companyIds)
    const { options: tentativeMonthOptions } = useMasterOptions("tentative_month", companyIds)
    const { options: tentativeYearOptions } = useMasterOptions("tentative_year", companyIds)

    useEffect(() => {
        if (!isHoldingView) return
        // Prefer subsidiaries the user is a direct member of so the dropdown
        // matches the rest of the holding-view UX. If the user has holding
        // access but no subsidiary memberships (typical for super admins
        // whose only `company_members` row is the holding itself), the
        // filtered list ends up empty — fall back to fetching every
        // non-holding company directly.
        const memberSubs = companies.filter((c) => !c.isHolding).map((c) => ({ id: c.id, name: c.name }))
        if (memberSubs.length > 0) {
            setSubsidiaries(memberSubs)
            return
        }
        let cancelled = false
        ;(async () => {
            const { data } = await supabase
                .from("companies")
                .select("id, name")
                .eq("is_holding", false)
                .order("name", { ascending: true })
            if (cancelled) return
            setSubsidiaries((data ?? []) as { id: string; name: string }[])
        })()
        return () => { cancelled = true }
    }, [isHoldingView, companies, supabase])

    useEffect(() => {
        const fetchSchemas = async () => {
            const companyIds = companies.map((c) => c.id)
            let query = supabase
                .from("form_schemas").select("*")
                .eq("module_name", "leads").eq("is_active", true).order("sort_order")
            if (companyIds.length > 0) {
                const orClauses = companyIds.map((id) => `company_id.eq.${id}`).join(",")
                query = query.or(`${orClauses},company_id.is.null`)
            }
            
            const optQuery = supabase.from("master_options").select("*").eq("option_type", "system_setting").in("label", ["event_cutoff_date", "form_layout_config"])
            
            let stageQuery = supabase.from("pipeline_stages").select("id, name").order("sort_order")
            if (pipelineId) {
                stageQuery = stageQuery.eq("pipeline_id", pipelineId)
            }
            
            const [scRes, optRes, stRes] = await Promise.all([query, optQuery, stageQuery])
            if (scRes.data) setCustomSchemas(scRes.data as FormSchema[])
            if (stRes.data) setPipelineStages(stRes.data)
            if (optRes.data) {
                const cutoff = optRes.data.find(o => o.label === "event_cutoff_date")
                if (cutoff) setCutoffDate(parseInt(cutoff.value))
                const layoutOpt = optRes.data.find(o => o.label === "form_layout_config")
                if (layoutOpt) {
                    try { 
                        const parsed = JSON.parse(layoutOpt.value)
                        
                        // Extract base layout
                        const baseLayout = parsed.tabs ? { ...DEFAULT_LAYOUT, ...parsed.tabs } : { ...DEFAULT_LAYOUT, ...parsed }

                        // Self-heal: reinject native fields the saved layout
                        // is missing. Critical for fields shipped after a
                        // tenant already saved a custom layout (e.g.
                        // received_date) — without this they'd be silently
                        // absent from the form even though they exist in
                        // DEFAULT_LAYOUT.
                        const healedLayout = mergeMissingNativeFields(baseLayout, DEFAULT_LAYOUT)

                        if (parsed.tabs && parsed.requiredOverrides) {
                            setLayoutConfig(healedLayout)
                            setRequiredOverrides(parsed.requiredOverrides)
                            if (parsed.visibilityRules) setVisibilityRules(parsed.visibilityRules)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                        } else {
                            setLayoutConfig(healedLayout)
                        }
                    } catch(e) {}
                }
            }
        }
        fetchSchemas()
    }, [supabase, companies])

    // Resolve current user + their auto-fill PIC preference. Only applies
    // when creating a new lead. We require the user to actually be in the
    // PIC sales options (sales / bu_manager) so we don't pre-fill a value
    // the user can't legitimately own.
    useEffect(() => {
        if (isEditing) return
        let cancelled = false
        ;(async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (cancelled || !user) return
            const { data: profile } = await supabase
                .from("profiles")
                .select("id, role, ui_preferences")
                .eq("id", user.id)
                .single()
            if (cancelled || !profile) return
            const prefs = (typeof profile.ui_preferences === "object" && profile.ui_preferences) ? profile.ui_preferences as Record<string, unknown> : {}
            const enabled = prefs.auto_fill_pic_sales !== false // default true
            const eligibleRole = profile.role === "sales" || profile.role === "bu_manager"
            if (!enabled || !eligibleRole) return
            setDefaultPicSalesId(profile.id)
        })()
        return () => { cancelled = true }
    }, [supabase, isEditing])

    // For editing existing leads: only enforce project_name as required
    // Historical/imported leads often have incomplete data — don't block saves
    const effectiveRequired = isEditing
        ? requiredOverrides.filter(id => id === "native:project_name")
        : requiredOverrides
    const dynamicSchema = getDynamicSchema(effectiveRequired)
    const visibleTabs = getVisibleTabIds(layoutConfig, tabSettings)
    const resolvedActiveTab = visibleTabs.includes(activeTab) ? activeTab : (visibleTabs[0] || activeTab)
    const form = useForm<AddLeadValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(dynamicSchema) as any,
        defaultValues: initialData ? {
            project_name: initialData.project_name || "",
            company_id: initialData.company_id || null,
            pipeline_stage_id: initialData.pipeline_stage_id || defaultStageId || null,
            client_company_id: initialData.client_company_id || null,
            contact_id: initialData.contact_id || null,
            category: initialData.category || null,
            grade_lead: initialData.grade_lead || null,
            lead_source: initialData.lead_source || null,
            referral_source: initialData.referral_source || null,
            pic_sales_id: initialData.pic_sales_id || null,
            target_close_date: initialData.target_close_date || "",
            month_event: initialData.month_event || null,
            tentative_month: (() => {
                const me = initialData.month_event || ""
                if (me.includes("-")) {
                    const mapped: Record<string, string> = { "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December" }
                    return mapped[me.split("-")[0]] || null
                }
                const parsed = me.split(" ")[0] || null
                if (!parsed && initialData.event_dates && initialData.event_dates.length > 0) {
                    // Fallback: derive from event END date + cut-off rule.
                    const derived = computeMonthEvent(initialData.event_dates, cutoffDate)
                    return derived ? derived.split(" ")[0] : null
                }
                return parsed
            })(),
            tentative_year: (() => {
                const me = initialData.month_event || ""
                if (me.includes("-")) {
                    const yr = me.split("-")[1]
                    return yr ? (yr.length === 2 ? "20" + yr : yr) : null
                }
                const parsed = me.split(" ")[1] || null
                if (!parsed && initialData.event_dates && initialData.event_dates.length > 0) {
                    const derived = computeMonthEvent(initialData.event_dates, cutoffDate)
                    return derived ? derived.split(" ")[1] : null
                }
                return parsed
            })(),
            estimated_value: initialData.estimated_value || null,
            event_date_start: initialData.event_date_start || null,
            event_date_end: initialData.event_date_end || null,
            event_dates: initialData.event_dates || [],
            destinations: Array.isArray(initialData.destinations) ? initialData.destinations.map((d: { city: string; venue?: string }) => ({ city: d.city, venue: d.venue ?? "" })) : [],
            pax_count: initialData.pax_count || null,
            event_format: initialData.event_format || null,
            virtual_platform: initialData.virtual_platform || null,
            main_stream: initialData.main_stream || null,
            stream_type: initialData.stream_type || null,
            business_purpose: initialData.business_purpose || null,
            area: initialData.area || null,
            general_brief: initialData.general_brief || null,
            production_sow: initialData.production_sow || null,
            special_remarks: initialData.special_remarks || null,
            account_status: initialData.account_status || null,
            custom_data: {},
        } : {
            project_name: "",
            company_id: null,
            pipeline_stage_id: defaultStageId || null,
            client_company_id: null,
            contact_id: null,
            category: null,
            grade_lead: null,
            lead_source: null,
            referral_source: null,
            pic_sales_id: null,
            target_close_date: "",
            received_date: new Date().toISOString().slice(0, 10),
            closed_won_date: "",
            closed_lost_date: "",
            month_event: null,
            tentative_month: null,
            tentative_year: null,
            estimated_value: null,
            event_date_start: null,
            event_date_end: null,
            event_dates: [],
            destinations: [],
            pax_count: null,
            event_format: null,
            virtual_platform: null,
            main_stream: null,
            stream_type: null,
            business_purpose: null,
            area: null,
            general_brief: null,
            production_sow: null,
            special_remarks: null,
            account_status: null,
            custom_data: {},
        },
    })

    // Once the auto-fill default resolves AFTER the form is mounted, patch
    // the pic_sales_id field if the user hasn't touched it yet. This handles
    // the common case where the form mounts before the profile fetch lands.
    useEffect(() => {
        if (isEditing || !defaultPicSalesId) return
        const current = form.getValues("pic_sales_id")
        if (current) return
        form.setValue("pic_sales_id", defaultPicSalesId, { shouldDirty: false, shouldTouch: false })
    }, [defaultPicSalesId, isEditing, form])

    const isFieldMandatory = (fieldId: string) => requiredOverrides.includes(fieldId) || fieldId === "native:project_name"
    const getLabelStr = (baseLabel: string, fieldId: string) => baseLabel + (isFieldMandatory(fieldId) ? " *" : "") // legacy helper, retained for any caller still relying on it


    // Reset form when initialData changes (e.g., switching between edit targets)
    useEffect(() => {
        if (initialData) {
            const me = initialData.month_event || ""
            let tMonth: string | null = null
            let tYear: string | null = null
            if (me.includes("-")) {
                const mapped: Record<string, string> = { "Jan": "January", "Feb": "February", "Mar": "March", "Apr": "April", "May": "May", "Jun": "June", "Jul": "July", "Aug": "August", "Sep": "September", "Oct": "October", "Nov": "November", "Dec": "December" }
                tMonth = mapped[me.split("-")[0]] || null
                const yr = me.split("-")[1]
                tYear = yr ? (yr.length === 2 ? "20" + yr : yr) : null
            } else if (me.trim()) {
                tMonth = me.split(" ")[0] || null
                tYear = me.split(" ")[1] || null
            }
            if (!tMonth && initialData.event_dates && initialData.event_dates.length > 0) {
                // Fallback: derive from event END date + cut-off rule (canonical helper).
                const derived = computeMonthEvent(initialData.event_dates, cutoffDate)
                if (derived) {
                    tMonth = derived.split(" ")[0]
                    tYear = derived.split(" ")[1]
                }
            }
            form.reset({
                project_name: initialData.project_name || "",
                company_id: initialData.company_id || null,
                pipeline_stage_id: initialData.pipeline_stage_id || defaultStageId || null,
                client_company_id: initialData.client_company_id || null,
                contact_id: initialData.contact_id || null,
                category: initialData.category || null,
                grade_lead: initialData.grade_lead || null,
                lead_source: initialData.lead_source || null,
                referral_source: initialData.referral_source || null,
                pic_sales_id: initialData.pic_sales_id || null,
            target_close_date: initialData.target_close_date || "",
            closed_won_date: initialData.closed_won_date ? initialData.closed_won_date.split("T")[0] : "",
            closed_lost_date: initialData.closed_lost_date ? initialData.closed_lost_date.split("T")[0] : "",
                month_event: initialData.month_event || null,
                tentative_month: tMonth,
                tentative_year: tYear,
                estimated_value: initialData.estimated_value || null,
                event_date_start: initialData.event_date_start || null,
                event_date_end: initialData.event_date_end || null,
                event_dates: initialData.event_dates || [],
                destinations: Array.isArray(initialData.destinations) ? initialData.destinations.map((d: { city: string; venue?: string }) => ({ city: d.city, venue: d.venue ?? "" })) : [],
                pax_count: initialData.pax_count || null,
                event_format: initialData.event_format || null,
                virtual_platform: initialData.virtual_platform || null,
                main_stream: initialData.main_stream || null,
                stream_type: initialData.stream_type || null,
                business_purpose: initialData.business_purpose || null,
                area: initialData.area || null,
                general_brief: initialData.general_brief || null,
                production_sow: initialData.production_sow || null,
                special_remarks: initialData.special_remarks || null,
                account_status: initialData.account_status || null,
                custom_data: {},
            })
            setCustomValues((initialData.custom_data as Record<string, unknown>) ?? {})
            // Sync cascade refs so watchers don't see a false "change"
            prevMainStream.current = initialData.main_stream || null
            prevStreamType.current = initialData.stream_type || null
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData?.id])

    const { dirtyFields } = form.formState

    const handleAttemptClose = () => {
        const hasRealChanges = Object.keys(dirtyFields).length > 0
        if (hasRealChanges) {
            setShowWarning(true)
        } else {
            form.reset()
            onClose?.()
        }
    }

    const handleForceClose = () => {
        setShowWarning(false)
        form.reset()
        setCustomValues({})
        onClose?.()
    }

    // ═══ Dynamic Visibility Rule Evaluator (Multi-Condition with AND/OR) ═══
    // Watch ALL form values for rule evaluation
    const allFormValues = useWatch({ control: form.control })

    const evaluateCondition = (cond: { dependsOn: string; operator: string; value: string | string[] }): boolean => {
        const depKey = cond.dependsOn.replace("native:", "").replace("custom:", "")
        const depValue = String((allFormValues as Record<string, unknown>)?.[depKey] ?? "")

        switch (cond.operator) {
            case "equals": return depValue === String(cond.value)
            case "not_equals": return depValue !== String(cond.value)
            case "contains": return depValue.toLowerCase().includes(String(cond.value).toLowerCase())
            case "starts_with": return depValue.toLowerCase().startsWith(String(cond.value).toLowerCase())
            case "in": return Array.isArray(cond.value) ? cond.value.includes(depValue) : depValue === String(cond.value)
            case "not_empty": return !!depValue && depValue !== "null"
            default: return true
        }
    }

    const isFieldVisible = (fieldId: string): boolean => {
        const rule = visibilityRules[fieldId]
        if (!rule) return true // No rule = always visible

        // New multi-condition format
        if (rule.conditions?.length) {
            const results = rule.conditions.map(evaluateCondition)
            return rule.logic === "or" ? results.some(Boolean) : results.every(Boolean)
        }

        // Backward compat: old single-condition format (dependsOn at root level)
        const legacy = rule as unknown as { dependsOn?: string; operator?: string; value?: string | string[] }
        if (legacy.dependsOn) return evaluateCondition(legacy as { dependsOn: string; operator: string; value: string | string[] })

        return true
    }

    // Auto-clear hidden field values when visibility changes
    const prevVisRef = useRef<Record<string, boolean>>({})
    useEffect(() => {
        const clearMap: Record<string, unknown> = {
            referral_source: null,
            destinations: [],
            virtual_platform: null,
        }
        for (const fieldId of Object.keys(visibilityRules)) {
            const visible = isFieldVisible(fieldId)
            const wasVisible = prevVisRef.current[fieldId] !== false
            if (!visible && wasVisible) {
                const key = fieldId.replace("native:", "").replace("custom:", "")
                if (key in clearMap) {
                    form.setValue(key as any, clearMap[key] as any)
                }
            }
            prevVisRef.current[fieldId] = visible
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [allFormValues, visibilityRules])

    // Watch event_format for conditional spatial logic (fallback when no visibility rules set)
    const watchedEventFormat = useWatch({ control: form.control, name: "event_format" })
    const isOnline = watchedEventFormat === "Online" || watchedEventFormat === "Hybrid"
    const isPhysical = watchedEventFormat === "Onsite" || watchedEventFormat === "Hybrid"

    const watchedEventDates = useWatch({ control: form.control, name: "event_dates" })
    const isFirstRender = useRef(true)
    const prevEventDatesStr = useRef<string>(JSON.stringify(initialData?.event_dates ?? []))

    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false
            return
        }
        const currentDateStr = JSON.stringify(watchedEventDates ?? [])
        if (currentDateStr !== prevEventDatesStr.current) {
            prevEventDatesStr.current = currentDateStr
            if (watchedEventDates && watchedEventDates.length > 0) {
                // Auto-derive Revenue Recognition month from the event's END
                // date + the company cut-off rule (System Rules). Uses the
                // canonical computeMonthEvent so form, import, and server all
                // agree. The user can still override the month/year manually
                // afterwards — we only set, never lock.
                const me = computeMonthEvent(watchedEventDates, cutoffDate)
                if (me) {
                    const [monthName, yyyy] = me.split(" ")
                    form.setValue("tentative_month", monthName, { shouldDirty: true, shouldValidate: true })
                    form.setValue("tentative_year", yyyy, { shouldDirty: true, shouldValidate: true })
                }
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedEventDates, cutoffDate])

    // Cascading taxonomy: main_stream → stream_type → business_purpose
    const watchedMainStream = useWatch({ control: form.control, name: "main_stream" })
    const watchedStreamType = useWatch({ control: form.control, name: "stream_type" })

    // Fetch suggested account status for the selected client company. We
    // surface this as a hint and as a quick-fill option — it never silently
    // overwrites a value the user has already chosen on this lead.
    const watchedClientCompanyId = useWatch({ control: form.control, name: "client_company_id" })
    useEffect(() => {
        let cancelled = false
        if (!watchedClientCompanyId) {
            setClientAccountStatus(null)
            setAccountStatusReason(null)
            return
        }
        void (async () => {
            const computation = await computeAccountStatus(supabase, watchedClientCompanyId)
            if (cancelled) return
            setClientAccountStatus(computation.value)
            setAccountStatusReason(computation.reason)
            // For brand-new leads with no manual choice yet, pre-fill the
            // computed value so sales rarely needs to touch the field.
            if (!isEditing) {
                const current = form.getValues("account_status")
                if (!current) {
                    form.setValue("account_status", computation.value, { shouldDirty: false })
                }
            }
        })()
        return () => {
            cancelled = true
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedClientCompanyId])

    const filteredStreamTypes = watchedMainStream
        ? allStreamTypeOptions.filter((o) => o.parent_value === watchedMainStream)
        : []
    const filteredBusinessPurposes = watchedStreamType
        ? allBusinessPurposeOptions.filter((o) => o.parent_value === watchedStreamType)
        : []

    // Reset children when parent changes — only on actual user-driven value change.
    // Refs are declared at component top and synced in the form.reset() effect.

    useEffect(() => {
        // Only cascade if the value actually changed to something different
        if (prevMainStream.current === watchedMainStream) return
        prevMainStream.current = watchedMainStream
        form.setValue("stream_type", null)
        form.setValue("business_purpose", null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedMainStream])

    useEffect(() => {
        if (prevStreamType.current === watchedStreamType) return
        prevStreamType.current = watchedStreamType
        form.setValue("business_purpose", null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedStreamType])

    // Dynamic destinations field array
    const { fields: destinationFields, append: appendDestination, remove: removeDestination } = useFieldArray({
        control: form.control,
        name: "destinations",
    })

    const onSubmit = (values: AddLeadValues) => {
        startTransition(async () => {
            try {
                const finalCompanyId = isHoldingView ? values.company_id : activeCompany?.id
                if (!finalCompanyId) {
                    toast.error("Please select a company for this lead")
                    return
                }
                const { company_id: _drop, custom_data: _cd, ...rest } = values

                // ── Validate Custom Fields (Native fields are caught by Zod superRefine) ──
                for (const schema of customSchemas) {
                    const val = customValues[schema.field_key]
                    const isRequired = schema.is_required || requiredOverrides.includes(`custom:${schema.field_key}`)
                    if (isRequired && (val === undefined || val === null || val === "")) {
                        const errorTab = Object.entries(layoutConfig).find(([_, fields]) => Array.isArray(fields) && fields.includes(`custom:${schema.field_key}`))?.[0]
                        if (errorTab) {
                            setActiveTab(errorTab)
                        }
                        toast.error(`Custom field "${schema.field_name}" is required.`)
                        return
                    }
                }

                const payload: Record<string, unknown> = {
                    ...rest,
                    company_id: finalCompanyId,
                    custom_data: Object.keys(customValues).length > 0 ? customValues : {},
                }
                
                // Smart sync of start/end dates for table filtering
                if (values.event_dates && values.event_dates.length > 0) {
                    const sorted = [...values.event_dates].sort()
                    payload.event_date_start = sorted[0]
                    payload.event_date_end = sorted[sorted.length - 1]
                } else {
                    payload.event_date_start = null
                    payload.event_date_end = null
                }
                
                // Allow manual override for revenue recognized date via dual dropdowns
                payload.month_event = [values.tentative_month, values.tentative_year].filter(Boolean).join(" ") || null

                // Tag the source so recalculate jobs know what's safe to touch.
                // If the chosen month matches what the cut-off rule derives from
                // the event dates, it's 'auto'; any divergence (or a tentative
                // entry with no event dates) is a deliberate 'manual' value.
                if (payload.month_event) {
                    const derived = values.event_dates && values.event_dates.length > 0
                        ? computeMonthEvent(values.event_dates, cutoffDate)
                        : null
                    payload.month_event_source = derived && derived === payload.month_event ? "auto" : "manual"
                } else {
                    payload.month_event_source = null
                }

                if (isEditing && initialData) {
                    // ── UPDATE MODE ──
                    const result = await updateLeadAction(initialData.id, payload)
                    if (!result.success) throw new Error(result.error)
                    toast.success("Lead updated successfully")
                    form.reset()
                    setCustomValues({})
                    onSuccess?.()
                    onClose?.()
                    router.refresh()
                } else {
                    // ── CREATE MODE ──
                    payload.pipeline_id = pipelineId || null
                    // Clean spatial fields based on event format
                    if (payload.event_format === "Online") {
                        payload.destinations = []
                    } else if (payload.event_format === "Onsite") {
                        payload.virtual_platform = null
                    }
                    const result = await createLeadAction(payload)
                    if (!result.success) throw new Error(result.error)
                    toast.success("Lead created — opening details...")
                    form.reset()
                    setCustomValues({})
                    onSuccess?.()
                    onClose?.()
                    if (result.data?.id) {
                        router.push(`/leads/${result.data.id}`)
                    } else {
                        router.refresh()
                    }
                }
            } catch (err) {
                toast.error(`${isEditing ? 'Update' : 'Create'} failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        })
    }

    const onError = (errors: any) => {
        const errorKeys = Object.keys(errors)
        if (errorKeys.length === 0) return

        // Build human-readable field names
        const fieldLabels: Record<string, string> = {
            project_name: "Project Name", category: "Category", grade_lead: "Grade Lead",
            client_company_id: "Client Company", contact_id: "Contact Person",
            pic_sales_id: "PIC Sales", lead_source: "Lead Source", target_close_date: "Target Close Date",
            pipeline_stage_id: "Pipeline Stage", estimated_value: "Estimated Value",
            main_stream: "Main Stream", stream_type: "Stream Type", business_purpose: "Business Purpose",
            area: "Client Source Area", event_dates: "Event Dates", company_id: "Assign to Company",
        }

        const errorFieldNames = errorKeys.map(k => fieldLabels[k] || k.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()))

        // Navigate to the tab containing the first error
        const firstKey = errorKeys[0]
        const nativeKey = `native:${firstKey}`
        const errorTab = Object.entries(layoutConfig).find(([_, fields]) => Array.isArray(fields) && fields.includes(nativeKey))?.[0]
        if (errorTab) setActiveTab(errorTab)

        toast.error(`Required: ${errorFieldNames.join(", ")}`)
    }

    const currentStageId = form.watch("pipeline_stage_id")
    const isClosedLost = pipelineStages.find(s => s.id === currentStageId)?.name === "Closed Lost"

    const hasCustomFields = customSchemas.length > 0

    return (
        <>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col h-full overflow-hidden">
                <Tabs value={resolvedActiveTab} onValueChange={setActiveTab} className="flex flex-col h-full overflow-hidden">
                    {/* FIXED HEADER: Title + Tabs */}
                    <div className="flex-none px-6 pt-5 pb-2 border-b border-border bg-card z-10">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h2 className="text-base font-semibold tracking-tight">{isEditing ? "Edit lead details" : "Add new lead"}</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">{isEditing ? `Editing ${initialData?.project_name || "lead"} · #${initialData?.manual_id || "N/A"}` : "Fill in the details to track a new lead."}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {canManageLayout && (
                                    <Button variant="ghost" size="sm" asChild className="h-8 px-2 text-muted-foreground hover:text-foreground hidden sm:flex">
                                        <Link href="/settings/master-options?tab=layout" onClick={onClose}>
                                            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                            <span className="text-xs">Layout</span>
                                        </Link>
                                    </Button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAttemptClose}
                                    className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 p-1"
                                >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                </button>
                            </div>
                        </div>
                        {/* DYNAMIC TABS LIST */}
                        <TabsList className="flex w-full mt-4 bg-muted/60 p-1 rounded-lg overflow-x-auto no-scrollbar justify-start">
                            {visibleTabs.map(tab => (
                                    <TabsTrigger key={tab} value={tab} className="text-xs min-w-fit px-4 flex-1">
                                        {tabSettings[tab]?.label || formatTabLabel(tab)}
                                    </TabsTrigger>
                                ))}
                        </TabsList>
                    </div>

                    {/* SCROLLABLE BODY */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">

                        {visibleTabs.map(tab => (
                            <TabsContent key={tab} value={tab} className="mt-0 space-y-5">
                                {tab === "project" && isHoldingView && (
                                    <FieldSection title="Company Assignment">
                                        <FormField control={form.control} name="company_id" render={({ field }) => (
                                            <FormItem className="space-y-1.5">
                                                <FormFieldLabel required>Assign to company</FormFieldLabel>
                                                <FormControl>
                                                    <SearchableSelect
                                                        value={field.value ?? null}
                                                        onChange={(v) => field.onChange(v ?? null)}
                                                        options={subsidiaries.map(c => ({ value: c.id, label: c.name }))}
                                                        placeholder="Select subsidiary…"
                                                        searchPlaceholder="Search…"
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )} />
                                    </FieldSection>
                                )}
                                <FieldSection title={`${formatTabLabel(tab)} Details`}>
                                    <FieldGrid>
                                        {(layoutConfig[tab] || []).map((fieldId: string) => {
                                            // Handle Custom Fields dynamically
                                            if (fieldId.startsWith("custom:")) {
                                                const schema = customSchemas.find(s => s.field_key === fieldId.replace("custom:", ""))
                                                if (!schema) return null
                                                return (
                                                    <DynamicField key={schema.id} schema={schema}
                                                        value={customValues[schema.field_key]}
                                                        onChange={(val) => setCustomValues((prev) => ({ ...prev, [schema.field_key]: val }))}
                                                        companyId={activeCompany?.id}
                                                        allValues={customValues}
                                                        isRequired={schema.is_required || isFieldMandatory(fieldId)} />
                                                )
                                            }

                                            // Render Native Fields individually mapped
                                            switch (fieldId) {
                                                case "native:project_name":
                                                    return <TextField key={fieldId} control={form.control} name="project_name" label="Project name" required={isFieldMandatory(fieldId)} className="sm:col-span-2" />
                                                case "native:pipeline_stage_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="pipeline_stage_id" render={({ field }) => (
                                                            <FormItem className="space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>Pipeline stage</FormFieldLabel>
                                                                <FormControl>
                                                                    <SearchableSelect
                                                                        value={field.value ?? null}
                                                                        onChange={(v) => field.onChange(v ?? null)}
                                                                        options={pipelineStages.map(s => ({ value: s.id, label: s.name }))}
                                                                        placeholder="Select stage…"
                                                                    />
                                                                </FormControl>
                                                                <FormMessage className="text-[11px]" />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:category":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="category" label="Category" required={isFieldMandatory(fieldId)} options={categoryOptions.map((o) => o.value)} />
                                                case "native:grade_lead":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="grade_lead" label="Grade lead" required={isFieldMandatory(fieldId)} options={gradeLeadOptions.map((o) => o.value)} />
                                                case "native:client_company_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="client_company_id" render={({ field }) => (
                                                            <FormItem className="space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>Client company</FormFieldLabel>
                                                                <FormControl><CompanyCombobox value={field.value ?? null} onChange={(id) => { field.onChange(id); form.setValue("contact_id", null) }} /></FormControl>
                                                                <FormMessage className="text-[11px]" />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:account_status": {
                                                    return (
                                                        <FormField
                                                            key={fieldId}
                                                            control={form.control}
                                                            name="account_status"
                                                            render={({ field }) => {
                                                                const value = (field.value ?? "") as string
                                                                const matchesSuggestion =
                                                                    !!clientAccountStatus &&
                                                                    value === clientAccountStatus
                                                                const sourceLabel = (() => {
                                                                    if (!isEditing) {
                                                                        if (matchesSuggestion && accountStatusReason) {
                                                                            return `Auto-detected · ${accountStatusReason}`
                                                                        }
                                                                        return null
                                                                    }
                                                                    if (accountStatusSource === "computed") {
                                                                        return accountStatusReason
                                                                            ? `Auto-detected · ${accountStatusReason}`
                                                                            : "Auto-detected from history"
                                                                    }
                                                                    if (accountStatusSource === "manual") {
                                                                        return "Manually set"
                                                                    }
                                                                    return null
                                                                })()
                                                                return (
                                                                    <FormItem className="sm:col-span-2 space-y-1.5">
                                                                        <FormFieldLabel required={isFieldMandatory(fieldId)} hint="New = first-time client. Repeater = previously bought once or twice. Contracted = ongoing contract in place.">
                                                                            Account status
                                                                        </FormFieldLabel>
                                                                        <FormControl>
                                                                            <SegmentedControl
                                                                                value={value || "new"}
                                                                                onChange={(v) => field.onChange(v)}
                                                                                options={[
                                                                                    { value: "new", label: "New" },
                                                                                    { value: "repeater", label: "Repeater" },
                                                                                    { value: "contracted", label: "Contracted" },
                                                                                ]}
                                                                                aria-label="Account status"
                                                                            />
                                                                        </FormControl>
                                                                        {sourceLabel && (
                                                                            <p className="text-[11px] text-muted-foreground leading-snug">
                                                                                {sourceLabel}
                                                                                {clientAccountStatus &&
                                                                                    !matchesSuggestion &&
                                                                                    isEditing && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                form.setValue(
                                                                                                    "account_status",
                                                                                                    clientAccountStatus,
                                                                                                    { shouldDirty: true },
                                                                                                )
                                                                                            }
                                                                                            className="ml-1 underline-offset-2 hover:underline text-primary"
                                                                                        >
                                                                                            Use suggested ({clientAccountStatus})
                                                                                        </button>
                                                                                    )}
                                                                            </p>
                                                                        )}
                                                                    </FormItem>
                                                                )
                                                            }}
                                                        />
                                                    )
                                                }
                                                case "native:contact_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="contact_id" render={({ field }) => (
                                                            <FormItem className="space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>Contact person</FormFieldLabel>
                                                                <FormControl><ContactCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} clientCompanyId={form.watch("client_company_id") ?? null} /></FormControl>
                                                                <FormMessage className="text-[11px]" />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:pic_sales_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="pic_sales_id" render={({ field }) => (
                                                            <FormItem className="space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>PIC sales</FormFieldLabel>
                                                                <FormControl><ProfileCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} placeholder="Select PIC sales…" filterRoles={["sales", "bu_manager"]} /></FormControl>
                                                                <FormMessage className="text-[11px]" />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:lead_source":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="lead_source" label="Lead source" required={isFieldMandatory(fieldId)} options={leadSourceOptions.map((o) => o.value)} />
                                                case "native:referral_source":
                                                    return isFieldVisible("native:referral_source") ? <TextField key={fieldId} control={form.control} name="referral_source" label="Referral source" required={isFieldMandatory(fieldId)} /> : null
                                                case "native:received_date":
                                                    return (
                                                        <TextField
                                                            key={fieldId}
                                                            control={form.control}
                                                            name="received_date"
                                                            label="Received date"
                                                            required={isFieldMandatory(fieldId)}
                                                            type="date"
                                                        />
                                                    )
                                                case "native:target_close_date":
                                                    return (
                                                        <div key={fieldId} className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            <TextField control={form.control} name="target_close_date" label="Target close date" required={isFieldMandatory(fieldId)} type="date" />
                                                            {initialData && (
                                                                <>
                                                                    <TextField control={form.control} name="closed_won_date" label="Closed won date" type="date" />
                                                                    <TextField control={form.control} name="closed_lost_date" label="Closed lost date" type="date" />
                                                                </>
                                                            )}
                                                        </div>
                                                    )
                                                case "native:event_dates":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="event_dates" render={({ field }) => (
                                                            <FormItem className="sm:col-span-2 space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>Event dates</FormFieldLabel>
                                                                <p className="text-[12px] text-muted-foreground">Select one or multiple dates. Use <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">Shift</kbd> + click to select a range.</p>
                                                                <FormControl>
                                                                    <MultiDatePicker value={field.value ?? []} onChange={field.onChange} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:month_event":
                                                    // Handled outside of the main FieldGrid for UX separation
                                                    return null
                                                case "native:pax_count":
                                                    return <TextField key={fieldId} control={form.control} name="pax_count" label="Pax count" required={isFieldMandatory(fieldId)} type="number" />
                                                case "native:event_format":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="event_format" label="Event format" required={isFieldMandatory(fieldId)} options={eventFormatOptions.map(o => o.value)} />
                                                case "native:destinations":
                                                    if (!isFieldVisible("native:destinations") && !(isPhysical && !visibilityRules["native:destinations"])) return null
                                                    return (
                                                        <div key={fieldId} className="sm:col-span-2 space-y-3">
                                                            <FormFieldLabel required={isFieldMandatory(fieldId)}>Destinations</FormFieldLabel>
                                                            <div className="space-y-2">
                                                                {destinationFields.map((destField, index) => (
                                                                    <div key={destField.id} className="flex items-start gap-2 rounded-lg border border-border bg-background p-3">
                                                                        <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
                                                                            <FormField control={form.control} name={`destinations.${index}.city`} render={({ field }) => (
                                                                                <FormItem className="space-y-1.5">
                                                                                    <FormFieldLabel required>City</FormFieldLabel>
                                                                                    <FormControl>
                                                                                        <SearchableSelect
                                                                                            value={field.value || null}
                                                                                            onChange={(v) => field.onChange(v ?? "")}
                                                                                            options={eventCityOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                                                                                            placeholder="Select city"
                                                                                        />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )} />
                                                                            <TextField control={form.control} name={`destinations.${index}.venue`} label="Venue" />
                                                                        </div>
                                                                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 mt-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => removeDestination(index)}>
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <Button type="button" variant="outline" size="sm" onClick={() => appendDestination({ city: "", venue: "" })}>
                                                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add destination
                                                            </Button>
                                                        </div>
                                                    )
                                                case "native:lost_reason":
                                                    if (!isFieldVisible(fieldId)) return null;
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="lost_reason" label="Lost reason" required={isFieldMandatory(fieldId)} options={lostReasonOptions.map(o => o.value)} />
                                                case "native:lost_reason_details":
                                                    if (!isFieldVisible(fieldId)) return null;
                                                    return (
                                                        <FormField key={fieldId} control={form.control as any} name="lost_reason_details" render={({ field }) => (
                                                            <FormItem className="sm:col-span-2 space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>Lost reason details</FormFieldLabel>
                                                                <FormControl>
                                                                    <textarea rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder="Provide more context…" {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                                <FormMessage className="text-[11px]" />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:virtual_platform":
                                                    return (isFieldVisible("native:virtual_platform") || (isOnline && !visibilityRules["native:virtual_platform"])) ? <TextField key={fieldId} control={form.control} name="virtual_platform" label="Virtual platform" required={isFieldMandatory(fieldId)} /> : null
                                                case "native:main_stream":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="main_stream" label="Main stream" required={isFieldMandatory(fieldId)} options={mainStreamOptions.map((o) => o.value)} />
                                                case "native:stream_type":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="stream_type" label="Stream type" required={isFieldMandatory(fieldId)} options={filteredStreamTypes.map((o) => o.value)} disabled={!watchedMainStream} />
                                                case "native:business_purpose":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="business_purpose" label="Business purpose" required={isFieldMandatory(fieldId)} options={filteredBusinessPurposes.map((o) => o.value)} disabled={!watchedStreamType} />
                                                case "native:area":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="area" label="Client source area" required={isFieldMandatory(fieldId)} options={areaOptions.map((o) => o.value)} />
                                                case "native:estimated_value":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="estimated_value" render={({ field }) => (
                                                            <FormItem className="space-y-1.5">
                                                                <FormFieldLabel required={isFieldMandatory(fieldId)}>Estimated value (IDR)</FormFieldLabel>
                                                                <FormControl>
                                                                    <CurrencyInput
                                                                        ref={field.ref}
                                                                        name={field.name}
                                                                        value={field.value}
                                                                        onChange={field.onChange}
                                                                        onBlur={field.onBlur}
                                                                        prefix="Rp"
                                                                    />
                                                                </FormControl>
                                                                <FormMessage className="text-[11px]" />
                                                            </FormItem>
                                                        )} />
                                                    )
                                                default:
                                                    return null
                                            }
                                        })}
                                    </FieldGrid>
                                </FieldSection>

                                {/* Separate box for Revenue Recognition outside Event Details */}
                                {(layoutConfig[tab] || []).includes("native:month_event") && (
                                    <FieldSection title="Revenue Recognition">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <DynamicSelectField control={form.control} name="tentative_month" label="Month" options={tentativeMonthOptions.map(o => o.value)} />
                                            <DynamicSelectField control={form.control} name="tentative_year" label="Year" options={tentativeYearOptions.map(o => o.value)} />
                                        </div>
                                        <p className="text-[11px] text-muted-foreground mt-0">Defaults dynamically back to Event Dates if available.</p>
                                    </FieldSection>
                                )}
                            </TabsContent>
                        ))}


                    </div>
                    {/* END SCROLLABLE BODY */}

                    {/* FIXED FOOTER */}
                    <div className="flex-none px-6 py-3.5 border-t border-border bg-card flex items-center justify-between gap-3 z-10">
                        <p className="text-[11px] text-muted-foreground hidden sm:block">
                            <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Esc</kbd>
                            <span className="mx-1">to cancel</span>
                        </p>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button type="button" variant="ghost" onClick={handleAttemptClose}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending || (isEditing && !form.formState.isDirty)}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                {isPending ? "Saving…" : isEditing ? "Save changes" : "Create lead"}
                            </Button>
                        </div>
                    </div>
                </Tabs>
            </form>
        </Form>

        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have entered data. If you close this modal, all your inputs will be lost.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowWarning(false)}>Keep editing</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive"
                        onClick={handleForceClose}
                    >
                        Discard changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}


function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h4 className="text-[11px] font-semibold text-muted-foreground tracking-wide">{title}</h4>
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">{children}</div>
        </section>
    )
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
    return (<div className={`grid gap-x-4 gap-y-4 [&>*]:min-w-0 ${cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>{children}</div>)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TextField({ control, name, label, type = "text", className, required, autoComplete }: { control: any; name: string; label: string; type?: string; className?: string; required?: boolean; autoComplete?: string }) {
    // Date inputs use DatePickerField (Popover + Calendar) so we get a
    // consistent UI without the native browser quirks.
    if (type === "date") {
        return (
            <FormField control={control} name={name} render={({ field }) => (
                <FormItem className={cn("space-y-1.5", className)}>
                    <FormFieldLabel required={required}>{label}</FormFieldLabel>
                    <FormControl>
                        <DatePickerField
                            value={(field.value as string | null | undefined) ?? ""}
                            onChange={field.onChange}
                            placeholder={`Select ${label.toLowerCase()}`}
                        />
                    </FormControl>
                    <FormMessage className="text-[11px]" />
                </FormItem>
            )} />
        )
    }
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem className={cn("space-y-1.5", className)}>
                <FormFieldLabel required={required}>{label}</FormFieldLabel>
                <FormControl>
                    <Input
                        type={type}
                        autoComplete={autoComplete}
                        aria-required={required}
                        className="h-9 text-sm"
                        {...field}
                        value={field.value ?? ""}
                    />
                </FormControl>
                <FormMessage className="text-[11px]" />
            </FormItem>
        )} />
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DynamicSelectField({ control, name, label, options, disabled, required }: { control: any; name: string; label: string; options: string[]; disabled?: boolean; required?: boolean }) {
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem className="space-y-1.5">
                <FormFieldLabel required={required}>{label}</FormFieldLabel>
                <FormControl>
                    <SearchableSelect
                        value={(field.value as string | null | undefined) ?? null}
                        onChange={(v) => field.onChange(v ?? null)}
                        options={options.length === 0 ? [] : options.map((opt, idx) => ({ value: opt, label: opt, secondary: idx === 0 ? undefined : undefined }))}
                        placeholder={options.length === 0 ? "No options configured" : `Select ${label.toLowerCase()}`}
                        searchPlaceholder="Search…"
                        emptyText="No options found"
                        disabled={disabled || options.length === 0}
                    />
                </FormControl>
                <FormMessage className="text-[11px]" />
            </FormItem>
        )} />
    )
}
