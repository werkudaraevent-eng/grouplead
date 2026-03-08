"use client"

import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form"
import { WorkflowActions } from "./workflow-actions"
import { PermissionGate } from "@/components/permission-gate"
import { Lead } from "@/types"
import { CompanyCombobox, ContactCombobox } from "@/components/entity-combobox"
import {
    Save, Trash2, Loader2, CheckCircle2, Circle,
    AlertTriangle, Clock
} from "lucide-react"

// ============================================================
// ZOD SCHEMA
// ============================================================

const leadFormSchema = z.object({
    // Overview
    project_name: z.string().nullable().optional(),
    company_name: z.string().nullable().optional(),
    main_company: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    bu_revenue: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    source_lead: z.string().nullable().optional(),
    referral_source: z.string().nullable().optional(),
    pic_sales: z.string().nullable().optional(),
    account_manager: z.string().nullable().optional(),
    is_qualified: z.boolean().nullable().optional(),
    cancel_lost_reason: z.string().nullable().optional(),

    // Financial
    estimated_revenue: z.coerce.number().nullable().optional(),
    nominal_konfirmasi: z.coerce.number().nullable().optional(),
    materialized_amount: z.coerce.number().nullable().optional(),
    difference_amount: z.coerce.number().nullable().optional(),
    percentage_deal: z.coerce.number().nullable().optional(),

    // Event
    date_of_event: z.string().nullable().optional(),
    start_date: z.string().nullable().optional(),
    venue_hotel: z.string().nullable().optional(),
    location_city: z.string().nullable().optional(),
    number_of_pax: z.coerce.number().nullable().optional(),
    nationality: z.string().nullable().optional(),
    grade_lead: z.string().nullable().optional(),
    main_stream: z.string().nullable().optional(),
    tipe_stream: z.string().nullable().optional(),
    business_purpose: z.string().nullable().optional(),
    tipe: z.string().nullable().optional(),
    is_onsite: z.boolean().nullable().optional(),
    is_online: z.boolean().nullable().optional(),

    // Contact
    salutation: z.string().nullable().optional(),
    contact_full_name: z.string().nullable().optional(),
    contact_email: z.string().nullable().optional(),
    contact_mobile: z.string().nullable().optional(),
    job_title: z.string().nullable().optional(),
    office_phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    destination: z.string().nullable().optional(),
    client_province_country: z.string().nullable().optional(),
    client_company_country: z.string().nullable().optional(),

    // Misc
    sector: z.string().nullable().optional(),
    line_industry: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
})

type LeadFormValues = z.infer<typeof leadFormSchema>

// ============================================================
// DROPDOWN OPTIONS
// ============================================================

const STATUS_OPTIONS = [
    "Lead Masuk",
    "Estimasi Project",
    "Proposal Sent",
    "Closed Won",
    "Closed Lost",
]

const BU_OPTIONS = ["WNW", "WNS", "UK", "TEP", "CREATIVE"]

const CATEGORY_OPTIONS = ["Corporate", "Government", "MICE", "Wedding", "Social"]

const SALUTATION_OPTIONS = ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."]

// ============================================================
// COMPONENT
// ============================================================

