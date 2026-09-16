"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  Download,
  HelpCircle,
  LayoutDashboard,
  Sparkles,
  Loader2,
  LogOut,
  Menu,
  MonitorPlay,
  Settings,
  UserSearch,
} from "@/components/icons"
import { BottomSheet, SheetRow } from "@/components/ui/bottom-sheet"
import { PersonAvatar } from "@/components/person-avatar"
import { usePageChrome } from "@/components/page-chrome"
import { CoachMark, useHintSeen } from "@/components/coach-mark"
import { useStandalone } from "@/hooks/use-compact"
import { createClient } from "@/utils/supabase/client"
import { clearActiveSessionId } from "@/lib/session-guard"
import { paths } from "@/lib/paths"
import { cn } from "@/lib/utils"
import type { NavAccess } from "@/lib/missions/nav-access"

/**
 * Material's navigation bar, for the phone.
 *
 * Three to five top destinations, icon over label, the active one under a
 * tonal pill; 80dp tall plus the safe area. The rest of the product
 * (calendar, board, notifications, settings, the account) sits behind
 * "Lainnya" in a bottom sheet, so the bar keeps to the places a rep opens
 * every day. On a long form the bar steps aside for the form's own action
 * bar (`hideNav` from the page chrome).
 */

type Destination = { href: string; label: string; icon: typeof LayoutDashboard; requires?: keyof NavAccess }

const DESTINATIONS: Destination[] = [
  { href: paths.workspace, label: "Hari ini", icon: LayoutDashboard },
  { href: paths.activities(), label: "Aktivitas", icon: ClipboardList, requires: "missions" },
  { href: paths.prospects, label: "Prospek", icon: UserSearch, requires: "prospects" },
  { href: paths.reports, label: "Laporan", icon: BarChart3, requires: "reports" },
]

function isActive(pathname: string, href: string) {
  return href === paths.workspace ? pathname === href : pathname.startsWith(href)
}

export function MobileNavBar({
  navAccess,
  unreadCount,
  displayName,
  avatarUrl,
}: {
  navAccess: NavAccess
  unreadCount: number
  displayName: string
  avatarUrl: string | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { hideNav } = usePageChrome()
  const standalone = useStandalone()
  const [moreOpen, setMoreOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    setLoggingOut(true)
    clearActiveSessionId()
    await createClient().auth.signOut()
    router.push("/login")
    router.refresh()
  }

  if (hideNav) return null

  const destinations = DESTINATIONS.filter((item) => !item.requires || navAccess[item.requires])
  const moreActive = !destinations.some((item) => isActive(pathname, item.href))
  const menuHintSeen = useHintSeen("nav-lainnya")
  const go = (href: string) => {
    setMoreOpen(false)
    router.push(href)
  }

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-30 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid h-20" style={{ gridTemplateColumns: `repeat(${destinations.length + 1}, minmax(0, 1fr))` }}>
          {destinations.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex h-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
                >
                  <span className={cn("grid h-8 w-16 place-items-center rounded-full transition-colors", active && "bg-[var(--tonal)] text-[var(--tonal-foreground)]")}>
                    <item.icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className={cn(active && "text-foreground")}>{item.label}</span>
                </Link>
              </li>
            )
          })}
          <li>
            {/* Two marks share this anchor and show one after the other:
                what is behind Lainnya, then, on a phone that has not
                installed the app, that it can be. */}
            <CoachMark
              hintKey={menuHintSeen ? "install" : "nav-lainnya"}
              enabled={menuHintSeen ? !standalone : true}
              title={menuHintSeen ? "Pasang ke layar utama" : "Menu lainnya"}
              body={menuHintSeen ? "Sales Activity bisa dibuka seperti aplikasi, tanpa bilah alamat. Caranya ada di Lainnya → Pasang di ponsel." : "Kalender, Papan live, Notifikasi, Pengaturan, dan Panduan ada di sini."}
              learnHref={menuHintSeen ? paths.install : paths.guide}
              side="top"
              align="end"
            >
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              aria-current={moreActive ? "page" : undefined}
              className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
            >
              <span className={cn("relative grid h-8 w-16 place-items-center rounded-full transition-colors", moreActive && "bg-[var(--tonal)] text-[var(--tonal-foreground)]")}>
                <Menu className="h-6 w-6" aria-hidden="true" />
                {unreadCount > 0 && (
                  <span aria-hidden="true" className="absolute right-3 top-0 h-2.5 w-2.5 rounded-full bg-[var(--danger-foreground)] ring-2 ring-card" />
                )}
              </span>
              <span className={cn(moreActive && "text-foreground")}>Lainnya</span>
            </button>
            </CoachMark>
          </li>
        </ul>
      </nav>

      <BottomSheet open={moreOpen} onOpenChange={setMoreOpen} title="Lainnya" description={displayName}>
        <div className="space-y-1 pb-2">
          {navAccess.missions && <SheetRow icon={CalendarDays} label="Kalender" active={isActive(pathname, paths.calendar)} onClick={() => go(paths.calendar)} />}
          {navAccess.missions && <SheetRow icon={MonitorPlay} label="Papan live" active={isActive(pathname, paths.board)} onClick={() => go(paths.board)} />}
          <SheetRow
            icon={Bell}
            label="Notifikasi"
            active={isActive(pathname, paths.notifications)}
            onClick={() => go(paths.notifications)}
            trailing={unreadCount > 0 ? <span className="rounded-full bg-[var(--danger-foreground)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : undefined}
          />
          {navAccess.settings && <SheetRow icon={Settings} label="Pengaturan" active={isActive(pathname, paths.settings.index)} onClick={() => go(paths.settings.index)} />}
          {navAccess.missions && (
            <SheetRow icon={CalendarDays} label="Kalender saya" hint="Sinkron ke Google Calendar atau iPhone" active={isActive(pathname, paths.myCalendar)} onClick={() => go(paths.myCalendar)} />
          )}
          <SheetRow icon={HelpCircle} label="Panduan" hint="Cara kerja Sales Activity, singkat" active={isActive(pathname, paths.guide)} onClick={() => go(paths.guide)} />
          <SheetRow icon={Sparkles} label="Yang baru" hint="Perubahan terbaru di aplikasi" active={isActive(pathname, paths.whatsNew)} onClick={() => go(paths.whatsNew)} />
          {!standalone && (
            <SheetRow icon={Download} label="Pasang di ponsel" hint="Buka seperti aplikasi, dari layar utama" onClick={() => go(paths.install)} />
          )}
          {/* No panel toggle here: it recolours the sidebar, which a phone
              does not have. The choice still lives in the desktop sidebar. */}
          <div className="my-2 border-t" />
          <div className="flex min-h-14 items-center gap-4 px-4">
            <PersonAvatar name={displayName} avatarUrl={avatarUrl} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
              <span className="block truncate text-xs text-muted-foreground">Sales Activity</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Keluar"
              className="grid h-11 w-11 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {loggingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
