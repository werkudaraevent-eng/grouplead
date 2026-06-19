"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip } from "@/components/ui/tooltip"
import {
    ShieldCheck, Plus, Loader2, Search, Mail, MoreHorizontal, UserCog, KeyRound, Filter, X, UserX, Trash2,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Profile } from "@/types"
import { EditUserSheet } from "@/features/users/components/edit-user-modal"
import { CreateUserModal } from "@/features/users/components/create-user-modal"
import { adminResetUserPassword } from "@/app/actions/auth-actions"
import { activateUserAction, deactivateUserAction, deleteUserAction } from "@/app/actions/user-actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { getAvatarColor } from "@/lib/avatar"

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    super_admin: { label: "Super Admin", color: "text-red-600", bg: "bg-red-50" },
    admin: { label: "Admin", color: "text-violet-600", bg: "bg-violet-50" },
    executive: { label: "Executive", color: "text-blue-600", bg: "bg-blue-50" },
    leader: { label: "Leader", color: "text-emerald-600", bg: "bg-emerald-50" },
    sales: { label: "Sales", color: "text-amber-600", bg: "bg-amber-50" },
    staff: { label: "Staff", color: "text-slate-500", bg: "bg-slate-50" },
}

export default function UserManagementPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const initialBU = searchParams.get("bu") || "all"

    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [filterRole, setFilterRole] = useState<string>("all")
    const [filterStatus, setFilterStatus] = useState<string>("active")
    const [filterBU, setFilterBU] = useState<string>(initialBU)
    const [togglingId, setTogglingId] = useState<string | null>(null)
    const [inviteOpen, setInviteOpen] = useState(false)
    const [editProfile, setEditProfile] = useState<Profile | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [resetProfile, setResetProfile] = useState<Profile | null>(null)
    const [newPassword, setNewPassword] = useState("")
    const [resetting, setResetting] = useState(false)
    const [deleteProfile, setDeleteProfile] = useState<Profile | null>(null)
    const [deleteMode, setDeleteMode] = useState<"deactivate" | "delete">("deactivate")
    const [deleting, setDeleting] = useState(false)
    const supabase = createClient()

    const handleAdminPasswordReset = async () => {
        if (!resetProfile || !newPassword) return
        setResetting(true)
        const result = await adminResetUserPassword(resetProfile.id, newPassword)
        if (result.success) {
            toast.success(`Password reset for ${resetProfile.full_name || resetProfile.email}`)
            setResetProfile(null)
            setNewPassword("")
        } else {
            toast.error(result.error || "Failed to reset password")
        }
        setResetting(false)
    }

    const handleToggleActive = async (p: Profile, nextActive: boolean) => {
        if (togglingId) return
        // Optimistic update
        setTogglingId(p.id)
        setProfiles((prev) => prev.map((u) => u.id === p.id ? { ...u, is_active: nextActive } : u))
        const result = nextActive
            ? await activateUserAction(p.id)
            : await deactivateUserAction(p.id)
        if (result.success) {
            toast.success(nextActive
                ? `${p.full_name || "User"} reactivated`
                : `${p.full_name || "User"} deactivated \u2014 login blocked`
            )
            fetchProfiles()
        } else {
            // Roll back on failure
            setProfiles((prev) => prev.map((u) => u.id === p.id ? { ...u, is_active: !nextActive } : u))
            toast.error(result.error || "Failed to update status")
        }
        setTogglingId(null)
    }

    const handleDeleteUser = async () => {
        if (!deleteProfile) return
        setDeleting(true)
        const result = deleteMode === "delete"
            ? await deleteUserAction(deleteProfile.id)
            : await deactivateUserAction(deleteProfile.id)
        if (result.success) {
            toast.success(deleteMode === "delete"
                ? `${deleteProfile.full_name || "User"} permanently deleted`
                : `${deleteProfile.full_name || "User"} deactivated`
            )
            setDeleteProfile(null)
            fetchProfiles()
        } else {
            toast.error(result.error || "Operation failed")
        }
        setDeleting(false)
    }

    const fetchProfiles = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("profiles")
            .select("*, assigned_role:roles(name), company_memberships:company_members(company_id, user_type, company:companies(id, name, is_holding))")
            .order("full_name", { ascending: true })
        if (error) console.error("Error fetching profiles:", error)
        else setProfiles((data as Profile[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchProfiles() }, [fetchProfiles])

    // Sync BU filter to URL (enables deep-linking from Company Management)
    useEffect(() => {
        const currentBU = searchParams.get("bu") || "all"
        if (filterBU !== currentBU) {
            const params = new URLSearchParams(searchParams.toString())
            if (filterBU === "all") params.delete("bu")
            else params.set("bu", filterBU)
            const qs = params.toString()
            router.replace(`/settings/users${qs ? `?${qs}` : ""}`, { scroll: false })
        }
    }, [filterBU]) // eslint-disable-line react-hooks/exhaustive-deps

    // Derive unique roles and business units for filter dropdowns
    const uniqueRoles = [...new Set(profiles.map(p => typeof p.role === "string" ? p.role : "").filter(Boolean))].sort()
    const uniqueBUs = [...new Set(profiles.flatMap(p => p.company_memberships?.map(cm => cm.company?.name).filter(Boolean) || []))].sort() as string[]

    const filtered = profiles.filter((p) => {
        const roleStr = typeof p.role === "string" ? p.role : ""
        // Role filter
        if (filterRole !== "all" && roleStr !== filterRole) return false
        // Status filter
        if (filterStatus === "active" && p.is_active === false) return false
        if (filterStatus === "inactive" && p.is_active !== false) return false
        // Business unit filter
        if (filterBU !== "all") {
            const memberOf = p.company_memberships?.some(cm => cm.company?.name === filterBU)
            if (!memberOf) return false
        }
        // Text search
        const q = search.toLowerCase()
        if (!q) return true
        const companyStr = p.company_memberships?.map(cm => cm.company?.name).join(" ") || ""
        return (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)
            || roleStr.toLowerCase().includes(q) || companyStr.toLowerCase().includes(q)
    })

    const hasActiveFilters = filterRole !== "all" || filterStatus !== "active" || filterBU !== "all"
    const clearFilters = () => { setFilterRole("all"); setFilterStatus("active"); setFilterBU("all") }

    const activeCount = profiles.filter((p) => p.is_active !== false).length
    const inactiveCount = profiles.length - activeCount

    const getInitials = (name: string | null) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"

    return (
        <PermissionGate resource="members" action="read" fallback={
            <div className="p-8 text-center text-muted-foreground">You don&apos;t have permission to view users.</div>
        }>
        <div className="space-y-6 w-full">
            <SettingsPageHeader
                title="User Management"
                subtitle="Manage team hierarchy, roles, and sales quotas."
                breadcrumbs={[{ label: "Users" }]}
                actions={
                    <PermissionGate resource="members" action="create">
                        <Button size="sm" onClick={() => setInviteOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Create User</Button>
                    </PermissionGate>
                }
            />

            <div className="px-6 lg:px-8 pb-8 space-y-5">

            {/* Search + Filters */}
            <div className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative max-w-xs flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                        <Input
                            placeholder="Search users..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-9 h-9 bg-muted/40 border-transparent focus:border-border focus:bg-background transition-colors"
                        />
                    </div>

                    <Select value={filterRole} onValueChange={setFilterRole}>
                        <SelectTrigger className="h-9 w-[140px] text-xs">
                            <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                            <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All roles</SelectItem>
                            {uniqueRoles.map(r => (
                                <SelectItem key={r} value={r}>
                                    {ROLE_CONFIG[r]?.label || r}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="h-9 w-[130px] text-xs">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>

                    {uniqueBUs.length > 1 && (
                        <Select value={filterBU} onValueChange={setFilterBU}>
                            <SelectTrigger className="h-9 w-[180px] text-xs">
                                <SelectValue placeholder="Business unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All business units</SelectItem>
                                {uniqueBUs.map(bu => (
                                    <SelectItem key={bu} value={bu}>{bu}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1">
                            <X className="h-3 w-3" /> Clear filters
                        </Button>
                    )}

                    <div className="ml-auto">
                        {!loading && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {activeCount} active · {inactiveCount} inactive
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableHead className="w-[280px] font-semibold text-xs">User</TableHead>
                            <TableHead className="font-semibold text-xs w-[120px]">Role</TableHead>
                            <TableHead className="font-semibold text-xs">Business unit</TableHead>
                            <TableHead className="font-semibold text-xs w-[160px]">Reports to</TableHead>
                            <TableHead className="font-semibold text-xs w-[110px]">Status</TableHead>
                            <TableHead className="w-[52px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-16">
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                                        <span className="text-xs text-muted-foreground">Loading users...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="py-16">
                                    <div className="flex flex-col items-center gap-1.5">
                                        <Search className="h-5 w-5 text-muted-foreground/40" />
                                        <span className="text-sm text-muted-foreground">No users found</span>
                                        {search && <span className="text-xs text-muted-foreground/60">Try a different search term</span>}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {filtered.map((p) => {
                            const roleKey = typeof p.role === "string" ? p.role : ""
                            const role = ROLE_CONFIG[roleKey] || { label: roleKey || "—", color: "text-muted-foreground", bg: "bg-muted" }
                            const inactive = p.is_active === false
                            const companies = p.company_memberships?.filter(cm => cm.company?.name) || []
                            const reportsToName = p.reports_to ? profiles.find((u) => u.id === p.reports_to)?.full_name : null

                            return (
                                <TableRow
                                    key={p.id}
                                    className="group transition-colors hover:bg-muted/20"
                                >
                                    {/* User */}
                                    <TableCell className="py-2">
                                        <div className="flex items-center gap-3">
                                            {p.avatar_url && !inactive ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img
                                                    src={p.avatar_url}
                                                    alt={p.full_name || "User"}
                                                    className="w-8 h-8 rounded-full object-cover shrink-0 border border-border transition-transform group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-transform group-hover:scale-105",
                                                    inactive ? "bg-muted text-muted-foreground/60" : getAvatarColor(p.full_name)
                                                )}>
                                                    {getInitials(p.full_name)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className={cn(
                                                    "font-medium text-[13px] leading-tight truncate",
                                                    inactive && "text-muted-foreground"
                                                )}>{p.full_name || "Unnamed"}</p>
                                                <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{p.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Role — fixed: no more clipping */}
                                    <TableCell className="py-2">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 text-[11px] font-semibold leading-none px-2 py-1.5 rounded-md whitespace-nowrap",
                                            role.bg, role.color
                                        )}>
                                            {roleKey === "super_admin" && <ShieldCheck className="h-3 w-3 shrink-0" />}
                                            {role.label}
                                        </span>
                                    </TableCell>

                                    {/* Business Unit — if holding present, just show "All units" */}
                                    <TableCell className="py-2">
                                        {(() => {
                                            const hasHolding = companies.some(cm => (cm.company as { is_holding?: boolean })?.is_holding)
                                            if (companies.length === 0) {
                                                return <span className="text-[11px] text-muted-foreground/40">Not assigned</span>
                                            }
                                            if (hasHolding) {
                                                return (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                                        All units
                                                    </span>
                                                )
                                            }
                                            // No holding — show individual subsidiaries
                                            const subs = companies.filter(cm => !(cm.company as { is_holding?: boolean })?.is_holding)
                                            return (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {subs.slice(0, 2).map((cm) => (
                                                        <span
                                                            key={cm.company_id}
                                                            className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                                                        >
                                                            {cm.company?.name}
                                                        </span>
                                                    ))}
                                                    {subs.length > 2 && (
                                                        <span className="text-[10px] font-medium text-muted-foreground/60 px-1">
                                                            +{subs.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            )
                                        })()}
                                    </TableCell>

                                    {/* Reports To */}
                                    <TableCell className="py-2">
                                        {reportsToName ? (
                                            <span className="text-[13px]">{reportsToName}</span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/40">—</span>
                                        )}
                                    </TableCell>

                                    {/* Status — interactive toggle (controls login access) */}
                                    <TableCell className="py-2">
                                        <PermissionGate
                                            resource="members"
                                            action="update"
                                            fallback={
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full shrink-0",
                                                        inactive ? "bg-red-400" : "bg-emerald-500"
                                                    )} />
                                                    <span className={cn(
                                                        "text-[11px] font-medium",
                                                        inactive ? "text-red-500" : "text-muted-foreground"
                                                    )}>
                                                        {inactive ? "Inactive" : "Active"}
                                                    </span>
                                                </div>
                                            }
                                        >
                                            <div className="flex items-center gap-2">
                                                <Tooltip
                                                    position="left"
                                                    content={inactive
                                                        ? "Inactive — cannot log in or be assigned leads"
                                                        : "Active — can log in and be assigned leads"}
                                                >
                                                    <Switch
                                                        checked={!inactive}
                                                        disabled={togglingId === p.id}
                                                        onCheckedChange={(checked) => handleToggleActive(p, checked)}
                                                        aria-label={inactive ? "Activate user" : "Deactivate user"}
                                                    />
                                                </Tooltip>
                                                <span className={cn(
                                                    "text-[11px] font-medium w-[52px]",
                                                    inactive ? "text-muted-foreground" : "text-emerald-600"
                                                )}>
                                                    {inactive ? "Inactive" : "Active"}
                                                </span>
                                            </div>
                                        </PermissionGate>
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="py-2">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => { setEditProfile(p); setEditOpen(true) }}>
                                                    <UserCog className="h-3.5 w-3.5 mr-2" /> Edit profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setResetProfile(p); setNewPassword("") }}>
                                                    <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset password
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => { setDeleteProfile(p); setDeleteMode("delete") }}
                                                    className="text-red-600 focus:text-red-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete permanently
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            </div>

            {/* Edit Profile Sheet */}
            <EditUserSheet profile={editProfile} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchProfiles} />

            {/* Create User Modal */}
            <CreateUserModal open={inviteOpen} onOpenChange={setInviteOpen} onCreated={fetchProfiles} />

            {/* Admin Password Reset Dialog */}
            <Dialog open={!!resetProfile} onOpenChange={(open) => { if (!open) { setResetProfile(null); setNewPassword("") } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5" /> Reset Password
                        </DialogTitle>
                        <DialogDescription>
                            Force-reset the password for <strong>{resetProfile?.full_name || resetProfile?.email}</strong>. The user will need to use the new password on their next login.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                type="password"
                                placeholder="Minimum 8 characters"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                autoComplete="new-password"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setResetProfile(null); setNewPassword("") }}>Cancel</Button>
                        <Button
                            onClick={handleAdminPasswordReset}
                            disabled={resetting || newPassword.length < 8}
                        >
                            {resetting ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <KeyRound className="h-4 w-4 mr-1.5" />}
                            Reset Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete / Deactivate Confirmation Dialog */}
            <Dialog open={!!deleteProfile} onOpenChange={(open) => { if (!open) setDeleteProfile(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {deleteMode === "delete"
                                ? <><Trash2 className="h-5 w-5 text-red-500" /> Delete user</>
                                : <><UserX className="h-5 w-5 text-amber-500" /> Deactivate user</>
                            }
                        </DialogTitle>
                        <DialogDescription>
                            {deleteMode === "delete" ? (
                                <>This will <strong>permanently delete</strong> <strong>{deleteProfile?.full_name || deleteProfile?.email}</strong> and remove all their data including auth credentials. This cannot be undone.</>
                            ) : (
                                <>This will deactivate <strong>{deleteProfile?.full_name || deleteProfile?.email}</strong>. They will no longer be able to log in, but their data will be preserved. You can reactivate them later.</>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteProfile(null)} disabled={deleting}>Cancel</Button>
                        <Button
                            variant={deleteMode === "delete" ? "destructive" : "default"}
                            onClick={handleDeleteUser}
                            disabled={deleting}
                        >
                            {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                            {deleteMode === "delete" ? "Delete permanently" : "Deactivate"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
        </PermissionGate>
    )
}
