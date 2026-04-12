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
import type { FormSchema, Lead } from "@/types"
import { cn } from "@/lib/utils"
import Link from "next/link"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import { CompanyCombobox, ContactCombobox } from "@/components/shared/entity-combobox"
import { CurrencyInput } from "@/components/shared/currency-input"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import type { LayoutItemsMap, VisibilityRules } from "@/features/settings/components/form-layout-builder"
import { DynamicField } from "./dynamic-field"

const DEFAULT_LAYOUT: LayoutItemsMap = {
    project: ["native:project_name", "native:pipeline_stage_id", "native:category", "native:grade_lead", "native:client_company_id", "native:contact_id", "native:pic_sales_id", "native:lead_source", "native:referral_source", "native:target_close_date"],
    event: ["native:event_dates", "native:month_event", "native:pax_count", "native:event_format", "native:destinations", "native:virtual_platform"],
    classification: ["native:main_stream", "native:stream_type", "native:business_purpose", "native:area"],
    financial: ["native:estimated_value"],
    hidden: []
}
import { Save, Loader2, Check, ChevronsUpDown, Plus, Trash2, X, CalendarIcon, Settings2 } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { MultiDatePicker } from "@/components/shared/multi-date-picker"
import { Switch } from "@/components/ui/switch"
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
    target_close_date: z.string().min(1, "Target close date is required"),
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
    custom_data: z.record(z.string(), z.unknown()).optional(),
}) // removed date validation refine because MultiDatePicker inherently avoids invalid ranges

