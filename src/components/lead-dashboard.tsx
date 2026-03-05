"use client"

import { useState } from "react"
import { DataTable } from "@/components/data-table"
import { columns } from "@/components/lead-columns"
import { LeadKanban } from "@/components/lead-kanban"
import { LeadDetailLayout } from "@/components/lead-detail-layout"
import { LeadForm } from "@/components/lead-form"
import { Lead } from "@/types/index"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Plus, LayoutGrid, Table, X, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { PermissionGate } from "@/components/permission-gate"
import { EditLeadModal } from "@/components/edit-lead-modal"

type ViewMode = 'table' | 'kanban'

interface LeadDashboardProps {
    initialData: Lead[]
}

export function LeadDashboard({ initialData }: LeadDashboardProps) {
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
    const [sheetOpen, setSheetOpen] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editOpen, setEditOpen] = useState(false)
    const [viewMode, setViewMode] = useState<ViewMode>('kanban')
    const router = useRouter()

    const handleSelectLead = (lead: Lead) => {
        setSelectedLead(lead)
        setSheetOpen(true)
    }

    const handleSuccess = () => {
        setDialogOpen(false)
        router.refresh()
    }

    return (
        <div className="space-y-4">
            {/* Header Row */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Lead Pipeline</h2>
                    <p className="text-sm text-muted-foreground">
                        {initialData.length} lead{initialData.length !== 1 ? 's' : ''} total
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex items-center border rounded-lg p-0.5 bg-muted/50">
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'kanban'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'table'
                                    ? 'bg-background shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Table className="h-3.5 w-3.5" /> Table
                        </button>
                    </div>

                    {/* Add Lead */}
                    <PermissionGate resource="leads" action="create">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm">
                                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Lead
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[800px] overflow-y-auto max-h-[90vh]">
                                <DialogHeader>
                                    <DialogTitle>Add New Lead</DialogTitle>
                                    <DialogDescription>
                                        Fill in the details to track a new lead.
                                    </DialogDescription>
                                </DialogHeader>
                                <LeadForm onSuccess={handleSuccess} />
                            </DialogContent>
                        </Dialog>
                    </PermissionGate>
                </div>
            </div>

            {/* View Content */}
            {viewMode === 'kanban' ? (
                <LeadKanban leads={initialData} onSelectLead={handleSelectLead} />
            ) : (
                <DataTable
                    columns={columns}
                    data={initialData}
                    onRowClick={handleSelectLead}
                />
            )}

            {/* Detail Sheet - Wide 3-Column Layout */}
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent className="w-full sm:max-w-[95vw] lg:max-w-[1200px] overflow-y-auto p-0">
                    <SheetHeader className="px-6 pt-6 pb-2 border-b bg-muted/20">
                        <div className="flex items-center justify-between">
                            <div>
                                <SheetTitle className="text-lg">
                                    {selectedLead?.project_name || 'Lead Details'}
                                </SheetTitle>
                                <SheetDescription>
                                    {selectedLead?.company_name} — #{selectedLead?.manual_id || 'N/A'}
                                </SheetDescription>
                            </div>
                            <PermissionGate resource="leads" action="update">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => setEditOpen(true)}
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit Details
                                </Button>
                            </PermissionGate>
                        </div>
                    </SheetHeader>

                    {selectedLead && (
                        <LeadDetailLayout lead={selectedLead} />
                    )}
                </SheetContent>
            </Sheet>

            {/* Edit Lead Modal */}
            {selectedLead && (
                <EditLeadModal
                    lead={selectedLead}
                    open={editOpen}
                    onOpenChange={setEditOpen}
                />
            )}
        </div>
    )
}
