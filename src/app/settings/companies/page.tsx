'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PermissionGate } from '@/features/users/components/permission-gate'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Building2, Globe, Plus, Loader2, Users, Pencil, Trash2, Search, MoreHorizontal } from 'lucide-react'
import { SettingsPageHeader } from "@/components/layout/settings-page-header"
import { toast } from 'sonner'
import { CompanyForm } from '@/features/companies/components/company-form'
import { cn } from '@/lib/utils'
import type { Company } from '@/types/company'

export default function CompanyManagementPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editCompany, setEditCompany] = useState<Company | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchCompanies = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) console.error('Error fetching companies:', error)
    else setCompanies((data as Company[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const filtered = companies.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) || (c.slug || '').toLowerCase().includes(q)
  })

  const holdingCount = companies.filter(c => c.is_holding).length
  const subsidiaryCount = companies.filter(c => !c.is_holding).length

  const handleDelete = async () => {
    if (!deleteCompany) return
    setDeleting(true)
    const supabase = createClient()

    // Check for members first
    const { count } = await supabase
      .from('company_members')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', deleteCompany.id)

    if (count && count > 0) {
      toast.error(`Cannot delete — ${count} member(s) are still assigned to this company`)
      setDeleting(false)
      setDeleteOpen(false)
      return
    }

    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', deleteCompany.id)

    if (error) toast.error(error.message || 'Failed to delete company')
    else {
      toast.success(`${deleteCompany.name} deleted`)
      fetchCompanies()
    }
    setDeleting(false)
    setDeleteOpen(false)
  }

  return (
    <div className="space-y-6 w-full">
      <SettingsPageHeader
        title="Company Management"
        subtitle="Manage companies, members, and role permissions."
        breadcrumbs={[{ label: "Companies" }]}
        actions={
          <PermissionGate resource="companies" action="create">
            <Button size="sm" onClick={() => { setEditCompany(null); setEditOpen(true) }}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Company
            </Button>
          </PermissionGate>
        }
      />

      <div className="px-6 lg:px-8 pb-8 space-y-5">

        {/* Search + count */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <Input
              placeholder="Search companies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 bg-muted/40 border-transparent focus:border-border focus:bg-background transition-colors"
            />
          </div>
          {!loading && (
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">
              {holdingCount} holding · {subsidiaryCount} subsidiaries
            </span>
          )}
        </div>

        {/* Table */}
        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold text-xs w-[350px]">Company</TableHead>
                <TableHead className="font-semibold text-xs w-[120px]">Type</TableHead>
                <TableHead className="font-semibold text-xs">Slug</TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={4} className="py-16">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground">Loading companies...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-16">
                    <div className="flex flex-col items-center gap-1.5">
                      <Building2 className="h-5 w-5 text-muted-foreground/40" />
                      <span className="text-sm text-muted-foreground">No companies found</span>
                      {search && <span className="text-xs text-muted-foreground/60">Try a different search term</span>}
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((company) => (
                <TableRow
                  key={company.id}
                  className="group transition-colors hover:bg-muted/20 cursor-pointer"
                  onClick={() => router.push(`/settings/users?bu=${encodeURIComponent(company.name)}`)}
                >
                  {/* Company */}
                  <TableCell className="py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105",
                        company.is_holding
                          ? "bg-indigo-100 text-indigo-600"
                          : "bg-sky-50 text-sky-600"
                      )}>
                        {company.is_holding
                          ? <Globe className="h-4 w-4" />
                          : <Building2 className="h-4 w-4" />
                        }
                      </div>
                      <span className="font-medium text-[13px]">{company.name}</span>
                    </div>
                  </TableCell>

                  {/* Type badge */}
                  <TableCell className="py-3">
                    <span className={cn(
                      "inline-flex items-center text-[11px] font-semibold leading-none px-2 py-1.5 rounded-md whitespace-nowrap",
                      company.is_holding
                        ? "bg-indigo-50 text-indigo-600"
                        : "bg-slate-50 text-slate-500"
                    )}>
                      {company.is_holding ? 'Holding' : 'Subsidiary'}
                    </span>
                  </TableCell>

                  {/* Slug */}
                  <TableCell className="py-3">
                    <span className="text-[12px] text-muted-foreground/60 font-mono">{company.slug}</span>
                  </TableCell>

                  {/* Actions dropdown */}
                  <TableCell className="py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/settings/users?bu=${encodeURIComponent(company.name)}`) }}>
                          <Users className="h-3.5 w-3.5 mr-2" /> View members
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditCompany(company); setEditOpen(true) }}>
                          <Pencil className="h-3.5 w-3.5 mr-2" /> Edit company
                        </DropdownMenuItem>
                        {!company.is_holding && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); setDeleteCompany(company); setDeleteOpen(true) }}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete company
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

      </div>

      {/* Edit/Create Company Dialog */}
      <CompanyForm
        open={editOpen}
        onOpenChange={setEditOpen}
        company={editCompany ?? undefined}
        onSuccess={fetchCompanies}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" /> Delete company
            </DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteCompany?.name}</strong>. Companies with active members cannot be deleted. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
