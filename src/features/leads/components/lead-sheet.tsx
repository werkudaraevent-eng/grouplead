"use client"
import React, { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { updateLeadAction, deleteLeadAction } from "@/app/actions/lead-actions"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useMasterOptions } from "@/hooks/use-master-options"
import { useCompany } from "@/contexts/company-context"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { WorkflowActions } from "@/features/tasks/components/workflow-actions"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Lead, PipelineStage } from "@/types"
import { CompanyCombobox, ContactCombobox } from "@/components/shared/entity-combobox"
import { CurrencyInput } from "@/components/shared/currency-input"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import { Save, Trash2, Loader2, AlertTriangle, CalendarIcon } from "lucide-react"
import { MultiDatePicker } from "@/components/shared/multi-date-picker"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

const leadFormSchema = z.object({
    project_name: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    pipeline_stage_id: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    lead_source: z.string().nullable().optional(),
    referral_source: z.string().nullable().optional(),
    pic_sales_id: z.string().nullable().optional(),
    account_manager_id: z.string().nullable().optional(),
    lost_reason: z.string().nullable().optional(),
    lost_reason_details: z.string().nullable().optional(),
    estimated_value: z.coerce.number().nullable().optional(),
    actual_value: z.coerce.number().nullable().optional(),
    event_date_start: z.string().nullable().optional(),
    event_date_end: z.string().nullable().optional(),
    event_dates: z.array(z.string()).optional().default([]),
    destinations: z.array(z.object({
        city: z.string().min(1, "City is required"),
        venue: z.string().optional().default(""),
    })).optional().default([]),
    pax_count: z.coerce.number().nullable().optional(),
    event_format: z.string().nullable().optional(),
    nationality: z.string().nullable().optional(),
    grade_lead: z.string().nullable().optional(),
    stream_type: z.string().nullable().optional(),
    business_purpose: z.string().nullable().optional(),
    tipe: z.string().nullable().optional(),
    sector: z.string().nullable().optional(),
    line_industry: z.string().nullable().optional(),
    area: z.string().nullable().optional(),
    general_brief: z.string().nullable().optional(),
    production_sow: z.string().nullable().optional(),
    special_remarks: z.string().nullable().optional(),
    remark: z.string().nullable().optional(),
})
type LeadFormValues = z.infer<typeof leadFormSchema>

interface LeadSheetProps { lead: Lead | null; open: boolean; onOpenChange: (open: boolean) => void }

