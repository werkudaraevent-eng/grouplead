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
    ShieldCheck, Plus, Loader2, Search, Mail, MoreHorizontal, UserCog, Target, KeyRound,
} from "lucide-react"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Profile } from "@/types"
import { EditUserSheet } from "@/features/users/components/edit-user-modal"
import { TargetManagementModal } from "@/features/users/components/target-management-modal"
import { CreateUserModal } from "@/features/users/components/create-user-modal"
import { adminResetUserPassword } from "@/app/actions/auth-actions"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const ROLE_BADGES: Record<string, { label: string; class: string }> = {
    super_admin: { label: "Super Admin", class: "bg-red-100 text-red-700 border-red-200" },
    admin: { label: "Admin", class: "bg-purple-100 text-purple-700 border-purple-200" },
    executive: { label: "Executive", class: "bg-blue-100 text-blue-700 border-blue-200" },
    leader: { label: "Leader", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    staff: { label: "Staff", class: "bg-amber-100 text-amber-700 border-amber-200" },
}

export default function UserManagementPage() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [inviteOpen, setInviteOpen] = useState(false)
    const [editProfile, setEditProfile] = useState<Profile | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [targetProfile, setTargetProfile] = useState<Profile | null>(null)
    const [targetOpen, setTargetOpen] = useState(false)
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

    const filtered = profiles.filter((p) => {
        const q = search.toLowerCase()
        const roleStr = typeof p.role === "string" ? p.role : ""
        const companyStr = p.company_memberships?.map(cm => cm.company?.name).join(" ") || ""
        return !q || (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)
            || roleStr.toLowerCase().includes(q) || companyStr.toLowerCase().includes(q)
    })

    const getInitials = (name: string | null) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"

    return (
        <div className="p-6 lg:p-8 space-y-6 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" /> User Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage team hierarchy, roles, and sales quotas.</p>
                </div>
                <PermissionGate resource="members" action="create">
                    <Button size="sm" onClick={() => setInviteOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Create User</Button>
                </PermissionGate>
            </div>

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, email, role..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>

            <div className="border rounded-xl bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-[250px]">User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Business Unit</TableHead>
                            <TableHead>Reports To</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="w-[60px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow><TableCell colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                        )}
                        {!loading && filtered.length === 0 && (
                            <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No users found.</TableCell></TableRow>
                        )}
                        {filtered.map((p) => {
                            const roleKey = typeof p.role === "string" ? p.role : ""
                            const badge = ROLE_BADGES[roleKey] || { label: roleKey || "Unknown", class: "bg-gray-100 text-gray-600" }
                            const inactive = p.is_active === false
                            return (
                                <TableRow key={p.id} className={cn(
                                    "hover:bg-muted/30 transition-colors",
                                    inactive && "opacity-50"
                                )}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                                                inactive ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                                            )}>{getInitials(p.full_name)}</div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate">{p.full_name || "—"}</p>
                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{p.email || "—"}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${badge.class}`}>
                                            {badge.label}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {(p.company_memberships && p.company_memberships.length > 0)
                                                ? p.company_memberships.map((cm) => (
                                                    <span key={cm.company_id} className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                        {cm.company?.name || "—"}
                                                    </span>
                                                ))
                                                : <span className="text-sm text-muted-foreground">—</span>
                                            }
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm">
                                            {p.reports_to
                                                ? profiles.find((u) => u.id === p.reports_to)?.full_name || "—"
                                                : "—"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className={cn(
                                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
                                            inactive
                                                ? "bg-red-50 text-red-600 border-red-200"
                                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                        )}>
                                            {inactive ? "Inactive" : "Active"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => { setEditProfile(p); setEditOpen(true) }}>
                                                    <UserCog className="h-3.5 w-3.5 mr-2" /> Edit Profile
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setTargetProfile(p); setTargetOpen(true) }}>
                                                    <Target className="h-3.5 w-3.5 mr-2" /> Manage Quota
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => { setResetProfile(p); setNewPassword("") }}>
                                                    <KeyRound className="h-3.5 w-3.5 mr-2" /> Reset Password
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

            {/* Edit Profile Sheet */}
            <EditUserSheet profile={editProfile} open={editOpen} onOpenChange={setEditOpen} onSaved={fetchProfiles} />

            {/* Quota Modal */}
            <TargetManagementModal profile={targetProfile} open={targetOpen} onOpenChange={setTargetOpen} />

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
