"use client"

import Link from "next/link"
import { ChevronRight } from "@/components/icons"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { SETTINGS_ICONS } from "@/components/layout/settings-icons"
import { pageIntroKey } from "@/lib/hints/hint-key"
import { SETTINGS_GROUPS, visibleSettingsGroups, type SettingsItem } from "@/lib/navigation/settings-nav"
import { CurrencySettingsRow } from "@/features/settings/components/currency-settings-card"
import { MaintenanceSection } from "@/features/settings/components/maintenance-section"
import { usePermissions } from "@/contexts/permissions-context"

/**
 * The Settings page: a list of destinations, so an M3 list, grouped under
 * subheaders, one two-line row per page (DESIGN.md "Settings index"). The
 * groups and their grants are `SETTINGS_GROUPS` in
 * lib/navigation/settings-nav.ts, shared with the menu beside every
 * settings page (DESIGN.md "Settings layout and page width").
 *
 * On a phone it is the list Settings opens on. On a desk it is the overview
 * beside the settings menu (the detail pane's "nothing chosen yet" in M3's
 * list-detail, as Google Account's Home is), with each page's supporting
 * line, which the compact menu leaves out. Account is everyone's; someone
 * without the Settings grant sees only that group, here and in the menu.
 */
export default function SettingsPage() {
    const { can, loading } = usePermissions()
    const canAccessSettings = can("settings", "read")
    const canSeeCurrency = can("settings", "update")

    // Until the grants arrive, Account (everyone's) and a placeholder. Currency
    // display rides in Administration, which the same grant (settings update)
    // always opens through AI.
    const sections = loading ? SETTINGS_GROUPS.filter((group) => group.everyone) : visibleSettingsGroups(can)

    return (
        // A list of destinations fits a phone, so it opts out of the shell's
        // 900px canvas (see main-layout.tsx) and gets the real width.
        <div data-fluid-page className="min-h-[100dvh] bg-background">
            <SettingsPageHeader
                title="Settings"
                subtitle={
                    canAccessSettings || loading
                        ? "Your account, and your workspace's configuration, team, and access control."
                        : "Your profile, and the devices where your account is signed in."
                }
                intro={pageIntroKey("settings")}
            />

            <div className="px-4 sm:px-6 lg:px-8 pb-20">
                {sections.map((section) => (
                    <section key={section.id} className="mt-10 first:mt-0">
                        <SectionHeader label={section.label} description={section.description} />

                        <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                            {section.items.map((item) => (
                                <SettingsRow key={item.href} item={item} />
                            ))}

                            {/* Currency Display lives in Administration as an inline-expand row */}
                            {section.id === "administration" && canSeeCurrency && (
                                <li>
                                    <CurrencySettingsRow />
                                </li>
                            )}
                        </ul>
                    </section>
                ))}

                {loading && <SettingsAccessSkeleton />}

                {/* Super-admin-only platform controls (maintenance mode).
                    Renders nothing for non-super-admins. */}
                {!loading && canAccessSettings && <MaintenanceSection />}
            </div>
        </div>
    )
}

function SettingsAccessSkeleton() {
    return (
        <div className="mt-10 space-y-3">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex min-h-[72px] items-center gap-4 px-4 py-3">
                        <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
                            <div className="h-3 w-72 max-w-full rounded bg-muted/70 animate-pulse" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function SectionHeader({ label, description }: { label: string; description?: string }) {
    return (
        <div className="px-1">
            {/* The settings menu's group label, the same in both apps. */}
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                {label}
            </h2>
            {description && (
                <p className="mt-1 text-[12.5px] text-muted-foreground/70">{description}</p>
            )}
        </div>
    )
}

function SettingsRow({ item }: { item: SettingsItem }) {
    const Icon = SETTINGS_ICONS[item.icon]
    return (
        <li>
            <Link
                href={item.href}
                className="group flex min-h-[72px] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/60"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold tracking-tight text-foreground">
                        {item.title}
                    </div>
                    {/* Two lines, not one: on a phone a one-line clamp cut
                        every description down to its first few words. */}
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
                        {item.description}
                    </p>
                </div>
                <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground"
                    aria-hidden="true"
                />
            </Link>
        </li>
    )
}
