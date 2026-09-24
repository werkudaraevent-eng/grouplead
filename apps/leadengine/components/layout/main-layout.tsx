"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileTopBar } from "@/components/layout/mobile-top-bar"
import { MobileNavBar } from "@/components/layout/mobile-nav-bar"
import { PageChromeProvider } from "@/components/layout/page-chrome"

/**
 * Loaded client-only, and that is load-bearing rather than an optimisation.
 *
 * TopLoader calls `useSearchParams()`, which makes Next bail out of static
 * rendering for its subtree during SSR. That bail-out shifts the `useId` tree
 * path for the rest of the layout, so the Radix popover in the app switcher
 * received one id on the server and a different one on hydration:
 *
 *   - aria-controls="radix-_R_aatpet5ritqlb_"   (server)
 *   + aria-controls="radix-_R_2inebn9esnelb_"   (client)
 *
 * Reproduced on a minimal probe, and moving the Suspense boundary after the
 * popover did NOT help: any SSR bail-out in the tree is enough. Not rendering
 * it on the server at all is what removes the mismatch, and the loader has
 * nothing to show before hydration anyway.
 */
const TopLoader = dynamic(
  () => import("@/components/layout/top-loader").then((m) => m.TopLoader),
  { ssr: false }
)
import { CompanySwitchLoader } from "@/components/layout/company-switch-loader"
import { SessionGuard } from "@/components/layout/session-guard"
import { UsageBeacon } from "@/components/layout/usage-beacon"
import { MaintenanceWatcher } from "@/features/settings/components/maintenance-watcher"
import { CompanyProvider } from "@/contexts/company-context"
import { PermissionsProvider } from "@/contexts/permissions-context"
import { SidebarThemeProvider } from "@/contexts/sidebar-theme-context"
import { CurrencyProvider } from "@/contexts/currency-context"
import { hasPreferenceCookie, writePreferenceCookie } from "@/lib/preference-cookie"
import type { CompanyContext } from "@/types/company"
import type { CurrencySettings } from "@/types/currency"
import { DEFAULT_CURRENCY_SETTINGS } from "@/types/currency"

export interface UserProfile {
    full_name: string | null
    role: string | null
    avatar_url: string | null
}

interface MainLayoutProps {
    children: React.ReactNode
    initialCompany: CompanyContext | null
    companies: CompanyContext[]
    currencySettings?: CurrencySettings
    userProfile?: UserProfile | null
    /** From the parent-domain cookies, so the first HTML is already at this size. */
    initialCollapsed?: boolean
}

export function MainLayout({ children, initialCompany, companies, currencySettings = DEFAULT_CURRENCY_SETTINGS, userProfile = null, initialCollapsed = false }: MainLayoutProps) {
    return (
        <CompanyProvider initialCompany={initialCompany} companies={companies}>
            <CompanySwitchLoader />
            <PermissionsProvider>
                <CurrencyProvider settings={currencySettings}>
                    <SidebarThemeProvider>
                        <SessionGuard />
                        {/* Settings → Usage: which page, when; draws nothing, fails silently. */}
                        <UsageBeacon />
                        <MaintenanceWatcher />
                        <TopLoader />
                        <PageChromeProvider>
                            <MainLayoutInner initialCollapsed={initialCollapsed} userProfile={userProfile}>
                                {children}
                            </MainLayoutInner>
                        </PageChromeProvider>
                    </SidebarThemeProvider>
                </CurrencyProvider>
            </PermissionsProvider>
        </CompanyProvider>
    )
}

// Inner component that can access SidebarThemeContext
import { useSidebarTheme } from "@/contexts/sidebar-theme-context"
import { useCompany } from "@/contexts/company-context"

function MainLayoutInner({
    children,
    userProfile,
    initialCollapsed = false,
}: {
    children: React.ReactNode
    userProfile?: UserProfile | null
    initialCollapsed?: boolean
}) {
    const { isDarkPanel } = useSidebarTheme()
    const { isSwitching } = useCompany()
    const darkClass = isDarkPanel ? "sidebar-dark" : ""
    const [collapsed, setCollapsed] = useState(initialCollapsed)

    // A person from before the cookie existed still has the choice in
    // localStorage; honour it once and move it into the cookie.
    useEffect(() => {
        if (hasPreferenceCookie("sidebar-collapsed")) return
        const stored = localStorage.getItem("sidebar-collapsed")
        if (stored === null) return
        setCollapsed(stored === "true")
        writePreferenceCookie("sidebar-collapsed", stored)
    }, [])

    const toggleCollapse = () => {
        setCollapsed(prev => {
            const next = !prev
            localStorage.setItem("sidebar-collapsed", String(next))
            writePreferenceCookie("sidebar-collapsed", String(next))
            return next
        })
    }

    // Below `lg` the phone shell (Sales Activity's, rule for rule): the top
    // app bar above `<main>`, the navigation bar under it, the drawer gone
    // rather than folded into a sheet. From `lg` the drawer, as it was. The
    // shell is `h-dvh` so the navigation bar sits on the visible bottom edge
    // of a phone's browser, not under its toolbar.
    return (
        <div className="shell-in flex h-dvh overflow-hidden">
            <aside
                data-sidebar
                className={`hidden lg:flex lg:flex-col shrink-0 flex-none overflow-hidden bg-sidebar relative ${darkClass} transition-[width] duration-200 ease-out ${collapsed ? "lg:w-[60px]" : "lg:w-[220px]"}`}
            >
                <Sidebar serverProfile={userProfile} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
                <MobileTopBar />
                {/* The content keeps a 900px floor so the CRM's wide tables scroll
                    sideways instead of squeezing. A page built to reflow down
                    to a phone opts out by carrying `data-fluid-page` on its
                    root (Settings → Usage), so it gets the real width and no
                    sideways page scroll; every other page is unchanged. The
                    sideways scroll is this box's, between the two bars, so
                    the bars stay on screen while a wide page moves under
                    them. */}
                <div className="flex min-h-0 flex-1 flex-col overflow-x-auto overflow-y-hidden">
                    <main id="main-content" className={`flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-background thin-scrollbar min-w-[900px] has-[[data-fluid-page]]:min-w-0 transition-opacity duration-200 ${isSwitching ? "opacity-60 pointer-events-none" : "opacity-100"}`}>{children}</main>
                </div>
                <MobileNavBar profile={userProfile ?? null} />
            </div>
        </div>
    )
}
