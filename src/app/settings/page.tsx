import Link from "next/link"
import { Users, GitBranch, Building, Shield, Library, Target, ChevronRight, Database, Tags } from "lucide-react"

const modules = [
    {
        title: "Lead Field Registry",
        description: "Manage which lead fields are available for analysis across goals, segments, and dashboard widgets.",
        href: "/settings/registry",
        icon: Database,
        button: "Manage Fields",
    },
    {
        title: "Lead Dropdown Options",
        description: "Manage categories and options for Streams, Purposes, and Companies.",
        href: "/settings/master-options",
        icon: Library,
        button: "Configure Options",
    },
    {
        title: "Segments & Dimensions",
        description: "Define custom segments by grouping lead field values. Reusable across goals and dashboard analytics.",
        href: "/settings/segments",
        icon: Tags,
        button: "Manage Segments",
    },
    {
        title: "Pipeline & Stages",
        description: "Configure workflow stages for each sales pipeline in your Kanban board.",
        href: "/settings/pipeline",
        icon: GitBranch,
        button: "Manage Stages",
    },
    {
        title: "Company Management",
        description: "Configure holding structure, subsidiaries, and member assignments.",
        href: "/settings/companies",
        icon: Building,
        button: "Manage Companies",
    },
    {
        title: "User Management",
        description: "Manage team hierarchy, roles, sales quotas, and user provisioning.",
        href: "/settings/users",
        icon: Users,
        button: "Manage Users",
    },
    {
        title: "Roles & Permissions",
        description: "Define global access control matrices for all system roles.",
        href: "/settings/permissions",
        icon: Shield,
        button: "Configure Roles",
    },
    {
        title: "Goal Settings",
        description: "Configure goal periods, attribution rules, forecasting, and reporting settings.",
        href: "/settings/goals",
        icon: Target,
        button: "Manage Goals",
        dependencies: "References: Master Options, Pipeline, Companies, Segments",
    },
]

export default function SettingsPage() {
    return (
        <div className="bg-slate-50 min-h-screen">
            <div className="w-full px-10 py-10">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
                    <p className="text-base text-slate-500 mt-1">
                        Configure dropdown options, custom fields, and pipelines for your event leads.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
                    {modules.map((m) => (
                        <Link key={m.href} href={m.href} className="group">
                            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow cursor-pointer h-full">
                                <div>
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit">
                                        <m.icon className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900 mt-4">{m.title}</h3>
                                    <p className="text-sm text-slate-600 mt-1">{m.description}</p>
                                    {"dependencies" in m && m.dependencies && (
                                        <p className="text-[11px] text-slate-400 mt-2 italic">{m.dependencies}</p>
                                    )}
                                </div>
                                <div className="text-blue-600 text-sm font-medium mt-6 flex items-center w-full justify-between border border-slate-200 rounded-lg px-4 py-2 group-hover:bg-slate-50 transition-colors">
                                    {m.button}
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
