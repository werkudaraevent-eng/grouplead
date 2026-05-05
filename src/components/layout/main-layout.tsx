"use client"

import { Suspense, useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TopLoader } from "@/components/layout/top-loader"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { CompanyProvider } from "@/contexts/company-context"
import { PermissionsProvider } from "@/contexts/permissions-context"
import { SidebarThemeProvider } from "@/contexts/sidebar-theme-context"
import { CurrencyProvider } from "@/contexts/currency-context"
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
}

export function MainLayout({ children, initialCompany, companies, currencySettings = DEFAULT_CURRENCY_SETTINGS, userProfile = null }: MainLayoutProps) {
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <CompanyProvider initialCompany={initialCompany} companies={companies}>
            <PermissionsProvider>
                <CurrencyProvider settings={currencySettings}>
                    <SidebarThemeProvider>
                        <Suspense fallback={null}>
                            <TopLoader />
                        </Suspense>
                        <MainLayoutInner mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} userProfile={userProfile}>
                            {children}
                        </MainLayoutInner>
                    </SidebarThemeProvider>
                </CurrencyProvider>
            </PermissionsProvider>
        </CompanyProvider>
    )
}

// Inner component that can access SidebarThemeContext
import { useSidebarTheme } from "@/contexts/sidebar-theme-context"

function MainLayoutInner({
    children,
    mobileOpen,
    setMobileOpen,
    userProfile,
}: {
    children: React.ReactNode
    mobileOpen: boolean
    setMobileOpen: (v: boolean) => void
    userProfile?: UserProfile | null
}) {
    const { isDarkPanel } = useSidebarTheme()
    const darkClass = isDarkPanel ? "sidebar-dark" : ""

    return (
        <div className="flex h-screen overflow-hidden">
            <aside
                data-sidebar
                className={`hidden lg:flex lg:w-[220px] lg:flex-col lg:border-r shrink-0 flex-none transition-colors duration-300 border-sidebar-border bg-sidebar ${darkClass}`}
            >
                <Sidebar serverProfile={userProfile} />
            </aside>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetContent side="left" className={`w-72 p-0 border-r-0 ${darkClass}`}>
                    <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                    <SheetDescription className="sr-only">Main navigation sidebar for mobile devices.</SheetDescription>
                    <Sidebar isSheet onCollapse={() => setMobileOpen(false)} serverProfile={userProfile} />
                </SheetContent>
            </Sheet>
            <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
                <div className="lg:hidden flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-9 w-9 mr-3" aria-label="Open navigation menu">
                        <Menu className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                            <span className="text-primary-foreground font-bold text-xs">W</span>
                        </div>
                        <span className="font-bold text-sm">Werkudara Group</span>
                    </div>
                </div>
                <main id="main-content" className="flex-1 overflow-y-auto bg-muted/30 thin-scrollbar">{children}</main>
            </div>
        </div>
    )
}
