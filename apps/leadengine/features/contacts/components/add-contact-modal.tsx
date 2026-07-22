"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { createContactAction, updateContactAction } from "@/app/actions/contact-actions"
import { Loader2, Plus, Trash2, MapPin, Settings2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { usePermissions } from "@/contexts/permissions-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Form, FormField, FormItem, FormControl, FormMessage,
} from "@/components/ui/form"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import type { ClientCompany, FormSchema } from "@/types"
import { normalizeStringFields } from "@/lib/text-normalize"
import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { TitleCaseHint } from "@/components/shared/title-case-hint"
import { DuplicateHint } from "@/components/shared/duplicate-hint"
import { PhoneInput } from "@/components/shared/phone-input"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { SearchableSelect } from "@/components/shared/searchable-select"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { DEFAULT_LAYOUTS, type LayoutItemsMap } from "@/features/settings/components/form-layout-builder"
import { mergeMissingNativeFields } from "@/features/settings/lib/layout-self-heal"
import { formatTabLabel, getVisibleTabEntries } from "@/features/settings/lib/form-layout-tabs"
import { DynamicField } from "@/features/leads/components/dynamic-field"
import { useCompany } from "@/contexts/company-context"
import { useMasterOptions } from "@/hooks/use-master-options"

const contactSchema = z.object({
    salutation: z.string().nullable().optional(),
    full_name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").or(z.literal("")).nullable().optional(),
    phone: z.string().nullable().optional(),
    job_title: z.string().nullable().optional(),
    contact_source: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    owner_id: z.string().nullable().optional(),
    custom_data: z.record(z.string(), z.unknown()).nullable().optional(),
})

type ContactFormValues = z.infer<typeof contactSchema>

interface SocialLink {
    platform: string
    url: string
}

interface AddContactModalProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    preselectedCompanyId?: string | null
    initialData?: Record<string, any> | null
    onSuccess?: (id?: string) => void
}

const SOCIAL_PLATFORMS = ["LinkedIn", "Instagram", "Twitter", "Facebook", "TikTok", "Website", "Other"]
const SALUTATIONS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Prof", "Sir", "Madam"]

const EMPTY_DEFAULTS: ContactFormValues = {
    salutation: "", full_name: "", email: "", phone: "", job_title: "", client_company_id: "",
    contact_source: "", date_of_birth: "", address: "", notes: "", owner_id: null, custom_data: {}
}

/**
 * Build a Zod resolver that enforces "required" overrides at runtime.
 *
 * Most fields on the contact form are optional in the static schema
 * because they are also optional in the database. Whether a field is
 * required for the user is decided per-tenant by Layout Settings
 * (`requiredOverrides`) and by the server-defined custom schemas
 * (`customSchemas[i].is_required`). We assert both here in
 * `superRefine` so the user can never bypass them with an empty submit.
 *
 * `additionalEmails` / `additionalPhones` / `socialLinks` live in
 * component state (not in the Zod-tracked form), so we treat their
 * required overrides as a pre-submit assertion in `onSubmit` instead
 * of a Zod issue.
 */
function getDynamicSchema(
    requiredIds: string[],
    customSchemas: FormSchema[],
    customValues: Record<string, unknown>,
) {
    const ARRAY_KEYS = new Set(["secondary_emails", "secondary_phones", "social_urls"])
    return contactSchema.superRefine((data, ctx) => {
        for (const fieldId of requiredIds) {
            if (!fieldId.startsWith("native:")) continue
            const key = fieldId.replace("native:", "")
            // Array fields are validated against component state in onSubmit.
            if (ARRAY_KEYS.has(key)) continue
            const val = (data as Record<string, unknown>)[key]
            const empty =
                val === undefined ||
                val === null ||
                (typeof val === "string" && val.trim() === "") ||
                (Array.isArray(val) && val.length === 0)
            if (empty) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "This field is required",
                    path: [key],
                })
            }
        }

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

