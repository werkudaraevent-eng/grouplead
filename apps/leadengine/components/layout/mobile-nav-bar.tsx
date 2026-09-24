"use client"

import Link from "next/link"
import { useState } from "react"
import { createPortal } from "react-dom"
import { usePathname, useRouter } from "next/navigation"
import {
    Building2,
    Check,
    ChevronDown,
    ExternalLink,
    Globe,
    Loader2,
    LogOut,
    MapPinned,
    Menu,
    ScrollText,
    Settings,
    UserCircle,
} from "@/components/icons"
import { BottomSheet, SheetRow } from "@/components/ui/bottom-sheet"
import { InitialsAvatar } from "@/components/shared/initials-avatar"
import { AppTransit } from "@/components/layout/app-transit"
import { salesMissionUrl, useAppTransit } from "@/components/layout/app-switcher"
import { DESTINATION_ICONS } from "@/components/layout/destination-icons"
import { useSignOut } from "@/components/layout/use-sign-out"
import { useCompany } from "@/contexts/company-context"
import { usePermissions } from "@/contexts/permissions-context"
import {
    CHANGELOG_HREF,
    DESTINATIONS,
    PROFILE_HREF,
    SETTINGS_HREF,
    canOpenSettings,
    isActiveHref,
    isMoreActive,
    permittedDestinations,
    roleLabel,
} from "@/lib/navigation/app-nav"
import { cn } from "@/lib/utils"

interface Profile {
    full_name: string | null
    role: string | null
    avatar_url: string | null
}

/**
 * Material's navigation bar, below `lg`. Twin of Sales Activity's
 * `components/mobile-nav-bar.tsx`.
 *
 * The drawer's daily destinations (Dashboard, Pipeline, Companies,
 * Contacts), each only for whoever may read it, then "More": icon over
 * label, the current one under a tonal pill, 80dp plus the home
 * indicator's inset. Everything else the drawer carries (Settings, the
 * account menu's pages, the business unit and the app switcher, sign-out)
 * is behind More in a bottom sheet, so the bar keeps to the places a person
 * opens every day.
 *
 * It is the last row of the shell's column, not an overlay: `<main>` ends
 * where it starts, so no page can scroll content under it and nothing needs
 * a padding for it.
 */
export function MobileNavBar({ profile }: { profile: Profile | null }) {
    const pathname = usePathname()
    const { can, loading } = usePermissions()
    const [moreOpen, setMoreOpen] = useState(false)

    const destinations = loading ? [] : permittedDestinations(can)
    const moreActive = !loading && isMoreActive(pathname, destinations)
    const cells = (loading ? DESTINATIONS.length : destinations.length) + 1

    return (
        <>
            <nav aria-label="Main navigation" className="shrink-0 border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
                <ul className="grid h-20" style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}>
                    {loading
                        ? // Placeholders while the grants load, as the drawer draws them,
                          // so no destination shows and then vanishes.
                          DESTINATIONS.map((destination) => (
                              <li key={destination.key} aria-hidden="true" className="flex flex-col items-center justify-center gap-1">
                                  <span className="h-8 w-16 animate-pulse rounded-full bg-muted" />
                                  <span className="h-3 w-12 animate-pulse rounded bg-muted" />
                              </li>
                          ))
                        : destinations.map((destination) => {
                              const active = isActiveHref(pathname, destination.href)
                              const Icon = DESTINATION_ICONS[destination.key]
                              return (
                                  <li key={destination.key}>
                                      <Link
                                          href={destination.href}
                                          aria-current={active ? "page" : undefined}
                                          className="flex h-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
                                      >
                                          <span className={cn("grid h-8 w-16 place-items-center rounded-full transition-colors", active && "bg-[var(--tonal)] text-[var(--tonal-foreground)]")}>
                                              <Icon className="h-6 w-6" aria-hidden="true" />
                                          </span>
                                          <span className={cn("max-w-full truncate px-1", active && "text-foreground")}>{destination.label}</span>
                                      </Link>
                                  </li>
                              )
                          })}
                    <li>
                        <button
                            type="button"
                            onClick={() => setMoreOpen(true)}
                            aria-haspopup="dialog"
                            aria-expanded={moreOpen}
                            aria-current={moreActive ? "page" : undefined}
                            className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs font-medium text-muted-foreground"
                        >
                            <span className={cn("grid h-8 w-16 place-items-center rounded-full transition-colors", moreActive && "bg-[var(--tonal)] text-[var(--tonal-foreground)]")}>
                                <Menu className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <span className={cn(moreActive && "text-foreground")}>More</span>
                        </button>
                    </li>
                </ul>
            </nav>

            <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} profile={profile} />
        </>
    )
}

/**
 * Behind More, in the order Sales Activity's Lainnya keeps: the pages
 * (Settings, My profile, the changelog), then what the drawer's header
 * holds (the business unit, the other app), then the account and the way
 * out. The panel toggle is not here: it recolours the drawer, which a phone
 * does not have.
 */
