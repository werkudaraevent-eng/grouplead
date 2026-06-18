"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowLeft, MailCheck, KeyRound } from "lucide-react"

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)
    const supabase = createClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })

        // Always show the success state regardless of whether the email exists.
        // Revealing which emails are registered would be an enumeration risk.
        if (error && !/rate limit|too many/i.test(error.message)) {
            setError(error.message)
            setLoading(false)
            return
        }

        setSent(true)
        setLoading(false)
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
                    {sent ? (
                        <div className="space-y-5 text-center">
                            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                                <MailCheck className="h-6 w-6 text-emerald-600" />
                            </div>
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground tracking-tight">Check your email</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    If an account exists for <span className="font-medium text-foreground">{email}</span>,
                                    we&apos;ve sent a link to reset your password. The link expires in 1 hour.
                                </p>
                            </div>
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-[#02378D] hover:text-[#02378D]/80 transition-colors"
                            >
                                <ArrowLeft className="h-4 w-4" /> Back to sign in
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <div className="w-10 h-10 rounded-lg bg-[#02378D]/10 flex items-center justify-center mb-2">
                                    <KeyRound className="h-5 w-5 text-[#02378D]" />
                                </div>
                                <h2 className="text-xl font-semibold text-foreground tracking-tight">Forgot your password?</h2>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Enter the email linked to your account and we&apos;ll send you a link to reset it.
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
                                    <Label htmlFor="email" className="text-sm font-medium text-foreground">
                                        Email address
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="name@werkudara.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        autoComplete="email"
                                        className="h-11 bg-muted/40 border-border/60 focus:bg-white transition-colors"
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full h-11 text-[15px] font-medium bg-[#02378D] hover:bg-[#02378D]/90 transition-all duration-200 shadow-lg shadow-[#02378D]/20"
                                    disabled={loading || !email}
                                >
                                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {loading ? "Sending link..." : "Send reset link"}
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
