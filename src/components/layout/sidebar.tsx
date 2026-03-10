"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard,
    KanbanSquare,
    Building2,
    Users,
    ClipboardList,
    ShieldCheck,
    LogOut,
    ChevronLeft,
    Settings,
    Loader2,
    GitBranchPlus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { CompanySwitcher } from "@/components/layout/company-switcher"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { createClient } from "@/utils/supabase/client"

interface SidebarProps {
    onCollapse?: () => void
    isSheet?: boolean
}

const mainNav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, description: "Overview & metrics" },
    { href: "/leads", label: "Pipeline", icon: KanbanSquare, description: "Kanban & leads" },
    { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList, description: "Department tasks" },
    { href: "/companies", label: "Companies", icon: Building2, description: "Client directory" },
    { href: "/contacts", label: "Contacts", icon: Users, description: "Contact persons" },
]

const adminNav = [
    { href: "/settings/pipeline", label: "Pipeline Settings", icon: GitBranchPlus, description: "Manage stages" },
    { href: "/settings/companies", label: "Company Management", icon: Building2, description: "Manage companies" },
    { href: "/settings/users", label: "User Management", icon: ShieldCheck, description: "Roles & access" },
    { href: "/settings", label: "Settings", icon: Settings, description: "System preferences" },
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
            super_admin: "Super Admin",
            director: "Director",
            bu_manager: "BU Manager",
            sales: "Sales",
            finance: "Finance",
        }
        return role ? labels[role] || role : "User"
    }

    return (
        <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-5 border-b border-sidebar-border shrink-0">
                <Link href="/" className="flex items-center gap-2.5 group">
                    <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground font-bold text-sm">W</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-bold text-sm tracking-tight leading-none">Werkudara</span>
                        <span className="text-[10px] text-sidebar-foreground/50 font-medium tracking-wider uppercase">Group Lead</span>
                    </div>
                </Link>
                {isSheet && onCollapse && (
                    <Button variant="ghost" size="icon" onClick={onCollapse} className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* Company Switcher */}
            <div className="px-3 py-2 border-b border-sidebar-border">
                <CompanySwitcher />
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                    Menu
                </p>
                {mainNav.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={isSheet ? onCollapse : undefined}
                            className={`
                                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                                ${isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                    : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                }
                            `}
                        >
                            <item.icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
                            <span>{item.label}</span>
                        </Link>
                    )
                })}

                {/* Divider */}
                <div className="!my-4 border-t border-sidebar-border" />

                <PermissionGate resource="companies" action="read">
                    <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/40">
                        Administration
                    </p>
                    {adminNav.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={isSheet ? onCollapse : undefined}
                                className={`
                                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150
                                    ${isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                        : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                                    }
                                `}
                            >
                                <item.icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-sidebar-primary' : ''}`} />
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </PermissionGate>
            </nav>

            {/* Footer: User Profile */}
            <div className="border-t border-sidebar-border px-3 py-3 shrink-0">
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                    <div className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-sidebar-accent-foreground shrink-0">
                        {getInitials(profile?.full_name ?? null)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight">
                            {profile?.full_name || "Loading..."}
                        </p>
                        <p className="text-[11px] text-sidebar-foreground/50 truncate">
                            {getRoleLabel(profile?.role ?? null)}
                        </p>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-sidebar-foreground/30 hover:text-sidebar-foreground shrink-0"
                        onClick={handleLogout}
                        disabled={loggingOut}
                    >
                        {loggingOut ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <LogOut className="h-4 w-4" />
                        )}
                    </Button>
                </div>
            </div>
        </div>
    )
}
