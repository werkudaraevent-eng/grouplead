"use client"

import Link from "next/link"
import {
    Users,
    GitBranch,
    Building,
    Shield,
    Target,
    ChevronRight,
    Database,
    ShieldAlert,
    Trash2,
} from "lucide-react"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { CurrencySettingsRow } from "@/features/settings/components/currency-settings-card"
import { MaintenanceSection } from "@/features/settings/components/maintenance-section"
import { usePermissions } from "@/contexts/permissions-context"

type ModuleItem = {
    title: string
    description: string
    href: string
    icon: typeof Users
    permission: {
        module: string
        action: "read" | "create" | "update" | "delete"
    }
}

type ModuleSection = {
    label: string
    description?: string
    items: ModuleItem[]
}

const sections: ModuleSection[] = [
    {
        label: "Configuration",
        description: "Define how leads, pipelines, and goals behave across the workspace.",
        items: [
            {
                title: "Lead attributes & segments",
                description: "Manage lead fields, dropdown options, custom form layouts, and segment rules.",
                href: "/settings/master-options",
                icon: Database,
                permission: { module: "master_options", action: "read" },
            },
            {
                title: "Pipeline & stages",
                description: "Configure workflow stages for each sales pipeline in the Kanban board.",
                href: "/settings/pipeline",
                icon: GitBranch,
                permission: { module: "master_options", action: "read" },
            },
            {
                title: "Goals",
                description: "Periods, attribution rules, forecasting, and reporting settings.",
                href: "/settings/goals",
                icon: Target,
                permission: { module: "goal_settings", action: "read" },
            },
        ],
    },
    {
        label: "Workspace",
        description: "Holding structure, member assignments, and team hierarchy.",
        items: [
            {
                title: "Companies",
                description: "Configure holding structure, subsidiaries, and member assignments.",
                href: "/settings/companies",
                icon: Building,
                permission: { module: "companies", action: "read" },
            },
            {
                title: "Users",
                description: "Manage team hierarchy, roles, sales quotas, and provisioning.",
                href: "/settings/users",
                icon: Users,
                permission: { module: "members", action: "read" },
            },
        ],
    },
    {
        label: "Administration",
        description: "Access control and global display preferences.",
        items: [
            {
                title: "Roles & permissions",
                description: "Define global access control matrices for all system roles.",
                href: "/settings/permissions",
                icon: Shield,
                permission: { module: "permissions", action: "read" },
            },
            {
                title: "Recycle Bin",
                description: "Restore or permanently remove deleted leads, companies, and contacts.",
                href: "/settings/recycle-bin",
                icon: Trash2,
                permission: { module: "permissions", action: "read" },
            },
        ],
    },
]

const CONTAINER = "w-full max-w-[1200px]"

export default function SettingsPage() {
    const { can, loading } = usePermissions()
    const canAccessSettings = can("settings", "read")
    const canSeeCurrency = can("settings", "update")

    const visibleSections = sections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => can(item.permission.module, item.permission.action)),
        }))
        .filter((section) => section.items.length > 0 || (section.label === "Administration" && canSeeCurrency))

    return (
        <div className="min-h-[100dvh] bg-background">
            <SettingsPageHeader
                title="Settings"
                subtitle="Manage your workspace configuration, team, and access control."
            />

            <div className="px-4 sm:px-6 lg:px-8 pb-20">
                <div className={CONTAINER}>
                    {loading ? (
                        <SettingsAccessSkeleton />
                    ) : !canAccessSettings ? (
                        <SettingsAccessDenied />
                    ) : visibleSections.length === 0 ? (
                        <SettingsEmptyAccess />
                    ) : visibleSections.map((section) => (
                        <section key={section.label} className="mt-10 first:mt-6">
                            <SectionHeader label={section.label} description={section.description} />

                            <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                                {section.items.map((item) => (
                                    <SettingsRow key={item.href} item={item} />
                                ))}

                                {/* Currency Display lives in Administration as an inline-expand row */}
                                {section.label === "Administration" && canSeeCurrency && (
                                    <li>
                                        <CurrencySettingsRow />
                                    </li>
                                )}
                            </ul>
                        </section>
                    ))}

                    {/* Super-admin-only platform controls (maintenance mode).
                        Renders nothing for non-super-admins. */}
                    {!loading && canAccessSettings && <MaintenanceSection />}
                </div>
            </div>
        </div>
    )
}

function SettingsAccessDenied() {
    return (
        <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-foreground">Settings access restricted</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                Your role does not have permission to access the Settings hub.
            </p>
        </div>
    )
}

function SettingsEmptyAccess() {
    return (
        <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
            <h2 className="text-sm font-semibold text-foreground">No settings sections available</h2>
            <p className="mt-1 text-sm text-muted-foreground">
                You can open Settings, but your role has no section-level access yet.
            </p>
        </div>
    )
}

function SettingsAccessSkeleton() {
    return (
        <div className="mt-10 space-y-3">
            <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                        <div className="h-9 w-9 rounded-md bg-muted animate-pulse" />
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
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {label}
            </h2>
            {description && (
                <p className="mt-1 text-[12.5px] text-muted-foreground/70">{description}</p>
            )}
        </div>
    )
}

function SettingsRow({ item }: { item: ModuleItem }) {
    const Icon = item.icon
    return (
        <li>
            <Link
                href={item.href}
                className="group flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold tracking-tight text-foreground">
                        {item.title}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[12px] text-muted-foreground">
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
