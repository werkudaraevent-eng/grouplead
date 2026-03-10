"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Save, Plus, Trash2, Target } from "lucide-react"
import { Profile, SalesTarget } from "@/types"

const schema = z.object({
    target_amount: z.coerce.number().min(0, "Must be positive"),
    period_type: z.enum(["monthly", "quarterly", "yearly"]),
    period_start: z.string().min(1, "Required"),
    period_end: z.string().min(1, "Required"),
})
type FormValues = z.infer<typeof schema>

interface TargetManagementModalProps {
    profile: Profile | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TargetManagementModal({ profile, open, onOpenChange }: TargetManagementModalProps) {
    const [targets, setTargets] = useState<SalesTarget[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const supabase = createClient()
    const router = useRouter()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({ resolver: zodResolver(schema) as any, defaultValues: { period_type: "monthly", target_amount: 0 } })

    useEffect(() => {
        if (profile && open) {
            setLoading(true)
            supabase.from("sales_targets").select("*").eq("profile_id", profile.id)
                .order("period_start", { ascending: false })
                .then(({ data }) => { setTargets((data as SalesTarget[]) || []); setLoading(false) })
            form.reset({ period_type: "monthly", target_amount: 0, period_start: "", period_end: "" })
        }
    }, [profile, open])

    const onSubmit = async (values: FormValues) => {
        if (!profile) return
        setSaving(true)
        const { error } = await supabase.from("sales_targets").insert({
            profile_id: profile.id,
            target_amount: values.target_amount,
            period_type: values.period_type,
            period_start: values.period_start,
            period_end: values.period_end,
        })
        if (error) { toast.error(`Error: ${error.message}`) }
        else {
            toast.success("Target added")
            form.reset({ period_type: "monthly", target_amount: 0, period_start: "", period_end: "" })
            const { data } = await supabase.from("sales_targets").select("*").eq("profile_id", profile.id).order("period_start", { ascending: false })
            setTargets((data as SalesTarget[]) || [])
            router.refresh()
        }
        setSaving(false)
    }

    const handleDelete = async (id: string) => {
        setDeleting(id)
        const { error } = await supabase.from("sales_targets").delete().eq("id", id)
        if (error) toast.error(`Delete failed: ${error.message}`)
        else { setTargets((prev) => prev.filter((t) => t.id !== id)); toast.success("Target removed") }
        setDeleting(null)
    }

    const formatIDR = (n: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n)

    if (!profile) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Manage Quota</DialogTitle>
                    <DialogDescription>{profile.full_name} — Sales Targets</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
                    {/* Existing targets */}
                    {loading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : targets.length > 0 ? (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Existing Targets</p>
                            {targets.map((t) => (
                                <div key={t.id} className="flex items-center justify-between border rounded-lg p-3 bg-card">
                                    <div>
                                        <p className="text-sm font-semibold">{formatIDR(t.target_amount)}</p>
                                        <p className="text-xs text-muted-foreground">{t.period_type} · {t.period_start} → {t.period_end}</p>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => handleDelete(t.id)} disabled={deleting === t.id}>
                                        {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No targets assigned yet.</p>
                    )}

                    {/* Add new target form */}
                    <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add New Target</p>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={form.control} name="target_amount" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Target Amount (IDR)</FormLabel>
                                            <FormControl><Input type="number" className="h-9 text-sm" {...field} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="period_type" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Period Type</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl><SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                                    <SelectItem value="yearly">Yearly</SelectItem>
                                                </SelectContent>
                                            </Select></FormItem>
                                    )} />
                                    <FormField control={form.control} name="period_start" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">Start Date</FormLabel>
                                            <FormControl><Input type="date" className="h-9 text-sm" {...field} /></FormControl></FormItem>
                                    )} />
                                    <FormField control={form.control} name="period_end" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs">End Date</FormLabel>
                                            <FormControl><Input type="date" className="h-9 text-sm" {...field} /></FormControl></FormItem>
                                    )} />
                                </div>
                                <Button type="submit" size="sm" disabled={saving} className="w-full">
                                    {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                    Add Target
                                </Button>
                            </form>
                        </Form>
                    </div>
                </div>
                <DialogFooter className="px-6 py-4 border-t shrink-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
