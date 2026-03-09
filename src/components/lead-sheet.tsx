"use client"
import React, { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { WorkflowActions } from "./workflow-actions"
import { PermissionGate } from "@/components/permission-gate"
import { Lead, PipelineStage } from "@/types"
import { CompanyCombobox, ContactCombobox } from "@/components/entity-combobox"
import { ProfileCombobox } from "@/components/profile-combobox"
import { Save, Trash2, Loader2, CheckCircle2, Circle, AlertTriangle, Clock } from "lucide-react"

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

interface SlaItem { label: string; value: string | null; icon: React.ReactNode }
function getSlaItems(lead: Lead): SlaItem[] {
    const raw: { label: string; value: string | null }[] = [
        { label: "Lead Received", value: lead.date_lead_received },
        { label: "TEP \u2192 PD", value: lead.sla_tep_to_pd },
        { label: "PD \u2192 SO", value: lead.sla_pd_to_so },
        { label: "PD \u2192 ACS", value: lead.sla_pd_to_acs },
        { label: "SO \u2192 PD", value: lead.sla_so_to_pd },
        { label: "PD \u2192 TEP", value: lead.sla_pd_to_tep },
        { label: "ACS \u2192 PD", value: lead.sla_acs_to_pd },
        { label: "Quotation \u2192 TEP", value: lead.sla_quo_to_tep },
        { label: "Proposal \u2192 TEP", value: lead.sla_pro_to_tep },
        { label: "Quotation \u2192 Client", value: lead.sla_quo_send_client },
        { label: "Proposal \u2192 Client", value: lead.sla_pro_send_client },
    ]
    return raw.map((item) => ({
        ...item,
        icon: item.value
            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            : <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />,
    }))
}

interface LeadSheetProps { lead: Lead | null; open: boolean; onOpenChange: (open: boolean) => void }

export function LeadSheet({ lead, open, onOpenChange }: LeadSheetProps) {
    const [saving, setSaving] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [stages, setStages] = useState<PipelineStage[]>([])
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

    const onSubmit = async (values: LeadFormValues) => {
        if (!lead) return
        setSaving(true)
        try {
            const payload: Record<string, unknown> = {}
            for (const [key, val] of Object.entries(values)) {
                if (val === undefined) continue
                payload[key] = val === "" ? null : val
            }
            const { error } = await supabase.from("leads").update(payload).eq("id", lead.id)
            if (error) throw new Error(error.message)
            toast.success("Lead updated successfully")
            onOpenChange(false)
            router.refresh()
        } catch (err) {
            toast.error(`Update failed: ${err instanceof Error ? err.message : "Unknown error"}`)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!lead) return
        setDeleting(true)
        const { error } = await supabase.from("leads").delete().eq("id", lead.id)
        if (error) { toast.error(`Delete failed: ${error.message}`) }
        else { toast.success("Lead deleted"); setDeleteOpen(false); onOpenChange(false); router.refresh() }
        setDeleting(false)
    }

    if (!lead) return null
    const slaItems = getSlaItems(lead)

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-[700px] flex flex-col p-0">
                    <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <SheetTitle>{lead.project_name || "Untitled Lead"}</SheetTitle>
                        <SheetDescription>
                            {lead.client_company?.name || lead.company_name || "No client"} &mdash; #{lead.manual_id || "N/A"}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="px-6 py-3 border-b bg-muted/30 shrink-0">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Workflow</p>
                        <WorkflowActions lead={lead} onUpdate={() => router.refresh()} />
                    </div>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0">
                            <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
                                <div className="px-6 pt-3 shrink-0">
                                    <TabsList className="grid w-full grid-cols-4 bg-muted p-1 rounded-lg">
                                        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                                        <TabsTrigger value="event" className="text-xs">Event</TabsTrigger>
                                        <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                                        <TabsTrigger value="timeline" className="text-xs">Timeline</TabsTrigger>
                                    </TabsList>
                                </div>
                                <div className="flex-1 overflow-y-auto px-6 py-4">
                                    <TabsContent value="overview" className="mt-0 space-y-5">
                                        <FieldSection title="Project & Client">
                                            <FieldGrid>
                                                <TextField control={form.control} name="project_name" label="Project Name" />
                                                <SelectField control={form.control} name="category" label="Category" options={CATEGORY_OPTIONS} />
                                                <FormField control={form.control} name="client_company_id" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client Company</FormLabel>
                                                        <FormControl><CompanyCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} /></FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="contact_id" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Person</FormLabel>
                                                        <FormControl><ContactCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} clientCompanyId={form.watch("client_company_id") ?? null} /></FormControl>
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
                                    <TabsContent value="timeline" className="mt-0 space-y-5">
                                        <FieldSection title="SLA Timeline">
                                            <div className="space-y-2">
                                                {slaItems.map((item) => (
                                                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b last:border-0">
                                                        <div className="flex items-center gap-2">
                                                            {item.icon}
                                                            <span className="text-sm">{item.label}</span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {item.value ? new Date(item.value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "\u2014"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </FieldSection>
                                        <FieldSection title="Duration">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Inquiry \u2192 PD</p>
                                                        <p className="text-sm font-medium">{lead.duration_inq_to_pd || "\u2014"}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                                    <div>
                                                        <p className="text-xs text-muted-foreground">Inquiry \u2192 Client</p>
                                                        <p className="text-sm font-medium">{lead.duration_inq_to_client || "\u2014"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </FieldSection>
                                    </TabsContent>
                                </div>
                            </Tabs>
                            <SheetFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between gap-2">
                                <PermissionGate resource="leads" action="delete">
                                    <Button type="button" variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                                        <Trash2 className="h-4 w-4 mr-1.5" /> Delete
                                    </Button>
                                </PermissionGate>
                                <div className="flex items-center gap-2 ml-auto">
                                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                                    <Button type="submit" disabled={saving || !form.formState.isDirty}>
                                        {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                        Save Changes
                                    </Button>
                                </div>
                            </SheetFooter>
                        </form>
                    </Form>
                </SheetContent>
            </Sheet>
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive" /> Delete Lead
                        </DialogTitle>
                        <DialogDescription>
                            This will permanently delete &quot;{lead.project_name || "this lead"}&quot;. This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                            Delete Permanently
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

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
