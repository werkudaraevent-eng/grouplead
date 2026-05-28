"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
    Form, FormControl, FormField, FormItem, FormMessage
} from "@/components/ui/form"
import { Loader2, Check, ChevronsUpDown, Settings2 } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { normalizeStringFields } from "@/lib/text-normalize"
import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { TitleCaseHint } from "@/components/shared/title-case-hint"
import { DuplicateHint } from "@/components/shared/duplicate-hint"
import { PhoneInput } from "@/components/shared/phone-input"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/contexts/permissions-context"
import { useMasterOptions } from "@/hooks/use-master-options"
import { useCascadedOptions } from "@/hooks/use-cascaded-options"
import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/countries"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import type { ClientCompany, FormSchema } from "@/types"
import { parseAddress } from "@/lib/address-parser"
import { DynamicField } from "@/features/leads/components/dynamic-field"
import { DEFAULT_LAYOUTS, type LayoutItemsMap } from "@/features/settings/components/form-layout-builder"
import { mergeMissingNativeFields } from "@/features/settings/lib/layout-self-heal"
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
    account_status: z.string().nullable().optional(),
    custom_data: z.record(z.string(), z.unknown()).optional(),
})

type AddCompanyValues = z.infer<typeof addCompanySchema>

/**
 * Fields whose `null` value is a semantically valid first-class choice,
 * not "user hasn't picked yet". These bypass the required-emptiness
 * check because choosing "None (top-level)" IS a valid answer.
 *
 * Contrast with `industry` / `line_industry` / `account_status` /
 * `owner_id` where `null` means "no value selected" and a required
 * override should reject it.
 */
const NULL_IS_VALID_CHOICE = new Set(["parent_id"])

/**
 * Build a Zod resolver that enforces "required" overrides at runtime.
 *
 * The base schema marks most fields as nullable/optional because that
 * matches the database shape. Whether a field is *required for the
 * user* is decided per-tenant by Layout Settings and stored in
 * `master_options.value.requiredOverrides`. We assert those rules here
 * via `superRefine` so they apply alongside the static schema.
 *
 * `customSchemas` is also passed in so server-defined custom fields
 * (e.g. "Segment") can be validated against `custom_data`.
 */
