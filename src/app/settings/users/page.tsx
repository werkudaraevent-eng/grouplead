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
import { Input } from "@/components/ui/input"
import {
    ShieldCheck, Plus, Loader2, Search, Mail, MoreHorizontal, Network, Target,
} from "lucide-react"
import { PermissionGate } from "@/components/permission-gate"
import { Profile } from "@/types"
import { EditUserModal } from "@/components/edit-user-modal"
import { TargetManagementModal } from "@/components/target-management-modal"
import { CreateUserModal } from "@/components/create-user-modal"

const ROLE_BADGES: Record<string, { label: string; class: string }> = {
    super_admin: { label: "Super Admin", class: "bg-red-100 text-red-700 border-red-200" },
    director: { label: "Director", class: "bg-purple-100 text-purple-700 border-purple-200" },
    bu_manager: { label: "BU Manager", class: "bg-blue-100 text-blue-700 border-blue-200" },
    sales: { label: "Sales", class: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    finance: { label: "Finance", class: "bg-amber-100 text-amber-700 border-amber-200" },
}
const TIER_LABELS: Record<number, string> = { 1: "Staff", 2: "Team Lead", 3: "Manager", 4: "Director", 5: "VP+" }

export default function UserManagementPage() {
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [inviteOpen, setInviteOpen] = useState(false)
    const [editOrgProfile, setEditOrgProfile] = useState<Profile | null>(null)
    const [editOrgOpen, setEditOrgOpen] = useState(false)
    const [targetProfile, setTargetProfile] = useState<Profile | null>(null)
    const [targetOpen, setTargetOpen] = useState(false)
    const supabase = createClient()

    const fetchProfiles = useCallback(async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("profiles")
            .select("*, manager:profiles!reports_to(full_name)")
            .order("role_tier", { ascending: false })
        if (error) console.error("Error fetching profiles:", error)
        else setProfiles((data as Profile[]) || [])
        setLoading(false)
    }, [])

    useEffect(() => { fetchProfiles() }, [fetchProfiles])

    const filtered = profiles.filter((p) => {
        const q = search.toLowerCase()
        return !q || (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q)
            || (p.role || "").toLowerCase().includes(q) || (p.business_unit || "").toLowerCase().includes(q)
    })

    const getInitials = (name: string | null) => name ? name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) : "?"

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-6xl">
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
                            <TableHead>Tier</TableHead>
                            <TableHead>Business Unit</TableHead>
                            <TableHead>Reports To</TableHead>
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
                            const badge = ROLE_BADGES[p.role] || { label: p.role, class: "bg-gray-100 text-gray-600" }
                            return (
                                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">{getInitials(p.full_name)}</div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-sm truncate">{p.full_name || "—"}</p>
                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{p.email || "—"}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell><span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${badge.class}`}>{badge.label}</span></TableCell>
                                    <TableCell><span className="text-sm">{TIER_LABELS[p.role_tier ?? 1] || `Tier ${p.role_tier}`}</span></TableCell>
                                    <TableCell><span className="text-sm">{p.business_unit || "—"}</span></TableCell>
                                    <TableCell><span className="text-sm">{p.manager?.full_name || "—"}</span></TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => { setEditOrgProfile(p); setEditOrgOpen(true) }}>
                                                    <Network className="h-3.5 w-3.5 mr-2" /> Edit Org Structure
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => { setTargetProfile(p); setTargetOpen(true) }}>
                                                    <Target className="h-3.5 w-3.5 mr-2" /> Manage Quota
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

            {/* Org Structure Modal */}
            <EditUserModal profile={editOrgProfile} open={editOrgOpen} onOpenChange={setEditOrgOpen} onSaved={fetchProfiles} />

            {/* Quota Modal */}
            <TargetManagementModal profile={targetProfile} open={targetOpen} onOpenChange={setTargetOpen} />

            {/* Create User Modal */}
            <CreateUserModal open={inviteOpen} onOpenChange={setInviteOpen} onCreated={fetchProfiles} />
        </div>
    )
}
