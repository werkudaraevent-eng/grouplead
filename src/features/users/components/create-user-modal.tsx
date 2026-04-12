"use client"

import { useEffect, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { provisionUserAction } from "@/app/actions/user-actions"
import { createClient } from "@/utils/supabase/client"
import type { UserType } from "@/types/company"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, UserPlus, Building2 } from "lucide-react"

/* ─── Schema (department OBLITERATED) ───────────────────────────────────── */
const schema = z.object({
    email: z.string().email("Valid email required"),
    password: z.string().min(6, "Minimum 6 characters"),
    full_name: z.string().min(1, "Name is required"),
    role: z.string().min(1, "Role is required"),
})
type FormValues = z.infer<typeof schema>

/** Canonical role labels — matches the UserType enum used across RBAC */
const ROLE_LABEL_MAP: Record<UserType, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    executive: "Executive",
    leader: "Leader",
    staff: "Staff",
}

interface CompanyOption { id: string; name: string; is_holding: boolean }

interface CreateUserModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated?: () => void
}

export function CreateUserModal({ open, onOpenChange, onCreated }: CreateUserModalProps) {
    const [isPending, startTransition] = useTransition()
    const [companies, setCompanies] = useState<CompanyOption[]>([])
    const [availableRoles, setAvailableRoles] = useState<{ id: string; slug: string; label: string }[]>([])
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
    const router = useRouter()

    useEffect(() => {
        if (!open) return
        const supabase = createClient()

        // Fetch companies with hierarchy flag
        supabase.from("companies").select("id, name, is_holding").order("name").then(({ data }) => {
            setCompanies((data as CompanyOption[]) ?? [])
        })

        // Fetch available roles from the roles table (source of truth)
        supabase
            .from("roles")
            .select("id, name, sort_order")
            .order("sort_order", { ascending: true })
            .then(({ data, error }) => {
                if (error || !data) {
                    // Fallback: use the canonical UserType list (id doubles as slug for legacy)
                    setAvailableRoles(
                        Object.entries(ROLE_LABEL_MAP).map(([slug, label]) => ({ id: slug, slug, label }))
                    )
                    return
                }
                setAvailableRoles(
                    data.map((r) => ({
                        id: r.id,
                        slug: r.name.toLowerCase().replace(/\s+/g, "_"),
                        label: r.name,
                    }))
                )
            })
    }, [open])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            email: "",
            password: "",
            full_name: "",
            role: "",
        },
    })

    const onSubmit = (values: FormValues) => {
        startTransition(async () => {
            try {
                // Derive primary company name for legacy backward compat
                const primaryCompanyName = selectedCompanyIds.length > 0
                    ? companies.find(c => c.id === selectedCompanyIds[0])?.name || null
                    : null

                // Resolve the selected role: values.role is the UUID from the Select
                const selectedRoleObj = availableRoles.find(r => r.id === values.role)
                const roleSlug = selectedRoleObj?.slug ?? values.role
                const roleUuid = selectedRoleObj?.id ?? null

                const result = await provisionUserAction({
                    email: values.email,
                    password: values.password,
                    full_name: values.full_name,
                    role: roleSlug,
                    role_id: roleUuid,
                    department: null,
                    business_unit: primaryCompanyName,
                })
                if (!result.success) throw new Error(result.error)

                // Insert ALL company memberships into junction table
                if (selectedCompanyIds.length > 0 && result.userId) {
                    const supabase = createClient()
                    await supabase.from("company_members").insert(
                        selectedCompanyIds.map(cid => ({
                            company_id: cid,
                            user_id: result.userId!,
                            user_type: roleSlug || "staff",
                        }))
                    )
                }

                toast.success(`User "${values.full_name}" created successfully`)
                form.reset()
                setSelectedCompanyIds([])
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
                        <FormField control={form.control} name="role" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Role</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder="Select a role..." />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {availableRoles.map((r) => (
                                            <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )} />

                        {/* ═══════════════════════════════════════════════════════
                            MATRIX CHECKBOX GROUP: Accessible Business Units
                            Source of Truth: company_members junction table
                        ═══════════════════════════════════════════════════════ */}
                        {(() => {
                            const holdingCompanies = companies.filter(c => c.is_holding)
                            const subsidiaryCompanies = companies.filter(c => !c.is_holding)
                            const renderCheckbox = (c: CompanyOption) => {
                                const isChecked = selectedCompanyIds.includes(c.id)
                                return (
                                    <label
                                        key={c.id}
                                        className={`flex items-center gap-2 px-2.5 py-2 rounded-md cursor-pointer transition-all text-sm ${
                                            isChecked
                                                ? "bg-blue-50 border border-blue-200 text-blue-900 shadow-sm"
                                                : "bg-background border border-transparent hover:bg-muted"
                                        }`}
                                    >
                                        <Checkbox
                                            checked={isChecked}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedCompanyIds(prev => [...prev, c.id])
                                                } else {
                                                    setSelectedCompanyIds(prev => prev.filter(id => id !== c.id))
                                                }
                                            }}
                                            className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                        />
                                        <span className="truncate text-xs font-medium">{c.name}</span>
                                    </label>
                                )
                            }
                            return (
                                <div>
                                    <FormLabel className="flex items-center gap-1.5 mb-1.5">
                                        <Building2 className="h-3.5 w-3.5" /> Accessible Business Units
                                    </FormLabel>
                                    <p className="text-[0.7rem] text-muted-foreground mb-2">
                                        Select the companies this user will have access to. This defines their data scope.
                                    </p>
                                    <div className="flex flex-col gap-3 border rounded-xl p-3 bg-slate-50/50 max-h-52 overflow-y-auto">
                                        {/* Group Level (HQ) */}
                                        {holdingCompanies.length > 0 && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Group Level (HQ)</span>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {holdingCompanies.map(renderCheckbox)}
                                                </div>
                                            </div>
                                        )}
                                        {/* Divider */}
                                        {holdingCompanies.length > 0 && subsidiaryCompanies.length > 0 && (
                                            <div className="w-full h-px bg-border" />
                                        )}
                                        {/* Subsidiary Units */}
                                        {subsidiaryCompanies.length > 0 && (
                                            <div className="flex flex-col gap-1.5">
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subsidiary Units</span>
                                                <div className="grid grid-cols-2 gap-1.5">
                                                    {subsidiaryCompanies.map(renderCheckbox)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {selectedCompanyIds.length > 0 && (
                                        <p className="text-[0.7rem] text-muted-foreground mt-1">
                                            {selectedCompanyIds.length} compan{selectedCompanyIds.length === 1 ? 'y' : 'ies'} selected
                                        </p>
                                    )}
                                </div>
                            )
                        })()}
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