export function AddContactModal({ isOpen, onOpenChange, preselectedCompanyId, initialData, onSuccess }: AddContactModalProps) {
    const supabase = createClient()
    const { activeCompany } = useCompany()
    const { can } = usePermissions()
    const canManageLayout = can("master_options", "update")
    const isEditMode = !!initialData?.id
    const { options: contactSourceOptions } = useMasterOptions("contact_source")
    
    const [companies, setCompanies] = useState<ClientCompany[]>([])
    const [existingContacts, setExistingContacts] = useState<{ id: string; full_name: string }[]>([])
    const [saving, setSaving] = useState(false)
    const [showWarning, setShowWarning] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    // Config state
    const [layoutConfig, setLayoutConfig] = useState<LayoutItemsMap>(DEFAULT_LAYOUTS.contacts)
    const [requiredOverrides, setRequiredOverrides] = useState<string[]>(["native:full_name"])
    const [tabSettings, setTabSettings] = useState<any>({})
    const [customSchemas, setCustomSchemas] = useState<FormSchema[]>([])
    const [customValues, setCustomValues] = useState<Record<string, any>>({})

    // Dynamic JSONB array state
    const [additionalEmails, setAdditionalEmails] = useState<string[]>([])
    const [additionalPhones, setAdditionalPhones] = useState<string[]>([])
    const [socialLinks, setSocialLinks] = useState<SocialLink[]>([])

    // See `add-company-modal.tsx` — RHF doesn't watch `resolver`, so we
    // memoize and re-bind on every dependency change so newly-loaded
    // Layout Settings actually take effect.
    const dynamicResolver = useMemo(
        () => zodResolver(getDynamicSchema(requiredOverrides, customSchemas, customValues)),
        [requiredOverrides, customSchemas, customValues],
    )

    const form = useForm<ContactFormValues>({
        // @ts-ignore
        resolver: dynamicResolver,
        defaultValues: EMPTY_DEFAULTS,
    })

    useEffect(() => {
        if (!isOpen) return
        supabase.from("client_companies").select("id, name").is("deleted_at", null).order("name").then(({ data }) => {
            if (data) setCompanies(data as unknown as ClientCompany[])
        })
        // Fetch existing contacts for soft duplicate detection. Light
        // payload (id + full_name only) so it is cheap even for tens of
        // thousands of rows. Excludes the contact being edited so a
        // record can't match itself.
        let q = supabase.from("contacts").select("id, full_name").is("deleted_at", null).order("full_name")
        if (initialData?.id) q = q.neq("id", initialData.id)
        q.then(({ data }) => {
            if (data) setExistingContacts(data as { id: string; full_name: string }[])
        })
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.id) setCurrentUserId(data.user.id)
        })
    }, [isOpen, supabase, initialData?.id])

    useEffect(() => {
        const fetchConfig = async () => {
            if (!isOpen) return
            const scRes = await supabase.from("form_schemas").select("*").eq("module_name", "contacts").eq("is_active", true).order("sort_order")
            if (scRes.data) setCustomSchemas(scRes.data as FormSchema[])
            
            const optRes = await supabase.from("master_options").select("*").eq("option_type", "system_setting").eq("label", "form_layout_config_contacts")
            if (optRes.data) {
                const activeId = activeCompany?.id || null
                const cnf = optRes.data.find(o => o.company_id === activeId) || optRes.data.find(o => o.company_id === null)
                if (cnf) {
                    try {
                        const parsed = JSON.parse(cnf.value)
                        if (parsed.tabs && parsed.requiredOverrides) {
                            setLayoutConfig(mergeMissingNativeFields({ ...DEFAULT_LAYOUTS.contacts, ...parsed.tabs }, DEFAULT_LAYOUTS.contacts))
                            setRequiredOverrides(parsed.requiredOverrides)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                        } else {
                            setLayoutConfig(mergeMissingNativeFields({ ...DEFAULT_LAYOUTS.contacts, ...parsed }, DEFAULT_LAYOUTS.contacts))
                        }
                    } catch(e) {}
                }
            }
        }
        fetchConfig()
    }, [isOpen, activeCompany, supabase])

    useEffect(() => {
        if (!isOpen) return
        if (initialData) {
            form.reset({
                salutation: initialData.salutation || "",
                full_name: initialData.full_name || "",
                email: initialData.email || "",
                phone: initialData.phone || "",
                job_title: initialData.job_title || "",
                contact_source: initialData.contact_source || "",
                client_company_id: initialData.client_company_id || "",
                date_of_birth: initialData.date_of_birth || "",
                address: initialData.address || "",
                notes: initialData.notes || "",
                owner_id: initialData.owner_id || null,
                custom_data: initialData.custom_data || {},
            })
            setCustomValues(initialData.custom_data || {})
            const emails: string[] = Array.isArray(initialData.secondary_emails) ? initialData.secondary_emails : (initialData.secondary_email ? [initialData.secondary_email] : [])
            const phones: string[] = Array.isArray(initialData.secondary_phones) ? initialData.secondary_phones : (initialData.secondary_phone ? [initialData.secondary_phone] : [])
            const socials: SocialLink[] = Array.isArray(initialData.social_urls) ? initialData.social_urls.map((s: any) => ({ platform: s.platform || "Other", url: s.url || "" })) : (initialData.linkedin_url ? [{ platform: "LinkedIn", url: initialData.linkedin_url }] : [])
            setAdditionalEmails(emails.filter(Boolean))
            setAdditionalPhones(phones.filter(Boolean))
            setSocialLinks(socials.filter((s: SocialLink) => s.url))
        } else {
            form.reset({
                ...EMPTY_DEFAULTS,
                client_company_id: preselectedCompanyId || "",
                owner_id: currentUserId,
            })
            setCustomValues({})
            setAdditionalEmails([])
            setAdditionalPhones([])
            setSocialLinks([])
        }
    }, [isOpen, initialData, preselectedCompanyId, currentUserId, form])

    const handleAttemptClose = () => {
        const { dirtyFields } = form.formState
        const hasDynamicChanges = additionalEmails.some(Boolean) || additionalPhones.some(Boolean) || socialLinks.some(s => s.url)
        if (Object.keys(dirtyFields).length > 0 || (hasDynamicChanges && !isEditMode)) {
            setShowWarning(true)
        } else {
            resetAndClose()
        }
    }

    const resetAndClose = () => {
        form.reset()
        setCustomValues({})
        setAdditionalEmails([])
        setAdditionalPhones([])
        setSocialLinks([])
        onOpenChange(false)
    }

    const onSubmit = async (values: ContactFormValues) => {
        setSaving(true)
        try {
            const cleanEmails = additionalEmails.filter(e => e.trim())
            const cleanPhones = additionalPhones
                .map(p => {
                    const t = p.trim()
                    if (!t) return ""
                    return normalizePhoneToE164(t) ?? t
                })
                .filter(Boolean)
            const cleanSocials = socialLinks.filter(s => s.url.trim())

            if (requiredOverrides.includes('native:secondary_emails') && cleanEmails.length === 0) {
                toast.error("Secondary Email is required"); setSaving(false); return
            }
            if (requiredOverrides.includes('native:secondary_phones') && cleanPhones.length === 0) {
                toast.error("Secondary Phone is required"); setSaving(false); return
            }
            if (requiredOverrides.includes('native:social_urls') && cleanSocials.length === 0) {
                toast.error("Social Links are required"); setSaving(false); return
            }

            const rawPayload: Record<string, any> = {
                salutation: values.salutation || null,
                full_name: values.full_name,
                email: values.email ? values.email.trim().toLowerCase() : null,
                phone: values.phone
                    ? (() => {
                        const trimmed = values.phone!.trim()
                        if (!trimmed) return null
                        return normalizePhoneToE164(trimmed) ?? trimmed
                    })()
                    : null,
                job_title: values.job_title || null,
                contact_source: values.contact_source || null,
                client_company_id: values.client_company_id || null,
                date_of_birth: values.date_of_birth || null,
                address: values.address || null,
                notes: values.notes || null,
                owner_id: values.owner_id || null,
                custom_data: customValues,
                secondary_emails: cleanEmails.length > 0 ? cleanEmails.map(e => e.trim().toLowerCase()) : [],
                secondary_phones: cleanPhones.length > 0 ? cleanPhones : [],
                social_urls: cleanSocials.length > 0 ? cleanSocials : [],
                secondary_email: cleanEmails[0] ? cleanEmails[0].trim().toLowerCase() : null,
                secondary_phone: cleanPhones[0] || null,
                linkedin_url: cleanSocials.find(s => s.platform === "LinkedIn")?.url || null,
            }
            // Layer 1 — normalize whitespace on every plain-string field.
            // Email/phone/social_urls are already special-cased above so
            // they stay accurate; the helper only walks string-valued keys.
            const payload: Record<string, any> = {
                ...normalizeStringFields(rawPayload),
                // Re-attach the array/object fields the helper passed through.
                custom_data: customValues,
                secondary_emails: rawPayload.secondary_emails,
                secondary_phones: rawPayload.secondary_phones,
                social_urls: rawPayload.social_urls,
            }
            // Guard: full_name is required, the normalizer can return null
            // if the user typed only whitespace. Bail out cleanly.
            if (!payload.full_name) {
                toast.error("Full name is required")
                setSaving(false)
                return
            }

            const selectFields = "id, salutation, full_name, email, phone, job_title, contact_source, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, custom_data, client_company:client_company_id ( name )"

            if (isEditMode) {
                const result = await updateContactAction(initialData!.id, payload, selectFields)
                if (!result.success) throw new Error(result.error)
                toast.success("Contact updated successfully")
                resetAndClose()
                onSuccess?.(initialData!.id)
            } else {
                const result = await createContactAction(payload, selectFields)
                if (!result.success || !result.data) throw new Error(result.error || "Failed to create contact")
                toast.success("Contact created successfully")
                resetAndClose()
                onSuccess?.(result.data.id)
            }
        } catch (err: any) {
            console.warn("[Contact Save]:", err.message || err)
            toast.error(err.message || "Failed to save contact data.")
        } finally {
            setSaving(false)
        }
    }

    const isFieldMandatory = (id: string) => requiredOverrides.includes(id) || id === "native:full_name"
    const getLabelStr = (base: string, id: string) => isFieldMandatory(id) ? `${base} *` : base

    const renderNativeField = (fieldId: string) => {
        const required = isFieldMandatory(fieldId)
        switch (fieldId) {
            case "native:client_company_id":
                return (
                    <div key={fieldId} className="space-y-1.5 sm:col-span-2">
                        <FormFieldLabel required={required}>Linked company</FormFieldLabel>
                        <SearchableSelect
                            value={form.watch("client_company_id") || null}
                            onChange={(v) => form.setValue("client_company_id", v ?? null, { shouldDirty: true })}
                            options={companies.map(c => ({ value: c.id, label: c.name }))}
                            placeholder="No company (individual contact)"
                            searchPlaceholder="Search company…"
                            emptyText="No companies found"
                        />
                        {form.formState.errors.client_company_id && <p className="text-[11px] text-destructive">{form.formState.errors.client_company_id.message}</p>}
                    </div>
                )
            case "native:salutation":
                return (
                    <FormField key={fieldId} control={form.control} name="salutation" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel required={required}>Salutation</FormFieldLabel>
                            <FormControl>
                                <SearchableSelect
                                    value={field.value || null}
                                    onChange={(v) => field.onChange(v ?? null)}
                                    options={SALUTATIONS.map(s => ({ value: s, label: s }))}
                                    placeholder="—"
                                    searchPlaceholder="Search…"
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:full_name":
                return (
                    <FormField key={fieldId} control={form.control} name="full_name" render={({ field }) => (
                        <FormItem className="space-y-1.5">
                            <FormFieldLabel htmlFor="contact-full-name" required={required}>Full name</FormFieldLabel>
                            <FormControl>
                                <Input
                                    id="contact-full-name"
                                    placeholder="John Doe"
                                    autoComplete="name"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <TitleCaseHint
                                value={field.value}
                                onApply={(suggested) => form.setValue("full_name", suggested, { shouldDirty: true })}
                            />
                            <DuplicateHint
                                value={field.value}
                                existing={existingContacts}
                                getName={(c) => c.full_name}
                                excludeId={initialData?.id}
                                entityNoun="contact"
                            />
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:job_title":
                return (
                    <FormField key={fieldId} control={form.control} name="job_title" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Job title</FormFieldLabel>
                            <FormControl>
                                <Input
                                    placeholder="e.g. Marketing Director"
                                    autoComplete="organization-title"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:contact_source":
                return (
                    <FormField key={fieldId} control={form.control} name="contact_source" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Contact source</FormFieldLabel>
                            <FormControl>
                                <SearchableSelect
                                    value={field.value || null}
                                    onChange={(v) => field.onChange(v ?? null)}
                                    options={contactSourceOptions.map(o => ({ value: o.value, label: o.label }))}
                                    placeholder="Select source…"
                                    searchPlaceholder="Search source…"
                                    emptyText="No contact sources configured"
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:email":
                return (
                    <FormField key={fieldId} control={form.control} name="email" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Primary email</FormFieldLabel>
                            <FormControl>
                                <Input
                                    type="email"
                                    placeholder="john@example.com"
                                    autoComplete="email"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:phone":
                return (
                    <FormField key={fieldId} control={form.control} name="phone" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Primary phone</FormFieldLabel>
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
            case "native:secondary_emails":
                return (
                    <div key={fieldId} className="space-y-2 sm:col-span-2">
                        <div className="flex items-center justify-between">
                            <FormFieldLabel required={required}>Additional emails</FormFieldLabel>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAdditionalEmails(prev => [...prev, ""])} className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5">
                                <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {additionalEmails.map((email, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <Input type="email" placeholder="personal@email.com" autoComplete="email" value={email} onChange={e => { const n = [...additionalEmails]; n[idx] = e.target.value; setAdditionalEmails(n) }} className="h-9 text-sm flex-1" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setAdditionalEmails(prev => prev.filter((_, i) => i !== idx))} className="h-9 w-9 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            case "native:secondary_phones":
                return (
                    <div key={fieldId} className="space-y-2 sm:col-span-2">
                        <div className="flex items-center justify-between">
                            <FormFieldLabel required={required}>Additional phones</FormFieldLabel>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAdditionalPhones(prev => [...prev, ""])} className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5">
                                <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {additionalPhones.map((phone, idx) => (
                                <div key={idx} className="flex items-center gap-2">
                                    <PhoneInput
                                        value={phone}
                                        onChange={(v) => { const n = [...additionalPhones]; n[idx] = v; setAdditionalPhones(n) }}
                                        wrapperClassName="flex-1"
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setAdditionalPhones(prev => prev.filter((_, i) => i !== idx))} className="h-9 w-9 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            case "native:social_urls":
                return (
                    <div key={fieldId} className="space-y-2 sm:col-span-2">
                        <div className="flex items-center justify-between">
                            <FormFieldLabel required={required}>Social & external links</FormFieldLabel>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSocialLinks(prev => [...prev, { platform: "LinkedIn", url: "" }])} className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/5">
                                <Plus className="w-3 h-3 mr-1" /> Add link
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {socialLinks.map((social, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                    <div className="w-[140px] shrink-0">
                                        <SearchableSelect
                                            value={social.platform}
                                            onChange={(v) => { const n = [...socialLinks]; n[idx].platform = v ?? "Other"; setSocialLinks(n) }}
                                            options={SOCIAL_PLATFORMS.map(p => ({ value: p, label: p }))}
                                            placeholder="Platform"
                                            clearable={false}
                                        />
                                    </div>
                                    <Input placeholder="https://…" type="url" value={social.url} onChange={e => { const n = [...socialLinks]; n[idx].url = e.target.value; setSocialLinks(n) }} className="h-9 text-sm flex-1" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => setSocialLinks(prev => prev.filter((_, i) => i !== idx))} className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            case "native:linkedin_url":
                return null
            case "native:date_of_birth":
                return (
                    <FormField key={fieldId} control={form.control} name="date_of_birth" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Date of birth</FormFieldLabel>
                            <FormControl>
                                <DatePickerField
                                    value={field.value || ""}
                                    onChange={field.onChange}
                                    placeholder="Select date"
                                    maxDate={new Date().toISOString().slice(0, 10)}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:address":
                return (
                    <FormField key={fieldId} control={form.control} name="address" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required}>Address</FormFieldLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Full residential / office address…"
                                    rows={2}
                                    autoComplete="street-address"
                                    aria-required={required}
                                    {...field}
                                    value={field.value || ""}
                                />
                            </FormControl>
                            <FormMessage className="text-[11px]" />
                        </FormItem>
                    )} />
                )
            case "native:notes":
                return (
                    <FormField key={fieldId} control={form.control} name="notes" render={({ field }) => (
                        <FormItem className="sm:col-span-2 space-y-1.5">
                            <FormFieldLabel required={required} hint="Internal-only notes. Not shared with the contact.">Private notes</FormFieldLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Background info, preferences…"
                                    rows={3}
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
                        <FormItem className="sm:col-span-2 space-y-1.5">
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
        <>
            <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleAttemptClose(); else onOpenChange(true) }}>
                <SheetContent
                    className="w-full sm:max-w-xl p-0 flex flex-col bg-background border-l border-border"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => { e.preventDefault(); handleAttemptClose() }}
                >
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, (err) => {
                            toast.error("Please complete all required fields")
                            console.error(err)
                            requestAnimationFrame(() => {
                                const firstInvalid = document.querySelector<HTMLElement>(
                                    "[aria-invalid='true'], .border-destructive"
                                )
                                if (firstInvalid) {
                                    firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" })
                                    if (typeof firstInvalid.focus === "function") firstInvalid.focus({ preventScroll: true })
                                }
                            })
                        })} className="flex flex-col h-full overflow-hidden">
                            <SheetHeader className="relative px-6 py-4 bg-card border-b border-border shrink-0">
                                <div className="flex justify-between items-start gap-3">
                                    <div>
                                        <SheetTitle className="text-base font-semibold tracking-tight">{isEditMode ? "Edit contact" : "Add contact"}</SheetTitle>
                                        <SheetDescription className="text-xs mt-0.5 text-muted-foreground">
                                            {isEditMode ? "Update contact information" : "Add a new person to your directory"}
                                        </SheetDescription>
                                    </div>
                                    {canManageLayout && (
                                        <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground hover:text-foreground hidden sm:flex" onClick={() => handleAttemptClose()} asChild>
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
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border bg-card p-4 [&>*]:min-w-0">
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
                                                                    onChange={(val: any) => {
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
                                    <Button type="button" variant="ghost" onClick={handleAttemptClose}>Cancel</Button>
                                    <Button type="submit" disabled={saving}>
                                        {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                        {saving ? "Saving…" : isEditMode ? "Save changes" : "Create contact"}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have unsaved changes. Are you sure you want to discard them?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setShowWarning(false); resetAndClose(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive">
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
