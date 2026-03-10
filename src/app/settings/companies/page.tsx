'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { PermissionGate } from '@/features/users/components/permission-gate'
import { Button } from '@/components/ui/button'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Building2, Globe, Plus, Loader2, Users, Settings2 } from 'lucide-react'
import type { Company } from '@/types/company'

export default function CompanyManagementPage() {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Company Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage companies, members, and role permissions.
          </p>
        </div>
        <PermissionGate resource="companies" action="create">
          <Button size="sm" onClick={() => router.push('/settings/companies/new')}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Company
          </Button>
        </PermissionGate>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Company</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!loading && companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                  No companies found.
                </TableCell>
              </TableRow>
            )}
            {companies.map((company) => (
              <TableRow
                key={company.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => router.push(`/settings/companies/${company.slug}/members`)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {company.is_holding
                        ? <Globe className="h-4 w-4 text-primary" />
                        : <Building2 className="h-4 w-4 text-primary" />
                      }
                    </div>
                    <span className="font-semibold text-sm">{company.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground font-mono">
                  {company.slug}
                </TableCell>
                <TableCell>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${
                    company.is_holding
                      ? 'bg-purple-100 text-purple-700 border-purple-200'
                      : 'bg-blue-100 text-blue-700 border-blue-200'
                  }`}>
                    {company.is_holding ? 'Holding' : 'Subsidiary'}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); router.push(`/settings/companies/${company.slug}/members`) }}
                    >
                      <Users className="h-3 w-3 mr-1" /> Members
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 text-xs"
                      onClick={(e) => { e.stopPropagation(); router.push(`/settings/companies/${company.slug}/permissions`) }}
                    >
                      <Settings2 className="h-3 w-3 mr-1" /> Permissions
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
