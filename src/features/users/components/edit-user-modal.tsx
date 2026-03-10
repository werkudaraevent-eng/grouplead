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
import { Loader2, Save } from "lucide-react"
import { Profile } from "@/types"
import { ProfileCombobox } from "@/features/users/components/profile-comboboxrofile-combobox"

const schema = z.object({
    role_tier: z.coerce.number().min(1).max(5),
    business_unit: z.string().nullable().optional(),
    reports_to: z.string().nullable().optional(),
})
type FormValues = z.infer<typeof schema>

const TIER_OPTIONS = [
    { value: "1", label: "1 — Staff / Sales" },
    { value: "2", label: "2 — Team Lead" },
    { value: "3", label: "3 — Manager" },
    { value: "4", label: "4 — Director" },
    { value: "5", label: "5 — VP / Executive" },
]
const BU_OPTIONS = ["WNW", "WNS", "UK", "TEP", "CREATIVE"]

interface EditUserModalProps {
    profile: Profile | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved?: () => void
}

export function EditUserModal({ profile, open, onOpenChange, onSaved }: EditUserModalProps) {
    const [saving, setSaving] = useState(false)
    const supabase = createClient()
    const router = useRouter()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({ resolver: zodResolver(schema) as any, defaultValues: { role_tier: 1 } })

    useEffect(() => {
        if (profile && open) {
            form.reset({
                role_tier: profile.role_tier ?? 1,
                business_unit: profile.business_unit,
                reports_to: profile.reports_to,
            })
        }
    }, [profile, open, form])

    const onSubmit = async (values: FormValues) => {
        if (!profile) return
        setSaving(true)
        const { error } = await supabase.from("profiles").update({
            role_tier: values.role_tier,
            business_unit: values.business_unit || null,
            reports_to: values.reports_to || null,
        }).eq("id", profile.id)

        if (error) { toast.error(`Error: ${error.message}`) }
        else { toast.success("Org structure updated"); onOpenChange(false); onSaved?.(); router.refresh() }
        setSaving(false)
    }

    if (!profile) return null

    const watchedTier = form.watch("role_tier")

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Edit Org Structure</DialogTitle>
                    <DialogDescription>{profile.full_name} — {profile.email}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <FormField control={form.control} name="role_tier" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role Tier</FormLabel>
                                <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {TIER_OPTIONS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="business_unit" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Business Unit</FormLabel>
                                <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select BU" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">— None —</SelectItem>
                                        {BU_OPTIONS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="reports_to" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reports To</FormLabel>
                                <FormControl>
                                    <ProfileCombobox
                                        value={field.value ?? null}
                                        onChange={(id) => field.onChange(id)}
                                        filterTierBelow={watchedTier}
                                        placeholder="Select manager..."
                                    />
                                </FormControl>
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={saving}>
                                {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