function MoreSheet({ open, onOpenChange, profile }: { open: boolean; onOpenChange: (open: boolean) => void; profile: Profile | null }) {
    const pathname = usePathname()
    const router = useRouter()
    const { can, loading } = usePermissions()
    const { activeCompany, companies, isHoldingView, switchCompany, isSwitching } = useCompany()
    const { signOut, signingOut } = useSignOut()
    const { leaving, leaveTo } = useAppTransit()
    const [unitsOpen, setUnitsOpen] = useState(false)

    const setOpen = (next: boolean) => {
        if (!next) setUnitsOpen(false)
        onOpenChange(next)
    }
    const go = (href: string) => {
        setOpen(false)
        router.push(href)
    }

    const showSettings = !loading && canOpenSettings(can)
    // Known only after the browser-side permission read; until then the row is not drawn.
    const salesActivityUrl = !loading && can("sales_mission", "read") ? salesMissionUrl : null
    const name = profile?.full_name || "Account"

    // The drawer header's switcher, as a disclosure: the unit in view, and
    // on a tap the units to choose from, the holding first.
    const holding = companies.find((company) => company.isHolding)
    const units = companies.filter((company) => !company.isHolding)
    const unitName = isHoldingView ? "Werkudara Group" : activeCompany?.name ?? "Werkudara"
    const canSwitch = (holding ? 1 : 0) + units.length > 1
    const choose = (slug: string) => {
        setOpen(false)
        switchCompany(slug)
    }

    return (
        <>
            <BottomSheet open={open} onOpenChange={setOpen} title="More" description={name}>
                <div className="space-y-1 px-2 pb-2">
                    {showSettings && (
                        <SheetRow
                            icon={Settings}
                            label="Settings"
                            active={isActiveHref(pathname, SETTINGS_HREF) && !isActiveHref(pathname, PROFILE_HREF)}
                            onClick={() => go(SETTINGS_HREF)}
                        />
                    )}
                    <SheetRow icon={UserCircle} label="My profile" active={isActiveHref(pathname, PROFILE_HREF)} onClick={() => go(PROFILE_HREF)} />
                    {showSettings && (
                        <SheetRow icon={ScrollText} label="Changelog" hint="The latest changes to the app" active={isActiveHref(pathname, CHANGELOG_HREF)} onClick={() => go(CHANGELOG_HREF)} />
                    )}

                    <div className="my-2 border-t" />

                    <SheetRow
                        icon={isHoldingView ? Globe : Building2}
                        label={unitName}
                        hint={isSwitching ? "Loading…" : isHoldingView ? "Every business unit" : "Single unit"}
                        disabled={!canSwitch || isSwitching}
                        aria-expanded={canSwitch ? unitsOpen : undefined}
                        aria-controls={canSwitch ? "more-sheet-units" : undefined}
                        onClick={() => setUnitsOpen((value) => !value)}
                        trailing={
                            isSwitching ? (
                                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                            ) : canSwitch ? (
                                <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", unitsOpen && "rotate-180")} aria-hidden="true" />
                            ) : undefined
                        }
                    />
                    {canSwitch && unitsOpen && (
                        <div id="more-sheet-units" role="radiogroup" aria-labelledby="more-sheet-units-label" className="pb-1 pl-4">
                            <p id="more-sheet-units-label" className="px-4 pb-1 pt-1 text-xs font-medium text-muted-foreground">View data for</p>
                            {holding && (
                                <UnitChoice label="Werkudara Group" icon={<Globe className="h-5 w-5 text-muted-foreground" aria-hidden="true" />} checked={isHoldingView} onChoose={() => choose("holding")} />
                            )}
                            {units.map((company) => (
                                <UnitChoice
                                    key={company.id}
                                    label={company.name}
                                    icon={
                                        company.logoUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={company.logoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                                        ) : (
                                            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                                        )
                                    }
                                    checked={!isHoldingView && activeCompany?.id === company.id}
                                    onChoose={() => choose(company.slug)}
                                />
                            ))}
                        </div>
                    )}

                    {salesActivityUrl && (
                        <a
                            href={salesActivityUrl}
                            onClick={(event) => {
                                setOpen(false)
                                leaveTo("sales-mission", salesActivityUrl, event)
                            }}
                            className="flex min-h-14 w-full items-center gap-4 rounded-xl px-4 text-left text-sm text-foreground transition-colors hover:bg-muted"
                        >
                            <MapPinned className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                                <span className="block truncate">Sales Activity</span>
                                <span className="block truncate text-xs text-muted-foreground">Switch to the field sales app</span>
                            </span>
                            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </a>
                    )}

                    <div className="my-2 border-t" />

                    <div className="flex min-h-14 items-center gap-4 px-4">
                        <InitialsAvatar name={name} src={profile?.avatar_url} size="md" className="h-10 w-10 text-sm" />
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{roleLabel(profile?.role)}</span>
                        </span>
                        <button
                            type="button"
                            onClick={signOut}
                            disabled={signingOut}
                            aria-label="Sign out"
                            title="Sign out"
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            {signingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </BottomSheet>
            {leaving && createPortal(<AppTransit app={leaving} phase="leaving" />, document.body)}
        </>
    )
}

/** One business unit to choose, a 48dp radio row with a check on the one in view. */
function UnitChoice({ label, icon, checked, onChoose }: { label: string; icon: React.ReactNode; checked: boolean; onChoose: () => void }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={onChoose}
            className={cn(
                "flex min-h-12 w-full items-center gap-4 rounded-xl px-4 text-left text-sm transition-colors",
                checked ? "bg-[var(--tonal)] font-medium text-[var(--tonal-foreground)]" : "text-foreground hover:bg-muted",
            )}
        >
            <span className="grid h-5 w-5 shrink-0 place-items-center">{icon}</span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {checked && <Check className="h-5 w-5 shrink-0" aria-hidden="true" />}
        </button>
    )
}
