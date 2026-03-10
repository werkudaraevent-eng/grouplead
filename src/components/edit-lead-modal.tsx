"use client"

import React, { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateLeadAction } from "@/app/actions/lead-actions"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form"
import { Lead, PipelineStage } from "@/types"
import { Save, Loader2 } from "lucide-react"
import { CompanyCombobox, ContactCombobox } from "@/components/entity-combobox"
import { ProfileCombobox } from "@/components/profile-combobox"

// ============================================================
// ZOD SCHEMA
// ============================================================

const leadFormSchema = z.object({
    project_name: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    bu_revenue: z.string().nullable().optional(),
    pipeline_stage_id: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    source_lead: z.string().nullable().optional(),
    referral_source: z.string().nullable().optional(),
    pic_sales_id: z.string().nullable().optional(),
    account_manager_id: z.string().nullable().optional(),
    cancel_lost_reason: z.string().nullable().optional(),
    estimated_revenue: z.coerce.number().nullable().optional(),
    nominal_konfirmasi: z.coerce.number().nullable().optional(),
    materialized_amount: z.coerce.number().nullable().optional(),
    difference_amount: z.coerce.number().nullable().optional(),
    percentage_deal: z.coerce.number().nullable().optional(),
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
    sector: z.string().nullable().optional(),
    line_industry: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
})

type LeadFormValues = z.infer<typeof leadFormSchema>

const BU_OPTIONS = ["WNW", "WNS", "UK", "TEP", "CREATIVE"]
const CATEGORY_OPTIONS = ["Corporate", "Government", "MICE", "Wedding", "Social"]

// ============================================================
// COMPONENT
// ============================================================

interface EditLeadModalProps {
    lead: Lead
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved?: () => void
}

