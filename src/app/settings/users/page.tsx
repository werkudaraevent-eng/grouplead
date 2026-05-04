"use client"

import { useEffect, useState, useCallback } from "react"
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
import {
    ShieldCheck, Plus, Loader2, Search, Mail, MoreHorizontal, UserCog, KeyRound, Filter, X,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Profile } from "@/types"
import { EditUserSheet } from "@/features/users/components/edit-user-modal"
import { CreateUserModal } from "@/features/users/components/create-user-modal"
import { adminResetUserPassword } from "@/app/actions/auth-actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    super_admin: { label: "Super Admin", color: "text-red-600", bg: "bg-red-50" },
    admin: { label: "Admin", color: "text-violet-600", bg: "bg-violet-50" },
    executive: { label: "Executive", color: "text-blue-600", bg: "bg-blue-50" },
    leader: { label: "Leader", color: "text-emerald-600", bg: "bg-emerald-50" },
    sales: { label: "Sales", color: "text-amber-600", bg: "bg-amber-50" },
    staff: { label: "Staff", color: "text-slate-500", bg: "bg-slate-50" },
}

/** Avatar color based on name hash — consistent per user */
const AVATAR_COLORS = [
    "bg-indigo-100 text-indigo-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-violet-100 text-violet-700",
    "bg-teal-100 text-teal-700",
    "bg-orange-100 text-orange-700",
]
const getAvatarColor = (name: string | null) => {
    if (!name) return AVATAR_COLORS[0]
    const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
    return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export default function UserManagementPage() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [filterRole, setFilterRole] = useState<string>("all")
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterBU, setFilterBU] = useState<string>("all")
    const [inviteOpen, setInviteOpen] = useState(false)
    const [editProfile, setEditProfile] = useState<Profile | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [resetProfile, setResetProfile] = useState<Profile | null>(null)
    const [newPassword, setNewPassword] = useState("")
    const [resetting, setResetting] = useState(false)
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

    const fetchProfiles = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("profiles")
            .select("*, assigned_role:roles(name), company_memberships:company_members(company_id, user_type, company:companies(id, name))")
            .order("full_name", { ascending: true })
        if (error) console.error("Error fetching profiles:", error)
        else setProfiles((data as Profile[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchProfiles() }, [fetchProfiles])

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

    const hasActiveFilters = filterRole !== "all" || filterStatus !== "all" || filterBU !== "all"
    const clearFilters = () => { setFilterRole("all"); setFilterStatus("all"); setFilterBU("all") }

    const getInitials = (name: string | null) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"

    return (
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
                                {filtered.length} of {profiles.length} {profiles.length === 1 ? "user" : "users"}
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
                            <TableHead className="font-semibold text-xs w-[80px]">Status</TableHead>
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
                                    className={cn(
                                        "group transition-colors",
                                        inactive ? "opacity-40" : "hover:bg-muted/20"
                                    )}
                                >
                                    {/* User */}
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 transition-transform group-hover:scale-105",
                                                inactive ? "bg-muted text-muted-foreground" : getAvatarColor(p.full_name)
                                            )}>
                                                {getInitials(p.full_name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-[13px] leading-tight truncate">{p.full_name || "Unnamed"}</p>
                                                <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{p.email}</p>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Role — fixed: no more clipping */}
                                    <TableCell className="py-3">
                                        <span className={cn(
                                            "inline-flex items-center gap-1 text-[11px] font-semibold leading-none px-2 py-1.5 rounded-md whitespace-nowrap",
                                            role.bg, role.color
                                        )}>
                                            {roleKey === "super_admin" && <ShieldCheck className="h-3 w-3 shrink-0" />}
                                            {role.label}
                                        </span>
                                    </TableCell>

                                    {/* Business Unit — compact with overflow */}
                                    <TableCell className="py-3">
                                        {companies.length > 0 ? (
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {companies.slice(0, 3).map((cm) => (
                                                    <span
                                                        key={cm.company_id}
                                                        className="text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                                                    >
                                                        {cm.company?.name}
                                                    </span>
                                                ))}
                                                {companies.length > 3 && (
                                                    <span className="text-[10px] font-medium text-muted-foreground/60 px-1">
                                                        +{companies.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/40">Not assigned</span>
                                        )}
                                    </TableCell>

                                    {/* Reports To */}
                                    <TableCell className="py-3">
                                        {reportsToName ? (
                                            <span className="text-[13px]">{reportsToName}</span>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground/40">—</span>
                                        )}
                                    </TableCell>

                                    {/* Status — dot indicator instead of loud badge */}
                                    <TableCell className="py-3">
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
                                    </TableCell>

                                    {/* Actions */}
                                    <TableCell className="py-3">
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
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => { setResetProfile(p); setNewPassword("") }}>
                                                    <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset password
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
        </div>
    )
}
