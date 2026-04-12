"use client"

import * as React from "react"
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getPaginationRowModel,
    SortingState,
    getSortedRowModel,
    VisibilityState,
    ColumnOrderState,
    RowSelectionState,
} from "@tanstack/react-table"

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
    ChevronLeft, ChevronRight, Columns3, Eye, EyeOff,
    GripVertical, RotateCcw, Trash2, Download, X,
} from "lucide-react"

// ── Bulk action types ──
export interface BulkActions<TData> {
    onBulkDelete?: (rows: TData[]) => void
    onBulkExport?: (rows: TData[]) => void
}

interface DataTableProps<TData, TValue> {
    columns: ColumnDef<TData, TValue>[]
    data: TData[]
    onRowClick?: (row: TData) => void
    defaultHiddenColumns?: Record<string, boolean>
    enableRowSelection?: boolean
    bulkActions?: BulkActions<TData>
    getRowId?: (row: TData) => string
}

export function DataTable<TData, TValue>({
    columns,
    data,
    onRowClick,
    defaultHiddenColumns,
    enableRowSelection = false,
    bulkActions,
    getRowId,
}: DataTableProps<TData, TValue>) {
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(defaultHiddenColumns ?? {})
    const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>([])
    const [pageSize, setPageSize] = React.useState(15)
    const [pageIndex, setPageIndex] = React.useState(0)
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({})

    // DnD state for column reorder
    const [draggedCol, setDraggedCol] = React.useState<string | null>(null)
    const [dragOverCol, setDragOverCol] = React.useState<string | null>(null)

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onColumnOrderChange: setColumnOrder,
        onRowSelectionChange: enableRowSelection ? setRowSelection : undefined,
        enableRowSelection,
        getRowId: getRowId ? (row) => getRowId(row) : undefined,
        onPaginationChange: (updater) => {
            const next = typeof updater === 'function'
                ? updater({ pageIndex, pageSize })
                : updater
            setPageIndex(next.pageIndex)
            setPageSize(next.pageSize)
        },
        state: {
            sorting,
            columnVisibility,
            columnOrder,
            pagination: { pageIndex, pageSize },
            ...(enableRowSelection ? { rowSelection } : {}),
        },
    })

    // Get orderable columns (without 'actions' and 'row_number')
    const allColumns = table.getAllColumns().filter(c => c.id !== "actions" && c.id !== "row_number")
    const visibleCount = allColumns.filter(c => c.getIsVisible()).length

    const totalPages = table.getPageCount()
    const totalRows = data.length
    const start = totalRows > 0 ? pageIndex * pageSize + 1 : 0
    const end = Math.min((pageIndex + 1) * pageSize, totalRows)

    // Selected rows
    const selectedRows = table.getFilteredSelectedRowModel().rows
    const selectedCount = selectedRows.length
    const isAllPageSelected = table.getIsAllPageRowsSelected()
    const isSomeSelected = table.getIsSomePageRowsSelected()

    // Clear selection when data changes
    React.useEffect(() => {
        setRowSelection({})
    }, [data])

    // Reset column visibility
    const resetColumns = () => {
        setColumnVisibility(defaultHiddenColumns ?? {})
        setColumnOrder([])
    }

    // Column reorder in popover via drag
    const handleColDragStart = (colId: string) => setDraggedCol(colId)
    const handleColDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault()
        setDragOverCol(colId)
    }
    const handleColDrop = (targetColId: string) => {
        if (!draggedCol || draggedCol === targetColId) {
            setDraggedCol(null)
            setDragOverCol(null)
            return
        }
        const currentOrder = columnOrder.length > 0 ? [...columnOrder] : allColumns.map(c => c.id)
        const fromIdx = currentOrder.indexOf(draggedCol)
        const toIdx = currentOrder.indexOf(targetColId)
        if (fromIdx === -1 || toIdx === -1) return
        currentOrder.splice(fromIdx, 1)
        currentOrder.splice(toIdx, 0, draggedCol)
        setColumnOrder(currentOrder)
        setDraggedCol(null)
        setDragOverCol(null)
    }

    return (
        <div className="flex flex-col h-full">
            {/* ── Toolbar / Bulk Action Bar ── */}
            <div className="flex items-center justify-between px-1 pb-1.5 shrink-0">
                {selectedCount > 0 ? (
                    /* ── Floating Bulk Toolbar ── */
                    <div className="flex items-center gap-3 w-full">
                        <div className="flex items-center gap-2 bg-slate-900 text-white px-4 py-1.5 rounded-lg shadow-lg">
                            <span className="text-sm font-semibold">{selectedCount}</span>
                            <span className="text-xs text-slate-300">Selected</span>
                        </div>
                        {bulkActions?.onBulkDelete && (
                            <Button
                                size="sm"
                                variant="destructive"
                                className="h-8 text-xs gap-1.5 shadow-sm"
                                onClick={() => bulkActions.onBulkDelete!(selectedRows.map(r => r.original))}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Delete
                            </Button>
                        )}
                        {bulkActions?.onBulkExport && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1.5 border-slate-200 bg-white text-slate-700 hover:text-slate-900 shadow-sm"
                                onClick={() => bulkActions.onBulkExport!(selectedRows.map(r => r.original))}
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export
                            </Button>
                        )}
                        <button
                            onClick={() => setRowSelection({})}
                            className="ml-auto h-7 w-7 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            title="Clear selection"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    /* ── Normal Toolbar ── */
                    <>
                        <div className="text-[12px] text-slate-400">
                            {totalRows > 0 ? `${totalRows} record${totalRows !== 1 ? 's' : ''}` : 'No records'}
                        </div>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-slate-200 text-slate-600 hover:text-slate-900">
                                    <Columns3 className="h-3.5 w-3.5" />
                                    Columns
                                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full ml-0.5">
                                        {visibleCount}/{allColumns.length}
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="end" className="w-[260px] p-0">
                                {/* Header */}
                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                                    <span className="font-semibold text-sm text-slate-900">Columns</span>
                                    <button
                                        onClick={resetColumns}
                                        className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        Reset All
                                    </button>
                                </div>
                                <p className="px-4 pt-2 pb-1 text-[10px] text-slate-400">
                                    Drag to reorder • Click eye to toggle
                                </p>
                                {/* Column list */}
                                <div className="max-h-[320px] overflow-y-auto px-2 py-1">
                                    {allColumns.map(column => {
                                        const isVisible = column.getIsVisible()
                                        const colName = typeof column.columnDef.header === 'string'
                                            ? column.columnDef.header
                                            : column.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

                                        return (
                                            <div
                                                key={column.id}
                                                draggable
                                                onDragStart={() => handleColDragStart(column.id)}
                                                onDragOver={(e) => handleColDragOver(e, column.id)}
                                                onDrop={() => handleColDrop(column.id)}
                                                onDragEnd={() => { setDraggedCol(null); setDragOverCol(null) }}
                                                className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-grab transition-all ${
                                                    dragOverCol === column.id ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                                                } ${draggedCol === column.id ? 'opacity-40' : ''} ${!isVisible ? 'opacity-50' : ''}`}
                                            >
                                                <GripVertical className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                                <span className={`flex-1 text-[13px] font-medium ${isVisible ? 'text-slate-800' : 'text-slate-400 line-through'}`}>
                                                    {colName}
                                                </span>
                                                <button
                                                    onClick={() => column.toggleVisibility(!isVisible)}
                                                    className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                                                        isVisible ? 'text-emerald-500 hover:bg-emerald-50' : 'text-slate-300 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                                {/* Footer */}
                                <div className="px-4 py-2 border-t border-slate-100 text-[11px] text-slate-400 text-center">
                                    {visibleCount} of {allColumns.length} columns visible
                                </div>
                            </PopoverContent>
                        </Popover>
                    </>
                )}
            </div>

            {/* ── Table Container ── */}
            <div className="flex-1 relative rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
                {/* Single scroll layer: absolute fills full container, grid pushes scrollbar to bottom */}
                <div className="absolute inset-0 overflow-auto data-table-scroll" style={{ display: 'grid', gridTemplateRows: 'auto 1fr' }}>
                        <Table className="w-full" style={{ minWidth: '900px' }}>
                            <TableHeader className="sticky top-0 z-10">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="bg-slate-50 border-b-2 border-slate-200 hover:bg-slate-50">
                                        {/* Frozen header: checkbox + row number combined into one sticky cell */}
                                        <TableHead
                                            className="h-10 bg-slate-50 sticky left-0 z-20 p-0"
                                            style={{
                                                width: enableRowSelection ? 88 : 48,
                                                minWidth: enableRowSelection ? 88 : 48,
                                                maxWidth: enableRowSelection ? 88 : 48,
                                                boxShadow: '3px 0 6px -3px rgba(0,0,0,0.1)',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <div className="flex items-center h-full">
                                                {enableRowSelection && (
                                                    <div className="flex items-center justify-center w-10 shrink-0">
                                                        <Checkbox
                                                            checked={isAllPageSelected ? true : isSomeSelected ? "indeterminate" : false}
                                                            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                                                            aria-label="Select all"
                                                            className="data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-center w-12 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                                                    No
                                                </div>
                                            </div>
                                        </TableHead>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="h-10 px-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap bg-slate-50"
                                                style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row, idx) => {
                                        const rowNum = pageIndex * pageSize + idx + 1
                                        const isSelected = row.getIsSelected()
                                        return (
                                            <TableRow
                                                key={row.id}
                                                data-state={isSelected && "selected"}
                                                onClick={() => onRowClick && onRowClick(row.original)}
                                                className={`
                                                    ${onRowClick ? "cursor-pointer" : ""}
                                                    ${isSelected
                                                        ? "bg-blue-50 hover:bg-blue-100/80"
                                                        : idx % 2 === 0
                                                            ? "bg-white hover:bg-blue-50/60"
                                                            : "bg-slate-50 hover:bg-blue-50/60"
                                                    }
                                                    transition-colors border-b border-slate-100
                                                `}
                                            >
                                                {/* Frozen cell: checkbox + row number combined */}
                                                <TableCell
                                                    className={`p-0 sticky left-0 z-[5] ${isSelected ? 'bg-blue-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
                                                    style={{
                                                        width: enableRowSelection ? 88 : 48,
                                                        minWidth: enableRowSelection ? 88 : 48,
                                                        maxWidth: enableRowSelection ? 88 : 48,
                                                        boxShadow: '3px 0 6px -3px rgba(0,0,0,0.1)',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    <div className="flex items-center h-full" onClick={(e) => enableRowSelection && e.stopPropagation()}>
                                                        {enableRowSelection && (
                                                            <div className="flex items-center justify-center w-10 shrink-0">
                                                                <Checkbox
                                                                    checked={isSelected}
                                                                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                                                                    aria-label="Select row"
                                                                    className="data-[state=checked]:bg-slate-800 data-[state=checked]:border-slate-800"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-center w-12 shrink-0 text-[12px] font-mono text-slate-400">
                                                            {rowNum}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id} className="px-4 py-3 text-sm">
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length + 1} className="h-32 text-center">
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Columns3 className="h-8 w-8 text-slate-200" />
                                                <span className="text-sm font-medium">No data to display</span>
                                                <span className="text-xs">Try adjusting your filters or add new leads</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        {/* Grid spacer — pushes horizontal scrollbar to bottom */}
                        <div />
                    </div>
                </div>

            {/* ── Pagination Footer (outside the table border) ── */}
            {totalRows > 0 && (
                <div className="flex items-center justify-between pt-1.5 pb-1 shrink-0">
                    {/* Left: rows info */}
                    <div className="text-[12px] text-slate-400">
                        Showing <span className="font-medium text-slate-600">{start}</span>–<span className="font-medium text-slate-600">{end}</span> of <span className="font-medium text-slate-600">{totalRows}</span>
                    </div>

                    {/* Center: page navigation */}
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                            className="h-7 w-7 p-0 text-slate-500"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>

                        {/* Page numbers */}
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let pageNum: number
                            if (totalPages <= 5) {
                                pageNum = i
                            } else if (pageIndex < 3) {
                                pageNum = i
                            } else if (pageIndex > totalPages - 4) {
                                pageNum = totalPages - 5 + i
                            } else {
                                pageNum = pageIndex - 2 + i
                            }
                            return (
                                <button
                                    key={pageNum}
                                    onClick={() => table.setPageIndex(pageNum)}
                                    className={`h-7 min-w-[28px] px-1.5 rounded text-[12px] font-medium transition-colors ${
                                        pageIndex === pageNum
                                            ? 'bg-slate-900 text-white shadow-sm'
                                            : 'text-slate-500 hover:bg-slate-100'
                                    }`}
                                >
                                    {pageNum + 1}
                                </button>
                            )
                        })}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                            className="h-7 w-7 p-0 text-slate-500"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Right: Page size selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">Rows:</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(val) => {
                                const newSize = Number(val)
                                setPageSize(newSize)
                                setPageIndex(0)
                            }}
                        >
                            <SelectTrigger className="h-7 w-[60px] text-[12px] border-slate-200">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="15">15</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}
        </div>
    )
}
