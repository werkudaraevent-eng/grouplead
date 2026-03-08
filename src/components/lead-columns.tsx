"use client"

import { ColumnDef } from "@tanstack/react-table"
import { Lead } from "@/types"
import { ArrowUpDown, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LeadSheet } from "./lead-sheet" // Assuming imported here or handled via state
import { useState } from "react"
// If LeadSheet is triggered via state outside, we just need actions. 
// But commonly this file defines columns. 
// For "View Details" trigger, typically done via a callback or state lift.
// Here I'll assume the parent component handles the sheet and we just provide a way to open it via a callback passed to columns
// Or more commonly, the parent passes an `onEdit` or `onView` function to the table or columns context.
// However, standard tanstack table definition makes passing props tricky without context.
// I'll add a simple "View Details" action that logs for now or invokes a global event if configured.
// Actually, usually users put the sheet in the page and control it with state. 
// I'll invoke a custom event or expect the parent to handle row clicks.
// For now, I'll put the "View Details" button which the user can wire up.

// Helper for Badge-like style since we don't have the component installed yet
const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
        {children}
    </div>
)

export const columns: ColumnDef<Lead>[] = [
    {
        accessorKey: "manual_id",
        header: "#",
        size: 50,
        cell: ({ row }) => <div className="w-[50px] font-mono text-muted-foreground">{row.getValue("manual_id") || "-"}</div>,
    },
    {
        accessorKey: "date_lead_received",
        header: "Date",
        cell: ({ row }) => {
            const date = row.getValue("date_lead_received") as string
            if (!date) return <span className="text-muted-foreground">-</span>
            // Format DD/MM/YYYY
            return new Date(date).toLocaleDateString("en-GB")
        }
    },
    {
        accessorKey: "company_name",
        header: "Client",
        cell: ({ row }) => {
            const lead = row.original
            const displayName = lead.client_company?.name || lead.company_name
            return <div className="font-medium">{displayName || "-"}</div>
        },
    },
    {
        accessorKey: "project_name",
        header: "Project",
        cell: ({ row }) => {
            const val = row.getValue("project_name") as string
            return <div className="truncate max-w-[200px]" title={val}>{val}</div>
        }
    },
    {
        accessorKey: "bu_revenue",
        header: "BU",
        cell: ({ row }) => {
            const val = row.getValue("bu_revenue") as string
            return <Badge className="border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">{val}</Badge>
        }
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const val = row.getValue("status") as string
            let colorClass = "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80" // Default Gray

            if (val?.toLowerCase().includes("confirm")) {
                colorClass = "border-transparent bg-green-500 text-white hover:bg-green-600"
            } else if (val?.toLowerCase().includes("lost") || val?.toLowerCase().includes("cancel")) {
                colorClass = "border-transparent bg-red-500 text-white hover:bg-red-600"
            } else if (val?.toLowerCase().includes("new") || val?.toLowerCase().includes("hot")) {
                colorClass = "border-transparent bg-blue-500 text-white hover:bg-blue-600"
            }

            return <Badge className={colorClass}>{val}</Badge>
        }
    },
    {
        accessorKey: "pic_sales",
        header: "Sales",
    },
    {
        accessorKey: "estimated_revenue",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="justify-end w-full"
                >
                    Est. Revenue
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("estimated_revenue"))
            const formatted = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                minimumFractionDigits: 0,
            }).format(amount || 0)

            return <div className="text-right font-medium">{formatted}</div>
        },
    },
    {
        id: "actions",
        cell: ({ row }) => {
            const lead = row.original

            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onClick={() => navigator.clipboard.writeText(String(lead.id))}
                        >
                            Copy Lead ID
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => document.dispatchEvent(new CustomEvent('view-lead-details', { detail: lead }))}
                        >
                            View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit Lead</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )
        },
    },
]
