"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronsLeft,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPinned,
  Menu,
  MonitorPlay,
  Moon,
  Settings,
  Sun,
} from "lucide-react"
import dynamic from "next/dynamic"

/**
 * Client-only, and that is load-bearing rather than an optimisation.
 *
 * The switcher's Radix popover calls useId. app/workspace/loading.tsx puts a
 * Suspense boundary around this layout's children, and once the layout actually
 * suspends on its Supabase round trips, that boundary shifts the useId tree path
 * — so the popover trigger received one aria-controls on the server and another
 * on hydration. Proven with two otherwise identical probes: with loading.tsx the
 * error appears, without it the page is clean.
 *
 * Removing loading.tsx would trade a real loading state for a cosmetic id, so
 * the menu is kept out of SSR instead. It has nothing to show before hydration:
 * it is a popover behind a button.
 */
const AppSwitcher = dynamic(
  () => import("@/app/workspace/app-switcher").then((m) => m.AppSwitcher),
  { ssr: false }
)
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"
import { PersonAvatar } from "@/components/person-avatar"
import { cn } from "@/lib/utils"
import type { NavAccess } from "@/lib/missions/nav-access"

/**
 * App shell. Structure, tokens, and interaction mirror LeadEngine's sidebar so
 * moving between the two apps does not feel like moving between two products:
 * same collapse behaviour, same dark-panel toggle, same footer profile block.
 *
 * Icons come from Lucide for the same reason: LeadEngine already uses that set,
 * and a rep switching apps mid-visit should not have to relearn what a glyph
 * means. Each icon below is picked for what the destination does, not for the
 * library's look.
 *
 * Copy is Indonesian throughout, matching the visit report — the screen these
 * users spend the most time in, and the one whose wording they read under
 * pressure.
 */

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /**
   * Which NavAccess flag governs this destination. Items without one are
   * reachable by anyone who passed the app gate — "Hari ini" is where a rep
   * lands, whatever else their role covers.
   */
  requires?: keyof Pick<NavAccess, "missions" | "reports" | "settings">
}

/**
 * Every entry here is a place in the product, and no two of them answer the
 * same question.
 *
 * "Penugasan" used to sit between Mission and Papan live. It listed the same
 * assignments the mission list already carries, pivoted per person, so the two
 * menus read as synonyms and neither one said which missions were waiting on
 * you. That question is now a lens on the mission list itself.
 *
 * Notifications are not here either: they are an account concern, like the
 * profile and the sign-out beside them, so the bell lives in the footer and in
 * the mobile top bar rather than competing with the six real destinations.
 */
const mainNav: NavItem[] = [
  { href: "/workspace", label: "Hari ini", icon: LayoutDashboard },
  { href: "/workspace/missions", label: "Mission", icon: ClipboardList, requires: "missions" },
  { href: "/workspace/calendar", label: "Kalender", icon: CalendarDays, requires: "missions" },
  { href: "/workspace/board", label: "Papan live", icon: MonitorPlay, requires: "missions" },
  { href: "/workspace/reports", label: "Laporan", icon: BarChart3, requires: "reports" },
]

const adminNav: NavItem[] = [
  { href: "/workspace/settings", label: "Pengaturan", icon: Settings, requires: "settings" },
]

const NOTIFICATIONS_HREF = "/workspace/notifications"

/** Spoken form of the count, so the bell is not a colour-only signal. */
function unreadLabel(unreadCount: number) {
  return unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"
}

/**
 * Filled with --danger-foreground, not --destructive.
 *
 * globals.css says it plainly: the brand orange is for fills and icons and is
 * far too light to be read as text. White on #ED6F22 measures 3.04:1, and a
 * 10px numeral needs 4.5:1. On #93400a the same white reads 7.05:1.
 */
function UnreadBadge({ unreadCount }: { unreadCount: number }) {
  if (unreadCount === 0) return null

  return (
    <span
      aria-hidden="true"
      className="absolute -right-1 -top-1 min-w-[16px] rounded-full bg-[var(--danger-foreground)] px-1 text-center text-[10px] font-bold leading-4 text-white"
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  )
}

/** Sidebar tint over the shared avatar, so it sits on the panel's own tokens. */
function Avatar({ name, url }: { name: string; url: string | null }) {
  return (
    <PersonAvatar
      name={name}
      avatarUrl={url}
      size="lg"
      className="bg-sidebar-accent text-sidebar-accent-foreground"
    />
  )
}

