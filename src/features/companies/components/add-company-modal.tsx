"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import { Loader2, Check, ChevronsUpDown, Settings2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/contexts/permissions-context"
import { useMasterOptions } from "@/hooks/use-master-options"
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import type { ClientCompany, FormSchema } from "@/types"
import { parseAddress } from "@/lib/address-parser"
import { DynamicField } from "@/features/leads/components/dynamic-field"
import { DEFAULT_LAYOUTS, type LayoutItemsMap } from "@/features/settings/components/form-layout-builder"
import { formatTabLabel, getVisibleTabEntries } from "@/features/settings/lib/form-layout-tabs"
import { useCompany } from "@/contexts/company-context"

interface AddCompanyModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: (id?: string) => void
    /** If provided, hydrates the form for edit mode */
    initialData?: ClientCompany | null
}

const addCompanySchema = z.object({
    name: z.string().min(1, "Company Name is required"),
    parent_id: z.string().nullable().optional(),
    industry: z.string().nullable().optional(), // 'sector'
    line_industry: z.string().nullable().optional(),
    street_address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    owner_id: z.string().nullable().optional(),
    custom_data: z.record(z.string(), z.unknown()).optional(),
})

type AddCompanyValues = z.infer<typeof addCompanySchema>

const getDynamicSchema = (requiredIds: string[]) => {
    return addCompanySchema.superRefine((data, ctx) => {
        requiredIds.forEach(fieldId => {
            if (fieldId.startsWith('native:')) {
                const key = fieldId.replace('native:', '')
                let internalKey = key
                if (key === 'sector') internalKey = 'industry'

                const val = (data as any)[internalKey]
                if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "This field is required",
                        path: [internalKey]
                    })
                }
            }
        })
    })
}

