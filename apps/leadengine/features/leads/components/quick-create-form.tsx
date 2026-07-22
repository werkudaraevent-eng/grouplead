"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useCompany } from "@/contexts/company-context"
import { createLeadAction } from "@/app/actions/lead-actions"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form"
import { CompanyCombobox, ContactCombobox } from "@/components/shared/entity-combobox"
import { CurrencyInput } from "@/components/shared/currency-input"
import { ProfileCombobox } from "@/features/users/components/profile-combobox"
import { Loader2, X, Zap } from "lucide-react"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ── Minimal schema: only the essentials ──────────────────────────
const quickCreateSchema = z.object({
    project_name: z.string().min(1, "Project name is required"),
    company_id: z.string().nullable().optional(),
    client_company_id: z.string().nullable().optional(),
    contact_id: z.string().nullable().optional(),
    pic_sales_id: z.string().nullable().optional(),
    estimated_value: z.coerce.number().nullable().optional(),
    target_close_date: z.string().min(1, "Target close date is required"),
})

type QuickCreateValues = z.infer<typeof quickCreateSchema>

interface QuickCreateFormProps {
    onClose?: () => void
    pipelineId?: string
}

export function QuickCreateForm({ onClose, pipelineId }: QuickCreateFormProps) {
    const [showWarning, setShowWarning] = useState(false)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()
    const { activeCompany, isHoldingView, companies } = useCompany()

    const subsidiaries = isHoldingView
        ? companies.filter((c) => !c.isHolding).map((c) => ({ id: c.id, name: c.name }))
        : []

    const form = useForm<QuickCreateValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(quickCreateSchema) as any,
        defaultValues: {
            project_name: "",
            company_id: null,
            client_company_id: null,
            contact_id: null,
            pic_sales_id: null,
            estimated_value: null,
            target_close_date: "",
        },
    })

    const { dirtyFields } = form.formState

    const handleAttemptClose = () => {
        if (Object.keys(dirtyFields).length > 0) {
            setShowWarning(true)
        } else {
            form.reset()
            onClose?.()
        }
    }

    const handleForceClose = () => {
        setShowWarning(false)
        form.reset()
        onClose?.()
    }

    const onSubmit = (values: QuickCreateValues) => {
        startTransition(async () => {
            try {
                const finalCompanyId = isHoldingView ? values.company_id : activeCompany?.id
                if (!finalCompanyId) {
                    toast.error("Please select a company for this lead")
                    return
                }
                const { company_id: _drop, ...rest } = values
                const payload: Record<string, unknown> = {
                    ...rest,
                    company_id: finalCompanyId,
                    pipeline_id: pipelineId || null,
                }
                const result = await createLeadAction(payload)
                if (!result.success) throw new Error(result.error)

                toast.success("Lead created — opening detail page...")
                form.reset()
                onClose?.()

                // CRITICAL: Redirect to deep-work detail page
                if (result.data?.id) {
                    router.push(`/leads/${result.data.id}`)
                }
            } catch (err) {
                toast.error(`Create failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        })
    }

    return (
        <>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full overflow-hidden">
                {/* ─── Header ──────────────────────────────────────── */}
                <div className="flex-none px-6 py-5 border-b border-slate-200 bg-white">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Zap className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold">Quick Create Lead</h2>
                                <p className="text-xs text-muted-foreground">Enter essentials now, add details on the next page.</p>
                            </div>
                        </div>
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

                {/* ─── Form Body ───────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                    {/* Holding company selector */}
                    {isHoldingView && (
                        <FormField control={form.control} name="company_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assign to Company *</FormLabel>
                                <Select value={field.value || undefined} onValueChange={(v) => field.onChange(v || null)}>
                                    <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select subsidiary..." /></SelectTrigger></FormControl>
                                    <SelectContent>{subsidiaries.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}</SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                    )}

                    {/* Project Name */}
                    <FormField control={form.control} name="project_name" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Project / Deal Name *</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder="e.g. Annual Gala Dinner 2026"
                                    className="h-10 text-sm"
                                    autoFocus
                                    {...field}
                                />
                            </FormControl>
                        </FormItem>
                    )} />

                    {/* Client & Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    </div>

                    {/* PIC Sales */}
                    <FormField control={form.control} name="pic_sales_id" render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PIC Sales</FormLabel>
                            <FormControl><ProfileCombobox value={field.value ?? null} onChange={(id) => field.onChange(id)} placeholder="Assign a salesperson..." filterRoles={["sales", "bu_manager"]} /></FormControl>
                        </FormItem>
                    )} />

                    {/* Value & Date */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <FormField control={form.control} name="target_close_date" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Target Close Date *</FormLabel>
                                <FormControl><Input type="date" className="h-9 text-sm" {...field} value={field.value ?? ""} /></FormControl>
                            </FormItem>
                        )} />
                    </div>

                    {/* Helper Text */}
                    <div className="bg-primary/5 border border-primary/10 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            <span className="font-semibold text-foreground">Tip:</span> You&apos;ll be redirected to the full detail page after creating this lead, where you can add event details, classification, financials, notes, and files.
                        </p>
                    </div>
                </div>

                {/* ─── Footer ─────────────────────────────────────── */}
                <div className="flex-none px-6 py-4 border-t border-slate-200 bg-slate-50/80 flex justify-end gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={handleAttemptClose}>
                        Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={isPending} className="min-w-[120px]">
                        {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Zap className="h-4 w-4 mr-1.5" />}
                        Create & Open
                    </Button>
                </div>
            </form>
        </Form>

        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have entered data. If you close this panel, all your inputs will be lost.
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
