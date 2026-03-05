"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { CompanyProvider } from "@/contexts/company-context"
import { PermissionsProvider } from "@/contexts/permissions-context"
import type { CompanyContext } from "@/types/company"

interface MainLayoutProps {
    children: React.ReactNode
    initialCompany: CompanyContext | null
    companies: CompanyContext[]
}

export function MainLayout({ children, initialCompany, companies }: MainLayoutProps) {
    const [mobileOpen, setMobileOpen] = useState(false)

    return (
        <CompanyProvider initialCompany={initialCompany} companies={companies}>
            <PermissionsProvider>
                <div className="flex h-screen overflow-hidden">
                    {/* Desktop Sidebar */}
                    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:border-r border-sidebar-border bg-sidebar shrink-0">
                        <Sidebar />
                    </aside>

                    {/* Mobile Sidebar */}
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetContent side="left" className="w-72 p-0 border-r-0">
                            <Sidebar isSheet onCollapse={() => setMobileOpen(false)} />
                        </SheetContent>
                    </Sheet>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                        <div className="lg:hidden flex items-center h-14 px-4 border-b bg-background/95 backdrop-blur shrink-0">
                            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="h-9 w-9 mr-3">
                                <Menu className="h-5 w-5" />
                            </Button>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                                    <span className="text-primary-foreground font-bold text-xs">W</span>
                                </div>
                                <span className="font-bold text-sm">Werkudara Group</span>
                            </div>
                        </div>
                        <main className="flex-1 overflow-y-auto bg-muted/30">
                            {children}
                        </main>
                    </div>
                </div>
            </PermissionsProvider>
        </CompanyProvider>
    )
}
