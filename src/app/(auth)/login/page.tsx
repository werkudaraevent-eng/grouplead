"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, ArrowRight, BarChart3, Users, Target, TrendingUp, Eye, EyeOff } from "lucide-react"
import { ACTIVE_SESSION_STORAGE_KEY, newSessionId } from "@/lib/session-guard"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const errorCode = new URLSearchParams(window.location.search).get("error")
        if (errorCode === "access_not_provisioned") {
            setError("Your Microsoft account is not provisioned for LeadEngine. Ask an administrator to add your user and business-unit access.")
        } else if (errorCode === "auth_callback_failed") {
            setError("Microsoft sign-in could not be completed. Try again or contact an administrator.")
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        setLoading(true)

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        } else {
            // Single active session: mint a fresh session id, persist it on the
            // profile and in this browser. Any older session will detect the
            // mismatch and sign itself out ("last login wins").
            //
            // Use the user from the sign-in response directly — calling
            // getUser() here would add a redundant round-trip to the auth
            // server and slow the login down.
            const user = data.user
            if (user) {
                const sessionId = newSessionId()
                localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, sessionId)
                // Await the DB write so the SessionGuard on the dashboard reads
                // a consistent active_session_id (a stale read would otherwise
                // mismatch our local id and sign the user straight back out).
                try {
                    await supabase.from("profiles").update({ active_session_id: sessionId }).eq("id", user.id)
                } catch {
                    // Non-fatal — login still proceeds even if the stamp fails.
                }
            }
            router.push("/")
            router.refresh()
        }
    }

    const handleMicrosoftLogin = async () => {
        setError(null)
        setLoading(true)

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "azure",
            options: {
                // `profile` requests Entra's standard display-name claims.
                // `email` alone can leave Supabase metadata without a name.
                scopes: "openid profile email",
                redirectTo: `${window.location.origin}/auth/callback`,
            },
        })

        if (error) {
            setError(error.message)
            setLoading(false)
        }
    }

    return (
        <div className="h-screen flex overflow-hidden">
            {/* Left Panel — Branding & Visual */}
            <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#02378D]">
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#02378D] via-[#0247b3] to-[#013a91]" />

                {/* Subtle grid pattern */}
                <div
                    className="absolute inset-0 opacity-[0.04]"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />

                {/* Floating orbs */}
                <div className="absolute top-20 left-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-32 right-16 w-96 h-96 bg-[#F9BB46]/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-[#C3E6F5]/10 rounded-full blur-2xl" />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-between p-8 xl:p-12 w-full h-full">
                    {/* Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                            <span className="text-white font-bold text-base">W</span>
                        </div>
                        <span className="text-white/90 font-semibold text-base tracking-tight">Werkudara Group</span>
                    </div>

                    {/* Hero text */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h1 className="text-3xl xl:text-4xl font-bold text-white leading-tight tracking-tight">
                                Drive revenue.<br />
                                Close faster.<br />
                                <span className="text-[#F9BB46]">Win together.</span>
                            </h1>
                            <p className="text-white/60 text-base max-w-sm leading-relaxed">
                                The unified CRM platform powering Werkudara Group&apos;s sales engine across all business units.
                            </p>
                        </div>

                        {/* Feature pills */}
                        <div className="grid grid-cols-2 gap-2.5 max-w-sm">
                            <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2.5">
                                <BarChart3 className="h-3.5 w-3.5 text-[#F9BB46]" />
                                <span className="text-white/80 text-xs font-medium">Pipeline Analytics</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2.5">
                                <Users className="h-3.5 w-3.5 text-[#C3E6F5]" />
                                <span className="text-white/80 text-xs font-medium">Team Goals</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2.5">
                                <Target className="h-3.5 w-3.5 text-[#F9BB46]" />
                                <span className="text-white/80 text-xs font-medium">Lead Scoring</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/[0.07] backdrop-blur-sm border border-white/10 rounded-lg px-3 py-2.5">
                                <TrendingUp className="h-3.5 w-3.5 text-[#C3E6F5]" />
                                <span className="text-white/80 text-xs font-medium">Revenue Tracking</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom stats */}
                    <div className="flex items-center gap-6">
                        <div>
                            <div className="text-xl font-bold text-white">5+</div>
                            <div className="text-white/50 text-xs">Business Units</div>
                        </div>
                        <div className="w-px h-8 bg-white/20" />
                        <div>
                            <div className="text-xl font-bold text-white">100%</div>
                            <div className="text-white/50 text-xs">Data Unified</div>
                        </div>
                        <div className="w-px h-8 bg-white/20" />
                        <div>
                            <div className="text-xl font-bold text-white">Real-time</div>
                            <div className="text-white/50 text-xs">Insights</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel — Login Form */}
            <div className="flex-1 flex items-center justify-center px-6 sm:px-12 lg:px-16 bg-white">
                <div className="w-full max-w-[380px] space-y-8">
                    {/* Mobile logo */}
                    <div className="lg:hidden flex items-center gap-3 mb-4">
                        <div className="w-9 h-9 rounded-lg bg-[#02378D] flex items-center justify-center">
                            <span className="text-white font-bold text-base">W</span>
                        </div>
                        <span className="text-foreground font-semibold text-base tracking-tight">Werkudara Group</span>
                    </div>

                    {/* Header */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-semibold text-foreground tracking-tight">
                            Welcome back
                        </h2>
                        <p className="text-muted-foreground text-[15px]">
                            Enter your credentials to access LeadEngine
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="space-y-5">
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

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password" className="text-sm font-medium text-foreground">
                                    Password
                                </Label>
                                <Link
                                    href="/forgot-password"
                                    className="text-xs font-medium text-[#02378D] hover:text-[#02378D]/80 transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="h-11 bg-muted/40 border-border/60 focus:bg-white transition-colors pr-11"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    title={showPassword ? "Hide password" : "Show password"}
                                    tabIndex={-1}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-[15px] font-medium bg-[#02378D] hover:bg-[#02378D]/90 transition-all duration-200 shadow-lg shadow-[#02378D]/20 hover:shadow-xl hover:shadow-[#02378D]/30"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            {loading ? "Signing in..." : "Sign in"}
                            {!loading && <ArrowRight className="h-4 w-4 ml-2" />}
                        </Button>

                        <div className="relative py-1">
                            <div className="absolute inset-0 flex items-center" aria-hidden="true">
                                <div className="w-full border-t border-border/60" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-white px-3 text-xs text-muted-foreground">or</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            className="w-full h-11 text-[15px] font-medium"
                            disabled={loading}
                            onClick={handleMicrosoftLogin}
                        >
                            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                                <path fill="#f35325" d="M1 1h10.5v10.5H1z" />
                                <path fill="#81bc06" d="M12.5 1H23v10.5H12.5z" />
                                <path fill="#05a6f0" d="M1 12.5h10.5V23H1z" />
                                <path fill="#ffba08" d="M12.5 12.5H23V23H12.5z" />
                            </svg>
                            Continue with Microsoft
                        </Button>
                    </form>

                    {/* Footer */}
                    <div className="pt-4 border-t border-border/40">
                        <p className="text-xs text-muted-foreground text-center">
                            Protected by enterprise-grade security.
                            <br />
                            <span className="text-muted-foreground/70">© {new Date().getFullYear()} Werkudara Group. All rights reserved.</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
