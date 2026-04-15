"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/utils/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Loader2, Download } from "lucide-react"

function formatIDR(value: number): string {
  if (value >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp${(value / 1_000).toFixed(0)}K`
  return `Rp${value.toLocaleString("id-ID")}`
}

interface LeadRow {
  id: number
  project_name: string | null
  actual_value: number | null
  estimated_value: number | null
  company_name: string | null
  company_id: string | null
  pic_sales_name: string | null
  stage_name: string | null
}

interface DrillDownPanelProps {
  label: string
  filterType: string
  filterValue: string
  goalId: string | null
  onClose: () => void
}

export function DrillDownPanel({ label, filterType, filterValue, goalId, onClose }: DrillDownPanelProps) {
  const router = useRouter()
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeads = async () => {
      setLoading(true)
      const supabase = createClient()

      let query = supabase
        .from("leads")
        .select(
          "id, project_name, actual_value, estimated_value, company_id, client_company:client_companies!client_company_id(name), pic_sales_profile:profiles!pic_sales_id(full_name), pipeline_stage:pipeline_stages!pipeline_stage_id(name)"
        )
        .order("actual_value", { ascending: false })
        .limit(50)

      // Apply filter based on filterType
      if (filterType === "sales" && filterValue) {
        query = query.eq("pic_sales_id", filterValue)
      } else if (filterType === "company" && filterValue) {
        query = query.eq("client_company_id", filterValue)
      }

      const { data } = await query

      const rows: LeadRow[] = (data ?? []).map((l: Record<string, unknown>) => ({
        id: l.id as number,
        project_name: l.project_name as string | null,
        actual_value: l.actual_value as number | null,
        estimated_value: l.estimated_value as number | null,
        company_name: (l.client_company as { name?: string } | null)?.name ?? null,
        company_id: l.company_id as string | null,
        pic_sales_name: (l.pic_sales_profile as { full_name?: string } | null)?.full_name ?? null,
        stage_name: (l.pipeline_stage as { name?: string } | null)?.name ?? null,
      }))

      setLeads(rows)
      setLoading(false)
    }

    fetchLeads()
  }, [filterType, filterValue, goalId])

  const exportCSV = useCallback(() => {
    const headers = ["ID", "Project", "Actual Value", "Estimated Value", "Company", "Sales Owner", "Stage"]
    const csvRows = [
      headers.join(","),
      ...leads.map((l) =>
        [
          l.id,
          `"${l.project_name ?? ""}"`,
          l.actual_value ?? 0,
          l.estimated_value ?? 0,
          `"${l.company_name ?? ""}"`,
          `"${l.pic_sales_name ?? ""}"`,
          `"${l.stage_name ?? ""}"`,
        ].join(",")
      ),
    ]
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `drill-down-${label.replace(/\s+/g, "-").toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [leads, label])

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Drill-Down: {label}</SheetTitle>
          <SheetDescription>
            Filtered leads for {filterType}: {label}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={leads.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export CSV
          </Button>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No leads found.</p>
          ) : (
            <div className="space-y-1">
              {leads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center justify-between p-2 rounded hover:bg-slate-50 transition-colors text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="font-medium text-blue-600 hover:underline truncate block"
                    >
                      {lead.project_name ?? `Lead #${lead.id}`}
                    </button>
                    <div className="flex items-center gap-2 text-muted-foreground mt-0.5">
                      {lead.company_name && (
                        <button
                          onClick={() =>
                            lead.company_id && router.push(`/companies/${lead.company_id}`)
                          }
                          className="hover:underline"
                        >
                          {lead.company_name}
                        </button>
                      )}
                      {lead.pic_sales_name && <span>• {lead.pic_sales_name}</span>}
                      {lead.stage_name && <span>• {lead.stage_name}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-medium">
                      {formatIDR(lead.actual_value ?? lead.estimated_value ?? 0)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
