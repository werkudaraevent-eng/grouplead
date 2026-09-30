/**
 * Settings' places, and who sees which: one list read by the settings menu
 * beside every settings page on a desk (`SettingsFrame`) and by the Settings
 * page itself, the list a phone opens, so the two can never disagree about
 * what a person may open (DESIGN.md "Settings layout and page width").
 *
 * Account is everyone's: someone who may open no other setting still
 * reaches Profile and Active devices, and sees only that group. The other
 * groups need the Settings grant (`settings` read), and each row its own
 * grant, as the Settings page has always filtered them. Hiding a row is
 * presentation only; the settings layout and each page check on the server.
 *
 * Pure on purpose: no icons, no React. The components map each item's
 * `icon` to its glyph.
 */

import { DEVICES_HREF, PROFILE_HREF, SETTINGS_HREF, type Can } from "@/lib/navigation/app-nav"

export type SettingsIconKey =
    | "profile"
    | "devices"
    | "master-options"
    | "pipeline"
    | "goals"
    | "companies"
    | "users"
    | "announcements"
    | "history"
    | "usage"
    | "permissions"
    | "recycle-bin"
    | "ai"

export interface SettingsItem {
    href: string
    title: string
    /** The supporting line under the title on the Settings page. */
    description: string
    icon: SettingsIconKey
    /** The grant that shows the row; none for Account's rows. */
    permission?: { module: string; action: "read" | "create" | "update" | "delete" }
    /**
     * Pages that belong to this row without sitting under its address
     * (Segments and the field registry are part of Lead attributes).
     */
    also?: readonly string[]
}

export interface SettingsGroup {
    id: string
    label: string
    description: string
    items: SettingsItem[]
    /** Shown to every signed-in person, whatever their role (Account). */
    everyone?: boolean
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
    {
        id: "account",
        label: "Account",
        description: "Your profile, and the devices where your account is signed in.",
        everyone: true,
        items: [
            {
                title: "Profile",
                description: "Name, photo, phone, job title and password. One profile for Group Lead and Sales Activity.",
                href: PROFILE_HREF,
                icon: "profile",
            },
            {
                title: "Active devices",
                description: "Where your account is signed in. Sign out a device you don't recognise.",
                href: DEVICES_HREF,
                icon: "devices",
            },
        ],
    },
    {
        id: "configuration",
        label: "Configuration",
        description: "Define how leads, pipelines, and goals behave across the workspace.",
        items: [
            {
                title: "Lead attributes & segments",
                description: "Manage lead fields, dropdown options, custom form layouts, and segment rules.",
                href: "/settings/master-options",
                icon: "master-options",
                permission: { module: "master_options", action: "read" },
                also: ["/settings/segments", "/settings/registry"],
            },
            {
                title: "Pipeline & stages",
                description: "Configure workflow stages for each sales pipeline in the Kanban board.",
                href: "/settings/pipeline",
                icon: "pipeline",
                permission: { module: "master_options", action: "read" },
            },
            {
                title: "Goals",
                description: "Periods, attribution rules, forecasting, and reporting settings.",
                href: "/settings/goals",
                icon: "goals",
                permission: { module: "goal_settings", action: "read" },
            },
        ],
    },
    {
        id: "workspace",
        label: "Workspace",
        description: "Holding structure, member assignments, and team hierarchy.",
        items: [
            {
                title: "Companies",
                description: "Configure holding structure, subsidiaries, and member assignments.",
                href: "/settings/companies",
                icon: "companies",
                permission: { module: "companies", action: "read" },
            },
            {
                title: "Users",
                description: "Manage team hierarchy, roles, sales quotas, and provisioning.",
                href: "/settings/users",
                icon: "users",
                permission: { module: "members", action: "read" },
            },
        ],
    },
    {
        id: "communication",
        label: "Communication",
        description: "What is announced to the team.",
        items: [
            {
                title: "Announcements",
                description: "Which releases the What's new dialog announces on the dashboard, and announcing one again after a training.",
                href: "/settings/announcements",
                icon: "announcements",
                permission: { module: "settings", action: "update" },
            },
        ],
    },
    {
        id: "monitoring",
        label: "Monitoring",
        description: "Who changed what, and who actually uses the app.",
        items: [
            {
                title: "Change history",
                description: "Who created, changed and deleted what across Group Lead, with filters by person, action and record. Recorded automatically.",
                href: "/settings/history",
                icon: "history",
                permission: { module: "settings", action: "read" },
            },
            {
                title: "Usage",
                description: "Who opens Group Lead and when they last did, days active, and the pages opened most. Admins only.",
                href: "/settings/usage",
                icon: "usage",
                permission: { module: "settings", action: "read" },
            },
        ],
    },
    {
        id: "administration",
        label: "Administration",
        description: "Access control and global display preferences.",
        items: [
            {
                title: "Roles & permissions",
                description: "Define global access control matrices for all system roles.",
                href: "/settings/permissions",
                icon: "permissions",
                permission: { module: "permissions", action: "read" },
            },
            {
                title: "Recycle bin",
                description: "Restore or permanently remove deleted leads, companies, and contacts.",
                href: "/settings/recycle-bin",
                icon: "recycle-bin",
                permission: { module: "permissions", action: "read" },
            },
            {
                title: "AI",
                description: "Endpoint, API key and models for the AI features. One connection, shared with Sales Activity.",
                href: "/settings/ai",
                icon: "ai",
                permission: { module: "settings", action: "update" },
            },
        ],
    },
]

/**
 * The groups this person sees, in order, each with only the rows their
 * grants open: Account always; the rest with the Settings grant, a group
 * left out when none of its rows is open.
 */
export function visibleSettingsGroups(can: Can, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): SettingsGroup[] {
    const canOpenSettings = can("settings", "read")
    return groups
        .filter((group) => group.everyone || canOpenSettings)
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => !item.permission || can(item.permission.module, item.permission.action)),
        }))
        .filter((group) => group.items.length > 0)
}

function under(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The menu row the page at `pathname` belongs to: the row itself, a page
 * below it (a pipeline's page is Pipeline & stages'), or one it lists in
 * `also`. Null on the Settings page, and outside Settings.
 */
export function activeSettingsItem(pathname: string, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): SettingsItem | null {
    let best: SettingsItem | null = null
    let bestLength = 0
    for (const group of groups) {
        for (const item of group.items) {
            for (const href of [item.href, ...(item.also ?? [])]) {
                if (under(pathname, href) && href.length > bestLength) {
                    best = item
                    bestLength = href.length
                }
            }
        }
    }
    return best
}

/**
 * The Settings pages open without the Settings grant: the Settings page
 * itself (on a phone, the list Account's pages go back to) and Account's
 * pages. The settings layout lets exactly these through.
 */
export function isOpenSettingsPath(pathname: string, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): boolean {
    if (pathname === SETTINGS_HREF) return true
    return groups.some((group) => group.everyone && group.items.some((item) => under(pathname, item.href)))
}

/** Whether `pathname` is one of Account's pages (Profile, Active devices). */
export function isAccountPath(pathname: string, groups: readonly SettingsGroup[] = SETTINGS_GROUPS): boolean {
    return pathname !== SETTINGS_HREF && isOpenSettingsPath(pathname, groups)
}
