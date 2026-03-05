'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PermissionGate } from '@/components/permission-gate'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Users, Plus, Loader2, Trash2, UserCog, Mail } from 'lucide-react'
import type { CompanyMember, UserType } from '@/types/company'

const USER_TYPE_BADGES: Record<UserType, { label: string; class: string }> = {
  staff:       { label: 'Staff',       class: 'bg-gray-100 text-gray-700 border-gray-200' },
  leader:      { label: 'Leader',      class: 'bg-blue-100 text-blue-700 border-blue-200' },
  executive:   { label: 'Executive',   class: 'bg-purple-100 text-purple-700 border-purple-200' },
  admin:       { label: 'Admin',       class: 'bg-orange-100 text-orange-700 border-orange-200' },
  super_admin: { label: 'Super Admin', class: 'bg-red-100 text-red-700 border-red-200' },
}

const USER_TYPES: UserType[] = ['staff', 'leader', 'executive', 'admin', 'super_admin']

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

export default function CompanyMembersPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<CompanyMember | null>(null)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [selectedProfile, setSelectedProfile] = useState('')
  const [selectedUserType, setSelectedUserType] = useState<UserType>('staff')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)

    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('slug', params.slug)
      .single()

    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    setCompanyName(company.name)

    const { data: memberData } = await supabase
      .from('company_members')
      .select('*, profiles(full_name, email, avatar_url)')
      .eq('company_id', company.id)
      .order('created_at', { ascending: true })

    setMembers((memberData as CompanyMember[]) || [])
    setLoading(false)
  }, [params.slug])

  useEffect(() => { fetchData() }, [fetchData])

  const openAddDialog = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name, email, avatar_url').order('full_name')
    setAllProfiles((data as Profile[]) || [])
    setSelectedProfile('')
    setSelectedUserType('staff')
    setAddOpen(true)
  }

  const handleAddMember = async () => {
    if (!companyId || !selectedProfile) return
    setSaving(true)
    const { error } = await supabase.from('company_members').insert({
      company_id: companyId,
      user_id: selectedProfile,
      user_type: selectedUserType,
    })
    if (error) alert(error.message)
    else { setAddOpen(false); fetchData() }
    setSaving(false)
  }

  const handleChangeUserType = async () => {
    if (!editingMember) return
    setSaving(true)
    const { error } = await supabase
      .from('company_members')
      .update({ user_type: selectedUserType })
      .eq('id', editingMember.id)
    if (error) alert(error.message)
    else { setEditOpen(false); fetchData() }
    setSaving(false)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the company?')) return
    const { error } = await supabase.from('company_members').delete().eq('id', memberId)
    if (error) alert(error.message)
    else fetchData()
  }

  const getInitials = (name: string | null) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => router.push('/settings/companies')}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Companies
          </button>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {companyName || 'Members'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage team members and their roles in this company.
          </p>
        </div>
        <PermissionGate resource="members" action="create">
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Member
          </Button>
        </PermissionGate>
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-[280px]">Member</TableHead>
              <TableHead>User Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && members.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                  No members yet.
                </TableCell>
              </TableRow>
            )}
            {members.map((member) => {
              const profile = member.profiles as Profile | undefined
              const badge = USER_TYPE_BADGES[member.user_type as UserType]
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {getInitials(profile?.full_name ?? null)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{profile?.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3 shrink-0" />{profile?.email || '—'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${badge?.class}`}>
                      {badge?.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <PermissionGate resource="members" action="update">
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => { setEditingMember(member); setSelectedUserType(member.user_type as UserType); setEditOpen(true) }}
                        >
                          <UserCog className="h-3 w-3 mr-1" /> Change Role
                        </Button>
                      </PermissionGate>
                      <PermissionGate resource="members" action="delete">
                        <Button
                          variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-3 w-3 mr-1" /> Remove
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>Select a user and assign their role in {companyName}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>User</Label>
              <Select value={selectedProfile} onValueChange={setSelectedProfile}>
                <SelectTrigger><SelectValue placeholder="Select a user" /></SelectTrigger>
                <SelectContent>
                  {allProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email || p.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>User Type</Label>
              <Select value={selectedUserType} onValueChange={(v) => setSelectedUserType(v as UserType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {USER_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{USER_TYPE_BADGES[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMember} disabled={saving || !selectedProfile}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change User Type</DialogTitle>
            <DialogDescription>
              Update the role for {(editingMember?.profiles as Profile | undefined)?.full_name || 'this member'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>User Type</Label>
            <Select value={selectedUserType} onValueChange={(v) => setSelectedUserType(v as UserType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_TYPES.map(t => (
                  <SelectItem key={t} value={t}>{USER_TYPE_BADGES[t].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleChangeUserType} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