export function LeadSheet({ lead, open, onOpenChange }: LeadSheetProps) {
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [cutoffDate, setCutoffDate] = useState<number>(31)
    const [isPending, startTransition] = useTransition()
    const supabase = createClient()
    const router = useRouter()
    const { companies } = useCompany()
    
    const companyIds = companies.map(c => c.id)
    const { options: eventFormatOptions } = useMasterOptions("event_format", companyIds)
    const { options: lostReasonOptions } = useMasterOptions("lost_reason", companyIds)

    useEffect(() => {
        Promise.all([
            supabase.from("pipeline_stages").select("*").order("sort_order"),
            supabase.from("master_options").select("*").eq("option_type", "system_setting").eq("label", "event_cutoff_date")
        ]).then(([stagesRes, optRes]) => {
            if (stagesRes.data) setStages(stagesRes.data)
            if (optRes.data?.[0]) setCutoffDate(parseInt(optRes.data[0].value))
        })
    }, [supabase])

    const form = useForm<LeadFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(leadFormSchema) as any,
        defaultValues: {},
    })

    const currentStageId = form.watch("pipeline_stage_id")
    const isClosedWon = stages.find((s) => s.id === currentStageId)?.name === "Closed Won"

    useEffect(() => {
        if (lead && open) {
            form.reset({
                project_name: lead.project_name,
                client_company_id: lead.client_company_id,
                contact_id: lead.contact_id,
                pipeline_stage_id: lead.pipeline_stage_id,
                category: lead.category,
                lead_source: lead.lead_source,
                referral_source: lead.referral_source,
                pic_sales_id: lead.pic_sales_id,
                account_manager_id: lead.account_manager_id,
                lost_reason: lead.lost_reason,
                lost_reason_details: lead.lost_reason_details,
                estimated_value: lead.estimated_value,
                actual_value: lead.actual_value,
                event_date_start: lead.event_date_start,
                event_date_end: lead.event_date_end,
                event_dates: lead.event_dates || [],
                destinations: Array.isArray(lead.destinations) ? lead.destinations.map((d: { city: string; venue?: string }) => ({ city: d.city, venue: d.venue ?? "" })) : [],
                pax_count: lead.pax_count,
                event_format: lead.event_format,
                nationality: lead.nationality,
                grade_lead: lead.grade_lead,
                stream_type: lead.stream_type,
                business_purpose: lead.business_purpose,
                tipe: lead.tipe,
                sector: lead.sector,
                line_industry: lead.line_industry,
                area: lead.area,
                general_brief: lead.general_brief,
                production_sow: lead.production_sow,
                special_remarks: lead.special_remarks,
                remark: lead.remark,
            })
        }
    }, [lead, open, form])

    const onSubmit = (values: LeadFormValues) => {
        if (!lead) return
        startTransition(async () => {
            try {
                const payload: Record<string, unknown> = { ...values }
                if (values.event_dates && values.event_dates.length > 0) {
                    const sorted = [...values.event_dates].sort()
                    payload.event_date_start = sorted[0]
                    payload.event_date_end = sorted[sorted.length - 1]

                    const startDate = new Date(payload.event_date_start as string)
                    if (startDate.getDate() > cutoffDate) {
                        startDate.setMonth(startDate.getMonth() + 1)
                    }
                    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                    payload.month_event = `${MONTHS[startDate.getMonth()]}-${String(startDate.getFullYear()).slice(2)}`
                } else {
                    payload.event_date_start = null
                    payload.event_date_end = null
                    payload.month_event = null
                }
                const result = await updateLeadAction(lead.id, payload)
                if (!result.success) throw new Error(result.error)
                toast.success("Lead updated successfully")
                onOpenChange(false)
                router.refresh()
            } catch (err) {
                toast.error(`Update failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        })
    }

    const handleDelete = async () => {
        if (!lead) return
        setDeleting(true)
        try {
            const result = await deleteLeadAction(lead.id)
            if (!result.success) throw new Error(result.error)
            toast.success("Lead deleted")
            setDeleteOpen(false)
            onOpenChange(false)
            router.refresh()
        } catch (err) {
            toast.error(`Delete failed: ${err instanceof Error ? err.message : "Unknown error"}`)
        } finally { setDeleting(false) }
    }

    if (!lead) return null

    return (
        <>
            <Sheet open={open} onOpenChange={onOpenChange}>
                <SheetContent className="w-full sm:max-w-[700px] flex flex-col p-0">
                    <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                        <SheetTitle>{lead.project_name || "Untitled Lead"}</SheetTitle>
                        <SheetDescription>
                            {lead.client_company?.name || "No client"} &mdash; #{lead.manual_id || "N/A"}
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
                                    <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
                                        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                                        <TabsTrigger value="event" className="text-xs">Event</TabsTrigger>
                                        <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                                    </TabsList>
                                </div>
                                <div className="flex-1 overflow-y-auto px-6 py-4">
                                    <TabsContent value="overview" className="mt-0 space-y-5">
                                        <FieldSection title="Project & Client">
                                            <FieldGrid>
                                                <TextField control={form.control} name="project_name" label="Project Name" />
                                                <TextField control={form.control} name="category" label="Category" />
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
                                                            <SelectContent>{stages.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )} />
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
                                                <TextField control={form.control} name="lead_source" label="Lead Source" />
                                                <TextField control={form.control} name="referral_source" label="Referral Source" />
                                            </FieldGrid>
                                        </FieldSection>
                                        <FieldSection title="Classification">
                                            <FieldGrid>
                                                <TextField control={form.control} name="stream_type" label="Stream Type" />
                                                <TextField control={form.control} name="business_purpose" label="Business Purpose" />
                                                <TextField control={form.control} name="tipe" label="Type" />
                                                <TextField control={form.control} name="grade_lead" label="Grade Lead" />
                                                <TextField control={form.control} name="nationality" label="Nationality" />
                                                <TextField control={form.control} name="sector" label="Sector" />
                                                <TextField control={form.control} name="line_industry" label="Line Industry" />
                                                <TextField control={form.control} name="area" label="Area" />
                                            </FieldGrid>
                                        </FieldSection>
                                        <FieldSection title="Additional">
                                            <FieldGrid cols={1}>
                                                {isClosedLost && (
                                                    <>
                                                        <SelectField control={form.control} name="lost_reason" label="Lost Reason" options={lostReasonOptions.map((o) => o.value)} />
                                                        <FormField control={form.control} name="lost_reason_details" render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lost Reason Details</FormLabel>
                                                                <FormControl>
                                                                    <textarea
                                                                        rows={3}
                                                                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                        placeholder="Provide more context..."
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                    />
                                                                </FormControl>
                                                            </FormItem>
                                                        )} />
                                                    </>
                                                )}
                                                <FormField control={form.control} name="general_brief" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">General Brief &amp; Inquiry</FormLabel>
                                                        <FormControl>
                                                            <textarea
                                                                rows={4}
                                                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                placeholder="Raw narrative, event background, and client objectives..."
                                                                {...field}
                                                                value={field.value ?? ""}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="production_sow" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Production SOW &amp; Equipment</FormLabel>
                                                        <FormControl>
                                                            <textarea
                                                                rows={4}
                                                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                placeholder="Technical specs, multimedia needs, layout, talent requirements..."
                                                                {...field}
                                                                value={field.value ?? ""}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <FormField control={form.control} name="special_remarks" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Special Remarks</FormLabel>
                                                        <FormControl>
                                                            <textarea
                                                                rows={3}
                                                                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                                placeholder="Non-technical operational notes..."
                                                                {...field}
                                                                value={field.value ?? ""}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                                <TextField control={form.control} name="remark" label="Remark" />
                                            </FieldGrid>
                                        </FieldSection>
                                    </TabsContent>

                                    <TabsContent value="event" className="mt-0 space-y-5">
                                        <FieldSection title="Event Information">
                                            <div className="grid gap-4 grid-cols-1 mb-4">
                                                <FormField control={form.control} name="event_dates" render={({ field }) => (
                                                    <FormItem className="flex flex-col">
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Dates</FormLabel>
                                                        <p className="text-[11px] text-slate-500 mb-1 leading-relaxed">Select one or multiple dates. Use <kbd className="bg-slate-100 border border-slate-200 rounded px-1 py-0.5 font-sans">Shift</kbd> + click to select a range.</p>
                                                        <FormControl>
                                                            <MultiDatePicker value={field.value ?? []} onChange={field.onChange} />
                                                        </FormControl>
                                                    </FormItem>
                                                )} />
                                            </div>
                                            <FieldGrid>
                                                <TextField control={form.control} name="pax_count" label="Pax Count" type="number" />
                                                <SelectField control={form.control} name="event_format" label="Event Format" options={eventFormatOptions.map(o => o.value)} />
                                            </FieldGrid>
                                        </FieldSection>
                                        <FieldSection title="Destinations">
                                            <FormField control={form.control} name="destinations" render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <Input className="h-9 text-sm" value={Array.isArray(field.value) ? field.value.map((d: { city: string; venue?: string }) => d.venue ? `${d.city} (${d.venue})` : d.city).join(", ") : ""} readOnly placeholder="Edit via lead modal" />
                                                    </FormControl>
                                                </FormItem>
                                            )} />
                                        </FieldSection>
                                    </TabsContent>

                                    <TabsContent value="financial" className="mt-0 space-y-5">
                                        <FieldSection title="Financials">
                                            <FieldGrid>
                                                <FormField control={form.control} name="estimated_value" render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Estimated Value (IDR)</FormLabel>
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
                                                {isClosedWon && (
                                                    <FormField control={form.control} name="actual_value" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actual Value (IDR)</FormLabel>
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
                                                )}
                                            </FieldGrid>
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
                                    <Button type="submit" disabled={isPending || !form.formState.isDirty}>
                                        {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
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
    return (<div className="border rounded-lg p-4 bg-card space-y-4"><h4 className="font-semibold text-sm text-primary">{title}</h4>{children}</div>)
}

function FieldGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: number }) {
    return (<div className={`grid gap-4 ${cols === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>{children}</div>)
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
                    <SelectContent>{options.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}</SelectContent>
                </Select>
            </FormItem>
        )} />
    )
}
