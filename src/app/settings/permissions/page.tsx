"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { RoleModal } from "@/features/roles/components/create-role-modal"
import { Loader2, ShieldCheck, Shield, Lock, Crown, UserCog, User, Plus, ChevronRight, Pencil, Trash2, Info } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { RolePermission, AppModule, Role } from "@/types/company"

/* ─── Icon mapping for known system roles; custom roles get a generic Shield ──── */
const ROLE_ICON_MAP: Record<string, React.ElementType> = {
  "Super Admin": Crown,
  "Admin": ShieldCheck,
  "Executive": Shield,
  "Leader": UserCog,
  "Staff": User,
}

const CAN_READ_OPTIONS = ["none", "own", "company", "all"] as const
const READ_LABELS: Record<string, string> = {
  none: "No Access",
  own: "Own Records",
  company: "Company-wide",
  all: "Cross-company",
}

export default function GlobalPermissionsPage() {
  const { activeCompany, isHoldingView, companies } = useCompany()
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)

  /* ─── Dynamic roles state ──────────────────────────────────────────────── */
  const [roles, setRoles] = useState<Role[]>([])
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null)

  const [modules, setModules] = useState<AppModule[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [rolesLoading, setRolesLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const companyId = selectedCompanyId ?? activeCompany?.id ?? null
  const isSuperAdmin = selectedRole?.name === "Super Admin"

  /* ─── Fetch roles from DB ──────────────────────────────────────────────── */
  const fetchRoles = useCallback(async () => {
    setRolesLoading(true)
    const { data, error: err } = await supabase
      .from("roles")
      .select("*")
      .order("sort_order", { ascending: true })

    if (err) { setError(err.message); setRolesLoading(false); return }

    const fetched = (data as Role[]) ?? []
    setRoles(fetched)

    // Auto-select the first role if nothing selected yet
    setSelectedRole((prev) => {
      if (prev && fetched.find((r) => r.id === prev.id)) return prev
      return fetched[0] ?? null
    })
    setRolesLoading(false)
  }, [])

  /* ─── Fetch modules + permissions for selected role ────────────────────── */
  const fetchPermissions = useCallback(async () => {
    if (!companyId || !selectedRole) return
    setLoading(true)
    setError(null)

    const { data: mods, error: modErr } = await supabase
      .from("app_modules")
      .select("*")
      .order("sort_order", { ascending: true })

    if (modErr) { setError(modErr.message); setLoading(false); return }
    setModules((mods as AppModule[]) ?? [])

    const { data: perms, error: permErr } = await supabase
      .from("role_permissions")
      .select("*")
      .eq("company_id", companyId)
      .eq("role_id", selectedRole.id)

    if (permErr) { setError(permErr.message); setLoading(false); return }
    setPermissions((perms as RolePermission[]) ?? [])
    setLoading(false)
  }, [companyId, selectedRole?.id])

  useEffect(() => { fetchRoles() }, [fetchRoles])
  useEffect(() => { fetchPermissions() }, [fetchPermissions])

  /* ─── Permission helpers ───────────────────────────────────────────────── */
  const findPerm = (moduleId: string) =>
    permissions.find((p) => p.module_id === moduleId)

  const handleToggleBool = async (
    moduleId: string,
    field: "can_create" | "can_update" | "can_delete"
  ) => {
    if (!companyId || !selectedRole || isSuperAdmin) return
    const key = `${moduleId}:${selectedRole.id}:${field}`
    setToggling(key)

    const perm = findPerm(moduleId)
    if (perm) {
      const newVal = !perm[field]
      const { error } = await supabase
        .from("role_permissions")
        .update({ [field]: newVal })
        .eq("id", perm.id)
      if (error) { setError(error.message); toast.error("Failed to update permission") }
      else {
        setPermissions((prev) =>
          prev.map((p) => (p.id === perm.id ? { ...p, [field]: newVal } : p))
        )
        // Propagate to subsidiaries when editing from Holding View
        if (isHoldingView && companies.length > 1) {
          await propagateToSubsidiaries(moduleId, { [field]: newVal })
        }
        toast.success("Permission updated")
      }
    } else {
      const insertPayload = {
        company_id: companyId,
        role_id: selectedRole.id,
        module_id: moduleId,
        can_create: field === "can_create",
        can_read: "none" as const,
        can_update: field === "can_update",
        can_delete: field === "can_delete",
      }
      const { data, error } = await supabase
        .from("role_permissions")
        .insert(insertPayload)
        .select("*")
        .single()
      if (error) { setError(error.message); toast.error("Failed to update permission") }
      else if (data) {
        setPermissions((prev) => [...prev, data as RolePermission])
        // Propagate to subsidiaries when editing from Holding View
        if (isHoldingView && companies.length > 1) {
          await propagateToSubsidiaries(moduleId, {
            can_create: insertPayload.can_create,
            can_read: insertPayload.can_read,
            can_update: insertPayload.can_update,
            can_delete: insertPayload.can_delete,
          })
        }
        toast.success("Permission updated")
      }
    }
    setToggling(null)
  }

  const handleChangeRead = async (moduleId: string, value: string) => {
    if (!companyId || !selectedRole || isSuperAdmin) return
    const key = `${moduleId}:${selectedRole.id}:can_read`
    setToggling(key)

    const perm = findPerm(moduleId)
    if (perm) {
      // Cascade: if setting to 'none', force CUD off in the same update
      const cascadePayload: Record<string, unknown> = { can_read: value }
      if (value === 'none') {
        cascadePayload.can_create = false
        cascadePayload.can_update = false
        cascadePayload.can_delete = false
      }
      const { error } = await supabase
        .from("role_permissions")
        .update(cascadePayload)
        .eq("id", perm.id)
      if (error) { setError(error.message); toast.error("Failed to update read scope") }
      else {
        setPermissions((prev) =>
          prev.map((p) => (p.id === perm.id ? { ...p, ...cascadePayload as Partial<RolePermission> } : p))
        )
        // Propagate to subsidiaries when editing from Holding View
        if (isHoldingView && companies.length > 1) {
          await propagateToSubsidiaries(moduleId, cascadePayload)
        }
        toast.success("Read scope updated")
      }
    } else {
      const insertPayload = {
        company_id: companyId,
        role_id: selectedRole.id,
        module_id: moduleId,
        can_create: false,
        can_read: value as RolePermission["can_read"],
        can_update: false,
        can_delete: false,
      }
      const { data, error } = await supabase
        .from("role_permissions")
        .insert(insertPayload)
        .select("*")
        .single()
      if (error) { setError(error.message); toast.error("Failed to update read scope") }
      else if (data) {
        setPermissions((prev) => [...prev, data as RolePermission])
        // Propagate to subsidiaries when editing from Holding View
        if (isHoldingView && companies.length > 1) {
          await propagateToSubsidiaries(moduleId, {
            can_create: false,
            can_read: value,
            can_update: false,
            can_delete: false,
          })
        }
        toast.success("Read scope updated")
      }
    }
    setToggling(null)
  }

  /* ─── Propagate permission changes from Holding → all subsidiaries ───── */
  const propagateToSubsidiaries = async (
    moduleId: string,
    updates: Record<string, unknown>
  ) => {
    if (!selectedRole) return
    const subsidiaryIds = companies
      .filter((c) => c.id !== companyId && !c.isHolding)
      .map((c) => c.id)

    for (const subId of subsidiaryIds) {
      // Check if row exists for this subsidiary
      const { data: existing } = await supabase
        .from("role_permissions")
        .select("id")
        .eq("role_id", selectedRole.id)
        .eq("company_id", subId)
        .eq("module_id", moduleId)
        .maybeSingle()

      if (existing) {
        await supabase
          .from("role_permissions")
          .update(updates)
          .eq("id", existing.id)
      } else {
        // Insert new row for subsidiary with current holding values
        const holdingPerm = findPerm(moduleId)
        await supabase
          .from("role_permissions")
          .insert({
            company_id: subId,
            role_id: selectedRole.id,
            module_id: moduleId,
            can_create: false,
            can_read: "none",
            can_update: false,
            can_delete: false,
            ...holdingPerm ? {
              can_create: holdingPerm.can_create,
              can_read: holdingPerm.can_read,
              can_update: holdingPerm.can_update,
              can_delete: holdingPerm.can_delete,
            } : {},
            ...updates,
          })
      }
    }
  }

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  const getRoleName = (roleId: string) => roles.find((r) => r.id === roleId)?.name ?? "Unknown"
  const getRoleIcon = (roleName: string): React.ElementType => ROLE_ICON_MAP[roleName] ?? Shield

  const openRoleModal = (role: Role | null = null) => {
    setEditingRole(role)
    setRoleModalOpen(true)
  }

  const handleDeleteRole = async () => {
    if (!roleToDelete) return
    const supabase = createClient()
    const { error } = await supabase.from("roles").delete().eq("id", roleToDelete.id)
    if (error) {
      toast.error("Failed to delete. Users or child roles may still be attached.")
    } else {
      setRoles((prev) => prev.filter((r) => r.id !== roleToDelete.id))
      if (selectedRole?.id === roleToDelete.id) setSelectedRole(null)
      toast.success(`Role "${roleToDelete.name}" deleted`)
    }
    setRoleToDelete(null)
  }

  const companyName = isHoldingView
    ? companies.find((c) => c.id === companyId)?.name ?? "All Companies"
    : activeCompany?.name ?? ""

  /* ─── Render ───────────────────────────────────────────────────────────── */
  return (
    <PermissionGate resource="companies" action="update" fallback={
      <div className="p-8 text-center text-muted-foreground">You don&apos;t have permission to manage permissions.</div>
    }>
      <div className="p-6 lg:p-8 space-y-6 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" /> Roles &amp; Permissions
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure access control matrices per role{companyName ? ` — ${companyName}` : ""}
            </p>
          </div>
          {isHoldingView && (
            <Select value={companyId ?? ""} onValueChange={(val) => setSelectedCompanyId(val)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select company" />
              </SelectTrigger>
              <SelectContent>
                {companies.filter((c) => !c.isHolding).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        {rolesLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* ─── Left: Dynamic Role Sidebar ──────────────────────────── */}
            <div className="col-span-12 lg:col-span-3">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Role Hierarchy
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-muted"
                  onClick={() => openRoleModal()}
                  title="Create new role"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              <nav className="flex flex-row lg:flex-col gap-1">
                {roles.map((role) => {
                  const Icon = getRoleIcon(role.name)
                  const isActive = selectedRole?.id === role.id
                  return (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-all w-full",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <div className="hidden lg:block min-w-0">
                        <div className={cn("font-medium truncate", isActive ? "text-primary-foreground" : "text-foreground")}>
                          {role.name}
                        </div>
                        {role.parent_id ? (
                          <div className={cn(
                            "text-[11px] truncate flex items-center gap-0.5",
                            isActive ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            {getRoleName(role.parent_id)}
                          </div>
                        ) : role.description ? (
                          <div className={cn("text-xs truncate", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                            {role.description}
                          </div>
                        ) : null}
                      </div>
                      <span className="lg:hidden font-medium">{role.name}</span>
                    </button>
                  )
                })}
              </nav>
            </div>

            {/* ─── Right: Permissions Matrix ────────────────────────────── */}
            <div className="col-span-12 lg:col-span-9">
              {selectedRole ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {(() => { const Icon = getRoleIcon(selectedRole.name); return <Icon className="h-5 w-5" /> })()}
                          {selectedRole.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {selectedRole.description || "No description provided"}
                        </CardDescription>
                      </div>
                      {isSuperAdmin ? (
                        <div className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 border border-amber-200 shrink-0">
                          <Lock className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">Immutable — full access granted</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => openRoleModal(selectedRole)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                          </Button>
                          {!selectedRole.is_system && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              onClick={() => setRoleToDelete(selectedRole)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : modules.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        No modules configured. Seed the <code>app_modules</code> table first.
                      </div>
                    ) : (
                      <>
                      {/* ─── Data Visibility Scope Legend ──────────────────── */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                          <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Data Visibility Scopes (Read Access)</span>
                        </div>
                        <ul className="text-[13px] text-slate-600 space-y-1.5 ml-6 list-disc">
                          <li><strong className="text-slate-800">No Access:</strong> Module is completely hidden from the user&apos;s sidebar and all create/update/delete toggles are disabled.</li>
                          <li><strong className="text-slate-800">Own Records:</strong> Strict isolation. User only sees data they created or are explicitly assigned to as owner.</li>
                          <li><strong className="text-slate-800">Company-wide:</strong> Business unit isolation. User sees all data within the specific subsidiaries they are assigned to (via the User Matrix).</li>
                          <li><strong className="text-slate-800">Cross-company:</strong> Global visibility. User sees all data across the entire holding and all subsidiaries, bypassing company assignments. <span className="text-amber-600 font-medium">(Use for Super Admins/Directors only).</span></li>
                        </ul>
                      </div>

                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10">
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[200px]">Module</th>
                              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Create</th>
                              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Read Scope</th>
                              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Update</th>
                              <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Delete</th>
                            </tr>
                          </thead>
                          <tbody>
                            {modules.map((mod) => {
                              const perm = findPerm(mod.id)
                              const isReadLocked = !isSuperAdmin && (perm?.can_read ?? 'none') === 'none'
                              return (
                                <tr key={mod.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-4">
                                    <div className="font-medium">{mod.name}</div>
                                    {mod.description && (
                                      <div className="text-xs text-muted-foreground mt-0.5">{mod.description}</div>
                                    )}
                                  </td>
                                  <td className="text-center px-4 py-4">
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={isSuperAdmin ? true : (perm?.can_create ?? false)}
                                        disabled={isSuperAdmin || isReadLocked || toggling === `${mod.id}:${selectedRole.id}:can_create`}
                                        onCheckedChange={() => handleToggleBool(mod.id, "can_create")}
                                        className={isReadLocked ? 'opacity-40 cursor-not-allowed' : ''}
                                      />
                                    </div>
                                  </td>
                                  <td className="text-center px-4 py-4">
                                    {isSuperAdmin ? (
                                      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                                        Cross-company
                                      </span>
                                    ) : (
                                      <Select
                                        value={perm?.can_read ?? "none"}
                                        onValueChange={(val) => handleChangeRead(mod.id, val)}
                                        disabled={toggling === `${mod.id}:${selectedRole.id}:can_read`}
                                      >
                                        <SelectTrigger className="h-8 w-[140px] mx-auto text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {CAN_READ_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt} className="text-xs">
                                              {READ_LABELS[opt]}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </td>
                                  <td className="text-center px-4 py-4">
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={isSuperAdmin ? true : (perm?.can_update ?? false)}
                                        disabled={isSuperAdmin || isReadLocked || toggling === `${mod.id}:${selectedRole.id}:can_update`}
                                        onCheckedChange={() => handleToggleBool(mod.id, "can_update")}
                                        className={isReadLocked ? 'opacity-40 cursor-not-allowed' : ''}
                                      />
                                    </div>
                                  </td>
                                  <td className="text-center px-4 py-4">
                                    <div className="flex justify-center">
                                      <Switch
                                        checked={isSuperAdmin ? true : (perm?.can_delete ?? false)}
                                        disabled={isSuperAdmin || isReadLocked || toggling === `${mod.id}:${selectedRole.id}:can_delete`}
                                        onCheckedChange={() => handleToggleBool(mod.id, "can_delete")}
                                        className={isReadLocked ? 'opacity-40 cursor-not-allowed' : ''}
                                      />
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
                  {roles.length === 0
                    ? "No roles found. Create one to get started."
                    : "Select a role to configure permissions."}
                </div>
              )}


            </div>
          </div>
        )}
      </div>

      {/* Role Upsert Modal */}
      <RoleModal
        open={roleModalOpen}
        onOpenChange={setRoleModalOpen}
        existingRoles={roles}
        editingRole={editingRole}
        onSaved={fetchRoles}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role: {roleToDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Ensure no users are currently assigned to this role before deleting, or the system will reject the action. Child roles will lose their parent hierarchy link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRoleToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDeleteRole}
            >
              Force Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGate>
  )
}
