"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LogOut, ChevronsLeft, ChevronsRight, Settings, Loader2, Moon, Sun, ScrollText, MoreVertical, UserCircle, MonitorSmartphone,
} from "@/components/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PlainTooltip } from "@/components/ui/tooltip"
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
  // Holds the button's 36px until it arrives, so the unit's name does not
  // lay out wider and then shrink.
  { ssr: false, loading: () => <span className="h-9 w-9 shrink-0" aria-hidden="true" /> }
)
import { usePermissions } from "@/contexts/permissions-context"
import { useSidebarTheme } from "@/contexts/sidebar-theme-context"
import { createClient } from "@/utils/supabase/client"
import { useSignOut } from "@/components/layout/use-sign-out"
import { DESTINATION_ICONS } from "@/components/layout/destination-icons"
import { SIDEBAR_SHORTCUT, sidebarToggleLabel } from "@/lib/ui/sidebar-shortcut"
import { CHANGELOG_HREF, DEVICES_HREF, PROFILE_HREF, SETTINGS_HREF, canOpenSettings, isActiveHref, permittedDestinations, roleLabel } from "@/lib/navigation/app-nav"

/**
 * The drawer, from `lg` up. Below `lg` the phone shell takes its place (the
 * top app bar and the navigation bar in `main-layout.tsx`, the More sheet in
 * `mobile-nav-bar.tsx`); the drawer never opens as a sheet there.
 */
interface SidebarProps {
    collapsed?: boolean
    onToggleCollapse?: () => void
    serverProfile?: { full_name: string | null; role: string | null; avatar_url: string | null } | null
}

// Administration is administration. Supporting pages (the profile, active
// devices, the changelog), the panel toggle and sign-out live behind the account menu at
// the foot of the drawer, the same pattern as Sales Activity: Material's
// drawer holds destinations, and Slack, Notion and Linear keep help and
// release notes off the rail. The destinations and their grants are
// `DESTINATIONS` in lib/navigation/app-nav.ts, shared with the phone's
// navigation bar.
const adminNav = [
    { href: SETTINGS_HREF, label: "Settings", icon: Settings },
]

/** Menu rows on the panel's own tokens: hover/focus as a tonal state layer, icons in the panel's muted ink. */
const ACCOUNT_MENU_ITEMS =
    "[&_[role=menuitem]]:text-sidebar-accent-foreground [&_[role=menuitem]]:focus:bg-sidebar-accent [&_[role=menuitem]]:focus:text-sidebar-accent-foreground [&_[role=menuitem]_svg:not([class*='text-'])]:text-sidebar-foreground"

interface UserProfile {
    full_name: string | null
    role: string | null
    avatar_url: string | null
}

/**
 * Folds the drawer to the rail and opens it again: an icon button at the
 * drawer's foot, never a labelled one, named by its tooltip, which carries
 * the shortcut (Notion, Linear, Gmail and Atlassian all fold with an icon).
 * A 40px target; « when open, » on the rail. Twin of Sales Activity's
 * `DrawerToggle` in app/workspace/workspace-shell.tsx.
 */
function DrawerToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const label = sidebarToggleLabel(collapsed)
    const Icon = collapsed ? ChevronsRight : ChevronsLeft
    return (
        <PlainTooltip label={label} shortcut={SIDEBAR_SHORTCUT} side="right">
            <button
                type="button"
                onClick={onToggle}
                aria-label={label}
                aria-expanded={!collapsed}
                aria-controls="app-drawer"
                aria-keyshortcuts={SIDEBAR_SHORTCUT}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
        </PlainTooltip>
    )
}

export function Sidebar({ collapsed = false, onToggleCollapse, serverProfile = null }: SidebarProps) {
    const pathname = usePathname()
    // Use server-provided profile to avoid redundant client-side fetch
    const [profile, setProfile] = useState<UserProfile | null>(serverProfile)
    const { signOut: handleLogout, signingOut: loggingOut } = useSignOut()
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

    const getInitials = (name: string | null) => {
        if (!name) return "?"
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }


    const visibleMainNav = permsLoading ? [] : permittedDestinations(can)

    // Settings hub visibility is controlled by settings.read.
    // Section-level access is handled inside /settings via module permissions.
    const showAdminNav = !permsLoading && canOpenSettings(can)

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
        <div className="flex flex-col h-full transition-colors duration-300 bg-sidebar text-sidebar-foreground relative">
            {/* The header does one job per control (DESIGN.md, "The drawer:
                header, app switcher, collapse"): the unit you are working in,
                as one button across the free width, and the apps grid at the
                trailing end, whose menu drops from the header and stays
                inside the drawer. The collapse control lives at the foot. On
                the rail the mark and the grid stack. */}
            {!collapsed ? (
                <div className="flex h-14 shrink-0 items-center gap-0.5 border-b border-sidebar-border px-2">
                    <CompanySwitcherHeader />
                    <AppSwitcher />
                </div>
            ) : (
                <div className="flex shrink-0 flex-col items-center gap-2 border-b border-sidebar-border px-2 py-2">
                    <Link href="/" aria-label="LeadEngine home" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary">
                        <span className="text-sm font-bold text-primary-foreground">W</span>
                    </Link>
                    <AppSwitcher collapsed />
                </div>
            )}

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
                    const isActive = isActiveHref(pathname, item.href)
                    const Icon = DESTINATION_ICONS[item.key]
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={collapsed ? `flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 ${isActive ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"}` : menuItemClasses(isActive)}
                            title={collapsed ? item.label : undefined}
                        >
                            <Icon className={iconClasses(isActive)} />
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
                {/* Collapse: its own compact row above the account (LeadEngine
                    has no Notifications row for it to share), at the trailing
                    end where Sales Activity has it; on the rail, centred above
                    the avatar. */}
                {onToggleCollapse && (
                    <div className={`flex ${collapsed ? "justify-center" : "justify-end"}`}>
                        <DrawerToggle collapsed={collapsed} onToggle={onToggleCollapse} />
                    </div>
                )}
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
                                    <span className="block text-[11px] truncate text-sidebar-foreground/60">{roleLabel(profile?.role)}</span>
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
                            <p className="truncate text-xs text-sidebar-foreground">{roleLabel(profile?.role)}</p>
                        </div>
                        <DropdownMenuSeparator className="bg-sidebar-border" />
                        {/* The account's own pages first, the same two, in the
                            same order and with the same glyphs, as Sales
                            Activity's account menu: Settings › Account, open
                            to everyone. */}
                        <DropdownMenuItem asChild>
                            <Link href={PROFILE_HREF}><UserCircle className="h-4 w-4" /> Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href={DEVICES_HREF}><MonitorSmartphone className="h-4 w-4" /> Active devices</Link>
                        </DropdownMenuItem>
                        {showAdminNav && (
                            <>
                                <DropdownMenuSeparator className="bg-sidebar-border" />
                                <DropdownMenuItem asChild>
                                    <Link href={CHANGELOG_HREF}><ScrollText className="h-4 w-4" /> Changelog</Link>
                                </DropdownMenuItem>
                            </>
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
