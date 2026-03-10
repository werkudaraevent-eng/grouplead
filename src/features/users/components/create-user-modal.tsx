"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { provisionUserAction } from "@/app/actions/user-actions"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Loader2, UserPlus } from "lucide-react"

const schema = z.object({
    email: z.string().email("Valid email required"),
    password: z.string().min(6, "Minimum 6 characters"),
    full_name: z.string().min(1, "Name is required"),
    role: z.string().min(1),
    department: z.string().nullable().optional(),
    role_tier: z.coerce.number().min(1).max(5),
    business_unit: z.string().nullable().optional(),
})
type FormValues = z.infer<typeof schema>

const ROLES = [
    { value: "super_admin", label: "Super Admin" },
    { value: "director", label: "Director" },
    { value: "bu_manager", label: "BU Manager" },
    { value: "sales", label: "Sales" },
    { value: "finance", label: "Finance" },
]
const TIER_OPTIONS = [
    { value: "1", label: "1 — Staff" },
    { value: "2", label: "2 — Team Lead" },
    { value: "3", label: "3 — Manager" },
    { value: "4", label: "4 — Director" },
    { value: "5", label: "5 — VP / Executive" },
]
const DEPARTMENTS = ["WNW", "WNS", "UK", "TEP", "CREATIVE", "FINANCE", "LEGAL", "PD", "SO", "ACS"]
const BU_OPTIONS = ["WNW", "WNS", "UK", "TEP", "CREATIVE"]

interface CreateUserModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: () => void
}

export function CreateUserModal({ open, onOpenChange, onCreated }: CreateUserModalProps) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            email: "",
            password: "",
            full_name: "",
            role: "sales",
            department: null,
            role_tier: 1,
            business_unit: null,
        },
    })

    const onSubmit = (values: FormValues) => {
        startTransition(async () => {
            try {
                const result = await provisionUserAction({
                    email: values.email,
                    password: values.password,
                    full_name: values.full_name,
                    role: values.role,
                    department: values.department || null,
                    role_tier: values.role_tier,
                    business_unit: values.business_unit || null,
                })
                if (!result.success) throw new Error(result.error)
                toast.success(`User "${values.full_name}" created successfully`)
                form.reset()
                onOpenChange(false)
                onCreated?.()
                router.refresh()
            } catch (err) {
                toast.error(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`)
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Provision a new account with email and password. No email confirmation required.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
                        <FormField control={form.control} name="full_name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input type="email" placeholder="user@company.com" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="password" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Password</FormLabel>
                                <FormControl><Input type="password" placeholder="Min. 6 characters" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="role" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select value={field.value} onValueChange={field.onChange}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {ROLES.map((r) => (<SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="role_tier" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tier</FormLabel>
                                    <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {TIER_OPTIONS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="department" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Department</FormLabel>
                                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">— None —</SelectItem>
                                            {DEPARTMENTS.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="business_unit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Business Unit</FormLabel>
                                    <Select value={field.value || "none"} onValueChange={(v) => field.onChange(v === "none" ? null : v)}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">— None —</SelectItem>
                                            {BU_OPTIONS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </FormItem>
                            )} />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UserPlus className="h-4 w-4 mr-1.5" />}
                                Create User
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
