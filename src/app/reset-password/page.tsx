"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, CheckCircle2, KeyRound } from "lucide-react"

export default function ResetPasswordPage() {
    const router = useRouter()
    const supabase = createClient()

    const [verifying, setVerifying] = useState(true)
    const [validSession, setValidSession] = useState(false)
    const [password, setPassword] = useState("")
    const [confirm, setConfirm] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [done, setDone] = useState(false)

    // Establish the recovery session from the email link. The @supabase/ssr
    // browser client uses the PKCE flow, so the link arrives with a `?code=`
    // query param that must be exchanged for a session before we can update
    // the password.
    useEffect(() => {
        let active = true

        const establish = async () => {
            const params = new URLSearchParams(window.location.search)
            const code = params.get("code")
            const errDesc = params.get("error_description")

            if (errDesc) {
                if (active) { setError(errDesc); setVerifying(false) }
                return
            }

            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (!active) return
                if (error) {
                    setError("This reset link is invalid or has expired. Please request a new one.")
                    setVerifying(false)
                    return
                }
                // Clean the code out of the URL.
                window.history.replaceState({}, "", "/reset-password")
                setValidSession(true)
                setVerifying(false)
                return
            }

            // No code in URL — maybe a recovery session already exists.
            const { data } = await supabase.auth.getSession()
            if (!active) return
            if (data.session) {
                setValidSession(true)
            } else {
                setError("This reset link is invalid or has expired. Please request a new one.")
            }
            setVerifying(false)
        }

        establish()
        return () => { active = false }
    }, [supabase])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (password.length < 8) {
            setError("Password must be at least 8 characters")
            return
        }
        if (password !== confirm) {
            setError("Passwords do not match")
            return
        }

        setSaving(true)
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
            setError(error.message)
            setSaving(false)
            return
        }

        setDone(true)
        setSaving(false)
        // Sign out the recovery session so the user logs in fresh, then send
        // them to the login page after a short beat.
        await supabase.auth.signOut()
        setTimeout(() => router.push("/login"), 2500)
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-muted/30 px-6 py-12">
            <div className="w-full max-w-[400px] space-y-8">
                {/* Logo */}
                <div className="flex items-center gap-3 justify-center">
                    <div className="w-9 h-9 rounded-lg bg-[#02378D] flex items-center justify-center">
                        <span className="text-white font-bold text-base">W</span>
                    </div>
                    <span className="text-foreground font-semibold text-base tracking-tight">Werkudara Group</span>
                </div>

                <div className="bg-white rounded-2xl border border-border/60 shadow-sm p-8 space-y-6">
                    {verifying ? (
                        <div className="flex flex-col items-center gap-3 py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
                            <p className="text-sm text-muted-foreground">Verifying your reset link...</p>
                        </div>
                    ) : done ? (
                        <div className="space-y-5 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground tracking-tight">Password updated</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Your password has been changed. Redirecting you to sign in...
                                </p>
                            </div>
                        </div>
                    ) : !validSession ? (
                        <div className="space-y-5 text-center">
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground tracking-tight">Link expired</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {error || "This reset link is invalid or has expired."}
                                </p>
                            </div>
                            <Link
                                href="/forgot-password"
                                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#02378D] hover:text-[#02378D]/80 transition-colors"
                            >
                                Request a new link
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <div className="w-10 h-10 rounded-lg bg-[#02378D]/10 flex items-center justify-center mb-2">
                                    <KeyRound className="h-5 w-5 text-[#02378D]" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground tracking-tight">Set a new password</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Choose a strong password you haven&apos;t used before.
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {error && (
                                    <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                                        <svg className="h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4.75a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0v-3zM8 11a1 1 0 100 2 1 1 0 000-2z" />
                                        </svg>
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <Label htmlFor="new-password" className="text-sm font-medium text-foreground">
                                        New password
                                    </Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        placeholder="Minimum 8 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className="h-11 bg-muted/40 border-border/60 focus:bg-white transition-colors"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                                        Confirm password
                                    </Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        placeholder="Re-enter your new password"
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        required
                                        autoComplete="new-password"
                                        className="h-11 bg-muted/40 border-border/60 focus:bg-white transition-colors"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-11 text-[15px] font-medium bg-[#02378D] hover:bg-[#02378D]/90 transition-all duration-200 shadow-lg shadow-[#02378D]/20"
                                    disabled={saving || !password || !confirm}
                                >
                                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {saving ? "Updating..." : "Update password"}
                                </Button>
                            </form>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="h-4 w-4" /> Back to sign in
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
