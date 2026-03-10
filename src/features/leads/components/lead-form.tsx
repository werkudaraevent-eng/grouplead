"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useCompany } from "@/contexts/company-context"
import { createLeadAction } from "@/app/actions/lead-actions"

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
import { CompanyCombobox, ContactCombobox } from "@/components/shared/entity-comboboxombobox"
import { ProfileCombobox } from "@/features/users/components/profile-comboboxrofile-combobox"
import { PipelineStage } from "@/types"
import { Save, Loader2 } from "lucide-react"

// ============================================================
// ZOD SCHEMA
// ============================================================

const addLeadSchema = z.object({
    project_name: z.string().min(1, "Project name is required"),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    bu_revenue: z.string().nullable().optional(),
    pipeline_stage_id: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    source_lead: z.string().nullable().optional(),
    referral_source: z.string().nullable().optional(),
    pic_sales_id: z.string().nullable().optional(),
    account_manager_id: z.string().nullable().optional(),
    estimated_revenue: z.coerce.number().nullable().optional(),
    nominal_konfirmasi: z.coerce.number().nullable().optional(),
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

type AddLeadValues = z.infer<typeof addLeadSchema>

const BU_OPTIONS = ["WNW", "WNS", "UK", "TEP", "CREATIVE"]
const CATEGORY_OPTIONS = ["Corporate", "Government", "MICE", "Wedding", "Social"]

// ============================================================
// COMPONENT
// ============================================================

interface LeadFormProps {
    onSuccess?: () => void
}

export function LeadForm({ onSuccess }: LeadFormProps) {
    const [stages, setStages] = useState<PipelineStage[]>([])
    const [isPending, startTransition] = useTransition()
    const supabase = createClient()
    const router = useRouter()
    const { activeCompany } = useCompany()

    useEffect(() => {
        supabase.from("pipeline_stages").select("*").order("sort_order").then(({ data }) => {
            if (data) setStages(data)
        })
    }, [supabase])

    const defaultStageId = stages.find((s) => s.name === "Lead Masuk")?.id ?? null

    const form = useForm<AddLeadValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(addLeadSchema) as any,
        defaultValues: { pipeline_stage_id: defaultStageId },
    })

    const onSubmit = (values: AddLeadValues) => {
        startTransition(async () => {
            try {
                const payload: Record<string, unknown> = { ...values }
                if (activeCompany) payload.company_id = activeCompany.id

                const result = await createLeadAction(payload)
                if (!result.success) throw new Error(result.error)

                toast.success("Lead created successfully")
                onSuccess?.()
                router.refresh()
            } catch (err) {
                toast.error(`Create failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        })
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 bg-muted p-1 rounded-lg">
                        <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
                        <TabsTrigger value="event" className="text-xs">Event</TabsTrigger>
                        <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                    </TabsList>

                    <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
                        {/* OVERVIEW */}
                        <TabsContent value="overview" className="mt-0 space-y-5">
                            <FieldSection title="Project & Client">
                                <FieldGrid>
                                    <TextField control={form.control} name="project_name" label="Project Name *" />
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
                                    <SelectField control={form.control} name="bu_revenue" label="BU Revenue" options={BU_OPTIONS} />
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
                        </TabsContent>

                        {/* EVENT */}
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

                        {/* FINANCIAL */}
                        <TabsContent value="financial" className="mt-0 space-y-5">
                            <FieldSection title="Revenue">
                                <FieldGrid>
                                    <TextField control={form.control} name="estimated_revenue" label="Estimated Revenue (IDR)" type="number" />
                                    <TextField control={form.control} name="nominal_konfirmasi" label="Nominal Konfirmasi (IDR)" type="number" />
                                </FieldGrid>
                            </FieldSection>
                        </TabsContent>
                    </div>
                </Tabs>

                <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button type="submit" disabled={isPending}>
                        {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                        Create Lead
                    </Button>
                </div>
            </form>
        </Form>
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