function SidebarBody({
  displayName,
  avatarUrl,
  unreadCount,
  navAccess,
  collapsed,
  onToggleCollapse,
  isSheet = false,
  onNavigate,
}: {
  displayName: string
  avatarUrl: string | null
  unreadCount: number
  navAccess: NavAccess
  collapsed: boolean
  onToggleCollapse?: () => void
  isSheet?: boolean
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [isDarkPanel, setIsDarkPanel] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    setIsDarkPanel(localStorage.getItem("sidebar-panel-theme") === "dark")
  }, [])

  const togglePanel = () => {
    setIsDarkPanel((value) => {
      const next = !value
      localStorage.setItem("sidebar-panel-theme", next ? "dark" : "light")
      document.documentElement.classList.toggle("sidebar-dark-mode", next)
      return next
    })
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    // Clear the shared session id too — leaving it behind would make the
    // sibling app compare against an id this browser no longer owns.
    clearActiveSessionId()
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const menuItemClasses = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-150 ${
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
    }`

  const collapsedItemClasses = (isActive: boolean) =>
    `flex items-center justify-center p-2.5 rounded-lg transition-all duration-150 ${
      isActive
        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
        : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
    }`

  const iconClasses = (isActive: boolean) =>
    `h-4.5 w-4.5 shrink-0 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground"}`

  // Hidden rather than disabled: a menu the rep can never open is noise, not
  // information.
  //
  // This is presentation only. Every route behind these items calls
  // requireModule() for itself, because hiding a link leaves the URL working
  // and leaves a page already open still working after permission is revoked.
  const permitted = (items: NavItem[]) =>
    items.filter((item) => !item.requires || navAccess[item.requires])

  const renderNav = (items: NavItem[]) =>
    permitted(items).map((item) => {
      const isActive = item.href === "/workspace" ? pathname === item.href : pathname.startsWith(item.href)

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={collapsed ? collapsedItemClasses(isActive) : menuItemClasses(isActive)}
          title={collapsed ? item.label : undefined}
        >
          <item.icon className={iconClasses(isActive)} />
          {!collapsed && <span className="flex-1">{item.label}</span>}
        </Link>
      )
    })

  const notificationsActive = pathname.startsWith(NOTIFICATIONS_HREF)

  return (
    <div className="group/sidebar relative flex h-full flex-col bg-sidebar text-sidebar-foreground transition-colors duration-300">
      <div className={`relative min-h-14 shrink-0 border-b border-sidebar-border ${collapsed ? "flex flex-col items-center gap-2 px-2 py-2" : "flex items-center gap-2 py-2 pl-3 pr-0"}`}>
        {!collapsed ? (
          <Link href="/workspace" className="flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden" onClick={onNavigate}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MapPinned className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-sidebar-accent-foreground">Sales Mission</span>
              <span className="block truncate text-[11px] text-sidebar-foreground">Werkudara Group</span>
            </span>
          </Link>
        ) : (
          <Link href="/workspace" className="flex items-center justify-center transition-opacity duration-150 group-hover/sidebar:opacity-0" aria-label="Beranda Sales Mission">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <MapPinned className="h-4 w-4" />
            </span>
          </Link>
        )}

        <div className={`flex shrink-0 items-center justify-center ${collapsed ? "flex-col gap-2" : ""}`}>
          <AppSwitcher collapsed={collapsed} />
        </div>

        {onToggleCollapse && !isSheet && collapsed && (
          <button
            onClick={onToggleCollapse}
            className="absolute inset-x-0 top-0 flex h-14 items-center justify-center text-sidebar-foreground opacity-0 transition-opacity duration-150 hover:text-sidebar-foreground group-hover/sidebar:opacity-100"
            title="Lebarkan sidebar"
          >
            <ChevronsLeft className="h-[18px] w-[18px] rotate-180" />
          </button>
        )}
        {onToggleCollapse && !isSheet && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="-mr-px flex h-14 w-8 shrink-0 items-center justify-center rounded-l-lg text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Ciutkan sidebar"
          >
            <ChevronsLeft className="h-[16px] w-[16px]" />
          </button>
        )}
      </div>

      <nav aria-label="Navigasi Sales Mission" className={`sidebar-scrollbar flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? "px-1.5" : "px-3"}`}>
        {!collapsed && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground">Menu</p>}
        {renderNav(mainNav)}
        {/* The heading and its spacing go with the section. A lone "Administrasi"
            label above nothing reads as a menu that failed to load. */}
        {permitted(adminNav).length > 0 && (
          <>
            <div className="!my-4" />
            {!collapsed && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground">Administrasi</p>}
            {renderNav(adminNav)}
          </>
        )}
      </nav>

      {/*
        Account block. The bell sits here rather than in Menu above because a
        notification is not a place in the product — it is mail addressed to the
        person signed in, which is exactly what the rest of this block is about.
      */}
      <div className={`shrink-0 space-y-2 border-t border-sidebar-border py-3 ${collapsed ? "px-1.5" : "px-3"}`}>
        <Link
          href={NOTIFICATIONS_HREF}
          onClick={onNavigate}
          aria-label={unreadLabel(unreadCount)}
          title={unreadLabel(unreadCount)}
          aria-current={notificationsActive ? "page" : undefined}
          className={cn(
            "relative flex w-full items-center rounded-lg transition-all duration-150",
            collapsed ? "justify-center p-2.5" : "gap-2.5 px-3 py-2 text-[12px] font-medium",
            notificationsActive
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          )}
        >
          <span className="relative flex shrink-0">
            <Bell className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} />
            {/* Collapsed the label is gone, so the count rides the icon. */}
            {collapsed && <UnreadBadge unreadCount={unreadCount} />}
          </span>
          {!collapsed && <span className="flex-1 text-left">Notifikasi</span>}
          {!collapsed && unreadCount > 0 && (
            <span className="rounded-full bg-[var(--danger-foreground)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>

        <button
          onClick={togglePanel}
          className={
            collapsed
              ? "flex w-full items-center justify-center rounded-lg p-2.5 text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              : "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }
          title={isDarkPanel ? "Panel terang" : "Panel gelap"}
        >
          {isDarkPanel ? <Sun className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} /> : <Moon className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} />}
          {!collapsed && <span>{isDarkPanel ? "Ganti ke panel terang" : "Ganti ke panel gelap"}</span>}
        </button>

        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/50">
            <Link href="/workspace/settings" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={displayName} url={avatarUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight text-sidebar-accent-foreground">{displayName}</span>
                <span className="block truncate text-[11px] text-sidebar-foreground">Sales Mission</span>
              </span>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleLogout} disabled={loggingOut} aria-label="Keluar">
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link href="/workspace/settings" className="rounded-full" title={displayName}>
              <Avatar name={displayName} url={avatarUrl} />
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleLogout} disabled={loggingOut} aria-label="Keluar">
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function WorkspaceShell({
  children,
  displayName,
  avatarUrl = null,
  unreadCount = 0,
  navAccess,
}: {
  children: React.ReactNode
  displayName: string
  avatarUrl?: string | null
  unreadCount?: number
  navAccess: NavAccess
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true")
  }, [])

  const toggleCollapse = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem("sidebar-collapsed", String(next))
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        data-sidebar
        className={`relative hidden shrink-0 flex-none overflow-hidden bg-sidebar transition-[width] duration-200 ease-out lg:flex lg:flex-col ${collapsed ? "lg:w-[60px]" : "lg:w-[220px]"}`}
      >
        <SidebarBody displayName={displayName} avatarUrl={avatarUrl} unreadCount={unreadCount} navAccess={navAccess} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-r-0 p-0">
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <SheetDescription className="sr-only">Navigasi utama Sales Mission untuk layar kecil.</SheetDescription>
          <SidebarBody displayName={displayName} avatarUrl={avatarUrl} unreadCount={unreadCount} navAccess={navAccess} collapsed={false} isSheet onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-auto">
        <div className="flex h-14 shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="mr-3 h-9 w-9" aria-label="Buka menu navigasi">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <MapPinned className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-bold">Sales Mission</span>
          </div>

          {/*
            On a phone the sidebar is behind the hamburger, so a bell that lived
            only in the footer would be two taps away and invisible until then.
            It stays on the bar where an unread count can actually be seen.
          */}
          <Link
            href={NOTIFICATIONS_HREF}
            aria-label={unreadLabel(unreadCount)}
            className="relative ml-auto grid h-11 w-11 place-items-center rounded-md text-foreground transition-colors hover:bg-muted"
          >
            <Bell className="h-5 w-5" />
            <UnreadBadge unreadCount={unreadCount} />
          </Link>
        </div>
        <main id="main-content" className="thin-scrollbar flex-1 overflow-y-auto overflow-x-auto bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  )
}
