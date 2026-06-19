"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Save, UserCircle, KeyRound, Shield, Mail, Camera, Settings2 } from "lucide-react"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { PhoneInput } from "@/components/shared/phone-input"
import { normalizePhoneToE164 } from "@/lib/phone-normalize"
import { Switch } from "@/components/ui/switch"

/* ─── Schemas ────────────────────────────────────────────────────────────── */
const profileSchema = z.object({
    full_name: z.string().min(1, "Name is required"),
    phone: z.string().optional().or(z.literal("")),
    job_title: z.string().optional().or(z.literal("")),
    bio: z.string().optional().or(z.literal("")),
})
type ProfileValues = z.infer<typeof profileSchema>

const passwordSchema = z.object({
    new_password: z.string().min(8, "Minimum 8 characters"),
    confirm_password: z.string().min(8, "Minimum 8 characters"),
}).refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
})
type PasswordValues = z.infer<typeof passwordSchema>

export default function MyProfilePage() {
    const supabase = createClient()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [email, setEmail] = useState("")
    const [roleName, setRoleName] = useState("")
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
    const [userId, setUserId] = useState<string>("")
    const [autoFillPicSales, setAutoFillPicSales] = useState<boolean>(true)
    const [savingPreferences, setSavingPreferences] = useState(false)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileForm = useForm<ProfileValues>({
        resolver: zodResolver(profileSchema) as any,
        defaultValues: { full_name: "", phone: "", job_title: "", bio: "" },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const passwordForm = useForm<PasswordValues>({
        resolver: zodResolver(passwordSchema) as any,
        defaultValues: { new_password: "", confirm_password: "" },
    })

    /* ─── Load current user data ─────────────────────────────────────────── */
    useEffect(() => {
        const loadProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            setEmail(user.email || "")
            setUserId(user.id)

            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, phone, job_title, bio, avatar_url, role, ui_preferences, assigned_role:roles(name)")
                .eq("id", user.id)
                .single()

            if (profile) {
                profileForm.reset({
                    full_name: profile.full_name ?? "",
                    phone: profile.phone ?? "",
                    job_title: profile.job_title ?? "",
                    bio: profile.bio ?? "",
                })
                setAvatarUrl(profile.avatar_url)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ar = (profile as any).assigned_role
                setRoleName(ar?.name || profile.role || "Unknown")
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const prefs = (typeof (profile as any).ui_preferences === "object" && (profile as any).ui_preferences) ? (profile as any).ui_preferences : {}
                if (typeof prefs.auto_fill_pic_sales === "boolean") {
                    setAutoFillPicSales(prefs.auto_fill_pic_sales)
                }
            }
            setLoading(false)
        }
        loadProfile()
    }, [])

    /* ─── Save Profile ───────────────────────────────────────────────────── */
    const onProfileSubmit = async (values: ProfileValues) => {
        setSavingProfile(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { toast.error("Not authenticated"); setSavingProfile(false); return }

        const { error } = await supabase.from("profiles").update({
            full_name: values.full_name.trim(),
            phone: values.phone
                ? (normalizePhoneToE164(values.phone) ?? values.phone.trim() ?? null)
                : null,
            job_title: values.job_title?.trim() || null,
            bio: values.bio?.trim() || null,
        }).eq("id", user.id)

        if (error) toast.error(error.message)
        else toast.success("Profile updated")
        setSavingProfile(false)
    }

    /* ─── Save Preferences ───────────────────────────────────────────────── */
    const updateAutoFillPic = async (next: boolean) => {
        setAutoFillPicSales(next)
        setSavingPreferences(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            toast.error("Not authenticated")
            setSavingPreferences(false)
            return
        }
        const { data: profile } = await supabase
            .from("profiles")
            .select("ui_preferences")
            .eq("id", user.id)
            .single()
        const current = (typeof profile?.ui_preferences === "object" && profile?.ui_preferences) ? profile.ui_preferences : {}
        const { error } = await supabase
            .from("profiles")
            .update({ ui_preferences: { ...current, auto_fill_pic_sales: next } })
            .eq("id", user.id)
        if (error) {
            toast.error(error.message)
            setAutoFillPicSales(!next)
        }
        setSavingPreferences(false)
    }

    /* ─── Change Password (Self) ─────────────────────────────────────────── */
    const onPasswordSubmit = async (values: PasswordValues) => {
        setSavingPassword(true)
        const { error } = await supabase.auth.updateUser({
            password: values.new_password,
        })
        if (error) toast.error(error.message)
        else {
            toast.success("Password updated successfully")
            passwordForm.reset()
        }
        setSavingPassword(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <SettingsPageHeader
                title="Profile Settings"
                subtitle="Manage your personal information and security settings."
                breadcrumbs={[{ label: "Profile" }]}
            />

            <div className="px-6 lg:px-8 pb-6 max-w-3xl space-y-6">
            {/* ─── Avatar ────────────────────────────────────────────────── */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center gap-5">
                        <div className="relative group">
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    alt="Profile"
                                    className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                                />
                            ) : (
                                <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center">
                                    <UserCircle className="h-10 w-10 text-slate-300" />
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
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file || !userId) return
                                        setUploadingAvatar(true)
                                        const ext = file.name.split(".").pop()
                                        const path = `avatars/${userId}.${ext}`
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
                                        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId)
                                        setAvatarUrl(publicUrl)
                                        toast.success("Avatar updated")
                                        setUploadingAvatar(false)
                                        // Refresh server components (e.g. sidebar) so the new
                                        // avatar shows everywhere without a manual reload.
                                        router.refresh()
                                    }}
                                />
                            </label>
                        </div>
                        <div>
                            <p className="font-semibold text-[14px] text-slate-800">{profileForm.watch("full_name") || "Your Name"}</p>
                            <p className="text-[12px] text-slate-500">{email}</p>
                            <p className="text-[11px] text-slate-400 mt-1">Click photo to upload new avatar</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ─── Read-only System Info ─────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Account Information</CardTitle>
                    <CardDescription>These fields are managed by the system.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3.5 w-3.5" /> Email
                        </Label>
                        <Input value={email} disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="flex items-center gap-1.5 text-muted-foreground">
                            <Shield className="h-3.5 w-3.5" /> System Role
                        </Label>
                        <Input value={roleName} disabled className="bg-muted/50 text-muted-foreground cursor-not-allowed" />
                    </div>
                </CardContent>
            </Card>

            {/* ─── Editable Profile ──────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Personal Information</CardTitle>
                    <CardDescription>Update your display name and contact details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...profileForm}>
                        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                            <FormField control={profileForm.control} name="full_name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={profileForm.control} name="phone" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <PhoneInput
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                onBlur={field.onBlur}
                                                placeholder="+62 812 1234 5678"
                                            />
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={profileForm.control} name="job_title" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Job Title</FormLabel>
                                        <FormControl><Input placeholder="e.g. Sales Manager" {...field} /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
                            <FormField control={profileForm.control} name="bio" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bio</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="A short description about yourself..."
                                            className="resize-none h-20"
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )} />
                            <div className="flex justify-end">
                                <Button type="submit" disabled={savingProfile}>
                                    {savingProfile ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                                    Save Profile
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* ─── Preferences ───────────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Settings2 className="h-4 w-4" /> Preferences
                    </CardTitle>
                    <CardDescription>Personal defaults applied to forms and lists across the app.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-start justify-between gap-6 rounded-lg border border-slate-200 bg-card px-4 py-3">
                        <div className="min-w-0">
                            <p className="text-[13px] font-medium text-slate-800">Auto-fill PIC sales when creating a lead</p>
                            <p className="text-[12px] text-muted-foreground mt-0.5">
                                Pre-fills the PIC sales field with your account when you open the new lead form. You can still change it before saving.
                            </p>
                        </div>
                        <Switch
                            checked={autoFillPicSales}
                            onCheckedChange={updateAutoFillPic}
                            disabled={savingPreferences}
                            aria-label="Toggle auto-fill PIC sales"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* ─── Change Password ───────────────────────────────────────── */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <KeyRound className="h-4 w-4" /> Change Password
                    </CardTitle>
                    <CardDescription>Update your login credentials. You&apos;ll stay logged in after the change.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...passwordForm}>
                        <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                            <FormField control={passwordForm.control} name="new_password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>New Password</FormLabel>
                                    <FormControl><Input type="password" placeholder="Minimum 8 characters" autoComplete="new-password" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={passwordForm.control} name="confirm_password" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Confirm Password</FormLabel>
                                    <FormControl><Input type="password" placeholder="Re-enter your new password" autoComplete="new-password" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <div className="flex justify-end">
                                <Button type="submit" disabled={savingPassword}>
                                    {savingPassword ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1.5" />}
                                    Update Password
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            </div>
        </div>
    )
}
