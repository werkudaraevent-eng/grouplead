/**
 * LeadEngine's destinations, and who may see them: one list read by the
 * drawer on a desk (`components/layout/sidebar.tsx`) and by the navigation
 * bar on a phone (`components/layout/mobile-nav-bar.tsx`), so the two can
 * never disagree about what a person may open.
 *
 * Hiding a destination is presentation only. Every page behind it checks
 * the grant again on the server (`requirePermission`), because a hidden
 * link leaves its URL working.
 *
 * Pure on purpose: no icons, no React. The components map each destination
 * to its icon.
 */

/** Asks the permission matrix, as `usePermissions().can` does. */
export type Can = (module: string, action: string) => boolean

export type DestinationKey = "dashboard" | "pipeline" | "companies" | "contacts"

export interface Destination {
    key: DestinationKey
    href: string
    label: string
    /** The module whose read grant opens it. */
    module: string
}

/** The daily destinations, in the drawer's order (M3: 3 to 5 in a navigation bar). */
export const DESTINATIONS: readonly Destination[] = [
    { key: "dashboard", href: "/", label: "Dashboard", module: "dashboard" },
    { key: "pipeline", href: "/leads", label: "Pipeline", module: "leads" },
    { key: "companies", href: "/companies", label: "Companies", module: "companies" },
    { key: "contacts", href: "/contacts", label: "Contacts", module: "contacts" },
]

export const SETTINGS_HREF = "/settings"
/** Settings › Account › Profile: everyone's own page, no grant needed. */
export const PROFILE_HREF = "/settings/profile"
/** Settings › Account › Active devices: everyone's own page, no grant needed. */
export const DEVICES_HREF = "/settings/devices"
export const CHANGELOG_HREF = "/changelog"

/** The destinations this person may open, in order. */
export function permittedDestinations(can: Can): Destination[] {
    return DESTINATIONS.filter((destination) => can(destination.module, "read"))
}

/**
 * Settings, and the changelog beside it, open for whoever holds the Settings
 * grant (section-level access is handled inside /settings). Settings ›
 * Account (Profile, Active devices) is everyone's own and needs no grant.
 */
export function canOpenSettings(can: Can): boolean {
    return can("settings", "read")
}

/** Whether `href` is the place `pathname` is in: the dashboard only at "/", the rest with everything under them. */
export function isActiveHref(pathname: string, href: string): boolean {
    if (href === "/") return pathname === "/"
    return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The phone's More item is current when no destination in the bar is: a
 * page reached from the More sheet (Settings, Profile, Active devices, the
 * changelog).
 */
export function isMoreActive(pathname: string, destinations: readonly Destination[]): boolean {
    return !destinations.some((destination) => isActiveHref(pathname, destination.href))
}

/**
 * The product's name on screen: the tab title, the installed app, the
 * drawer's header, the app switcher, the transit screen and every sentence
 * that names the app. Two words, capital G and L. The code, the folders,
 * the package and the environment variables keep "leadengine"; only what a
 * person reads says this.
 */
export const PRODUCT_NAME = "Group Lead"

/**
 * The drawer header's second line, under the product's name: the scope the
 * data is shown for. The holding's view is every unit at once; a single
 * unit is named. No unit at all (a person the admin has not yet placed)
 * says so rather than inventing one.
 */
export function unitScopeLabel(isHoldingView: boolean, unitName: string | null | undefined): string {
    if (isHoldingView) return "Every business unit"
    return unitName?.trim() || "No business unit"
}

/**
 * The top app bar's title before the page announces its own (the first
 * HTML, a page that announces none): the destination the address is in,
 * so the bar does not read the product's name and then change a moment later.
 */
export function fallbackTitle(pathname: string): string {
    const destination = DESTINATIONS.find((item) => isActiveHref(pathname, item.href))
    if (destination) return destination.label
    if (isActiveHref(pathname, SETTINGS_HREF)) return "Settings"
    if (isActiveHref(pathname, CHANGELOG_HREF)) return "Changelog"
    return PRODUCT_NAME
}

const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    director: "Director",
    bu_manager: "BU Manager",
    sales: "Sales",
    finance: "Finance",
}

/** The line under a person's name in the drawer's account block and the More sheet. */
export function roleLabel(role: string | null | undefined): string {
    return role ? ROLE_LABELS[role] ?? role : "User"
}
