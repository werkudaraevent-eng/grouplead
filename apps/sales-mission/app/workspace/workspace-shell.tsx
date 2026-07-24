"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  CalendarDays,
  ChevronLeft,
  ChevronsLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Moon,
  Settings,
  Sun,
  UsersRound,
} from "lucide-react"
import { AppSwitcher } from "@/app/workspace/app-switcher"
import { createClient } from "@/utils/supabase/client"

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

const mainNav: NavItem[] = [
  { href: "/workspace", label: "Dashboard", icon: LayoutDashboard },
  { href: "/workspace/missions", label: "Missions", icon: ClipboardList },
  { href: "/workspace/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/workspace/assignments", label: "Assignments", icon: UsersRound },
]

const adminNav: NavItem[] = [
  { href: "/workspace/settings", label: "Settings", icon: Settings },
]

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2) || "?"
}

export function WorkspaceShell({ children, displayName }: { children: React.ReactNode; displayName: string }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [darkPanel, setDarkPanel] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    setCollapsed(localStorage.getItem("sales-mission-sidebar-collapsed") === "true")
    setDarkPanel(localStorage.getItem("sales-mission-sidebar-dark") === "true")
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      const next = !value
      localStorage.setItem("sales-mission-sidebar-collapsed", String(next))
      return next
    })
  }

  const toggleDarkPanel = () => {
    setDarkPanel((value) => {
      const next = !value
      localStorage.setItem("sales-mission-sidebar-dark", String(next))
      return next
    })
  }

  const signOut = async () => {
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  const renderNav = (items: NavItem[], heading: string) => (
    <div className="workspace-nav-group">
      {!collapsed && <p className="workspace-nav-heading">{heading}</p>}
      {items.map((item) => {
        const active = item.href === "/workspace" ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`workspace-nav-link ${active ? "workspace-nav-link-active" : ""} ${collapsed ? "workspace-nav-link-collapsed" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={17} strokeWidth={1.8} aria-hidden="true" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        )
      })}
    </div>
  )

  const sidebar = (
    <aside className={`workspace-sidebar ${darkPanel ? "workspace-sidebar-dark" : ""} ${collapsed ? "workspace-sidebar-collapsed" : ""}`}>
      <div className="workspace-sidebar-header">
        {collapsed ? (
          <Link className="workspace-logo workspace-logo-compact" href="/workspace" aria-label="Sales Mission dashboard">
            <MapPinned size={17} aria-hidden="true" />
          </Link>
        ) : (
          <Link className="workspace-brand" href="/workspace">
            <span className="workspace-logo"><MapPinned size={17} aria-hidden="true" /></span>
            <span><strong>Sales Mission</strong><small>Werkudara Group</small></span>
          </Link>
        )}
        <div className="workspace-sidebar-actions">
          <AppSwitcher />
          {!collapsed && <button className="workspace-icon-button" type="button" onClick={toggleCollapsed} aria-label="Collapse sidebar"><ChevronsLeft size={16} /></button>}
        </div>
      </div>

      <nav className="workspace-nav" aria-label="Sales Mission navigation">
        {renderNav(mainNav, "Menu")}
        <div className="workspace-nav-divider" />
        {renderNav(adminNav, "Administration")}
      </nav>

      <div className="workspace-sidebar-footer">
        <button className="workspace-footer-action" type="button" onClick={toggleDarkPanel}>
          {darkPanel ? <Sun size={15} /> : <Moon size={15} />}
          {!collapsed && <span>{darkPanel ? "Switch to Light Panel" : "Switch to Dark Panel"}</span>}
        </button>
        <div className={`workspace-profile ${collapsed ? "workspace-profile-collapsed" : ""}`}>
          <Link href="/workspace/settings" className="workspace-avatar" title={displayName}>{initials(displayName)}</Link>
          {!collapsed && <span className="workspace-profile-name">{displayName}</span>}
          <button className="workspace-logout" type="button" onClick={signOut} aria-label="Sign out"><LogOut size={15} /></button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="workspace-frame">
      <div className="workspace-mobile-bar">
        <button className="workspace-mobile-menu" type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu"><Menu size={19} /></button>
        <span className="workspace-mobile-title">Sales Mission</span>
      </div>
      <div className={`workspace-desktop-sidebar ${mobileOpen ? "workspace-mobile-sidebar-open" : ""}`}>
        {mobileOpen && <button className="workspace-sidebar-backdrop" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" />}
        {sidebar}
      </div>
      <div className="workspace-content">{children}</div>
    </div>
  )
}
