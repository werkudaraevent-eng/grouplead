"use client"

import { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Loader2, Save, UserCircle, KeyRound, Shield, Mail } from "lucide-react"

/* ─── Schemas ────────────────────────────────────────────────────────────── */
const profileSchema = z.object({
    full_name: z.string().min(1, "Name is required"),
    phone: z.string().optional().or(z.literal("")),
    job_title: z.string().optional().or(z.literal("")),
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
    const [loading, setLoading] = useState(true)
    const [savingProfile, setSavingProfile] = useState(false)
    const [savingPassword, setSavingPassword] = useState(false)
    const [email, setEmail] = useState("")
    const [roleName, setRoleName] = useState("")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileForm = useForm<ProfileValues>({
        resolver: zodResolver(profileSchema) as any,
        defaultValues: { full_name: "", phone: "", job_title: "" },
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

            const { data: profile } = await supabase
                .from("profiles")
                .select("full_name, phone, job_title, role, assigned_role:roles(name)")
                .eq("id", user.id)
                .single()

            if (profile) {
                profileForm.reset({
                    full_name: profile.full_name ?? "",
                    phone: profile.phone ?? "",
                    job_title: profile.job_title ?? "",
                })
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const ar = (profile as any).assigned_role
                setRoleName(ar?.name || profile.role || "Unknown")
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
            phone: values.phone?.trim() || null,
            job_title: values.job_title?.trim() || null,
        }).eq("id", user.id)

        if (error) toast.error(error.message)
        else toast.success("Profile updated")
        setSavingProfile(false)
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
        <div className="p-6 lg:p-8 max-w-2xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <UserCircle className="h-6 w-6 text-primary" /> My Profile
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Manage your personal information and security settings.
                </p>
            </div>

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
                                        <FormControl><Input placeholder="+62 812 1234 5678" {...field} /></FormControl>
                                    </FormItem>
                                )} />
                                <FormField control={profileForm.control} name="job_title" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Job Title</FormLabel>
                                        <FormControl><Input placeholder="e.g. Sales Manager" {...field} /></FormControl>
                                    </FormItem>
                                )} />
                            </div>
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
    )
}
