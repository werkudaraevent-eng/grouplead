"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard, KanbanSquare, Building2, Users,
    LogOut, ChevronLeft, Settings, Loader2, Moon, Sun,
    Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "@/components/layout/company-switcher"
import { usePermissions } from "@/contexts/permissions-context"
import { useSidebarTheme } from "@/contexts/sidebar-theme-context"
import { createClient } from "@/utils/supabase/client"

interface SidebarProps {
    onCollapse?: () => void
    isSheet?: boolean
}

const mainNav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, module: null },
    { href: "/leads", label: "Pipeline", icon: KanbanSquare, module: "leads" },
    // Tasks page hidden for now — checklist lives inside Lead Detail
    // { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList, module: "lead_tasks" },
    { href: "/companies", label: "Companies", icon: Building2, module: "companies" },
    { href: "/contacts", label: "Contacts", icon: Users, module: "contacts" },
]

const adminNav = [
    { href: "/settings", label: "Settings", icon: Settings },
]

const goalAdminNav = [
    { href: "/settings/goals", label: "Goal Settings", icon: Target, module: "goal_settings" },
]

interface UserProfile {
    full_name: string | null
    role: string | null
    avatar_url: string | null
}

export function Sidebar({ onCollapse, isSheet = false }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loggingOut, setLoggingOut] = useState(false)
    const { can, loading: permsLoading } = usePermissions()
    const { isDarkPanel, togglePanel } = useSidebarTheme()

    useEffect(() => {
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
    }, [])

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

    // While permissions are loading, show ALL nav items (with skeleton state)
    // to prevent the flash of restricted state on every page load.
    const visibleMainNav = permsLoading
        ? mainNav // Show all items during loading
        : mainNav.filter(item => {
            switch (item.label) {
                case 'Dashboard':  return true
                case 'Pipeline':   return can('leads', 'read')
                case 'Tasks':      return can('lead_tasks', 'read')
                case 'Companies':  return can('companies', 'read')
                case 'Contacts':   return can('contacts', 'read')
                default:           return false // Fail closed
            }
        })

    // Admin section visible if user can read users OR master_options
    const showAdminNav = permsLoading || can('users', 'read') || can('master_options', 'read')

    // Goals admin visible if user can manage goal settings
    const showGoalAdmin = permsLoading || can('goal_settings', 'read')

    const visibleGoalAdminNav = permsLoading
        ? goalAdminNav
        : goalAdminNav.filter(item => can(item.module, 'read'))

    // Theme-aware colors
    const menuItemClasses = (isActive: boolean) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            isActive
                ? isDarkPanel
                    ? "bg-white/10 text-white shadow-sm"
                    : "bg-primary/10 text-primary shadow-sm"
                : isDarkPanel
                    ? "text-slate-400 hover:text-white hover:bg-white/8"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
        }`

    const iconClasses = (isActive: boolean) =>
        `h-4.5 w-4.5 shrink-0 ${
            isActive
                ? isDarkPanel ? "text-blue-400" : "text-primary"
                : isDarkPanel ? "text-slate-500" : "text-slate-500"
        }`

    const sectionLabel = isDarkPanel
        ? "px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500"
        : "px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-600"

    return (
        <div
            className={`flex flex-col h-full transition-colors duration-300 ${isDarkPanel ? 'text-slate-400' : 'bg-sidebar text-sidebar-foreground'}`}
            style={isDarkPanel ? { backgroundColor: '#1a1f2e' } : undefined}
        >
            <div className={`flex items-center justify-between h-16 px-5 border-b shrink-0 ${isDarkPanel ? 'border-white/8' : 'border-sidebar-border'}`}>
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkPanel ? 'bg-blue-600' : 'bg-primary'}`}>
                        <span className="text-white font-bold text-sm">W</span>
                    </div>
                    <div className="flex flex-col">
                        <span className={`font-bold text-sm tracking-tight leading-none ${isDarkPanel ? 'text-white' : ''}`}>Werkudara</span>
                        <span className={`text-[10px] font-medium tracking-wider uppercase ${isDarkPanel ? 'text-slate-500' : 'text-sidebar-foreground/50'}`}>Group Lead</span>
                    </div>
                </Link>
                {isSheet && onCollapse && (
                    <Button variant="ghost" size="icon" onClick={onCollapse} className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            <div className="px-3 py-2">
                <CompanySwitcher isDark={isDarkPanel} />
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className={sectionLabel}>Menu</p>
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
                        <p className={sectionLabel}>Administration</p>
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
                        {showGoalAdmin && visibleGoalAdminNav.map((item) => {
                            const isActive = pathname === item.href || (item.href !== "/settings/goals" && pathname.startsWith(item.href))
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

            <div className={`border-t px-3 py-3 shrink-0 space-y-2 ${isDarkPanel ? 'border-white/8' : 'border-sidebar-border'}`}>
                {/* Dark/Light Panel Toggle */}
                <button
                    onClick={togglePanel}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                        isDarkPanel
                            ? "text-slate-400 hover:text-white hover:bg-white/8"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    }`}
                >
                    {isDarkPanel ? (
                        <Sun className="h-3.5 w-3.5" />
                    ) : (
                        <Moon className="h-3.5 w-3.5" />
                    )}
                    <span>{isDarkPanel ? "Switch to Light Panel" : "Switch to Dark Panel"}</span>
                </button>

                {/* User Profile */}
                <div className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-colors ${
                    isDarkPanel ? 'hover:bg-white/5' : 'hover:bg-sidebar-accent/50'
                }`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                        isDarkPanel
                            ? 'bg-slate-700 text-slate-300'
                            : 'bg-sidebar-accent text-sidebar-accent-foreground'
                    }`}>
                        {getInitials(profile?.full_name ?? null)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate leading-tight ${isDarkPanel ? 'text-white' : ''}`}>{profile?.full_name || "Loading..."}</p>
                        <p className={`text-[11px] truncate ${isDarkPanel ? 'text-slate-500' : 'text-sidebar-foreground/50'}`}>{getRoleLabel(profile?.role ?? null)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className={`h-8 w-8 shrink-0 ${
                        isDarkPanel
                            ? 'text-slate-600 hover:text-white hover:bg-white/10'
                            : 'text-sidebar-foreground/30 hover:text-sidebar-foreground'
                    }`} onClick={handleLogout} disabled={loggingOut}>
                        {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </Button>
                </div>
            </div>
        </div>
    )
}
