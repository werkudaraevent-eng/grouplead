"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { PermissionGate } from "@/components/permission-gate"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, Check, X } from "lucide-react"
import type { RolePermission, UserType } from "@/types/company"

const USER_TYPES: UserType[] = ["staff", "leader", "executive", "admin", "super_admin"]
const RESOURCES = ["leads", "lead_tasks", "master_options", "companies", "members"] as const
const ACTIONS = ["create", "read", "update", "delete"] as const

type Resource = typeof RESOURCES[number]
type Action = typeof ACTIONS[number]

// Map (resource, user_type, action) → is_allowed
type PermMatrix = Record<string, boolean>

function matrixKey(resource: Resource, userType: UserType, action: Action) {
    return `${resource}:${userType}:${action}`
}

interface PermissionsMatrixPageProps {}

export default function PermissionsMatrixPage({}: PermissionsMatrixPageProps) {
    const params = useParams()
    const slug = params.slug as string

    const [companyId, setCompanyId] = useState<string | null>(null)
    const [companyName, setCompanyName] = useState("")
    const [matrix, setMatrix] = useState<PermMatrix>({})
    const [permIds, setPermIds] = useState<Record<string, string>>({}) // key → row id
    const [loading, setLoading] = useState(true)
    const [toggling, setToggling] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    const fetchData = useCallback(async () => {
        setLoading(true)
        setError(null)

        // Resolve company by slug
        const { data: company, error: compErr } = await supabase
            .from("companies")
            .select("id, name")
            .eq("slug", slug)
            .single()

        if (compErr || !company) {
            setError("Company not found.")
            setLoading(false)
            return
        }

        setCompanyId(company.id)
        setCompanyName(company.name)

        // Fetch all role_permissions for this company
        const { data: perms, error: permErr } = await supabase
            .from("role_permissions")
            .select("*")
            .eq("company_id", company.id)

        if (permErr) {
            setError(permErr.message)
            setLoading(false)
            return
        }

        const newMatrix: PermMatrix = {}
        const newIds: Record<string, string> = {}

        for (const perm of (perms as RolePermission[]) || []) {
            const key = matrixKey(perm.resource as Resource, perm.user_type, perm.action as Action)
            newMatrix[key] = perm.is_allowed
            newIds[key] = perm.id
        }

        setMatrix(newMatrix)
        setPermIds(newIds)
        setLoading(false)
    }, [slug])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    const handleToggle = async (resource: Resource, userType: UserType, action: Action) => {
        if (!companyId) return
        const key = matrixKey(resource, userType, action)
        const current = matrix[key] ?? false
        const newValue = !current

        setToggling(key)

        const existingId = permIds[key]

        if (existingId) {
            // Update existing row
            const { error } = await supabase
                .from("role_permissions")
                .update({ is_allowed: newValue })
                .eq("id", existingId)

            if (error) {
                setError(error.message)
            } else {
                setMatrix((prev) => ({ ...prev, [key]: newValue }))
            }
        } else {
            // Insert new row
            const { data, error } = await supabase
                .from("role_permissions")
                .insert({
                    company_id: companyId,
                    user_type: userType,
                    resource,
                    action,
                    is_allowed: newValue,
                })
                .select("id")
                .single()

            if (error) {
                setError(error.message)
            } else {
                setMatrix((prev) => ({ ...prev, [key]: newValue }))
                setPermIds((prev) => ({ ...prev, [key]: data.id }))
            }
        }

        setToggling(null)
    }

    const USER_TYPE_LABELS: Record<UserType, string> = {
        staff: "Staff",
        leader: "Leader",
        executive: "Executive",
        admin: "Admin",
        super_admin: "Super Admin",
    }

    return (
        <PermissionGate resource="companies" action="update" fallback={
            <div className="p-8 text-center text-muted-foreground">
                You don&apos;t have permission to manage permissions.
            </div>
        }>
            <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        Permissions Matrix
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {companyName ? `Configure role permissions for ${companyName}` : "Configure role permissions"}
                    </p>
                </div>

                {error && (
                    <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg text-sm">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border bg-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-muted/30">
                                    <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-40">
                                        Resource / Action
                                    </th>
                                    {USER_TYPES.map((ut) => (
                                        <th
                                            key={ut}
                                            className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground"
                                            colSpan={ACTIONS.length}
                                        >
                                            {USER_TYPE_LABELS[ut]}
                                        </th>
                                    ))}
                                </tr>
                                <tr className="border-b bg-muted/10">
                                    <th className="px-4 py-2" />
                                    {USER_TYPES.map((ut) =>
                                        ACTIONS.map((action) => (
                                            <th
                                                key={`${ut}-${action}`}
                                                className="text-center px-2 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                                            >
                                                {action[0].toUpperCase()}
                                            </th>
                                        ))
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {RESOURCES.map((resource, rIdx) => (
                                    <tr
                                        key={resource}
                                        className={`border-b last:border-0 ${rIdx % 2 === 0 ? "bg-background" : "bg-muted/10"}`}
                                    >
                                        <td className="px-4 py-3 font-medium text-sm capitalize">
                                            {resource.replace("_", " ")}
                                        </td>
                                        {USER_TYPES.map((ut) =>
                                            ACTIONS.map((action) => {
                                                const key = matrixKey(resource, ut, action)
                                                const allowed = matrix[key] ?? false
                                                const isToggling = toggling === key

                                                return (
                                                    <td key={`${ut}-${action}`} className="text-center px-2 py-3">
                                                        <button
                                                            onClick={() => handleToggle(resource, ut, action)}
                                                            disabled={isToggling}
                                                            className={`
                                                                w-7 h-7 rounded-md border-2 flex items-center justify-center mx-auto transition-all
                                                                ${allowed
                                                                    ? "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600"
                                                                    : "bg-background border-muted-foreground/20 text-muted-foreground/30 hover:border-muted-foreground/40"
                                                                }
                                                                ${isToggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                                                            `}
                                                            title={`${allowed ? "Deny" : "Allow"} ${ut} to ${action} ${resource}`}
                                                        >
                                                            {isToggling ? (
                                                                <Loader2 className="h-3 w-3 animate-spin" />
                                                            ) : allowed ? (
                                                                <Check className="h-3 w-3" />
                                                            ) : (
                                                                <X className="h-3 w-3" />
                                                            )}
                                                        </button>
                                                    </td>
                                                )
                                            })
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <p className="text-xs text-muted-foreground">
                    C = Create, R = Read, U = Update, D = Delete. Missing rows default to deny.
                </p>
            </div>
        </PermissionGate>
    )
}