export function EditLeadModal({ lead, open, onOpenChange, onSaved }: EditLeadModalProps) {
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [isPending, startTransition] = useTransition()
    const supabase = createClient()
    const router = useRouter()

    useEffect(() => {
        supabase.from("pipeline_stages").select("*").order("sort_order").then(({ data }) => {
            if (data) setStages(data)
        })
    }, [supabase])

    const form = useForm<LeadFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(leadFormSchema) as any,
        defaultValues: {},
    })

    useEffect(() => {
        if (lead && open) {
            form.reset({
                project_name: lead.project_name,
                client_company_id: lead.client_company_id,
                contact_id: lead.contact_id,
                bu_revenue: lead.bu_revenue,
                pipeline_stage_id: lead.pipeline_stage_id,
                category: lead.category,
                source_lead: lead.source_lead,
                referral_source: lead.referral_source,
                pic_sales_id: lead.pic_sales_id,
                account_manager_id: lead.account_manager_id,
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
                sector: lead.sector,
                line_industry: lead.line_industry,
                area: lead.area,
                remark: lead.remark,
            })
        }
    }, [lead, open, form])

    const onSubmit = (values: LeadFormValues) => {
        startTransition(async () => {
            try {
                const result = await updateLeadAction(lead.id, values as Record<string, unknown>)
                if (!result.success) throw new Error(result.error)

                toast.success("Lead updated successfully")
                onOpenChange(false)
                onSaved?.()
                router.refresh()
            } catch (err) {
                toast.error(`Update failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <DialogTitle>Edit Lead</DialogTitle>
                    <DialogDescription>
                        {lead.project_name || "Untitled"} — #{lead.manual_id || "N/A"}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                            <div className="px-6 pt-3 shrink-0">
                                <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
                                    <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                                    <TabsTrigger value="event" className="text-xs">Event</TabsTrigger>
                                    <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                {/* OVERVIEW TAB */}
                                <TabsContent value="overview" className="mt-0 space-y-5">
                                    <FieldSection title="Project & Client">
                                        <FieldGrid>
                                            <TextField control={form.control} name="project_name" label="Project Name" />
                                            <SelectField control={form.control} name="category" label="Category" options={CATEGORY_OPTIONS} />
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
                                            <FormField control={form.control} name="pipeline_stage_id" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline Stage</FormLabel>
                                                    <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                                        <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select stage" /></SelectTrigger></FormControl>
                                                        <SelectContent>
                                                            {stages.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
                                                        </SelectContent>
                                                    </Select>
                                                </FormItem>
                                            )} />
                                            <SelectField control={form.control} name="bu_revenue" label="BU Revenue" options={BU_OPTIONS} />
                                            <FormField control={form.control} name="pic_sales_id" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PIC Sales</FormLabel>
                                                    <FormControl><ProfileCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} placeholder="Select PIC Sales..." /></FormControl>
                                                </FormItem>
                                            )} />
                                            <FormField control={form.control} name="account_manager_id" render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account Manager</FormLabel>
                                                    <FormControl><ProfileCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} placeholder="Select Account Manager..." /></FormControl>
                                                </FormItem>
                                            )} />
                                            <TextField control={form.control} name="source_lead" label="Source Lead" />
                                            <TextField control={form.control} name="referral_source" label="Referral Source" />
                                        </FieldGrid>
                                    </FieldSection>
                                    <FieldSection title="Additional">
                                        <FieldGrid cols={1}>
                                            <TextField control={form.control} name="cancel_lost_reason" label="Cancel/Lost Reason" />
                                            <TextField control={form.control} name="remark" label="Remark" />
                                        </FieldGrid>
                                    </FieldSection>
                                </TabsContent>

                                {/* EVENT TAB */}
                                <TabsContent value="event" className="mt-0 space-y-5">
                                    <FieldSection title="Event Info">
                                        <FieldGrid>
                                            <TextField control={form.control} name="date_of_event" label="Event Date" type="date" />
                                            <TextField control={form.control} name="start_date" label="Performance Start" type="date" />
                                            <TextField control={form.control} name="venue_hotel" label="Venue / Hotel" />
                                            <TextField control={form.control} name="location_city" label="City" />
                                            <TextField control={form.control} name="number_of_pax" label="Number of Pax" type="number" />
                                            <TextField control={form.control} name="nationality" label="Nationality" />
                                            <TextField control={form.control} name="grade_lead" label="Grade Lead" />
                                        </FieldGrid>
                                    </FieldSection>
                                    <FieldSection title="Classification">
                                        <FieldGrid>
                                            <TextField control={form.control} name="main_stream" label="Main Stream" />
                                            <TextField control={form.control} name="tipe_stream" label="Type Stream" />
                                            <TextField control={form.control} name="business_purpose" label="Business Purpose" />
                                            <TextField control={form.control} name="tipe" label="Type" />
                                        </FieldGrid>
                                        <div className="grid grid-cols-2 gap-4 mt-4">
                                            <FormField control={form.control} name="is_onsite" render={({ field }) => (
                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                    <input type="checkbox" checked={field.value ?? false} onChange={(e) => field.onChange(e.target.checked)} className="rounded border-input" />
                                                    Onsite
                                                </label>
                                            )} />
                                            <FormField control={form.control} name="is_online" render={({ field }) => (
                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                    <input type="checkbox" checked={field.value ?? false} onChange={(e) => field.onChange(e.target.checked)} className="rounded border-input" />
                                                    Online
                                                </label>
                                            )} />
                                        </div>
                                    </FieldSection>
                                    <FieldSection title="Industry & Location">
                                        <FieldGrid>
                                            <TextField control={form.control} name="sector" label="Sector" />
                                            <TextField control={form.control} name="line_industry" label="Line Industry" />
                                            <TextField control={form.control} name="area" label="Area" />
                                        </FieldGrid>
                                    </FieldSection>
                                </TabsContent>

                                {/* FINANCIAL TAB */}
                                <TabsContent value="financial" className="mt-0 space-y-5">
                                    <FieldSection title="Revenue & Deal">
                                        <FieldGrid>
                                            <TextField control={form.control} name="estimated_revenue" label="Estimated Revenue (IDR)" type="number" />
                                            <TextField control={form.control} name="nominal_konfirmasi" label="Nominal Konfirmasi (IDR)" type="number" />
                                            <TextField control={form.control} name="materialized_amount" label="Materialized Amount (IDR)" type="number" />
                                            <TextField control={form.control} name="difference_amount" label="Difference Amount (IDR)" type="number" />
                                            <TextField control={form.control} name="percentage_deal" label="% Deal" type="number" />
                                        </FieldGrid>
                                    </FieldSection>
                                </TabsContent>
                            </div>
                        </Tabs>

                        <DialogFooter className="px-6 py-4 border-t shrink-0">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

// ============================================================
// REUSABLE FIELD HELPERS
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TextField({ control, name, label, type = "text" }: { control: any; name: string; label: string; type?: string }) {
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</FormLabel>
                <FormControl><Input type={type} className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
            </FormItem>
        )} />
    )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SelectField({ control, name, label, options }: { control: any; name: string; label: string; options: string[] }) {
    return (
        <FormField control={control} name={name} render={({ field }) => (
            <FormItem>
                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</FormLabel>
                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                    <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger></FormControl>
                    <SelectContent>
                        {options.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                    </SelectContent>
                </Select>
            </FormItem>
        )} />
    )
}