export function AddCompanyModal({ open, onOpenChange, onCreated, initialData }: AddCompanyModalProps) {
    const supabase = createClient()
    const isEditMode = !!initialData?.id
    const { activeCompany, companies } = useCompany()
    const { can } = usePermissions()
    const canManageLayout = can("master_options", "update")
    
    // Config state
    const [layoutConfig, setLayoutConfig] = useState<LayoutItemsMap>(DEFAULT_LAYOUTS.companies)
    const [requiredOverrides, setRequiredOverrides] = useState<string[]>(["native:name"])
    const [tabSettings, setTabSettings] = useState<any>({})
    const [customSchemas, setCustomSchemas] = useState<FormSchema[]>([])
    const [customValues, setCustomValues] = useState<Record<string, any>>({})
    const [parents, setParents] = useState<ClientCompany[]>([])
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    // Master Options
    const companyIds = companies.map(c => c.id)
    const { options: industryOptions, loading: industriesLoading } = useMasterOptions("sector", companyIds)
    const { options: lineIndustryOptions, loading: lineIndustriesLoading } = useMasterOptions("line_industry", companyIds)

    const form = useForm<AddCompanyValues>({
        // @ts-ignore
        resolver: zodResolver(getDynamicSchema(requiredOverrides)),
        defaultValues: {
            name: "",
            parent_id: null,
            industry: null,
            line_industry: null,
            street_address: "",
            city: "",
            postal_code: "",
            country: DEFAULT_COUNTRY,
            phone: "",
            website: "",
            owner_id: null,
            custom_data: {},
        }
    })

    const loadParents = useCallback(async () => {
        let query = supabase.from("client_companies").select("id, name").order("name")
        if (initialData?.id) query = query.neq("id", initialData.id)
        const { data } = await query
        setParents((data as ClientCompany[]) ?? [])
    }, [initialData?.id, supabase])

    useEffect(() => {
        if (!open) return
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.id) setCurrentUserId(data.user.id)
        })
    }, [open, supabase])

    useEffect(() => {
        const fetchConfig = async () => {
            if (!open) return
            const scRes = await supabase.from("form_schemas").select("*").eq("module_name", "companies").eq("is_active", true).order("sort_order")
            if (scRes.data) setCustomSchemas(scRes.data as FormSchema[])
            
            const optRes = await supabase.from("master_options").select("*").eq("option_type", "system_setting").eq("label", "form_layout_config_companies")
            if (optRes.data) {
                // Find for active company or global
                const activeId = activeCompany?.id || null
                const cnf = optRes.data.find(o => o.company_id === activeId) || optRes.data.find(o => o.company_id === null)
                if (cnf) {
                    try {
                        const parsed = JSON.parse(cnf.value)
                        if (parsed.tabs && parsed.requiredOverrides) {
                            setLayoutConfig({ ...DEFAULT_LAYOUTS.companies, ...parsed.tabs })
                            setRequiredOverrides(parsed.requiredOverrides)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                        } else {
                            setLayoutConfig({ ...DEFAULT_LAYOUTS.companies, ...parsed })
                        }
                    } catch(e) {}
                }
            }
        }
        fetchConfig()
    }, [open, activeCompany, supabase])

    useEffect(() => {
        if (!open) return
        loadParents()
        if (initialData) {
            form.reset({
                name: initialData.name || "",
                parent_id: initialData.parent_id || null,
                industry: initialData.industry || null,
                line_industry: initialData.line_industry || null,
                street_address: initialData.street_address || "",
                city: initialData.city || "",
                postal_code: initialData.postal_code || "",
                country: initialData.country || DEFAULT_COUNTRY,
                phone: initialData.phone || "",
                website: initialData.website || "",
                owner_id: initialData.owner_id || null,
                custom_data: initialData.custom_data || {},
            })
            setCustomValues(initialData.custom_data || {})
        } else {
            form.reset({
                name: "",
                parent_id: null,
                industry: null,
                line_industry: null,
                street_address: "",
                city: "",
                postal_code: "",
                country: DEFAULT_COUNTRY,
                phone: "",
                website: "",
                owner_id: currentUserId,
                custom_data: {},
            })
            setCustomValues({})
        }
    }, [open, initialData, loadParents, currentUserId, form])

    const onSubmit = async (data: AddCompanyValues) => {
        setSaving(true)
        const payload = {
            ...data,
            custom_data: customValues,
            // Automatically compile standard full address
            address: [data.street_address, data.city, data.postal_code, data.country].filter(Boolean).join(", ") || null,
        }
        
        if (isEditMode) {
            const { error } = await supabase.from("client_companies").update(payload).eq("id", initialData!.id)
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success("Company updated")
            setSaving(false)
            onOpenChange(false)
            onCreated?.(initialData!.id)
        } else {
            const { data: newRec, error } = await supabase.from("client_companies").insert(payload).select("id").single()
            if (error) { toast.error(error.message); setSaving(false); return }
            toast.success("Company created")
            setSaving(false)
            onOpenChange(false)
            onCreated?.(newRec.id)
        }
    }

    const isFieldMandatory = (id: string) => requiredOverrides.includes(id) || id === "native:name"
    const getLabelStr = (base: string, id: string) => isFieldMandatory(id) ? `${base} *` : base

    const onError = (errors: any) => {
        toast.error("Please fill in all mandatory fields.")
        console.error(errors)
    }

    const renderNativeField = (fieldId: string) => {
        switch (fieldId) {
            case "native:name":
                return (
                    <FormField key={fieldId} control={form.control} name="name" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Company Name", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="e.g. PT Telkom Indonesia" {...field} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:parent_id":
                return (
                    <FormField key={fieldId} control={form.control} name="parent_id" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Parent Company", fieldId)}</FormLabel>
                            <Select value={field.value || "none"} onValueChange={v => field.onChange(v === "none" ? null : v)}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="None (top-level)" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">None (top-level)</SelectItem>
                                    {parents.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:sector":
                return (
                    <FormField key={fieldId} control={form.control} name="industry" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Sector", fieldId)}</FormLabel>
                            <Select value={field.value || "none"} onValueChange={v => field.onChange(v === "none" ? null : v)}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder={industriesLoading ? "Loading..." : "Select sector"} /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">— None —</SelectItem>
                                    {industryOptions.map(opt => (<SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:line_industry":
                return (
                    <FormField key={fieldId} control={form.control} name="line_industry" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Line Industry", fieldId)}</FormLabel>
                            <Select value={field.value || "none"} onValueChange={v => field.onChange(v === "none" ? null : v)}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder={lineIndustriesLoading ? "Loading..." : "Select line industry"} /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="none">— None —</SelectItem>
                                    {lineIndustryOptions.map(opt => (<SelectItem key={opt.id} value={opt.value}>{opt.label}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:street_address":
                return (
                    <FormField key={fieldId} control={form.control} name="street_address" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Address", fieldId)}</FormLabel>
                            <FormControl>
                                <Textarea 
                                    placeholder="Jl. Sudirman Kav. 52-53..." 
                                    {...field} 
                                    value={field.value || ""}
                                    onBlur={() => {
                                        field.onBlur();
                                        const c = form.getValues("city") || "";
                                        const p = form.getValues("postal_code") || "";
                                        const parsed = parseAddress(field.value || "", c.trim(), p.trim());
                                        if (parsed.street !== field.value?.trim()) form.setValue("street_address", parsed.street);
                                        if (parsed.city && parsed.city !== c.trim()) form.setValue("city", parsed.city);
                                        if (parsed.postal && parsed.postal !== p.trim()) form.setValue("postal_code", parsed.postal);
                                    }}
                                />
                            </FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:city":
                return (
                    <FormField key={fieldId} control={form.control} name="city" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("City", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="Jakarta Selatan" {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:postal_code":
                return (
                    <FormField key={fieldId} control={form.control} name="postal_code" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Postal Code", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="12190" {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:country":
                return (
                    <FormField key={fieldId} control={form.control} name="country" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Country", fieldId)}</FormLabel>
                            <CountryCombobox value={field.value || ""} onChange={field.onChange} />
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:phone":
                return (
                    <FormField key={fieldId} control={form.control} name="phone" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Phone", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="+62..." {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:website":
                return (
                    <FormField key={fieldId} control={form.control} name="website" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Website", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="https://..." {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:owner_id":
                return (
                    <FormField key={fieldId} control={form.control} name="owner_id" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{getLabelStr("Owner", fieldId)}</FormLabel>
                            <FormControl><ProfileCombobox value={field.value || null} onChange={field.onChange} placeholder="Assign..." /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            default:
                return null
        }
    }
    const visibleTabs = getVisibleTabEntries(layoutConfig, tabSettings)

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className="w-full sm:max-w-xl p-0 flex flex-col bg-slate-50 border-l border-slate-200"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col h-full overflow-hidden">
                        <SheetHeader className="relative px-6 py-4 bg-white border-b border-slate-200 shrink-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <SheetTitle>{isEditMode ? "Edit Company" : "Add Company"}</SheetTitle>
                                    <SheetDescription className="text-xs mt-0.5">
                                        {isEditMode ? "Update company information" : "Add a new client company to your directory"}
                                    </SheetDescription>
                                </div>
                                {canManageLayout && (
                                    <Button variant="outline" size="sm" className="h-8 shadow-sm hidden sm:flex bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" onClick={() => onOpenChange(false)} asChild>
                                        <Link href="/settings/master-options?tab=layout">
                                            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                            Layout Settings
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {visibleTabs.map(([tab, fields]) => (
                                    <div key={tab} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
                                        <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{tabSettings[tab]?.label || formatTabLabel(tab)} Details</h4>
                                        {fields.length === 0 ? (
                                            <p className="text-sm text-slate-500">No fields assigned to this tab yet.</p>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                                {fields.map(fieldId => {
                                                    if (fieldId.startsWith("custom:")) {
                                                        const schema = customSchemas.find(s => s.field_key === fieldId.replace("custom:", ""))
                                                        if (!schema) return null
                                                        return (
                                                            <div key={fieldId} className={schema.field_type === 'text' || schema.field_type === 'dropdown' ? "col-span-2" : ""}>
                                                                <DynamicField 
                                                                    schema={schema}
                                                                    value={customValues[schema.field_key]}
                                                                    onChange={(val) => setCustomValues((prev) => ({ ...prev, [schema.field_key]: val }))}
                                                                    companyId={activeCompany?.id}
                                                                    allValues={customValues}
                                                                    isRequired={schema.is_required || isFieldMandatory(fieldId)} />
                                                            </div>
                                                        )
                                                    }
                                                    return renderNativeField(fieldId)
                                                })}
                                            </div>
                                        )}
                                    </div>
                            ))}
                        </div>

                        <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
                                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                {isEditMode ? "Save Changes" : "Create Company"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    )
}

function CountryCombobox({ value, onChange }: { value: string, onChange: (val: string) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover modal={true} open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <FormControl>
                    <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal text-sm h-9">
                        {value || "Select country..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </FormControl>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" side="bottom" avoidCollisions={false}>
                <Command>
                    <CommandList className="max-h-[200px] overflow-y-auto">
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                            {COUNTRIES.map(c => (
                                <CommandItem key={c} value={c} onSelect={(val) => {
                                    const match = COUNTRIES.find(x => x.toLowerCase() === val.toLowerCase())
                                    onChange(match === value ? "" : (match ?? val))
                                    setOpen(false)
                                }}>
                                    <Check className={cn("mr-2 h-4 w-4", value === c ? "opacity-100" : "opacity-0")} />
                                    {c}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                    <div className="border-t border-slate-200">
                        <CommandInput placeholder="Search country..." />
                    </div>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
