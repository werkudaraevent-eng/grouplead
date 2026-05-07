"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard, KanbanSquare, Building2, Users,
    LogOut, ChevronLeft, Settings, Loader2, Moon, Sun, History,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "@/components/layout/company-switcher"
import { usePermissions } from "@/contexts/permissions-context"
import { useSidebarTheme } from "@/contexts/sidebar-theme-context"
import { createClient } from "@/utils/supabase/client"

interface SidebarProps {
    onCollapse?: () => void
    isSheet?: boolean
    serverProfile?: { full_name: string | null; role: string | null; avatar_url: string | null } | null
}

const mainNav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, module: null },
    { href: "/leads", label: "Pipeline", icon: KanbanSquare, module: "leads" },
    { href: "/companies", label: "Companies", icon: Building2, module: "companies" },
    { href: "/contacts", label: "Contacts", icon: Users, module: "contacts" },
    { href: "/history", label: "History", icon: History, module: null },
]

const adminNav = [
    { href: "/settings", label: "Settings", icon: Settings },
]

interface UserProfile {
    full_name: string | null
    role: string | null
    avatar_url: string | null
}

export function Sidebar({ onCollapse, isSheet = false, serverProfile = null }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    // Use server-provided profile to avoid redundant client-side fetch
    const [profile, setProfile] = useState<UserProfile | null>(serverProfile)
    const [loggingOut, setLoggingOut] = useState(false)
    const { can, loading: permsLoading } = usePermissions()
    const { isDarkPanel, togglePanel } = useSidebarTheme()

    // Only fetch client-side if server didn't provide profile (fallback)
    useEffect(() => {
        if (serverProfile) { setProfile(serverProfile); return }
        const supabase = createClient()
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data } = await supabase
                .from("profiles")
                .select("full_name, role, avatar_url")
                .eq("id", user.id)
                .single()
            if (data) setProfile(data)
        }
        fetchProfile()
    }, [serverProfile])

    const handleLogout = async () => {
        setLoggingOut(true)
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push("/login")
        router.refresh()
    }

    const getInitials = (name: string | null) => {
        if (!name) return "?"
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }

    const getRoleLabel = (role: string | null) => {
        const labels: Record<string, string> = {
            super_admin: "Super Admin", director: "Director", bu_manager: "BU Manager", sales: "Sales", finance: "Finance",
        }
        return role ? labels[role] || role : "User"
    }

    const visibleMainNav = permsLoading
        ? mainNav
        : mainNav.filter(item => {
            switch (item.label) {
                case 'Dashboard':  return true
                case 'Pipeline':   return can('leads', 'read')
                case 'Tasks':      return can('lead_tasks', 'read')
                case 'Companies':  return can('companies', 'read')
                case 'Contacts':   return can('contacts', 'read')
                default:           return false
            }
        })

    const showAdminNav = permsLoading || can('users', 'read') || can('master_options', 'read')

    const menuItemClasses = (isActive: boolean) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
        }`

    const iconClasses = (isActive: boolean) =>
        `h-4.5 w-4.5 shrink-0 ${
            isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"
        }`

    return (
        <div className="flex flex-col h-full transition-colors duration-300 bg-sidebar text-sidebar-foreground">
            <div className="flex items-center justify-between h-16 px-5 border-b shrink-0 border-sidebar-border">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-white font-bold text-sm">W</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight leading-none text-sidebar-accent-foreground">Werkudara</span>
                        <span className="text-[10px] font-medium tracking-wider uppercase text-sidebar-foreground/50">Group Lead</span>
                    </div>
                </Link>
                {isSheet && onCollapse && (
                    <Button variant="ghost" size="icon" onClick={onCollapse} className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground" aria-label="Close sidebar">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="px-3 py-2">
                <CompanySwitcher />
            </div>

            <nav aria-label="Main navigation" className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Menu</p>
                {visibleMainNav.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={isSheet ? onCollapse : undefined}
                            className={menuItemClasses(isActive)}
                        >
                            <item.icon className={iconClasses(isActive)} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}

                {showAdminNav && (
                    <>
                        <div className="!my-4" />
                        <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Administration</p>
                        {adminNav.map((item) => {
                            const isActive = pathname.startsWith(item.href)
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={isSheet ? onCollapse : undefined}
                                    className={menuItemClasses(isActive)}
                                >
                                    <item.icon className={iconClasses(isActive)} />
                                    <span>{item.label}</span>
                                </Link>
                            )
                        })}

                    </>
                )}
            </nav>

            <div className="border-t px-3 py-3 shrink-0 space-y-2 border-sidebar-border">
                <button
                    onClick={togglePanel}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                >
                    {isDarkPanel ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    <span>{isDarkPanel ? "Switch to Light Panel" : "Switch to Dark Panel"}</span>
                </button>

                <div className="flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-sidebar-accent/50">
                    <Link href="/settings/profile" onClick={isSheet ? onCollapse : undefined} className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center text-sm font-bold shrink-0">
                            {getInitials(profile?.full_name ?? null)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate leading-tight text-sidebar-accent-foreground">{profile?.full_name || "Loading..."}</p>
                            <p className="text-[11px] truncate text-sidebar-foreground/50">{getRoleLabel(profile?.role ?? null)}</p>
                        </div>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-sidebar-foreground/30 hover:text-sidebar-foreground hover:bg-sidebar-accent" onClick={handleLogout} disabled={loggingOut} aria-label="Sign out">
                        {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
