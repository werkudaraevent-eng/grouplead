"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    LayoutDashboard, KanbanSquare, Building2, Users,
    LogOut, ChevronLeft, ChevronsLeft, Settings, Loader2, Moon, Sun, ScrollText, MoreVertical, UserCircle,
} from "@/components/icons"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CompanySwitcherHeader } from "@/components/layout/company-switcher"
import dynamic from "next/dynamic"

/**
 * Client-only for the same reason as its twin in Sales Mission: the switcher's
 * Radix popover calls useId, and any SSR bail-out or Suspense boundary elsewhere
 * in this layout shifts the useId tree path, leaving the trigger with one
 * aria-controls on the server and another on hydration.
 *
 * TopLoader was the trigger here and is already loaded client-only, so this is
 * defence rather than a live fix: the next Suspense boundary added to this
 * layout would otherwise bring the error straight back.
 */
const AppSwitcher = dynamic(
  () => import("@/components/layout/app-switcher").then((m) => m.AppSwitcher),
  { ssr: false }
)
import { usePermissions } from "@/contexts/permissions-context"
import { useSidebarTheme } from "@/contexts/sidebar-theme-context"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"

interface SidebarProps {
    onCollapse?: () => void
    isSheet?: boolean
    collapsed?: boolean
    onToggleCollapse?: () => void
    serverProfile?: { full_name: string | null; role: string | null; avatar_url: string | null } | null
}

const mainNav = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard, module: null },
    { href: "/leads", label: "Pipeline", icon: KanbanSquare, module: "leads" },
    { href: "/companies", label: "Companies", icon: Building2, module: "companies" },
    { href: "/contacts", label: "Contacts", icon: Users, module: "contacts" },
]

// Administration is administration. Supporting pages (the changelog, the
// profile), the panel toggle and sign-out live behind the account menu at
// the foot of the drawer, the same pattern as Sales Activity: Material's
// drawer holds destinations, and Slack, Notion and Linear keep help and
// release notes off the rail.
const adminNav = [
    { href: "/settings", label: "Settings", icon: Settings },
]

/** Menu rows on the panel's own tokens: hover/focus as a tonal state layer, icons in the panel's muted ink. */
const ACCOUNT_MENU_ITEMS =
    "[&_[role=menuitem]]:text-sidebar-accent-foreground [&_[role=menuitem]]:focus:bg-sidebar-accent [&_[role=menuitem]]:focus:text-sidebar-accent-foreground [&_[role=menuitem]_svg:not([class*='text-'])]:text-sidebar-foreground"

interface UserProfile {
    full_name: string | null
    role: string | null
    avatar_url: string | null
}