const getDynamicSchema = (requiredIds: string[]) => {
    return addLeadSchema.superRefine((data, ctx) => {
        requiredIds.forEach(fieldId => {
            if (fieldId.startsWith('native:')) {
                const key = fieldId.replace('native:', '')
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

    const { can } = usePermissions()
    const canManageLayout = can("master_options", "update")

    const [cutoffDate, setCutoffDate] = useState<number>(31)
    const [layoutConfig, setLayoutConfig] = useState<LayoutItemsMap>(DEFAULT_LAYOUT)
    const [requiredOverrides, setRequiredOverrides] = useState<string[]>(["native:project_name"])
    const [tabSettings, setTabSettings] = useState<any>({})
    const [visibilityRules, setVisibilityRules] = useState<VisibilityRules>({})
    const [showWarning, setShowWarning] = useState(false)
    const [activeTab, setActiveTab] = useState("project")
    const [isPending, startTransition] = useTransition()
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
        if (isHoldingView) {
            setSubsidiaries(companies.filter((c) => !c.isHolding).map((c) => ({ id: c.id, name: c.name })))
        }
    }, [isHoldingView, companies])

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
                        
                        // Self-heal: Inject newly added native fields if they are completely missing from DB layouts
                        const allPresent = new Set(Object.values(baseLayout).flat())
                        if (!allPresent.has("native:month_event")) {
                            if (!baseLayout.event) baseLayout.event = []
                            const eventDatesIdx = baseLayout.event.indexOf("native:event_dates")
                            if (eventDatesIdx !== -1) {
                                baseLayout.event.splice(eventDatesIdx + 1, 0, "native:month_event")
                            } else {
                                baseLayout.event.push("native:month_event")
                            }
                        }
                        if (!allPresent.has("native:pipeline_stage_id")) {
                            if (!baseLayout.project) baseLayout.project = []
                            const projectNameIdx = baseLayout.project.indexOf("native:project_name")
                            if (projectNameIdx !== -1) {
                                baseLayout.project.splice(projectNameIdx + 1, 0, "native:pipeline_stage_id")
                            } else {
                                baseLayout.project.unshift("native:pipeline_stage_id")
                            }
                        }

                        if (parsed.tabs && parsed.requiredOverrides) {
                            setLayoutConfig(baseLayout)
                            setRequiredOverrides(parsed.requiredOverrides)
                            if (parsed.visibilityRules) setVisibilityRules(parsed.visibilityRules)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                        } else {
                            setLayoutConfig(baseLayout)
                        }
                    } catch(e) {}
                }
            }
        }
        fetchSchemas()
    }, [supabase, companies])

    const form = useForm<AddLeadValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(getDynamicSchema(requiredOverrides)) as any,
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
                    const sorted = [...initialData.event_dates].sort()
                    const sd = new Date(sorted[0])
                    if (sd.getDate() > 25) sd.setMonth(sd.getMonth() + 1)
                    const monthsNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                    return monthsNames[sd.getMonth()]
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
                    const sorted = [...initialData.event_dates].sort()
                    const sd = new Date(sorted[0])
                    if (sd.getDate() > 25) sd.setMonth(sd.getMonth() + 1)
                    return String(sd.getFullYear())
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
            custom_data: {},
        },
    })

    const isFieldMandatory = (fieldId: string) => requiredOverrides.includes(fieldId) || fieldId === "native:project_name"
    const getLabelStr = (baseLabel: string, fieldId: string) => baseLabel + (isFieldMandatory(fieldId) ? " *" : "")

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
                const sorted = [...initialData.event_dates].sort()
                const sd = new Date(sorted[0])
                if (sd.getDate() > 25) sd.setMonth(sd.getMonth() + 1)
                const monthsNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                tMonth = monthsNames[sd.getMonth()]
                tYear = String(sd.getFullYear())
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
                const sorted = [...watchedEventDates].sort()
                const sd = new Date(sorted[0])
                if (sd.getDate() > cutoffDate) sd.setMonth(sd.getMonth() + 1)
                
                // Format as YYYY-MM-DD
                const yyyy = sd.getFullYear()
                const mm = String(sd.getMonth() + 1).padStart(2, "0")
                const dd = String(sd.getDate()).padStart(2, "0")
                const monthsNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
                const monthName = monthsNames[sd.getMonth()]

                form.setValue("tentative_month", monthName, { shouldDirty: true, shouldValidate: true })
                form.setValue("tentative_year", String(yyyy), { shouldDirty: true, shouldValidate: true })
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedEventDates, cutoffDate])

    // Cascading taxonomy: main_stream → stream_type → business_purpose
    const watchedMainStream = useWatch({ control: form.control, name: "main_stream" })
    const watchedStreamType = useWatch({ control: form.control, name: "stream_type" })

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
        const firstErrorKey = Object.keys(errors)[0]
        if (!firstErrorKey) return

        const nativeKey = `native:${firstErrorKey}`
        const errorTab = Object.entries(layoutConfig).find(([_, fields]) => Array.isArray(fields) && fields.includes(nativeKey))?.[0]

        if (errorTab) {
            setActiveTab(errorTab)
            toast.error(`Please fill all required fields in the ${errorTab.charAt(0).toUpperCase() + errorTab.slice(1)} tab.`)
        } else {
             toast.error("Please fill all required fields.")
        }
    }

    const currentStageId = form.watch("pipeline_stage_id")
    const isClosedLost = pipelineStages.find(s => s.id === currentStageId)?.name === "Closed Lost"

    const hasCustomFields = customSchemas.length > 0

    return (
        <>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col h-full overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full overflow-hidden">
                    {/* FIXED HEADER: Title + Tabs */}
                    <div className="flex-none px-6 pt-6 pb-2 border-b border-slate-100 bg-white z-10">
                        <div className="flex items-start justify-between">
                            <div>
                                <h2 className="text-lg font-semibold">{isEditing ? 'Edit Lead Details' : 'Add New Lead'}</h2>
                                <p className="text-sm text-muted-foreground">{isEditing ? `Editing ${initialData?.project_name || 'lead'} — #${initialData?.manual_id || 'N/A'}` : 'Fill in the details to track a new lead.'}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {canManageLayout && (
                                    <Button variant="outline" size="sm" asChild className="h-8 text-xs shrink-0 hidden sm:flex">
                                        <Link href="/settings/master-options?tab=layout" onClick={onClose}>
                                            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                            Layout Settings
                                        </Link>
                                    </Button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleAttemptClose}
                                    className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">Close</span>
                                </button>
                            </div>
                        </div>
                        {/* DYNAMIC TABS LIST */}
                        <TabsList className="flex w-full mt-4 bg-muted p-1 rounded-lg overflow-x-auto no-scrollbar justify-start">
                            {Object.keys(layoutConfig)
                                .filter(k => k !== "hidden" && (!tabSettings[k] || !tabSettings[k].isHidden))
                                .sort((a, b) => (tabSettings[a]?.sortOrder || 0) - (tabSettings[b]?.sortOrder || 0))
                                .map(tab => (
                                    <TabsTrigger key={tab} value={tab} className="text-xs min-w-fit px-4 flex-1">
                                        {tabSettings[tab]?.label || tab.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                    </TabsTrigger>
                                ))}
                        </TabsList>
                    </div>

                    {/* SCROLLABLE BODY */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">

                        {Object.keys(layoutConfig)
                            .filter(tab => tab !== "hidden" && (!tabSettings[tab] || !tabSettings[tab].isHidden))
                            .map(tab => (
                            <TabsContent key={tab} value={tab} className="mt-0 space-y-5">
                                {tab === "project" && isHoldingView && (
                                    <FieldSection title="Company Assignment">
                                        <FormField control={form.control} name="company_id" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assign to Company *</FormLabel>
                                                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                    <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select subsidiary..." /></SelectTrigger></FormControl>
                                                    <SelectContent>{subsidiaries.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                    </FieldSection>
                                )}
                                <FieldSection title={`${tab.charAt(0).toUpperCase() + tab.slice(1)} Details`}>
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
                                                    return <TextField key={fieldId} control={form.control} name="project_name" label={getLabelStr("Project Name", fieldId)} className="sm:col-span-2" />
                                                case "native:pipeline_stage_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="pipeline_stage_id" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Pipeline Stage", fieldId)}</FormLabel>
                                                                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                                    <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select stage..." /></SelectTrigger></FormControl>
                                                                    <SelectContent>
                                                                        {pipelineStages.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:category":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="category" label={getLabelStr("Category", fieldId)} options={categoryOptions.map((o) => o.value)} />
                                                case "native:grade_lead":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="grade_lead" label={getLabelStr("Grade Lead", fieldId)} options={gradeLeadOptions.map((o) => o.value)} />
                                                case "native:client_company_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="client_company_id" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Client Company", fieldId)}</FormLabel>
                                                                <FormControl><CompanyCombobox value={field.value ?? null} onChange={(id) => { field.onChange(id); form.setValue("contact_id", null) }} /></FormControl>
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:contact_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="contact_id" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Contact Person", fieldId)}</FormLabel>
                                                                <FormControl><ContactCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} clientCompanyId={form.watch("client_company_id") ?? null} /></FormControl>
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:pic_sales_id":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="pic_sales_id" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("PIC Sales", fieldId)}</FormLabel>
                                                                <FormControl><ProfileCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} placeholder="Select PIC Sales..." filterRoles={["sales", "bu_manager"]} /></FormControl>
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:lead_source":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="lead_source" label={getLabelStr("Lead Source", fieldId)} options={leadSourceOptions.map((o) => o.value)} />
                                                case "native:referral_source":
                                                    return isFieldVisible("native:referral_source") ? <TextField key={fieldId} control={form.control} name="referral_source" label={getLabelStr("Referral Source", fieldId)} /> : null
                                                case "native:target_close_date":
                                                    return <TextField key={fieldId} control={form.control} name="target_close_date" label={getLabelStr("Target Close Date", fieldId)} type="date" />
                                                case "native:event_dates":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="event_dates" render={({ field }) => (
                                                            <FormItem className="sm:col-span-2">
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Event Dates", fieldId)}</FormLabel>
                                                                <p className="text-[13px] text-muted-foreground mb-2">Select one or multiple dates. Use <kbd className="px-1.5 py-0.5 bg-slate-100 border rounded text-[11px] font-sans">Shift</kbd> + click to select a range.</p>
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
                                                    return <TextField key={fieldId} control={form.control} name="pax_count" label={getLabelStr("Pax Count", fieldId)} type="number" />
                                                case "native:event_format":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="event_format" label={getLabelStr("Event Format", fieldId)} options={eventFormatOptions.map(o => o.value)} />
                                                case "native:destinations":
                                                    if (!isFieldVisible("native:destinations") && !(isPhysical && !visibilityRules["native:destinations"])) return null
                                                    return (
                                                        <div key={fieldId} className="sm:col-span-2 space-y-3 p-4 border rounded-md bg-muted/30">
                                                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">{getLabelStr("Destinations", fieldId)}</div>
                                                            {destinationFields.map((destField, index) => (
                                                                <div key={destField.id} className="flex items-start gap-3 rounded-md border bg-white p-3">
                                                                    <div className="flex-1 grid gap-3 grid-cols-1 sm:grid-cols-2">
                                                                        <FormField control={form.control} name={`destinations.${index}.city`} render={({ field }) => (
                                                                            <FormItem className="flex flex-col">
                                                                                <FormLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">City *</FormLabel>
                                                                                <Popover>
                                                                                    <PopoverTrigger asChild>
                                                                                        <FormControl>
                                                                                            <Button variant="outline" role="combobox" className={cn("h-9 w-full justify-between text-sm font-normal", !field.value && "text-muted-foreground")}>
                                                                                                {field.value || "Select city"}
                                                                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                                            </Button>
                                                                                        </FormControl>
                                                                                    </PopoverTrigger>
                                                                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                                                                                        <Command>
                                                                                            <CommandInput placeholder="Search city..." />
                                                                                            <CommandList>
                                                                                                <CommandEmpty>City not found</CommandEmpty>
                                                                                                <CommandGroup>
                                                                                                    {eventCityOptions.map((opt) => (
                                                                                                        <CommandItem key={opt.id} value={opt.value} onSelect={() => field.onChange(opt.value)}>
                                                                                                            <Check className={cn("mr-2 h-4 w-4", field.value === opt.value ? "opacity-100" : "opacity-0")} />
                                                                                                            {opt.label}
                                                                                                        </CommandItem>
                                                                                                    ))}
                                                                                                </CommandGroup>
                                                                                            </CommandList>
                                                                                        </Command>
                                                                                    </PopoverContent>
                                                                                </Popover>
                                                                            </FormItem>
                                                                        )} />
                                                                        <TextField control={form.control} name={`destinations.${index}.venue`} label="Venue" />
                                                                    </div>
                                                                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 mt-6 text-destructive shrink-0" onClick={() => removeDestination(index)}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            ))}
                                                            <Button type="button" variant="outline" size="sm" onClick={() => appendDestination({ city: "", venue: "" })}>
                                                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Destination
                                                            </Button>
                                                        </div>
                                                    )
                                                case "native:lost_reason":
                                                    if (!isFieldVisible(fieldId)) return null;
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="lost_reason" label={getLabelStr("Lost Reason", fieldId)} options={lostReasonOptions.map(o => o.value)} />
                                                case "native:lost_reason_details":
                                                    if (!isFieldVisible(fieldId)) return null;
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="lost_reason_details" render={({ field }) => (
                                                            <FormItem className="sm:col-span-2">
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Lost Reason Details", fieldId)}</FormLabel>
                                                                <FormControl>
                                                                    <textarea rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" placeholder="Provide more context..." {...field} value={field.value ?? ""} />
                                                                </FormControl>
                                                            </FormItem>
                                                        )} />
                                                    )
                                                case "native:virtual_platform":
                                                    return (isFieldVisible("native:virtual_platform") || (isOnline && !visibilityRules["native:virtual_platform"])) ? <TextField key={fieldId} control={form.control} name="virtual_platform" label={getLabelStr("Virtual Platform", fieldId)} /> : null
                                                case "native:main_stream":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="main_stream" label={getLabelStr("Main Stream", fieldId)} options={mainStreamOptions.map((o) => o.value)} />
                                                case "native:stream_type":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="stream_type" label={getLabelStr("Stream Type", fieldId)} options={filteredStreamTypes.map((o) => o.value)} disabled={!watchedMainStream} />
                                                case "native:business_purpose":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="business_purpose" label={getLabelStr("Business Purpose", fieldId)} options={filteredBusinessPurposes.map((o) => o.value)} disabled={!watchedStreamType} />
                                                case "native:area":
                                                    return <DynamicSelectField key={fieldId} control={form.control} name="area" label={getLabelStr("Client Source Area", fieldId)} options={areaOptions.map((o) => o.value)} />
                                                case "native:estimated_value":
                                                    return (
                                                        <FormField key={fieldId} control={form.control} name="estimated_value" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Estimated Value (IDR)", fieldId)}</FormLabel>
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
                                        <div className="grid grid-cols-2 gap-4">
                                            <DynamicSelectField control={form.control} name="tentative_month" label="Month" options={tentativeMonthOptions.map(o => o.value)} />
                                            <DynamicSelectField control={form.control} name="tentative_year" label="Year" options={tentativeYearOptions.map(o => o.value)} />
                                        </div>
                                        <p className="text-[11.5px] text-muted-foreground mt-0">Defaults dynamically back to Event Dates if available.</p>
                                    </FieldSection>
                                )}
                            </TabsContent>
                        ))}


                    </div>
                    {/* END SCROLLABLE BODY */}

                    {/* FIXED FOOTER */}
                    <div className="flex-none px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 z-10">
                        <Button type="button" variant="outline" onClick={handleAttemptClose}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending || (isEditing && !form.formState.isDirty)}>
                            {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                            {isEditing ? 'Save Changes' : 'Create Lead'}
                        </Button>
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
                    <AlertDialogCancel onClick={() => setShowWarning(false)}>Continue Editing</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleForceClose}
                    >
                        Discard Changes
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}


function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (<div className="border rounded-lg p-4 bg-card space-y-4"><h4 className="font-semibold text-sm text-primary">{title}</h4>{children}</div>)
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
    return (<div className={`grid gap-4 [&>*]:min-w-0 ${cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>{children}</div>)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TextField({ control, name, label, type = "text", className }: { control: any; name: string; label: string; type?: string; className?: string }) {
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem className={className}>
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</FormLabel>
                <FormControl><Input type={type} className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
        )} />
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DynamicSelectField({ control, name, label, options, disabled }: { control: any; name: string; label: string; options: string[]; disabled?: boolean }) {
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</FormLabel>
                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)} disabled={disabled}>
                    <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger></FormControl>
                    <SelectContent>
                        {options.length === 0 ? (
                            <SelectItem value="__empty" disabled>No options configured in Settings</SelectItem>
                        ) : (
                            options.map((opt, index) => (<SelectItem key={`${opt}-${index}`} value={opt}>{opt}</SelectItem>))
                        )}
                    </SelectContent>
                </Select>
            </FormItem>
        )} />
    )
}
