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
    Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BusinessUnitPicker } from "./business-unit-picker"
import { Loader2, UserPlus, Building2 } from "@/components/icons"

/* ─── Schema (department OBLITERATED) ───────────────────────────────────── */
const schema = z
    .object({
        email: z.string().email("Valid email required"),
        full_name: z.string().min(1, "Name is required"),
        role: z.string().min(1, "Role is required"),
        /** "invite" emails a link; "password" has the admin set one directly. */
        method: z.enum(["invite", "password"]),
        password: z.string().optional().or(z.literal("")),
    })
    .superRefine((value, ctx) => {
        // Eight to match the reset-password screen and adminResetUserPassword,
        // so one account cannot have two different minimums.
        if (value.method === "password" && (value.password ?? "").length < 8) {
            ctx.addIssue({
                code: "custom",
                path: ["password"],
                message: "Minimum 8 characters",
            })
        }
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
            full_name: "",
            role: "",
            method: "invite" as const,
            password: "",
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

                // Membership is created by the same server action, in the same
                // pass. Doing it here left accounts with no business unit
                // whenever the second call failed.
                const result = await provisionUserAction({
                    email: values.email,
                    full_name: values.full_name,
                    role: roleSlug,
                    role_id: roleUuid,
                    department: null,
                    business_unit: primaryCompanyName,
                    companyIds: selectedCompanyIds,
                    password: values.method === "password" ? values.password : null,
                })
                if (!result.success) throw new Error(result.error)

                toast.success(
                    values.method === "password"
                        ? `Akun "${values.full_name}" dibuat dengan password yang Anda tetapkan`
                        : `Undangan dikirim ke ${values.email}`
                )
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
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                    <DialogDescription>Choose how this person gets in: an emailed invite they answer themselves, or a password you set for them.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    {/* The form is a flex column so the body can shrink and scroll while
                        the footer stays put; the dialog itself never grows past the screen. */}
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col gap-4">
                      <DialogBody className="space-y-4">
                        <FormField control={form.control} name="full_name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Full Name</FormLabel>
                                <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />

                        <FormField control={form.control} name="method" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Cara masuk pertama kali</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger className="bg-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="invite">Kirim undangan lewat email</SelectItem>
                                        <SelectItem value="password">Tetapkan password sekarang</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs leading-relaxed text-muted-foreground">
                                    {field.value === "password"
                                        ? "Anda akan mengetahui password orang ini. Minta dia menggantinya setelah masuk; pembuatannya tercatat di audit log."
                                        : "Password dibuat sendiri oleh yang bersangkutan, jadi tidak ada orang lain yang mengetahuinya."}
                                </p>
                                <FormMessage />
                            </FormItem>
                        )} />
                        {form.watch("method") === "password" && (
                            <FormField control={form.control} name="password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Password</FormLabel>
                                    <FormControl>
                                        <Input type="password" autoComplete="new-password" placeholder="Min. 8 karakter" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        )}
                        <FormField control={form.control} name="email" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl><Input type="email" placeholder="user@company.com" {...field} /></FormControl>
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

                        <div className="space-y-2">
                            <FormLabel className="flex items-center gap-1.5">
                                <Building2 className="h-4 w-4" /> Unit bisnis yang bisa diakses
                            </FormLabel>
                            <p className="text-xs leading-relaxed text-muted-foreground">Menentukan data mana yang bisa dilihat orang ini.</p>
                            <BusinessUnitPicker companies={companies} value={selectedCompanyIds} onChange={setSelectedCompanyIds} />
                        </div>
                      </DialogBody>
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