function getDynamicSchema(
    requiredIds: string[],
    customSchemas: FormSchema[],
    customValues: Record<string, unknown>,
) {
    return addCompanySchema.superRefine((data, ctx) => {
        // 1. Native fields: any id like "native:foo" with foo present in
        //    the schema must be non-empty when listed in requiredIds.
        for (const fieldId of requiredIds) {
            if (!fieldId.startsWith("native:")) continue
            const key = fieldId.replace("native:", "")
            // The form key for the "sector" UI is `industry` (legacy).
            const internalKey = key === "sector" ? "industry" : key
            const val = (data as Record<string, unknown>)[internalKey]
            // Some fields treat `null` as a real choice (e.g. parent_id =
            // "None (top-level)" means the entity is top-level). Don't
            // count those as empty for the required check.
            if (val === null && NULL_IS_VALID_CHOICE.has(internalKey)) continue
            const empty =
                val === undefined ||
                val === null ||
                (typeof val === "string" && val.trim() === "") ||
                (Array.isArray(val) && val.length === 0)
            if (empty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "This field is required",
                    path: [internalKey],
                })
            }
        }

        // 2. Custom (per-tenant) fields stored on `custom_data`. The
        //    server-side schema has its own `is_required` flag; we honour
        //    it here so the user can't bypass via empty submit. The path
        //    points at `custom_data.<fieldKey>` so RHF can highlight the
        //    DynamicField in the form.
        for (const schema of customSchemas) {
            const fieldId = `custom:${schema.field_key}`
            const isRequired = schema.is_required || requiredIds.includes(fieldId)
            if (!isRequired) continue
            const val = customValues[schema.field_key]
            const empty =
                val === undefined ||
                val === null ||
                (typeof val === "string" && val.trim() === "") ||
                (Array.isArray(val) && val.length === 0)
            if (empty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "This field is required",
                    path: ["custom_data", schema.field_key],
                })
            }
        }
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

    // ── Generic cascading: detect parent for line_industry from cascade_relations ──
    const { parentCategory: liParentCat } = useCascadedOptions("line_industry", null, companyIds)
    const liParentFieldKey = liParentCat ? liParentCat.replace(/^custom_[a-z]+__/, "") : null
    const liParentValue = liParentFieldKey ? (customValues[liParentFieldKey] as string | null) ?? null : null
    const { options: filteredLineIndustryOptions, isDisabledByParent: liDisabled } = useCascadedOptions("line_industry", liParentValue, companyIds)

    // Memoize the dynamic resolver. We feed RHF a stable schema reference
    // and re-bind whenever any input it depends on changes — layout config
    // (`requiredOverrides`), the loaded custom schemas, or the live custom
    // values (so newly-typed values clear the "required" error). Without
    // this re-bind, the resolver would freeze at the initial state from
    // useForm and the user could submit even after Layout Settings adds
    // new required fields.
    const dynamicResolver = useMemo(
        () => zodResolver(getDynamicSchema(requiredOverrides, customSchemas, customValues)),
        [requiredOverrides, customSchemas, customValues],
    )

    const form = useForm<AddCompanyValues>({
        // @ts-ignore
        resolver: dynamicResolver,
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
            account_status: "new",
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
                            const merged = mergeMissingNativeFields(
                                { ...DEFAULT_LAYOUTS.companies, ...parsed.tabs },
                                DEFAULT_LAYOUTS.companies,
                            )
                            setLayoutConfig(merged)
                            setRequiredOverrides(parsed.requiredOverrides)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                        } else {
                            const merged = mergeMissingNativeFields(
                                { ...DEFAULT_LAYOUTS.companies, ...parsed },
                                DEFAULT_LAYOUTS.companies,
                            )
                            setLayoutConfig(merged)
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
                account_status: initialData.account_status || "new",
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
                account_status: "new",
                custom_data: {},
            })
            setCustomValues({})
        }
    }, [open, initialData, loadParents, currentUserId, form])

    // ── Cascade reset: clear line_industry when parent (segment) changes ──
    useEffect(() => {
        if (!liParentFieldKey) return
        const currentLI = form.getValues("line_industry")
        if (currentLI && liParentValue) {
            const isValid = lineIndustryOptions.some(o => o.value === currentLI && o.parent_value === liParentValue)
            if (!isValid) form.setValue("line_industry", null)
        } else if (!liParentValue && currentLI) {
            form.setValue("line_industry", null)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liParentValue])

    const onSubmit = async (data: AddCompanyValues) => {
        setSaving(true)
        // Canonicalize phone → E.164. Falls back to a digit-only form if
        // libphonenumber-js can't validate, so we never lose user input.
        if (data.phone) {
            const canonical = normalizePhoneToE164(data.phone)
            if (canonical) {
                data.phone = canonical
            } else {
                const trimmed = data.phone.trim()
                data.phone = trimmed || null
            }
        }
        // Layer 1 — normalize whitespace on every string field. Empty
        // strings become NULL so the DB never carries spurious "" rows.
        const cleaned = normalizeStringFields(data)
        const payload = {
            ...cleaned,
            custom_data: customValues,
            // Automatically compile standard full address
            address: [cleaned.street_address, cleaned.city, cleaned.postal_code, cleaned.country].filter(Boolean).join(", ") || null,
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

    const onError = (errors: any) => {
        toast.error("Please fill in all mandatory fields.")
        console.error(errors)
        // Find the first errored input and scroll it into view so the
        // user knows exactly which field is missing. RHF marks
        // FormItem-rendered fields with `aria-invalid="true"`; we also
        // tagged custom field containers with the destructive border
        // ring above so they show up to the same selector.
        requestAnimationFrame(() => {
            const firstInvalid = document.querySelector<HTMLElement>(
                "[aria-invalid='true'], .border-destructive"
            )
            if (firstInvalid) {
                firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" })
                if (typeof firstInvalid.focus === "function") firstInvalid.focus({ preventScroll: true })
            }
        })
    }

    const renderNativeField = (fieldId: string) => {
        const required = isFieldMandatory(fieldId)
        switch (fieldId) {
            case "native:name":
                return (
                    <FormField key={fieldId} control={form.control} name="name" render={({ field }) => (
                        <FormItem className="col-span-2 space-y-1.5">
                            <FormFieldLabel htmlFor="company-name" required={required}>Company name</FormFieldLabel>
                            <FormControl>
                                <Input
                                    id="company-name"
                                    placeholder="e.g. PT Telkom Indonesia"
                                    autoComplete="organization"
                                    aria-required={required}
                                    {...field}
                                />
                            </FormControl>
                            <TitleCaseHint
                                value={field.value}
                                onApply={(suggested) => form.setValue("name", suggested, { shouldDirty: true })}
                            />
                            <DuplicateHint
                                value={field.value}
                                existing={parents}
                                getName={(p) => p.name}
                                excludeId={initialData?.id}
                                entityNoun="company"
                            />
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:parent_id":
                return (
                    <FormField key={fieldId} control={form.control} name="parent_id" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required} hint="Use this when the company is a subsidiary or branch under a holding company.">Parent company</FormFieldLabel>
                            <FormControl>
                                <SearchableSelect
                                    value={field.value ?? null}
                                    onChange={field.onChange}
                                    options={parents.map(c => ({ value: c.id, label: c.name }))}
                                    placeholder="None (top-level)"
                                    searchPlaceholder="Search company…"
                                    emptyText="No companies found"
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:sector":
                return (
                    <FormField key={fieldId} control={form.control} name="industry" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>Sector</FormFieldLabel>
                            <FormControl>
                                <SearchableSelect
                                    value={field.value ?? null}
                                    onChange={field.onChange}
                                    options={industryOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                                    placeholder={industriesLoading ? "Loading…" : "Select sector"}
                                    loading={industriesLoading}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:line_industry":
                return (
                    <FormField key={fieldId} control={form.control} name="line_industry" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>Line of industry</FormFieldLabel>
                            <FormControl>
                                <SearchableSelect
                                    value={field.value ?? null}
                                    onChange={field.onChange}
                                    options={filteredLineIndustryOptions.map(opt => ({ value: opt.value, label: opt.label }))}
                                    placeholder={lineIndustriesLoading ? "Loading…" : liDisabled ? "Pick parent field first" : "Select line industry"}
                                    loading={lineIndustriesLoading}
                                    disabled={liDisabled}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:account_status":
                return (
                    <FormField key={fieldId} control={form.control} name="account_status" render={({ field }) => (
                        <FormItem className="col-span-2 space-y-1.5">
                            <FormFieldLabel required={required} hint={"New = first-time client. Repeater = previously bought once or twice. Contracted = ongoing contract in place."}>Account status</FormFieldLabel>
                            <FormControl>
                                <SegmentedControl
                                    value={field.value || "new"}
                                    onChange={(v) => field.onChange(v)}
                                    options={[
                                        { value: "new", label: "New" },
                                        { value: "repeater", label: "Repeater" },
                                        { value: "contracted", label: "Contracted" },
                                    ]}
                                    aria-label="Account status"
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:street_address":
                return (
                    <FormField key={fieldId} control={form.control} name="street_address" render={({ field }) => (
                        <FormItem className="col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Address</FormFieldLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Jl. Sudirman Kav. 52-53…"
                                    autoComplete="street-address"
                                    aria-required={required}
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
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:city":
                return (
                    <FormField key={fieldId} control={form.control} name="city" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>City</FormFieldLabel>
                            <FormControl>
                                <Input
                                    placeholder="Jakarta Selatan"
                                    autoComplete="address-level2"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:postal_code":
                return (
                    <FormField key={fieldId} control={form.control} name="postal_code" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>Postal code</FormFieldLabel>
                            <FormControl>
                                <Input
                                    placeholder="12190"
                                    autoComplete="postal-code"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:country":
                return (
                    <FormField key={fieldId} control={form.control} name="country" render={({ field }) => (
                        <FormItem className="col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Country</FormFieldLabel>
                            <CountryCombobox value={field.value || ""} onChange={field.onChange} />
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:phone":
                return (
                    <FormField key={fieldId} control={form.control} name="phone" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>Phone</FormFieldLabel>
                            <FormControl>
                                <PhoneInput
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    onBlur={field.onBlur}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:website":
                return (
                    <FormField key={fieldId} control={form.control} name="website" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>Website</FormFieldLabel>
                            <FormControl>
                                <Input
                                    type="url"
                                    placeholder="https://…"
                                    autoComplete="url"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:owner_id":
                return (
                    <FormField key={fieldId} control={form.control} name="owner_id" render={({ field }) => (
                        <FormItem className="col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Owner</FormFieldLabel>
                            <FormControl><ProfileCombobox value={field.value || null} onChange={field.onChange} placeholder="Assign…" filterRoles={["sales", "bu_manager"]} /></FormControl>
                            <FormMessage className="text-[11px]" />
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
                className="w-full sm:max-w-xl p-0 flex flex-col bg-background border-l border-border"
                onInteractOutside={(e) => e.preventDefault()}
            >
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, onError)} className="flex flex-col h-full overflow-hidden">
                        <SheetHeader className="relative px-6 py-4 bg-card border-b border-border shrink-0">
                            <div className="flex justify-between items-start gap-3">
                                <div>
                                    <SheetTitle className="text-base font-semibold tracking-tight">{isEditMode ? "Edit company" : "Add company"}</SheetTitle>
                                    <SheetDescription className="text-xs mt-0.5 text-muted-foreground">
                                        {isEditMode ? "Update company information" : "Add a new client company to your directory"}
                                    </SheetDescription>
                                </div>
                                {canManageLayout && (
                                    <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground hidden sm:flex" onClick={() => onOpenChange(false)} asChild>
                                        <Link href="/settings/master-options?tab=layout">
                                            <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                            <span className="text-xs">Layout</span>
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-5">
                            {visibleTabs.map(([tab, fields]) => (
                                <section key={tab} className="space-y-3">
                                    <h4 className="text-[11px] font-semibold text-muted-foreground tracking-wide">{tabSettings[tab]?.label || formatTabLabel(tab)}</h4>
                                    {fields.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">No fields assigned to this tab.</p>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border bg-card p-4">
                                            {fields.map(fieldId => {
                                                if (fieldId.startsWith("custom:")) {
                                                    const schema = customSchemas.find(s => s.field_key === fieldId.replace("custom:", ""))
                                                    if (!schema) return null
                                                    const customError = (form.formState.errors as Record<string, { message?: string } | undefined>)
                                                        ?.custom_data
                                                        ? ((form.formState.errors as Record<string, Record<string, { message?: string }>>).custom_data?.[schema.field_key])
                                                        : undefined
                                                    const errorMessage = customError?.message
                                                    return (
                                                        <div
                                                            key={fieldId}
                                                            className={`${schema.field_type === 'text' || schema.field_type === 'dropdown' ? "sm:col-span-2" : ""} ${errorMessage ? "[&_button[role=combobox]]:border-destructive [&_input]:border-destructive [&_button[role=combobox]]:ring-destructive/20" : ""}`}
                                                        >
                                                            <DynamicField
                                                                schema={schema}
                                                                value={customValues[schema.field_key]}
                                                                onChange={(val) => {
                                                                    setCustomValues((prev) => ({ ...prev, [schema.field_key]: val }))
                                                                    if (errorMessage) {
                                                                        form.clearErrors(`custom_data.${schema.field_key}` as never)
                                                                    }
                                                                }}
                                                                companyId={activeCompany?.id}
                                                                allValues={customValues}
                                                                isRequired={schema.is_required || isFieldMandatory(fieldId)} />
                                                            {errorMessage && (
                                                                <p className="mt-1 text-[11px] text-destructive">{errorMessage}</p>
                                                            )}
                                                        </div>
                                                    )
                                                }
                                                return renderNativeField(fieldId)
                                            })}
                                        </div>
                                    )}
                                </section>
                            ))}
                        </div>

                        <div className="px-6 py-3.5 bg-card border-t border-border flex items-center justify-between gap-3 shrink-0">
                            <p className="text-[11px] text-muted-foreground hidden sm:block">
                                <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Esc</kbd>
                                <span className="mx-1">to cancel</span>
                            </p>
                            <div className="flex items-center gap-2 ml-auto">
                                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                                <Button type="submit" disabled={saving}>
                                    {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                    {saving ? "Saving…" : isEditMode ? "Save changes" : "Create company"}
                                </Button>
                            </div>
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