export function Sidebar({ onCollapse, isSheet = false, collapsed = false, onToggleCollapse, serverProfile = null }: SidebarProps) {
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
        // Clear the shared session id too — leaving it behind would make the
        // sibling app compare against an id this browser no longer owns.
        clearActiveSessionId()
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
        ? []
        : mainNav.filter(item => {
            switch (item.label) {
                case 'Dashboard':  return can('dashboard', 'read')
                case 'Pipeline':   return can('leads', 'read')
                case 'Companies':  return can('companies', 'read')
                case 'Contacts':   return can('contacts', 'read')
                default:           return false
            }
        })

    // Settings hub visibility is controlled by settings.read.
    // Section-level access is handled inside /settings via module permissions.
    const showAdminNav = !permsLoading && can('settings', 'read')

    const menuItemClasses = (isActive: boolean) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
            isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
        }`

    const iconClasses = (isActive: boolean) =>
        `h-4.5 w-4.5 shrink-0 ${
            isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"
        }`

    return (
        <div className="group/sidebar flex flex-col h-full transition-colors duration-300 bg-sidebar text-sidebar-foreground relative">
            <div className={`relative min-h-14 shrink-0 border-b border-sidebar-border ${collapsed ? "flex flex-col items-center gap-2 px-2 py-2" : "flex items-center gap-2 py-2 pl-3 pr-0"}`}>
                {/* Header: Logo + Company Switcher integrated (Notion/Linear style) */}
                {!collapsed ? (
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <CompanySwitcherHeader />
                    </div>
                ) : (
                    <Link href="/" className="flex items-center justify-center transition-opacity duration-150 group-hover/sidebar:opacity-0">
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                            <span className="text-white font-bold text-sm">W</span>
                        </div>
                    </Link>
                )}
                <div className={`flex shrink-0 items-center justify-center ${collapsed ? "flex-col gap-2" : ""}`}>
                    <AppSwitcher collapsed={collapsed} />
                </div>
                {/* Collapse button — appears on sidebar hover */}
                {/* Expand button — replaces logo on hover when collapsed */}
                {onToggleCollapse && !isSheet && collapsed && (
                    <button
                        onClick={onToggleCollapse}
                        className="absolute inset-x-0 top-0 h-14 flex items-center justify-center transition-opacity duration-150 text-sidebar-foreground/70 hover:text-sidebar-foreground opacity-0 group-hover/sidebar:opacity-100"
                        title="Expand sidebar"
                    >
                        <ChevronsLeft className="h-[18px] w-[18px] rotate-180" />
                    </button>
                )}
                {isSheet && onCollapse && (
                    <Button variant="ghost" size="icon" onClick={onCollapse} className="h-8 w-8 text-sidebar-foreground/50 hover:text-sidebar-foreground" aria-label="Close sidebar">
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
                {!collapsed && onToggleCollapse && !isSheet && (
                    <button
                        onClick={onToggleCollapse}
                        className="-mr-px flex h-14 w-8 shrink-0 items-center justify-center rounded-l-lg text-sidebar-foreground/50 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        title="Collapse sidebar"
                    >
                        <ChevronsLeft className="h-[16px] w-[16px]" />
                    </button>
                )}
            </div>

            <nav aria-label="Main navigation" className={`flex-1 py-4 space-y-1 overflow-y-auto sidebar-scrollbar ${collapsed ? "px-1.5" : "px-3"}`}>
                {!collapsed && <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Menu</p>}
                {permsLoading ? (
                    // Skeleton placeholders — prevents FOUC of unauthorized nav items
                    <>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className={collapsed
                                    ? "h-9 w-9 mx-auto rounded-lg bg-sidebar-accent/40 animate-pulse"
                                    : "h-9 rounded-lg bg-sidebar-accent/40 animate-pulse"
                                }
                            />
                        ))}
                    </>
                ) : (
                    visibleMainNav.map((item) => {
                    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={isSheet ? onCollapse : undefined}
                            className={collapsed ? `flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}` : menuItemClasses(isActive)}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon className={iconClasses(isActive)} />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    )
                    })
                )}

                {showAdminNav && (
                    <>
                        <div className="!my-4" />
                        {!collapsed && <p className="px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Administration</p>}
                        {adminNav.map((item) => {
                            const isActive = pathname.startsWith(item.href)
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={isSheet ? onCollapse : undefined}
                                    className={collapsed ? `flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}` : menuItemClasses(isActive)}
                                    title={collapsed ? item.label : undefined}
                                >
                                    <item.icon className={iconClasses(isActive)} />
                                    {!collapsed && <span>{item.label}</span>}
                                </Link>
                            )
                        })}
                    </>
                )}
            </nav>

            <div className={`border-t py-3 shrink-0 space-y-2 border-sidebar-border ${collapsed ? "px-1.5" : "px-3"}`}>
                {/* The account menu: who you are, your profile, the changelog, the
                    panel, and the way out. One trigger, one menu on the panel's own
                    tokens; focus does not jump back on close, so a mouse user never
                    gets a focus ring for nothing. */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        {!collapsed ? (
                            <button
                                type="button"
                                aria-label="Account menu"
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:bg-sidebar-accent data-[state=open]:bg-sidebar-accent"
                            >
                                <span className="w-9 h-9 rounded-full bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                                {profile?.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} className="w-full h-full object-cover" />
                                ) : getInitials(profile?.full_name ?? null)}
                            </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-semibold truncate leading-tight text-sidebar-accent-foreground">{profile?.full_name || "Loading..."}</span>
                                    <span className="block text-[11px] truncate text-sidebar-foreground/60">{getRoleLabel(profile?.role ?? null)}</span>
                                </span>
                                <MoreVertical className="h-4 w-4 shrink-0 text-sidebar-foreground" aria-hidden="true" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                aria-label="Account menu"
                                title={profile?.full_name || "Account"}
                                className="mx-auto grid place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent-foreground/40 data-[state=open]:ring-2 data-[state=open]:ring-sidebar-accent-foreground/40"
                            >
                                <span className="w-9 h-9 rounded-full bg-sidebar-accent text-sidebar-accent-foreground flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden">
                                {profile?.avatar_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={profile.avatar_url} alt={profile.full_name ?? "Avatar"} className="w-full h-full object-cover" />
                                ) : getInitials(profile?.full_name ?? null)}
                            </span>
                            </button>
                        )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="start"
                        side="top"
                        sideOffset={8}
                        onCloseAutoFocus={(event) => event.preventDefault()}
                        className={`w-60 border-sidebar-border bg-sidebar text-sidebar-accent-foreground shadow-lg ${ACCOUNT_MENU_ITEMS}`}
                    >
                        <div className="px-2 py-1.5">
                            <p className="truncate text-sm font-semibold">{profile?.full_name || "Account"}</p>
                            <p className="truncate text-xs text-sidebar-foreground">{getRoleLabel(profile?.role ?? null)}</p>
                        </div>
                        <DropdownMenuSeparator className="bg-sidebar-border" />
                        <DropdownMenuItem asChild>
                            <Link href="/settings/profile" onClick={isSheet ? onCollapse : undefined}><UserCircle className="h-4 w-4" /> My profile</Link>
                        </DropdownMenuItem>
                        {showAdminNav && (
                            <DropdownMenuItem asChild>
                                <Link href="/changelog" onClick={isSheet ? onCollapse : undefined}><ScrollText className="h-4 w-4" /> Changelog</Link>
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator className="bg-sidebar-border" />
                        <DropdownMenuItem onSelect={togglePanel}>
                            {isDarkPanel ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {isDarkPanel ? "Switch to light panel" : "Switch to dark panel"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-sidebar-border" />
                        <DropdownMenuItem onSelect={handleLogout} disabled={loggingOut} className="text-destructive focus:text-destructive">
                            {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} Sign out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>

        </div>
    )
}
