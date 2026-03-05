"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Button } from "@/components/ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    ShieldCheck,
    Plus,
    Loader2,
    UserCog,
    Search,
    Mail,
} from "lucide-react"
import { PermissionGate } from "@/components/permission-gate"

interface Profile {
    id: string
    email: string | null
    full_name: string | null
    role: string
    department: string | null
    job_title: string | null
    avatar_url: string | null
    is_active: boolean
    created_at: string
}

const ROLE_BADGES: Record<string, { label: string; class: string }> = {
    super_admin: { label: "Super Admin", class: "bg-red-100 text-red-700 border-red-200" },
    director: { label: "Director", class: "bg-purple-100 text-purple-700 border-purple-200" },
    bu_manager: { label: "BU Manager", class: "bg-blue-100 text-blue-700 border-blue-200" },
    sales: { label: "Sales", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    finance: { label: "Finance", class: "bg-amber-100 text-amber-700 border-amber-200" },
}

const DEPT_BADGES: Record<string, string> = {
    WNW: "bg-violet-50 text-violet-700",
    WNS: "bg-sky-50 text-sky-700",
    UK: "bg-rose-50 text-rose-700",
    TEP: "bg-amber-50 text-amber-700",
    CREATIVE: "bg-pink-50 text-pink-700",
    FINANCE: "bg-emerald-50 text-emerald-700",
    LEGAL: "bg-orange-50 text-orange-700",
    PD: "bg-cyan-50 text-cyan-700",
    SO: "bg-indigo-50 text-indigo-700",
    ACS: "bg-teal-50 text-teal-700",
}

const ROLES = ["super_admin", "director", "bu_manager", "sales", "finance"] as const
const DEPARTMENTS = ["WNW", "WNS", "UK", "TEP", "CREATIVE", "FINANCE", "LEGAL", "PD", "SO", "ACS"] as const

export default function UserManagementPage() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [inviteOpen, setInviteOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<Profile | null>(null)
    const [editRole, setEditRole] = useState("")
    const [editDept, setEditDept] = useState("")
    const [saving, setSaving] = useState(false)

    const supabase = createClient()

    const fetchProfiles = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .order("created_at", { ascending: true })

        if (error) console.error("Error fetching profiles:", error)
        else setProfiles((data as Profile[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchProfiles()
    }, [fetchProfiles])

    const filteredProfiles = profiles.filter((p) => {
        const q = search.toLowerCase()
        return (
            !q ||
            (p.full_name || "").toLowerCase().includes(q) ||
            (p.email || "").toLowerCase().includes(q) ||
            (p.role || "").toLowerCase().includes(q) ||
            (p.department || "").toLowerCase().includes(q)
        )
    })

    const handleEditClick = (profile: Profile) => {
        setEditingUser(profile)
        setEditRole(profile.role)
        setEditDept(profile.department || "")
        setEditOpen(true)
    }

    const handleSaveRole = async () => {
        if (!editingUser) return
        setSaving(true)
        const { error } = await supabase
            .from("profiles")
            .update({ role: editRole, department: editDept || null })
            .eq("id", editingUser.id)

        if (error) {
            alert(`Error: ${error.message}`)
        } else {
            setEditOpen(false)
            fetchProfiles()
        }
        setSaving(false)
    }

    const getInitials = (name: string | null) => {
        if (!name) return "?"
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ShieldCheck className="h-6 w-6 text-primary" />
                        User Management
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage team roles, departments, and access permissions.
                    </p>
                </div>
                <PermissionGate resource="members" action="create">
                    <Button size="sm" onClick={() => setInviteOpen(true)}>
                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Invite User
                    </Button>
                </PermissionGate>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name, email, or role..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                />
            </div>

            {/* Table */}
            <div className="border rounded-xl bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/30">
                            <TableHead className="w-[280px]">User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Department</TableHead>
                            <TableHead>Title</TableHead>
                            <TableHead className="w-[80px]">Status</TableHead>
                            <TableHead className="w-[80px] text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                </TableCell>
                            </TableRow>
                        )}
                        {!loading && filteredProfiles.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                    No users found.
                                </TableCell>
                            </TableRow>
                        )}
                        {filteredProfiles.map((profile) => {
                            const roleBadge = ROLE_BADGES[profile.role] || {
                                label: profile.role,
                                class: "bg-gray-100 text-gray-600",
                            }
                            const deptClass = DEPT_BADGES[profile.department || ""] || "bg-gray-50 text-gray-600"

                            return (
                                <TableRow
                                    key={profile.id}
                                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                                    onClick={() => handleEditClick(profile)}
                                >
                                    {/* User */}
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                                {getInitials(profile.full_name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate">{profile.full_name || "—"}</p>
                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                    <Mail className="h-3 w-3 shrink-0" />
                                                    {profile.email || "—"}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>

                                    {/* Role */}
                                    <TableCell>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${roleBadge.class}`}>
                                            {roleBadge.label}
                                        </span>
                                    </TableCell>

                                    {/* Department */}
                                    <TableCell>
                                        {profile.department ? (
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${deptClass}`}>
                                                {profile.department}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </TableCell>

                                    {/* Title */}
                                    <TableCell className="text-sm text-muted-foreground">
                                        {profile.job_title || "—"}
                                    </TableCell>

                                    {/* Status */}
                                    <TableCell>
                                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${profile.is_active ? "text-green-600" : "text-red-500"}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${profile.is_active ? "bg-green-500" : "bg-red-400"}`} />
                                            {profile.is_active ? "Active" : "Inactive"}
                                        </span>
                                    </TableCell>

                                    {/* Action */}
                                    <TableCell className="text-right">
                                        <PermissionGate resource="members" action="update">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs"
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleEditClick(profile)
                                                }}
                                            >
                                                <UserCog className="h-3 w-3 mr-1" /> Edit
                                            </Button>
                                        </PermissionGate>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>

            {/* Edit Role Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User Role</DialogTitle>
                        <DialogDescription>
                            Update role and department for <strong>{editingUser?.full_name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={editRole} onValueChange={setEditRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {ROLE_BADGES[r]?.label || r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={editDept} onValueChange={setEditDept}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">— No Department —</SelectItem>
                                    {DEPARTMENTS.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveRole} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Invite User Dialog (Mocked) */}
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Invite Team Member</DialogTitle>
                        <DialogDescription>
                            Send an invitation email to add a new team member.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label htmlFor="inviteEmail">Email Address</Label>
                            <Input id="inviteEmail" type="email" placeholder="colleague@company.com" />
                        </div>
                        <div className="space-y-2">
                            <Label>Assign Role</Label>
                            <Select defaultValue="sales">
                                <SelectTrigger>
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ROLES.map((r) => (
                                        <SelectItem key={r} value={r}>
                                            {ROLE_BADGES[r]?.label || r}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Assign Department</Label>
                            <Select>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                                <SelectContent>
                                    {DEPARTMENTS.map((d) => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                        <Button onClick={() => { alert("Invitation sent! (Mocked)"); setInviteOpen(false) }}>
                            <Mail className="h-4 w-4 mr-2" /> Send Invitation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