interface LeadSheetProps {
    lead: Lead | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function LeadSheet({ lead, open, onOpenChange }: LeadSheetProps) {
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    const supabase = createClient()
    const router = useRouter()

    const form = useForm<LeadFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(leadFormSchema) as any,
        defaultValues: {},
    })

    // Auto-fill form when lead changes
    useEffect(() => {
        if (lead) {
            form.reset({
                project_name: lead.project_name,
                company_name: lead.company_name,
                main_company: lead.main_company,
                client_company_id: lead.client_company_id,
                contact_id: lead.contact_id,
                bu_revenue: lead.bu_revenue,
                status: lead.status,
                category: lead.category,
                source_lead: lead.source_lead,
                referral_source: lead.referral_source,
                pic_sales: lead.pic_sales,
                account_manager: lead.account_manager,
                is_qualified: lead.is_qualified,
                cancel_lost_reason: lead.cancel_lost_reason,
                estimated_revenue: lead.estimated_revenue,
                nominal_konfirmasi: lead.nominal_konfirmasi,
                materialized_amount: lead.materialized_amount,
                difference_amount: lead.difference_amount,
                percentage_deal: lead.percentage_deal,
                date_of_event: lead.date_of_event,
                start_date: lead.start_date,
                venue_hotel: lead.venue_hotel,
                location_city: lead.location_city,
                number_of_pax: lead.number_of_pax,
                nationality: lead.nationality,
                grade_lead: lead.grade_lead,
                main_stream: lead.main_stream,
                tipe_stream: lead.tipe_stream,
                business_purpose: lead.business_purpose,
                tipe: lead.tipe,
                is_onsite: lead.is_onsite,
                is_online: lead.is_online,
                salutation: lead.salutation,
                contact_full_name: lead.contact_full_name,
                contact_email: lead.contact_email,
                contact_mobile: lead.contact_mobile,
                job_title: lead.job_title,
                office_phone: lead.office_phone,
                address: lead.address,
                destination: lead.destination,
                client_province_country: lead.client_province_country,
                client_company_country: lead.client_company_country,
                sector: lead.sector,
                line_industry: lead.line_industry,
                area: lead.area,
                remark: lead.remark,
            })
        }
    }, [lead, form])

    // Submit handler
    const onSubmit = async (values: LeadFormValues) => {
        if (!lead) return
        setSaving(true)

        // Clean empty strings to null
        const cleaned: Record<string, unknown> = {}
        for (const [key, val] of Object.entries(values)) {
            cleaned[key] = val === "" ? null : val
        }

        const { error } = await supabase
            .from("leads")
            .update(cleaned)
            .eq("id", lead.id)

        if (error) {
            toast.error(`Error: ${error.message}`)
        } else {
            toast.success("Lead updated successfully")
            onOpenChange(false)
            router.refresh()
        }
        setSaving(false)
    }

    // Delete handler
    const handleDelete = async () => {
        if (!lead) return
        setDeleting(true)
        const { error } = await supabase.from("leads").delete().eq("id", lead.id)
        if (error) {
            toast.error(`Error: ${error.message}`)
        } else {
            toast.success("Lead deleted successfully")
            setDeleteOpen(false)
            onOpenChange(false)
            router.refresh()
        }
        setDeleting(false)
    }

    if (!lead) return null

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-[400px] sm:w-[540px] md:w-[800px] overflow-y-auto p-0 flex flex-col">
                    {/* Header */}
                    <SheetHeader className="px-6 pt-6 pb-4 border-b bg-muted/20 shrink-0">
                        <div className="flex items-start justify-between">
                            <div>
                                <SheetTitle className="text-lg">
                                    {lead.project_name || "Lead Details"}
                                </SheetTitle>
                                <SheetDescription>
                                    {lead.company_name} — #{lead.manual_id || "N/A"}
                                </SheetDescription>
                            </div>
                            <PermissionGate resource="leads" action="delete">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                                    onClick={() => setDeleteOpen(true)}
                                >
                                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                                </Button>
                            </PermissionGate>
                        </div>
                    </SheetHeader>

                    {/* Tabs + Form */}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                            <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                                <div className="px-6 pt-4 shrink-0">
                                    <TabsList className="grid w-full grid-cols-5 bg-muted p-1 rounded-lg">
                                        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                                        <TabsTrigger value="event" className="text-xs">Event</TabsTrigger>
                                        <TabsTrigger value="contact" className="text-xs">Contact</TabsTrigger>
                                        <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                                        <TabsTrigger value="sla" className="text-xs">SLA</TabsTrigger>
                                    </TabsList>
                                </div>

                                <div className="flex-1 overflow-y-auto px-6 py-4">
                                    {/* ========== TAB: OVERVIEW ========== */}
                                    <TabsContent value="overview" className="mt-0 space-y-6">
                                        <FieldSection title="Project & Company">
                                            <FieldGrid>
                                                <FormField control={form.control} name="project_name" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project Name</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="company_name" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Name</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="main_company" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main Company / Group</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="category" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</FormLabel>
                                                        <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                            <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {CATEGORY_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>

                                        <FieldSection title="Client Company & Contact">
                                            <FieldGrid>
                                                <FormField control={form.control} name="client_company_id" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Company</FormLabel>
                                                        <FormControl>
                                                            <CompanyCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="contact_id" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Person</FormLabel>
                                                        <FormControl>
                                                            <ContactCombobox
                                                                value={field.value ?? null}
                                                                onChange={(id) => field.onChange(id)}
                                                                clientCompanyId={form.watch("client_company_id") ?? null}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>

                                        <FieldSection title="Status & Operations">
                                            <FieldGrid>
                                                <FormField control={form.control} name="status" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</FormLabel>
                                                        <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                            <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {STATUS_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="bu_revenue" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">BU Revenue</FormLabel>
                                                        <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                            <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select BU" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {BU_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="pic_sales" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PIC Sales</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="account_manager" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Manager</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="source_lead" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source Lead</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="referral_source" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Referral Source</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>

                                        <FieldSection title="Additional">
                                            <FieldGrid cols={1}>
                                                <FormField control={form.control} name="cancel_lost_reason" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cancel/Lost Reason</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="remark" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Remark</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>
                                    </TabsContent>

                                    {/* ========== TAB: EVENT ========== */}
                                    <TabsContent value="event" className="mt-0 space-y-6">
                                        <FieldSection title="Event Info">
                                            <FieldGrid>
                                                <FormField control={form.control} name="date_of_event" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Date</FormLabel>
                                                        <FormControl><Input type="date" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="start_date" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Performance Start</FormLabel>
                                                        <FormControl><Input type="date" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="venue_hotel" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Venue / Hotel</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="location_city" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">City</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="number_of_pax" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Number of Pax</FormLabel>
                                                        <FormControl><Input type="number" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="nationality" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nationality</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="grade_lead" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Grade Lead</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>

                                        <FieldSection title="Classification">
                                            <FieldGrid>
                                                <FormField control={form.control} name="main_stream" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Main Stream</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="tipe_stream" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type Stream</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="business_purpose" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Business Purpose</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="tipe" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>

                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <FormField control={form.control} name="is_onsite" render={({ field }) => (
                                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.value ?? false}
                                                            onChange={(e) => field.onChange(e.target.checked)}
                                                            className="rounded border-input"
                                                        />
                                                        Onsite
                                                    </label>
                                                )} />
                                                <FormField control={form.control} name="is_online" render={({ field }) => (
                                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.value ?? false}
                                                            onChange={(e) => field.onChange(e.target.checked)}
                                                            className="rounded border-input"
                                                        />
                                                        Online
                                                    </label>
                                                )} />
                                            </div>
                                        </FieldSection>
                                    </TabsContent>

                                    {/* ========== TAB: CONTACT ========== */}
                                    <TabsContent value="contact" className="mt-0 space-y-6">
                                        <FieldSection title="Contact Person">
                                            <FieldGrid>
                                                <FormField control={form.control} name="salutation" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Salutation</FormLabel>
                                                        <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                            <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                            <SelectContent>
                                                                {SALUTATION_OPTIONS.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="contact_full_name" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="job_title" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Job Title</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="contact_email" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</FormLabel>
                                                        <FormControl><Input type="email" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="contact_mobile" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mobile</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="office_phone" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Office Phone</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>

                                        <FieldSection title="Location">
                                            <FieldGrid cols={1}>
                                                <FormField control={form.control} name="address" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                            <FieldGrid>
                                                <FormField control={form.control} name="destination" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destination</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="client_province_country" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Province / Country</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="client_company_country" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Company Country</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>

                                        <FieldSection title="Industry">
                                            <FieldGrid>
                                                <FormField control={form.control} name="sector" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sector</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="line_industry" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Line Industry</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="area" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Area</FormLabel>
                                                        <FormControl><Input className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>
                                    </TabsContent>

                                    {/* ========== TAB: FINANCIAL ========== */}
                                    <TabsContent value="financial" className="mt-0 space-y-6">
                                        <FieldSection title="Revenue & Deal">
                                            <FieldGrid>
                                                <FormField control={form.control} name="estimated_revenue" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated Revenue (IDR)</FormLabel>
                                                        <FormControl><Input type="number" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="nominal_konfirmasi" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nominal Konfirmasi (IDR)</FormLabel>
                                                        <FormControl><Input type="number" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="materialized_amount" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Materialized Amount (IDR)</FormLabel>
                                                        <FormControl><Input type="number" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="difference_amount" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Difference Amount (IDR)</FormLabel>
                                                        <FormControl><Input type="number" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="percentage_deal" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">% Deal</FormLabel>
                                                        <FormControl><Input type="number" step="0.01" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                                                    </FormItem>
                                                )} />
                                            </FieldGrid>
                                        </FieldSection>
                                    </TabsContent>

                                    {/* ========== TAB: SLA & WORKFLOW ========== */}
                                    <TabsContent value="sla" className="mt-0 space-y-6">
                                        <div className="bg-muted/50 p-4 rounded-lg border">
                                            <h4 className="text-sm font-semibold mb-3">Workflow Actions</h4>
                                            <WorkflowActions lead={lead} />
                                        </div>

                                        <FieldSection title="Processing Timeline">
                                            <div className="space-y-0 pl-1">
                                                <TimelineItem date={lead.date_lead_received} title="Lead Received" isDone={!!lead.date_lead_received} />
                                                <TimelineItem date={lead.sla_tep_to_pd} title="TEP → PD" isDone={!!lead.sla_tep_to_pd} />
                                                <TimelineItem date={lead.sla_pd_to_so} title="PD → SO" isDone={!!lead.sla_pd_to_so} />
                                                <TimelineItem date={lead.sla_so_to_pd} title="SO → PD" isDone={!!lead.sla_so_to_pd} />
                                                <TimelineItem date={lead.sla_pd_to_tep} title="PD → TEP" isDone={!!lead.sla_pd_to_tep} />
                                                <TimelineItem date={lead.sla_pd_to_acs} title="PD → ACS" isDone={!!lead.sla_pd_to_acs} />
                                                <TimelineItem date={lead.sla_acs_to_pd} title="ACS → PD" isDone={!!lead.sla_acs_to_pd} />
                                                <TimelineItem date={lead.sla_quo_to_tep} title="Quotation Drafted" isDone={!!lead.sla_quo_to_tep} />
                                                <TimelineItem date={lead.sla_pro_to_tep} title="Proposal Drafted" isDone={!!lead.sla_pro_to_tep} />
                                                <TimelineItem date={lead.sla_quo_send_client} title="Quotation Sent" isDone={!!lead.sla_quo_send_client} />
                                                <TimelineItem date={lead.sla_pro_send_client} title="Proposal Sent" isDone={!!lead.sla_pro_send_client} isLast />
                                            </div>
                                        </FieldSection>
                                    </TabsContent>
                                </div>
                            </Tabs>

                            {/* Sticky Footer */}
                            <SheetFooter className="px-6 py-4 border-t bg-background shrink-0">
                                <div className="flex items-center justify-between w-full gap-3">
                                    <p className="text-xs text-muted-foreground">
                                        {form.formState.isDirty ? (
                                            <span className="text-amber-600 font-medium flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" /> Unsaved changes
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> No changes
                                            </span>
                                        )}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                                            Cancel
                                        </Button>
                                        <PermissionGate resource="leads" action="update">
                                            <Button type="submit" size="sm" disabled={saving || !form.formState.isDirty}>
                                                {saving ? (
                                                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                                                ) : (
                                                    <Save className="h-4 w-4 mr-1.5" />
                                                )}
                                                Save Changes
                                            </Button>
                                        </PermissionGate>
                                    </div>
                                </div>
                            </SheetFooter>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" /> Delete Lead
                        </DialogTitle>
                        <DialogDescription>
                            This will permanently delete <strong>&ldquo;{lead.project_name}&rdquo;</strong> and
                            all associated data. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

