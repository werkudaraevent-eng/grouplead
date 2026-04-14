"use client"

import { useEffect, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { Loader2, Plus, Trash2, CalendarDays, MapPin, Settings2 } from "lucide-react"
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
    Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import type { ClientCompany, FormSchema } from "@/types"
import { DEFAULT_LAYOUTS, type LayoutItemsMap } from "@/features/settings/components/form-layout-builder"
import { formatTabLabel, getVisibleTabEntries } from "@/features/settings/lib/form-layout-tabs"
import { DynamicField } from "@/features/leads/components/dynamic-field"
import { useCompany } from "@/contexts/company-context"

const contactSchema = z.object({
    salutation: z.string().nullable().optional(),
    full_name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").or(z.literal("")).nullable().optional(),
    phone: z.string().nullable().optional(),
    job_title: z.string().nullable().optional(),
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
const SALUTATIONS = ["Mr.", "Mrs.", "Ms.", "Miss", "Dr.", "Prof.", "Sir", "Madam"]

const EMPTY_DEFAULTS: ContactFormValues = {
    salutation: "", full_name: "", email: "", phone: "", job_title: "", client_company_id: "",
    date_of_birth: "", address: "", notes: "", owner_id: null, custom_data: {}
}

const getDynamicSchema = (requiredIds: string[]) => {
    return contactSchema.superRefine((data, ctx) => {
        requiredIds.forEach(fieldId => {
            if (fieldId.startsWith('native:')) {
                const key = fieldId.replace('native:', '')
                if (key === 'secondary_emails' || key === 'secondary_phones' || key === 'social_urls') return // skip json arrays for zod
                
                const val = (data as any)[key]
                if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
                    ctx.addIssue({
                        code: z.ZodIssueCode.custom,
                        message: "This field is required",
                        path: [key]
                    })
                }
            }
        })
    })
}

export function AddContactModal({ isOpen, onOpenChange, preselectedCompanyId, initialData, onSuccess }: AddContactModalProps) {
    const supabase = createClient()
    const { activeCompany } = useCompany()
    const { can } = usePermissions()
    const canManageLayout = can("master_options", "update")
    const isEditMode = !!initialData?.id
    
    const [companies, setCompanies] = useState<ClientCompany[]>([])
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

    const form = useForm<ContactFormValues>({
        // @ts-ignore
        resolver: zodResolver(getDynamicSchema(requiredOverrides)),
        defaultValues: EMPTY_DEFAULTS,
    })

    useEffect(() => {
        if (!isOpen) return
        supabase.from("client_companies").select("id, name").order("name").then(({ data }) => {
            if (data) setCompanies(data as unknown as ClientCompany[])
        })
        supabase.auth.getUser().then(({ data }) => {
            if (data?.user?.id) setCurrentUserId(data.user.id)
        })
    }, [isOpen, supabase])

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
                            setLayoutConfig({ ...DEFAULT_LAYOUTS.contacts, ...parsed.tabs })
                            setRequiredOverrides(parsed.requiredOverrides)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                            if (parsed.tabSettings) setTabSettings(parsed.tabSettings)
                        } else {
                            setLayoutConfig({ ...DEFAULT_LAYOUTS.contacts, ...parsed })
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
            const cleanPhones = additionalPhones.filter(p => p.trim())
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

            const payload: Record<string, any> = {
                salutation: values.salutation || null,
                full_name: values.full_name,
                email: values.email || null,
                phone: values.phone || null,
                job_title: values.job_title || null,
                client_company_id: values.client_company_id || null,
                date_of_birth: values.date_of_birth || null,
                address: values.address || null,
                notes: values.notes || null,
                owner_id: values.owner_id || null,
                custom_data: customValues,
                secondary_emails: cleanEmails.length > 0 ? cleanEmails : [],
                secondary_phones: cleanPhones.length > 0 ? cleanPhones : [],
                social_urls: cleanSocials.length > 0 ? cleanSocials : [],
                secondary_email: cleanEmails[0] || null,
                secondary_phone: cleanPhones[0] || null,
                linkedin_url: cleanSocials.find(s => s.platform === "LinkedIn")?.url || null,
            }

            const selectFields = "id, salutation, full_name, email, phone, job_title, created_at, client_company_id, secondary_email, secondary_phone, secondary_emails, secondary_phones, linkedin_url, notes, date_of_birth, address, social_urls, owner_id, custom_data, client_company:client_company_id ( name )"

            if (isEditMode) {
                const { error } = await supabase.from("contacts").update(payload).eq("id", initialData!.id).select(selectFields).single()
                if (error) throw error
                toast.success("Contact updated successfully")
                resetAndClose()
                onSuccess?.(initialData!.id)
            } else {
                const { data, error } = await supabase.from("contacts").insert(payload).select(selectFields).single()
                if (error) throw error
                toast.success("Contact created successfully")
                resetAndClose()
                onSuccess?.(data.id)
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
        switch (fieldId) {
            case "native:client_company_id":
                return (
                    <div key={fieldId} className="space-y-1.5 col-span-2">
                        <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Link to Client Company", fieldId)}</Label>
                        <Select value={form.watch("client_company_id") || "none"} onValueChange={v => form.setValue("client_company_id", v === "none" ? null : v)}>
                            <SelectTrigger className="w-full bg-slate-50">
                                <SelectValue placeholder="No Company (Individual Contact)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Company (Individual Contact)</SelectItem>
                                {companies.map(c => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        {form.formState.errors.client_company_id && <p className="text-[10px] text-red-500">{form.formState.errors.client_company_id.message}</p>}
                    </div>
                )
            case "native:salutation":
                return (
                    <FormField key={fieldId} control={form.control} name="salutation" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Salutation", fieldId)}</FormLabel>
                            <Select value={field.value || "none"} onValueChange={v => field.onChange(v === "none" ? null : v)}>
                                <FormControl><SelectTrigger><SelectValue placeholder="-" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="none">-</SelectItem>
                                    {SALUTATIONS.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:full_name":
                return (
                    <FormField key={fieldId} control={form.control} name="full_name" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Full Name", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="John Doe" {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:job_title":
                return (
                    <FormField key={fieldId} control={form.control} name="job_title" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Job Title", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="e.g. Marketing Director" {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            // Contact Methods
            case "native:email":
                return (
                    <FormField key={fieldId} control={form.control} name="email" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Primary Email", fieldId)}</FormLabel>
                            <FormControl><Input type="email" placeholder="john@example.com" {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:phone":
                return (
                    <FormField key={fieldId} control={form.control} name="phone" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Primary Phone", fieldId)}</FormLabel>
                            <FormControl><Input placeholder="+62 8..." {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:secondary_emails":
                return (
                    <div key={fieldId} className="space-y-2 col-span-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Additional Emails", fieldId)}</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAdditionalEmails(prev => [...prev, ""])} className="h-6 text-xs text-blue-600 hover:text-blue-700 bg-blue-50/50">
                                <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                        </div>
                        {additionalEmails.map((email, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <Input type="email" placeholder="e.g. personal@email.com" value={email} onChange={e => { const n = [...additionalEmails]; n[idx] = e.target.value; setAdditionalEmails(n) }} className="h-8 text-sm" />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setAdditionalEmails(prev => prev.filter((_, i) => i !== idx))} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                )
            case "native:secondary_phones":
                return (
                    <div key={fieldId} className="space-y-2 col-span-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Additional Phones", fieldId)}</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setAdditionalPhones(prev => [...prev, ""])} className="h-6 text-xs text-blue-600 hover:text-blue-700 bg-blue-50/50">
                                <Plus className="w-3 h-3 mr-1" /> Add
                            </Button>
                        </div>
                        {additionalPhones.map((phone, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <Input placeholder="e.g. +62 8..." value={phone} onChange={e => { const n = [...additionalPhones]; n[idx] = e.target.value; setAdditionalPhones(n) }} className="h-8 text-sm" />
                                <Button type="button" variant="ghost" size="icon" onClick={() => setAdditionalPhones(prev => prev.filter((_, i) => i !== idx))} className="h-8 w-8 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                )
            case "native:social_urls":
                return (
                    <div key={fieldId} className="space-y-3 col-span-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between">
                            <Label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Social & External Links", fieldId)}</Label>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setSocialLinks(prev => [...prev, { platform: "LinkedIn", url: "" }])} className="h-6 text-xs text-blue-600 hover:text-blue-700 bg-blue-50/50">
                                <Plus className="w-3 h-3 mr-1" /> Add Link
                            </Button>
                        </div>
                        {socialLinks.map((social, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                                <div className="w-[110px] shrink-0">
                                    <Select value={social.platform} onValueChange={v => { const n = [...socialLinks]; n[idx].platform = v; setSocialLinks(n) }}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                        <SelectContent>{SOCIAL_PLATFORMS.map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1">
                                    <Input placeholder="https://..." value={social.url} onChange={e => { const n = [...socialLinks]; n[idx].url = e.target.value; setSocialLinks(n) }} className="h-8 text-sm" />
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => setSocialLinks(prev => prev.filter((_, i) => i !== idx))} className="h-8 w-8 shrink-0 text-slate-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                        ))}
                    </div>
                )
            case "native:linkedin_url":
                return null // skip because mapped under social_urls dynamically or just ignored for modern UI
            case "native:date_of_birth":
                return (
                    <FormField key={fieldId} control={form.control} name="date_of_birth" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Date of Birth", fieldId)}</FormLabel>
                            <div className="relative">
                                <Input type="date" {...field} value={field.value || ""} className="pl-9" />
                                <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            </div>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:address":
                return (
                    <FormField key={fieldId} control={form.control} name="address" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Address", fieldId)}</FormLabel>
                            <div className="relative">
                                <Textarea placeholder="Full residential/office address..." rows={2} {...field} value={field.value || ""} className="pl-9" />
                                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            </div>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:notes":
                return (
                    <FormField key={fieldId} control={form.control} name="notes" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Private Notes", fieldId)}</FormLabel>
                            <FormControl><Textarea placeholder="Background info, preferences..." rows={3} {...field} value={field.value || ""} /></FormControl>
                            <FormMessage className="text-[10px]" />
                        </FormItem>
                    )} />
                )
            case "native:owner_id":
                return (
                    <FormField key={fieldId} control={form.control} name="owner_id" render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{getLabelStr("Owner", fieldId)}</FormLabel>
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
        <>
            <Sheet open={isOpen} onOpenChange={(open) => { if (!open) handleAttemptClose(); else onOpenChange(true) }}>
                <SheetContent
                    className="w-full sm:max-w-xl p-0 flex flex-col bg-slate-50 border-l border-slate-200"
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => { e.preventDefault(); handleAttemptClose() }}
                >
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit, (err) => { toast.error("Please complete all required fields"); console.error(err) })} className="flex flex-col h-full overflow-hidden">
                            <SheetHeader className="relative px-6 py-4 bg-white border-b border-slate-200 shrink-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <SheetTitle>{isEditMode ? "Edit Contact" : "Add Contact"}</SheetTitle>
                                        <SheetDescription className="text-xs mt-0.5">
                                            {isEditMode ? "Update contact information" : "Add a new person to your directory"}
                                        </SheetDescription>
                                    </div>
                                    {canManageLayout && (
                                        <Button variant="outline" size="sm" className="h-8 shadow-sm hidden sm:flex bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" onClick={() => handleAttemptClose()} asChild>
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
                                                                        onChange={(val: any) => setCustomValues((prev) => ({ ...prev, [schema.field_key]: val }))}
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

                            <div className="px-6 py-4 bg-white border-t border-slate-200 flex justify-end gap-3 shrink-0 relative z-10 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
                                <Button type="button" variant="outline" onClick={handleAttemptClose}>Cancel</Button>
                                <Button type="submit" disabled={saving} className="bg-slate-900 hover:bg-slate-800 text-white">
                                    {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                    {isEditMode ? "Save Changes" : "Create Contact"}
                                </Button>
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
                        <AlertDialogCancel>Keep Editing</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setShowWarning(false); resetAndClose(); }} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
