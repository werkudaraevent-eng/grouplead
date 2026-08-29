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
  UsersRound,
} from "lucide-react"
import { AppSwitcher } from "@/app/workspace/app-switcher"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"

/**
 * App shell. Structure, tokens, and interaction mirror LeadEngine's sidebar so
 * moving between the two apps does not feel like moving between two products:
 * same collapse behaviour, same dark-panel toggle, same footer profile block.
 */

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  /** Renders an unread count beside the label. */
  badgeKey?: "notifications"
}

const mainNav: NavItem[] = [
  { href: "/workspace", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace/missions", label: "Missions", icon: ClipboardList },
  { href: "/workspace/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/workspace/assignments", label: "Assignments", icon: UsersRound },
  { href: "/workspace/board", label: "Papan live", icon: MonitorPlay },
  { href: "/workspace/reports", label: "Laporan", icon: BarChart3 },
  { href: "/workspace/notifications", label: "Notifikasi", icon: Bell, badgeKey: "notifications" },
]

const adminNav: NavItem[] = [{ href: "/workspace/settings", label: "Settings", icon: Settings }]

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?"
}

function SidebarBody({
  displayName,
  unreadCount,
  collapsed,
  onToggleCollapse,
  isSheet = false,
  onNavigate,
}: {
  displayName: string
  unreadCount: number
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
    `h-4.5 w-4.5 shrink-0 ${isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/70"}`

  const renderNav = (items: NavItem[]) =>
    items.map((item) => {
      const isActive = item.href === "/workspace" ? pathname === item.href : pathname.startsWith(item.href)
      const badge = item.badgeKey === "notifications" ? unreadCount : 0

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={collapsed ? collapsedItemClasses(isActive) : menuItemClasses(isActive)}
          title={collapsed ? `${item.label}${badge > 0 ? ` (${badge})` : ""}` : undefined}
        >
          <span className="relative shrink-0">
            <item.icon className={iconClasses(isActive)} />
            {/* Collapsed, the count has nowhere to sit, so it becomes a dot. */}
            {collapsed && badge > 0 && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </span>
          {!collapsed && <span className="flex-1">{item.label}</span>}
          {!collapsed && badge > 0 && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </Link>
      )
    })

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
              <span className="block truncate text-[11px] text-sidebar-foreground/60">Werkudara Group</span>
            </span>
          </Link>
        ) : (
          <Link href="/workspace" className="flex items-center justify-center transition-opacity duration-150 group-hover/sidebar:opacity-0" aria-label="Sales Mission dashboard">
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
            className="absolute inset-x-0 top-0 flex h-14 items-center justify-center text-sidebar-foreground/70 opacity-0 transition-opacity duration-150 hover:text-sidebar-foreground group-hover/sidebar:opacity-100"
            title="Expand sidebar"
          >
            <ChevronsLeft className="h-[18px] w-[18px] rotate-180" />
          </button>
        )}
        {onToggleCollapse && !isSheet && !collapsed && (
          <button
            onClick={onToggleCollapse}
            className="-mr-px flex h-14 w-8 shrink-0 items-center justify-center rounded-l-lg text-sidebar-foreground/50 transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground"
            title="Collapse sidebar"
          >
            <ChevronsLeft className="h-[16px] w-[16px]" />
          </button>
        )}
      </div>

      <nav aria-label="Sales Mission navigation" className={`sidebar-scrollbar flex-1 space-y-1 overflow-y-auto py-4 ${collapsed ? "px-1.5" : "px-3"}`}>
        {!collapsed && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Menu</p>}
        {renderNav(mainNav)}
        <div className="!my-4" />
        {!collapsed && <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/70">Administration</p>}
        {renderNav(adminNav)}
      </nav>

      <div className={`shrink-0 space-y-2 border-t border-sidebar-border py-3 ${collapsed ? "px-1.5" : "px-3"}`}>
        <button
          onClick={togglePanel}
          className={
            collapsed
              ? "flex w-full items-center justify-center rounded-lg p-2.5 text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              : "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] font-medium text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }
          title={isDarkPanel ? "Light mode" : "Dark mode"}
        >
          {isDarkPanel ? <Sun className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} /> : <Moon className={collapsed ? "h-4 w-4" : "h-3.5 w-3.5"} />}
          {!collapsed && <span>{isDarkPanel ? "Switch to Light Panel" : "Switch to Dark Panel"}</span>}
        </button>

        {!collapsed ? (
          <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sidebar-accent/50">
            <Link href="/workspace/settings" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground">
                {initials(displayName)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold leading-tight text-sidebar-accent-foreground">{displayName}</span>
                <span className="block truncate text-[11px] text-sidebar-foreground/50">Sales Mission</span>
              </span>
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-sidebar-foreground/30 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleLogout} disabled={loggingOut} aria-label="Sign out">
              {loggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Link href="/workspace/settings" className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-sm font-bold text-sidebar-accent-foreground" title={displayName}>
              {initials(displayName)}
            </Link>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground/30 hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={handleLogout} disabled={loggingOut} aria-label="Sign out">
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
  unreadCount = 0,
}: {
  children: React.ReactNode
  displayName: string
  unreadCount?: number
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
        <SidebarBody displayName={displayName} unreadCount={unreadCount} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-r-0 p-0">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <SheetDescription className="sr-only">Main navigation sidebar for mobile devices.</SheetDescription>
          <SidebarBody displayName={displayName} unreadCount={unreadCount} collapsed={false} isSheet onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-auto">
        <div className="flex h-14 shrink-0 items-center border-b bg-background/95 px-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="mr-3 h-9 w-9" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <MapPinned className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-bold">Sales Mission</span>
          </div>
        </div>
        <main id="main-content" className="thin-scrollbar flex-1 overflow-y-auto overflow-x-auto bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  )
}