// ============================================================
// FIELD HELPER COMPONENTS
// ============================================================

function FieldSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border rounded-lg p-4 bg-card space-y-4">
            <h4 className="font-semibold text-sm text-primary">{title}</h4>
            {children}
        </div>
    )
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
    return (
        <div className={`grid gap-4 ${cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
            {children}
        </div>
    )
}

// ============================================================
// TIMELINE (READ-ONLY)
// ============================================================

function TimelineItem({
    date,
    title,
    isDone,
    isLast = false,
}: {
    date: string | null | undefined
    title: string
    isDone: boolean
    isLast?: boolean
}) {
    return (
        <div className="relative flex gap-3">
            <div className="flex flex-col items-center">
                <div
                    className={`flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 z-10 ${isDone
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-muted-foreground/20 text-muted-foreground/30"
                        }`}
                >
                    {isDone ? (
                        <CheckCircle2 className="h-3 w-3" />
                    ) : (
                        <Circle className="h-2.5 w-2.5" />
                    )}
                </div>
                {!isLast && (
                    <div
                        className={`w-0.5 flex-1 min-h-[24px] ${isDone ? "bg-primary" : "bg-muted-foreground/10"}`}
                    />
                )}
            </div>
            <div className={`pb-4 pt-0.5 ${!isDone ? "opacity-40" : ""}`}>
                <span className="text-sm font-semibold">{title}</span>
                {isDone && date && (
                    <span className="block mt-0.5 text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded w-fit">
                        {formatDate(date)}
                    </span>
                )}
            </div>
        </div>
    )
}

// ============================================================
// UTILITIES
// ============================================================

function formatDate(date: string | null | undefined) {
    if (!date) return "-"
    try {
        return new Date(date).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
    } catch {
        return date
    }
}
