"use client"

import { useEffect, useState, useCallback } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Save, UserCog, Building2 } from "lucide-react"
import { Profile } from "@/types"
import type { Role } from "@/types/company"

/* ─── Schema ─────────────────────────────────────────────────────────────── */
const schema = z.object({
    full_name: z.string().min(1, "Name is required"),
    phone: z.string().optional().or(z.literal("")),
    job_title: z.string().optional().or(z.literal("")),
    role_id: z.string().min(1, "Role is required"),
    reports_to: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
})
type FormValues = z.infer<typeof schema>

interface CompanyOption { id: string; name: string; is_holding: boolean }
interface ManagerOption { id: string; full_name: string | null }

interface EditUserSheetProps {
    profile: Profile | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved?: () => void
}

export function EditUserSheet({ profile, open, onOpenChange, onSaved }: EditUserSheetProps) {
    const [saving, setSaving] = useState(false)
    const [showWarning, setShowWarning] = useState(false)
    const [companies, setCompanies] = useState<CompanyOption[]>([])
    const [roles, setRoles] = useState<Role[]>([])
    const [managers, setManagers] = useState<ManagerOption[]>([])
    const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
    const [initialCompanyIds, setInitialCompanyIds] = useState<string[]>([])
    const supabase = createClient()
    const router = useRouter()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const form = useForm<FormValues>({
        resolver: zodResolver(schema) as any,
        defaultValues: {
            full_name: "", phone: "", job_title: "",
            role_id: "", reports_to: null, is_active: true,
        },
    })

    /* ─── Load reference data on open ────────────────────────────────────── */
    useEffect(() => {
        if (!open || !profile) return
        supabase.from("companies").select("id, name, is_holding").order("name").then(({ data }) => {
            setCompanies((data as CompanyOption[]) ?? [])
        })
        supabase.from("roles").select("*").order("sort_order", { ascending: true }).then(({ data }) => {
            setRoles((data as Role[]) ?? [])
        })
        supabase.from("profiles").select("id, full_name").order("full_name").then(({ data }) => {
            setManagers(((data as ManagerOption[]) ?? []).filter((u) => u.id !== profile.id))
        })
    }, [open, profile?.id])

    /* ─── Populate form ──────────────────────────────────────────────────── */
    useEffect(() => {
        if (profile && open) {
            // Fetch ALL company memberships for this user
            supabase
                .from("company_members")
                .select("company_id")
                .eq("user_id", profile.id)
                .then(({ data }) => {
                    const ids = (data ?? []).map(d => d.company_id)
                    setSelectedCompanyIds(ids)
                    setInitialCompanyIds(ids)
                })
            form.reset({
                full_name: profile.full_name ?? "",
                phone: profile.phone ?? "",
                job_title: profile.job_title ?? "",
                role_id: profile.role_id ?? "",
                reports_to: profile.reports_to,
                is_active: profile.is_active ?? true,
            })
        }
    }, [profile, open, form])

    /* ─── Submit ─────────────────────────────────────────────────────────── */
    const onSubmit = async (values: FormValues) => {
        if (!profile) return
        setSaving(true)

        try {
            // Derive legacy text role for backward compat
            const selectedRole = roles.find((r) => r.id === values.role_id)
            const roleText = selectedRole ? selectedRole.name.toLowerCase().replace(/\s+/g, "_") : profile.role

            // Build legacy business_unit from first selected company
            const primaryCompanyName = selectedCompanyIds.length > 0
                ? companies.find(c => c.id === selectedCompanyIds[0])?.name || null
                : null

            const { data, error } = await supabase.from("profiles").update({
                full_name: values.full_name.trim(),
                phone: values.phone?.trim() || null,
                job_title: values.job_title?.trim() || null,
                role_id: values.role_id,
                role: roleText,
                business_unit: primaryCompanyName,
                reports_to: values.reports_to || null,
                is_active: values.is_active,
            })
            .eq("id", profile.id)
            .select()

            if (error) throw error

            // Diff-based sync on company_members junction table
            const toRemove = initialCompanyIds.filter(id => !selectedCompanyIds.includes(id))
            const toAdd = selectedCompanyIds.filter(id => !initialCompanyIds.includes(id))

            if (toRemove.length > 0) {
                await supabase.from("company_members").delete()
                    .eq("user_id", profile.id)
                    .in("company_id", toRemove)
            }
            if (toAdd.length > 0) {
                await supabase.from("company_members").insert(
                    toAdd.map(cid => ({
                        company_id: cid,
                        user_id: profile.id,
                        user_type: roleText || "staff",
                    }))
                )
            }

            // Strict RLS check: if no rows returned, the policy blocked the update
            if (!data || data.length === 0) {
                throw new Error("Update blocked by Row Level Security. You may not have permission to edit this user.")
            }

            toast.success(values.is_active ? "Profile updated successfully" : "User deactivated & profile updated")
            form.reset()
            onOpenChange(false)
            // Trigger parent refetch which includes the self-join for manager name
            onSaved?.()
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update user."
            console.error("[Mutation Error]:", err)
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    /* ─── Discard Interceptor ─────────────────────────────────────────────── */
    const handleAttemptClose = () => {
        const hasRealChanges = Object.keys(form.formState.dirtyFields).length > 0
        if (hasRealChanges) {
            setShowWarning(true)
        } else {
            form.reset()
            onOpenChange(false)
        }
    }

    const handleForceDiscard = () => {
        setShowWarning(false)
        form.reset()
        onOpenChange(false)
    }

    if (!profile) return null

    const isActive = form.watch("is_active")

    return (
        <>
        <Sheet open={open} onOpenChange={(val) => { if (!val) handleAttemptClose(); else onOpenChange(val) }}>
            <SheetContent
                className="w-full sm:max-w-2xl p-0 flex flex-col"
                side="right"
                onInteractOutside={(e) => { e.preventDefault(); handleAttemptClose() }}
                onEscapeKeyDown={(e) => { e.preventDefault(); handleAttemptClose() }}
            >
                {/* ─── Header ─────────────────────────────────────────── */}
                <SheetHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
                    <SheetTitle className="flex items-center gap-2 text-lg">
                        <UserCog className="h-5 w-5" /> Edit User Profile
                    </SheetTitle>
                    <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${isActive ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                            {isActive ? "Active" : "Inactive"}
                        </span>
                        <Switch
                            checked={isActive}
                            onCheckedChange={(val) => form.setValue("is_active", val, { shouldDirty: true })}
                        />
                    </div>
                </SheetHeader>

                {/* ─── Scrollable Body ────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6">
                    <Form {...form}>
                        <form id="edit-user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                            {/* Section 1: User Information */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                                    User Information
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="full_name" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name</FormLabel>
                                            <FormControl><Input {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <Input value={profile.email || ""} disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                                        </FormControl>
                                        <p className="text-[0.75rem] text-muted-foreground">
                                            Email is tied to Auth and cannot be changed here.
                                        </p>
                                    </FormItem>
                                    <FormField control={form.control} name="phone" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone</FormLabel>
                                            <FormControl><Input placeholder="+62 812 1234 5678" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="job_title" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Job Title</FormLabel>
                                            <FormControl><Input placeholder="e.g. Sales Manager" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            {/* Section 2: Organizational Structure */}
                            <div className="space-y-4">
                                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-2">
                                    Organizational Structure
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* System Role */}
                                    <FormField control={form.control} name="role_id" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>System Role</FormLabel>
                                            <Select key={profile.id} onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a role..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {roles.map((r) => (
                                                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[0.75rem] text-muted-foreground">
                                                Determines data visibility based on Role Hierarchy.
                                            </p>
                                        </FormItem>
                                    )} />

                                    {/* Accessible Business Units (Hierarchical Multi-Select) */}
                                    {(() => {
                                        const holdingCompanies = companies.filter(c => c.is_holding)
                                        const subsidiaryCompanies = companies.filter(c => !c.is_holding)
                                        const renderCheckbox = (c: CompanyOption) => {
                                            const isChecked = selectedCompanyIds.includes(c.id)
                                            return (
                                                <label
                                                    key={c.id}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer transition-all text-sm ${
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
                                                            form.setValue("full_name", form.getValues("full_name"), { shouldDirty: true })
                                                        }}
                                                        className="h-4 w-4 border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                    />
                                                    <span className="truncate font-medium">{c.name}</span>
                                                </label>
                                            )
                                        }
                                        return (
                                            <div className="sm:col-span-2">
                                                <FormLabel className="flex items-center gap-1.5 mb-2">
                                                    <Building2 className="h-3.5 w-3.5" /> Accessible Business Units
                                                </FormLabel>
                                                <p className="text-[0.7rem] text-muted-foreground mb-3">
                                                    Select the companies this user should have access to. This defines their data scope.
                                                </p>
                                                <div className="flex flex-col gap-3 border rounded-xl p-3 bg-slate-50/50 max-h-56 overflow-y-auto">
                                                    {/* Group Level (HQ) */}
                                                    {holdingCompanies.length > 0 && (
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Group Level (HQ)</span>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Subsidiary Units</span>
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                                {subsidiaryCompanies.map(renderCheckbox)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedCompanyIds.length > 0 && (
                                                    <p className="text-[0.7rem] text-muted-foreground mt-1.5">
                                                        {selectedCompanyIds.length} compan{selectedCompanyIds.length === 1 ? 'y' : 'ies'} assigned
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })()}

                                    {/* Direct Manager */}
                                    <FormField control={form.control} name="reports_to" render={({ field }) => (
                                        <FormItem className="sm:col-span-2">
                                            <FormLabel>Direct Manager (Reports To)</FormLabel>
                                            <Select
                                                key={profile.id + "-mgr"}
                                                onValueChange={(v) => field.onChange(v === "none" ? null : v)}
                                                defaultValue={field.value || "none"}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Assign a manager..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="none">— None (Top Level) —</SelectItem>
                                                    {managers.map((m) => (
                                                        <SelectItem key={m.id} value={m.id}>{m.full_name || "Unnamed User"}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[0.75rem] text-muted-foreground">
                                                Used for approval workflows and quota rollups.
                                            </p>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                        </form>
                    </Form>
                </div>

                {/* ─── Footer ─────────────────────────────────────────── */}
                <div className="px-6 py-4 border-t flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={handleAttemptClose}>Cancel</Button>
                    <Button type="submit" form="edit-user-form" disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                        Save Changes
                    </Button>
                </div>
            </SheetContent>
        </Sheet>

        {/* Discard Warning — rendered OUTSIDE Sheet to prevent z-index / unmount conflicts */}
        <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have modified this user&apos;s profile. Closing this panel will discard all unsaved data.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setShowWarning(false)}>Continue Editing</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={handleForceDiscard}
                    >
                        Discard
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}
