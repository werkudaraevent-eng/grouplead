"use client"

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react"
import { createClient } from "@/utils/supabase/client"

interface SidebarThemeContextType {
    isDarkPanel: boolean
    togglePanel: () => void
}

const SidebarThemeContext = createContext<SidebarThemeContextType>({
    isDarkPanel: false,
    togglePanel: () => {},
})

export function useSidebarTheme() {
    return useContext(SidebarThemeContext)
}

export function SidebarThemeProvider({ children }: { children: ReactNode }) {
    const [isDarkPanel, setIsDarkPanel] = useState(false)

    // Hydrate from localStorage on client mount
    useEffect(() => {
        const stored = localStorage.getItem("sidebar-panel-theme")
        if (stored === "dark") setIsDarkPanel(true)
    }, [])

    const togglePanel = useCallback(() => {
        setIsDarkPanel(prev => {
            const next = !prev
            localStorage.setItem("sidebar-panel-theme", next ? "dark" : "light")

            // Persist to Supabase in background (fire-and-forget)
            const supabase = createClient()
            ;(async () => {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return
                const { data } = await supabase
                    .from("profiles")
                    .select("ui_preferences")
                    .eq("id", user.id)
                    .single()
                const currentPrefs = (typeof data?.ui_preferences === "object" && data?.ui_preferences) ? data.ui_preferences : {}
                await supabase.from("profiles").update({
                    ui_preferences: { ...currentPrefs, sidebar_dark: next }
                }).eq("id", user.id)
            })()

            return next
        })
    }, [])

    return (
        <SidebarThemeContext.Provider value={{ isDarkPanel, togglePanel }}>
            {children}
        </SidebarThemeContext.Provider>
    )
}
