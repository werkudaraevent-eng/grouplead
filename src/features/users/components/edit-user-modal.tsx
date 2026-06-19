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
import { Loader2, Save, UserCog, Building2, X, Camera, UserCircle } from "lucide-react"
import { Profile } from "@/types"
import type { Role } from "@/types/company"
import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { PhoneInput } from "@/components/shared/phone-input"
import { FormFieldLabel } from "@/components/shared/form-field-label"
import { SearchableSelect } from "@/components/shared/searchable-select"

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
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
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
            setAvatarUrl(profile.avatar_url ?? null)
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
                phone: values.phone
                    ? (normalizePhoneToE164(values.phone) ?? values.phone.trim() ?? null)
                    : null,
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

            // Strict RLS check: if no rows returned, the policy blocked the update
            if (!data || data.length === 0) {
                throw new Error("Update blocked by Row Level Security. You may not have permission to edit this user.")
            }

            // Diff-based sync on company_members junction table
            const toRemove = initialCompanyIds.filter(id => !selectedCompanyIds.includes(id))
            const toAdd = selectedCompanyIds.filter(id => !initialCompanyIds.includes(id))

            // Resolve the membership user_type from the chosen role. The
            // company_members.user_type CHECK constraint only allows these.
            const VALID_USER_TYPES = ["staff", "leader", "executive", "admin", "super_admin"]
            const memberType = VALID_USER_TYPES.includes(roleText || "") ? roleText! : "staff"

            if (toRemove.length > 0) {
                const { error: delErr } = await supabase.from("company_members").delete()
                    .eq("user_id", profile.id)
                    .in("company_id", toRemove)
                if (delErr) {
                    console.error("[EditUser] Failed to remove company memberships:", delErr)
                    toast.error("Profile saved but failed to remove some business units")
                }
            }
            if (toAdd.length > 0) {
                const { error: insErr } = await supabase.from("company_members")
                    .upsert(
                        toAdd.map(cid => ({
                            company_id: cid,
                            user_id: profile.id,
                            user_type: memberType,
                        })),
                        { onConflict: "company_id,user_id" }
                    )
                if (insErr) {
                    console.error("[EditUser] Failed to add company memberships:", insErr)
                    toast.error("Profile saved but failed to assign some business units")
                }
            }

            // Re-sync user_type on memberships that were KEPT (not newly added).
            // Without this, changing a user's role leaves stale user_type rows
            // (e.g. an ex-super_admin keeps user_type='super_admin' on existing
            // companies), and the permissions context keys off user_type — so
            // the old role's access silently persists. Update every kept row.
            const toUpdate = selectedCompanyIds.filter(id => initialCompanyIds.includes(id))
            if (toUpdate.length > 0) {
                const { error: updErr } = await supabase.from("company_members")
                    .update({ user_type: memberType })
                    .eq("user_id", profile.id)
                    .in("company_id", toUpdate)
                if (updErr) {
                    console.error("[EditUser] Failed to re-sync membership roles:", updErr)
                    toast.error("Profile saved but failed to update role on existing business units")
                }
            }

            // Update initial state so subsequent saves diff correctly
            setInitialCompanyIds([...selectedCompanyIds])

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
                showCloseButton={false}
                onInteractOutside={(e) => { e.preventDefault(); handleAttemptClose() }}
                onEscapeKeyDown={(e) => { e.preventDefault(); handleAttemptClose() }}
            >
                {/* ─── Header ─────────────────────────────────────────── */}
                <SheetHeader className="px-6 py-4 border-b flex flex-row items-center justify-between space-y-0">
                    <SheetTitle className="flex items-center gap-2 text-lg">
                        <UserCog className="h-5 w-5" /> Edit User Profile
                    </SheetTitle>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 border rounded-lg px-2.5 py-1.5">
                            <span className={`text-[11px] font-medium ${isActive ? "text-emerald-600" : "text-red-500"}`}>
                                {isActive ? "Active" : "Inactive"}
                            </span>
                            <Switch
                                checked={isActive}
                                onCheckedChange={(val) => form.setValue("is_active", val, { shouldDirty: true })}
                                className="scale-90"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleAttemptClose}
                            className="rounded-md p-1.5 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                        >
                            <X className="h-4 w-4" />
                            <span className="sr-only">Close</span>
                        </button>
                    </div>
                </SheetHeader>

                {/* ─── Scrollable Body ────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto p-6">
                    <Form {...form}>
                        <form id="edit-user-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

                            {/* Section 1: User Information */}
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                                    User information
                                </h3>
                                {/* Avatar uploader — admin sets the photo for this user */}
                                <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
                                    <div className="relative group shrink-0">
                                        {avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={avatarUrl} alt={profile.full_name ?? "User"} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
                                        ) : (
                                            <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                                                <UserCircle className="h-8 w-8 text-slate-300" />
                                            </div>
                                        )}
                                        <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                            {uploadingAvatar ? (
                                                <Loader2 className="h-5 w-5 text-white animate-spin" />
                                            ) : (
                                                <Camera className="h-5 w-5 text-white" />
                                            )}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingAvatar}
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0]
                                                    if (!file || !profile) return
                                                    setUploadingAvatar(true)
                                                    const ext = file.name.split(".").pop()
                                                    const path = `avatars/${profile.id}.${ext}`
                                                    const { error: uploadErr } = await supabase.storage
                                                        .from("avatars")
                                                        .upload(path, file, { upsert: true })
                                                    if (uploadErr) {
                                                        toast.error("Upload failed: " + uploadErr.message)
                                                        setUploadingAvatar(false)
                                                        return
                                                    }
                                                    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path)
                                                    const publicUrl = urlData.publicUrl + "?t=" + Date.now()
                                                    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", profile.id)
                                                    if (updErr) {
                                                        toast.error("Could not save avatar: " + updErr.message)
                                                        setUploadingAvatar(false)
                                                        return
                                                    }
                                                    setAvatarUrl(publicUrl)
                                                    toast.success("Avatar updated")
                                                    setUploadingAvatar(false)
                                                    router.refresh()
                                                    if (e.target) e.target.value = ""
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-[14px] text-slate-800 truncate">{profile.full_name || "User"}</p>
                                        <p className="text-[12px] text-slate-500 truncate">{profile.email}</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Hover the photo to upload a new avatar</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border bg-card p-4">
                                    <FormField control={form.control} name="full_name" render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormFieldLabel required>Full name</FormFieldLabel>
                                            <FormControl><Input autoComplete="name" aria-required {...field} /></FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )} />
                                    <FormItem className="space-y-1.5">
                                        <FormFieldLabel hint="Email is tied to Auth and cannot be changed here.">Email address</FormFieldLabel>
                                        <FormControl>
                                            <Input value={profile.email || ""} disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                                        </FormControl>
                                    </FormItem>
                                    <FormField control={form.control} name="phone" render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormFieldLabel>Phone</FormFieldLabel>
                                            <FormControl>
                                                <PhoneInput
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    onBlur={field.onBlur}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={form.control} name="job_title" render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormFieldLabel>Job title</FormFieldLabel>
                                            <FormControl><Input placeholder="e.g. Sales Manager" autoComplete="organization-title" {...field} /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                            {/* Section 2: Organizational Structure */}
                            <div className="space-y-3">
                                <h3 className="text-[11px] font-semibold text-muted-foreground tracking-wide">
                                    Organizational structure
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 rounded-xl border border-border bg-card p-4">
                                    {/* System Role */}
                                    <FormField control={form.control} name="role_id" render={({ field }) => (
                                        <FormItem className="space-y-1.5">
                                            <FormFieldLabel required hint="Determines data visibility based on Role Hierarchy.">System role</FormFieldLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    value={field.value || null}
                                                    onChange={(v) => field.onChange(v ?? "")}
                                                    options={roles.map(r => ({ value: r.id, label: r.name }))}
                                                    placeholder="Select a role…"
                                                    searchPlaceholder="Search roles…"
                                                    clearable={false}
                                                />
                                            </FormControl>
                                            <FormMessage className="text-[11px]" />
                                        </FormItem>
                                    )} />

                                    {/* Accessible Business Units (Hierarchical Multi-Select) */}
                                    {(() => {
                                        const holdingCompanies = companies.filter(c => c.is_holding)
                                        const subsidiaryCompanies = companies.filter(c => !c.is_holding)
                                        const holdingIds = holdingCompanies.map(c => c.id)
                                        const allSubIds = subsidiaryCompanies.map(c => c.id)
                                        const hasHoldingSelected = holdingIds.some(id => selectedCompanyIds.includes(id))

                                        const handleHoldingToggle = (holdingId: string, checked: boolean) => {
                                            if (checked) {
                                                // Holding checked → select holding + ALL subsidiaries
                                                const allIds = [holdingId, ...allSubIds]
                                                setSelectedCompanyIds(allIds)
                                            } else {
                                                // Holding unchecked → deselect everything
                                                setSelectedCompanyIds([])
                                            }
                                            form.setValue("full_name", form.getValues("full_name"), { shouldDirty: true })
                                        }

                                        const handleSubsidiaryToggle = (companyId: string, checked: boolean) => {
                                            if (checked) {
                                                setSelectedCompanyIds(prev => [...prev, companyId])
                                            } else {
                                                setSelectedCompanyIds(prev => prev.filter(id => id !== companyId))
                                            }
                                            form.setValue("full_name", form.getValues("full_name"), { shouldDirty: true })
                                        }

                                        return (
                                            <div className="sm:col-span-2 space-y-1.5">
                                                <FormFieldLabel className="flex items-center gap-1.5">
                                                    <Building2 className="h-3.5 w-3.5" /> Accessible business units
                                                </FormFieldLabel>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Select the companies this user should have access to. This defines their data scope.
                                                </p>
                                                <div className="flex flex-col gap-3 border border-border rounded-xl p-3 bg-muted/40 max-h-72 overflow-y-auto custom-scrollbar mt-2">
                                                    {/* Group Level (HQ) — acts as "select all" */}
                                                    {holdingCompanies.length > 0 && (
                                                        <div className="flex flex-col gap-2">
                                                            <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">Group level (HQ)</span>
                                                            {holdingCompanies.map(c => {
                                                                const isChecked = selectedCompanyIds.includes(c.id)
                                                                return (
                                                                    <label
                                                                        key={c.id}
                                                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md cursor-pointer transition-all text-sm ${
                                                                            isChecked
                                                                                ? "bg-primary/10 border border-primary/20 text-primary shadow-sm"
                                                                                : "bg-background border border-transparent hover:bg-muted"
                                                                        }`}
                                                                    >
                                                                        <Checkbox
                                                                            checked={isChecked}
                                                                            onCheckedChange={(checked) => handleHoldingToggle(c.id, !!checked)}
                                                                            className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                                        />
                                                                        <span className="font-semibold">{c.name}</span>
                                                                        <span className="text-[10px] text-muted-foreground ml-auto">Access all units</span>
                                                                    </label>
                                                                )
                                                            })}
                                                        </div>
                                                    )}
                                                    {/* Divider */}
                                                    {holdingCompanies.length > 0 && subsidiaryCompanies.length > 0 && (
                                                        <div className="w-full h-px bg-border" />
                                                    )}
                                                    {/* Subsidiary Units — disabled when holding is selected */}
                                                    {subsidiaryCompanies.length > 0 && (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-semibold text-muted-foreground tracking-wide">Subsidiary units</span>
                                                                {hasHoldingSelected && (
                                                                    <span className="text-[10px] text-primary/80 font-medium">All included via group</span>
                                                                )}
                                                            </div>
                                                            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${hasHoldingSelected ? "opacity-50 pointer-events-none" : ""}`}>
                                                                {subsidiaryCompanies.map(c => {
                                                                    const isChecked = selectedCompanyIds.includes(c.id)
                                                                    return (
                                                                        <label
                                                                            key={c.id}
                                                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-md transition-all text-sm ${
                                                                                hasHoldingSelected
                                                                                    ? "bg-primary/5 border border-primary/10 text-primary/90"
                                                                                    : isChecked
                                                                                        ? "bg-primary/10 border border-primary/20 text-primary shadow-sm cursor-pointer"
                                                                                        : "bg-background border border-transparent hover:bg-muted cursor-pointer"
                                                                            }`}
                                                                        >
                                                                            <Checkbox
                                                                                checked={isChecked || hasHoldingSelected}
                                                                                disabled={hasHoldingSelected}
                                                                                onCheckedChange={(checked) => handleSubsidiaryToggle(c.id, !!checked)}
                                                                                className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary disabled:opacity-60"
                                                                            />
                                                                            <span className="truncate font-medium">{c.name}</span>
                                                                        </label>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedCompanyIds.length > 0 && (
                                                    <p className="text-[11px] text-muted-foreground mt-1.5">
                                                        {hasHoldingSelected
                                                            ? "Full group access (all business units)"
                                                            : `${selectedCompanyIds.length} compan${selectedCompanyIds.length === 1 ? 'y' : 'ies'} assigned`
                                                        }
                                                    </p>
                                                )}
                                            </div>
                                        )
                                    })()}

                                    {/* Direct Manager */}
                                    <FormField control={form.control} name="reports_to" render={({ field }) => (
                                        <FormItem className="sm:col-span-2 space-y-1.5">
                                            <FormFieldLabel hint="Used for approval workflows and quota rollups.">Direct manager (reports to)</FormFieldLabel>
                                            <FormControl>
                                                <SearchableSelect
                                                    value={field.value ?? null}
                                                    onChange={(v) => field.onChange(v)}
                                                    options={managers.map(m => ({ value: m.id, label: m.full_name || "Unnamed user" }))}
                                                    placeholder="None (top level)"
                                                    searchPlaceholder="Search…"
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>

                        </form>
                    </Form>
                </div>

                {/* ─── Footer ─────────────────────────────────────────── */}
                <div className="px-6 py-3.5 border-t border-border bg-card flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted-foreground hidden sm:block">
                        <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Esc</kbd>
                        <span className="mx-1">to cancel</span>
                    </p>
                    <div className="flex items-center gap-2 ml-auto">
                        <Button type="button" variant="ghost" onClick={handleAttemptClose}>Cancel</Button>
                        <Button type="submit" form="edit-user-form" disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                            {saving ? "Saving…" : "Save changes"}
                        </Button>
                    </div>
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
