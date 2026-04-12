"use client"

import { useCallback, useMemo, useState, useRef, useTransition } from "react"
import { useCompany } from "@/contexts/company-context"
import { importLeadsAction } from "@/app/actions/lead-actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { parseSmartEventDates } from "@/utils/smart-date-parser"

import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    Upload, Download, FileSpreadsheet, CheckCircle2, XCircle,
    AlertTriangle, Loader2, ArrowRight, ArrowLeft, Link2, Link2Off,
    Sparkles, RotateCcw,
} from "lucide-react"

// ── System fields — aligned with Lead Form tabs ──
const SYSTEM_FIELDS = [
    // Project Tab
    { key: "project_name", label: "Project Name", required: true, group: "Project", example: "Annual Gala Dinner 2026" },
    { key: "subsidiary_name", label: "Subsidiary / Business Unit", required: true, group: "Project", example: "Werkudara Nirwana Wisata" },
    { key: "category", label: "Category", required: false, group: "Project", example: "Hot Lead" },
    { key: "grade_lead", label: "Grade Lead", required: false, group: "Project", example: "Grade C (< 200 Jt)" },
    { key: "client_company_name", label: "Client Company", required: false, group: "Project", example: "PT Telkom Indonesia" },
    { key: "contact_name", label: "Contact Person", required: false, group: "Project", example: "John Doe" },
    { key: "pic_sales_name", label: "PIC Sales", required: false, group: "Project", example: "Sales Person Name" },
    { key: "lead_source", label: "Lead Source", required: false, group: "Project", example: "Referral" },
    { key: "referral_source", label: "Referral Source", required: false, group: "Project", example: "John from XYZ Corp" },
    { key: "target_close_date", label: "Target Close Date", required: false, group: "Project", example: "2026-06-30" },

    // Event Tab
    { key: "event_dates", label: "Event Dates", required: false, group: "Event", example: "3-5 Jan 2026" },
    { key: "pax_count", label: "Pax Count", required: false, group: "Event", example: "500" },
    { key: "event_format", label: "Event Format", required: false, group: "Event", example: "Onsite" },
    { key: "virtual_platform", label: "Virtual Platform", required: false, group: "Event", example: "Zoom" },
    { key: "destination_city", label: "Destination City", required: false, group: "Event", example: "Bali" },
    { key: "destination_venue", label: "Destination Venue", required: false, group: "Event", example: "Mulia Resort" },

    // Classification Tab
    { key: "main_stream", label: "Main Stream", required: false, group: "Classification", example: "MICE" },
    { key: "stream_type", label: "Stream Type", required: false, group: "Classification", example: "Conference" },
    { key: "business_purpose", label: "Business Purpose", required: false, group: "Classification", example: "Brand Awareness" },
    { key: "area", label: "Area", required: false, group: "Classification", example: "Jakarta" },

    // Financial Tab
    { key: "estimated_value", label: "Estimated Value", required: false, group: "Financial", example: "150000000" },

    // Pipeline & Status
    { key: "pipeline_stage_name", label: "Pipeline Stage", required: false, group: "Pipeline & Status", example: "Lead Masuk" },
    { key: "status", label: "Status", required: false, group: "Pipeline & Status", example: "Open" },

    // Notes
    { key: "general_brief", label: "General Brief", required: false, group: "Notes", example: "Client needs full-service event management" },
    { key: "production_sow", label: "Production SOW", required: false, group: "Notes", example: "Stage setup, sound system, lighting" },
    { key: "special_remarks", label: "Special Remarks", required: false, group: "Notes", example: "VIP guest protocol required" },
    { key: "description", label: "Description", required: false, group: "Notes", example: "Initial inquiry about event" },
    { key: "remark", label: "Remark", required: false, group: "Notes", example: "" },
]

type ParsedRow = Record<string, string>
type ColumnMapping = Record<string, string> // systemFieldKey -> excelColumnHeader
type RowValidation = { row: number; field: string; message: string; level: "error" | "warning" }

interface ImportLeadsModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    pipelineId?: string
    onSuccess?: () => void
}

export function ImportLeadsModal({ open, onOpenChange, pipelineId, onSuccess }: ImportLeadsModalProps) {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isPending, startTransition] = useTransition()

    // Wizard state — 4 steps
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
    const [fileName, setFileName] = useState("")
    const [parsedData, setParsedData] = useState<ParsedRow[]>([])
    const [excelHeaders, setExcelHeaders] = useState<string[]>([])
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
    const [validations, setValidations] = useState<RowValidation[]>([])
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[] }>({ success: 0, failed: 0, errors: [] })

    const resetState = useCallback(() => {
        setStep(1)
        setFileName("")
        setParsedData([])
        setExcelHeaders([])
        setColumnMapping({})
        setValidations([])
        setImportResult({ success: 0, failed: 0, errors: [] })
    }, [])

    const handleClose = useCallback(() => {
        resetState()
        onOpenChange(false)
    }, [resetState, onOpenChange])

    // ── Download XLSX Template ──
    const downloadTemplate = useCallback(() => {
        const headers = SYSTEM_FIELDS.map((c) => c.label)
        const exampleRow = SYSTEM_FIELDS.map((c) => c.example)
        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
        ws["!cols"] = SYSTEM_FIELDS.map((c) => ({
            wch: Math.max(c.label.length, c.example.length, 18)
        }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Lead Import Template")
        XLSX.writeFile(wb, "lead_import_template.xlsx")
        toast.success("Template downloaded!")
    }, [])

    // ── Auto-map headers to system fields ──
    const autoMapHeaders = useCallback((rawHeaders: string[]): ColumnMapping => {
        const mapping: ColumnMapping = {}
        for (const field of SYSTEM_FIELDS) {
            let found = rawHeaders.find((h) => h === field.label)
            if (!found) found = rawHeaders.find((h) => h.toLowerCase() === field.label.toLowerCase())
            if (!found) found = rawHeaders.find((h) => h.toLowerCase() === field.key.toLowerCase())
            if (!found) found = rawHeaders.find((h) => h.toLowerCase().replace(/[_ ]/g, '') === field.key.toLowerCase().replace(/_/g, ''))
            // Smart partial matches
            if (!found && field.key === "client_company_name") {
                found = rawHeaders.find((h) => /client.*company|company.*name/i.test(h))
            }
            if (!found && field.key === "contact_name") {
                found = rawHeaders.find((h) => /contact.*person|contact.*name/i.test(h))
            }
            if (!found && field.key === "pic_sales_name") {
                found = rawHeaders.find((h) => /sales|pic.*sales/i.test(h))
            }
            if (!found && field.key === "subsidiary_name") {
                found = rawHeaders.find((h) => /subsidiary|business.*unit|subs|bu\b/i.test(h))
            }
            if (!found && field.key === "pipeline_stage_name") {
                found = rawHeaders.find((h) => /stage|pipeline.*stage/i.test(h))
            }
            if (!found && field.key === "grade_lead") {
                found = rawHeaders.find((h) => /grade|lead.*grade|hot.*cold.*warm/i.test(h))
            }
            if (!found && field.key === "event_dates") {
                found = rawHeaders.find((h) => /event.*date|tanggal.*event|jadwal/i.test(h))
            }
            if (!found && field.key === "destination_city") {
                found = rawHeaders.find((h) => /destination.*city|event.*city|kota/i.test(h))
            }
            if (!found && field.key === "destination_venue") {
                found = rawHeaders.find((h) => /venue|tempat|lokasi/i.test(h))
            }
            if (!found && field.key === "production_sow") {
                found = rawHeaders.find((h) => /production|sow|scope.*work/i.test(h))
            }
            if (!found && field.key === "special_remarks") {
                found = rawHeaders.find((h) => /special.*remark|catatan.*khusus/i.test(h))
            }
            if (!found && field.key === "general_brief") {
                found = rawHeaders.find((h) => /brief|general.*brief/i.test(h))
            }
            if (found) mapping[field.key] = found
        }
        return mapping
    }, [])

    // ── Validate parsed data based on mapping ──
    const validateData = useCallback((rows: ParsedRow[], mapping: ColumnMapping): RowValidation[] => {
        const errors: RowValidation[] = []
        rows.forEach((row, idx) => {
            for (const field of SYSTEM_FIELDS.filter((f) => f.required)) {
                const header = mapping[field.key]
                const value = header ? row[header] : ""
                if (!value || !String(value).trim()) {
                    errors.push({ row: idx + 1, field: field.label, message: `${field.label} is required`, level: "error" })
                }
            }
            // Validate date formats
            const singleDateFields = ["target_close_date"]
            for (const df of singleDateFields) {
                const header = mapping[df]
                const value = header ? row[header] : ""
                if (value && String(value).trim()) {
                    const d = new Date(value)
                    if (isNaN(d.getTime())) {
                        const field = SYSTEM_FIELDS.find((f) => f.key === df)
                        errors.push({ row: idx + 1, field: field?.label || df, message: `Invalid date format (use YYYY-MM-DD)`, level: "error" })
                    }
                }
            }
            // Validate event dates using smart parser
            const eventDatesHeader = mapping["event_dates"]
            const eventDatesVal = eventDatesHeader ? row[eventDatesHeader] : ""
            if (eventDatesVal && String(eventDatesVal).trim()) {
                const parsed = parseSmartEventDates(String(eventDatesVal))
                if (parsed.length === 0) {
                    errors.push({ row: idx + 1, field: "Event Dates", message: `Could not parse dates — try "3-5 Jan 2026" or "2026-01-03, 2026-01-05"`, level: "error" })
                }
            }
            // Validate numbers
            for (const nf of ["estimated_value", "pax_count"]) {
                const header = mapping[nf]
                const val = header ? row[header] : ""
                if (val && String(val).trim() && isNaN(Number(String(val).replace(/[,.\s]/g, "")))) {
                    const field = SYSTEM_FIELDS.find((f) => f.key === nf)
                    errors.push({ row: idx + 1, field: field?.label || nf, message: "Must be a number", level: "error" })
                }
            }

        })
        return errors
    }, [])

    // ── Parse XLSX file ──
    const parseXLSX = useCallback((buffer: ArrayBuffer): { headers: string[]; rows: ParsedRow[] } => {
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { raw: false, defval: "" })
        if (jsonData.length === 0) return { headers: [], rows: [] }
        const headers = Object.keys(jsonData[0])
        const rows: ParsedRow[] = jsonData.map((row) => {
            const mapped: ParsedRow = {}
            headers.forEach((h) => { mapped[h] = String(row[h] ?? "") })
            return mapped
        })
        return { headers, rows }
    }, [])

    // ── Handle File ──
    const processFile = useCallback((file: File) => {
        const validExtensions = [".xlsx", ".xls"]
        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
        if (!validExtensions.includes(ext)) {
            toast.error("Please upload an Excel file (.xlsx or .xls)")
            return
        }
        setFileName(file.name)
        const reader = new FileReader()
        reader.onload = (e) => {
            const buffer = e.target?.result as ArrayBuffer
            const { headers, rows } = parseXLSX(buffer)
            if (rows.length === 0) {
                toast.error("No data rows found in the file")
                return
            }
            setExcelHeaders(headers)
            setParsedData(rows)
            const autoMap = autoMapHeaders(headers)
            setColumnMapping(autoMap)
            setStep(2)
        }
        reader.readAsArrayBuffer(file)
    }, [parseXLSX, autoMapHeaders])

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) processFile(file)
    }, [processFile])

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) processFile(file)
    }, [processFile])

    // ── Mapping handlers ──
    const updateMapping = useCallback((systemFieldKey: string, excelHeader: string) => {
        setColumnMapping((prev) => {
            const next = { ...prev }
            if (excelHeader === "__none__") {
                delete next[systemFieldKey]
            } else {
                next[systemFieldKey] = excelHeader
            }
            return next
        })
    }, [])

    const mappedCount = Object.keys(columnMapping).length
    const unmappedRequired = SYSTEM_FIELDS.filter((f) => f.required && !columnMapping[f.key])

    // ── Proceed from mapping to preview ──
    const proceedToPreview = useCallback(() => {
        const errors = validateData(parsedData, columnMapping)
        setValidations(errors)
        setStep(3)
    }, [validateData, parsedData, columnMapping])

    // ── Import ──
    const errorCount = validations.filter((v) => v.level === "error").length
    const warningCount = validations.filter((v) => v.level === "warning").length
    const canImport = parsedData.length > 0 && errorCount === 0

    const handleImport = useCallback(() => {
        startTransition(async () => {
            const rows = parsedData.map((row) => {
                const mapped: Record<string, unknown> = {}
                for (const [fieldKey, excelHeader] of Object.entries(columnMapping)) {
                    let val: unknown = row[excelHeader]?.trim() || null
                    if (fieldKey === "estimated_value" && val) {
                        val = Number(String(val).replace(/[,.\s]/g, ""))
                    }
                    if (fieldKey === "pax_count" && val) {
                        val = Number(val)
                    }

                    mapped[fieldKey] = val
                }
                mapped.pipeline_id = pipelineId || null
                return mapped
            })

            const result = await importLeadsAction(rows)
            setImportResult(result)
            setStep(4)

            if (result.success > 0) {
                toast.success(`${result.success} lead(s) imported successfully!`)
                onSuccess?.()
                router.refresh()
            }
            if (result.failed > 0) {
                toast.error(`${result.failed} lead(s) failed to import`)
            }
        })
    }, [columnMapping, parsedData, pipelineId, startTransition, onSuccess, router])

    // Headers already used in mapping
    const usedHeaders = useMemo(() => new Set(Object.values(columnMapping)), [columnMapping])

    // Group system fields by category
    const fieldGroups = useMemo(() => {
        const groups: Record<string, typeof SYSTEM_FIELDS> = {}
        for (const f of SYSTEM_FIELDS) {
            if (!groups[f.group]) groups[f.group] = []
            groups[f.group].push(f)
        }
        return groups
    }, [])

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/30">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Upload className="h-5 w-5 text-white" />
                        </div>
                        <div>
                            <DialogTitle className="text-lg font-semibold">Import Leads</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                {step === 1 && "Upload an Excel file to bulk import leads across all business units."}
                                {step === 2 && "Match the columns from your file to the system fields."}
                                {step === 3 && `Reviewing ${parsedData.length} row(s) from ${fileName}`}
                                {step === 4 && "Import complete — see the results below."}
                            </DialogDescription>
                        </div>
                    </div>
                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mt-4">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex-1">
                                <div className={`h-1.5 rounded-full transition-all duration-300 ${
                                    s <= step ? 'bg-gradient-to-r from-blue-500 to-indigo-500' : 'bg-slate-200'
                                }`} />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-1">
                        <span className={step >= 1 ? 'text-blue-600' : ''}>Upload</span>
                        <span className={step >= 2 ? 'text-blue-600' : ''}>Map Data</span>
                        <span className={step >= 3 ? 'text-blue-600' : ''}>Preview</span>
                        <span className={step >= 4 ? 'text-blue-600' : ''}>Result</span>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* ═══ STEP 1: Upload ═══ */}
                    {step === 1 && (
                        <div className="space-y-5">
                            {/* Drag & Drop Zone */}
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30"
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileInput}
                                />
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">
                                            Drop your Excel file here, or <span className="text-blue-600">browse</span>
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Supports .xlsx and .xls files • Multi business unit in one file
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Template Download */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">Download Template</p>
                                        <p className="text-xs text-muted-foreground">Excel template with all columns: company, contact, stages, grade lead & more</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                    <Download className="h-3.5 w-3.5" /> Download
                                </Button>
                            </div>

                            {/* Info hint */}
                            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/50 border border-blue-200/30 text-xs text-blue-700">
                                <Sparkles className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold">Smart Import</p>
                                    <p className="mt-0.5 text-blue-600">
                                        ALL CAPS text will be auto-converted to proper Title Case while keeping abbreviations (PT, UGM, MICE, etc.) intact.
                                        Company and Contact will be created automatically if they don&apos;t exist yet.
                                    </p>
                                    <p className="mt-1.5 text-blue-600">
                                        <span className="font-semibold">Smart Event Dates:</span> Write naturally — <code className="px-1 py-0.5 bg-blue-100 rounded text-[10px]">3-5 Jan 2026</code> or <code className="px-1 py-0.5 bg-blue-100 rounded text-[10px]">3,5,8 Jan 2026</code> — and dates will auto-expand.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP 2: Map Your Data ═══ */}
                    {step === 2 && (
                        <div className="space-y-4">
                            {/* Mapping summary */}
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/70 border border-blue-200/50">
                                <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                                <div className="text-xs">
                                    <span className="font-semibold text-blue-800">{mappedCount} of {SYSTEM_FIELDS.length}</span>
                                    <span className="text-blue-600"> fields mapped from </span>
                                    <span className="font-semibold text-blue-800">{excelHeaders.length} Excel columns</span>
                                </div>
                            </div>

                            {unmappedRequired.length > 0 && (
                                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200/50 text-xs">
                                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-red-800">Required fields not mapped</p>
                                        <p className="text-red-700 mt-0.5">
                                            {unmappedRequired.map((f) => f.label).join(", ")}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Mapping table by group */}
                            <div className="space-y-3">
                                {Object.entries(fieldGroups).map(([groupName, fields]) => (
                                    <div key={groupName} className="rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                            {groupName}
                                        </div>
                                        <div className="divide-y divide-slate-100">
                                            {fields.map((field) => {
                                                const currentHeader = columnMapping[field.key]
                                                const isMapped = !!currentHeader
                                                return (
                                                    <div key={field.key} className="flex items-center gap-3 px-3 py-2.5">
                                                        <div className="flex items-center gap-2 w-[200px] shrink-0">
                                                            <div className={`h-2 w-2 rounded-full shrink-0 ${
                                                                isMapped ? 'bg-emerald-400' : field.required ? 'bg-red-400' : 'bg-slate-300'
                                                            }`} />
                                                            <span className="text-xs font-medium text-slate-700 truncate">{field.label}</span>
                                                            {field.required && <span className="text-[9px] text-red-400 font-bold shrink-0">*</span>}
                                                        </div>
                                                        <div className="shrink-0">
                                                            {isMapped
                                                                ? <Link2 className="h-3.5 w-3.5 text-emerald-500" />
                                                                : <Link2Off className="h-3.5 w-3.5 text-slate-300" />
                                                            }
                                                        </div>
                                                        <Select
                                                            value={currentHeader || "__none__"}
                                                            onValueChange={(v) => updateMapping(field.key, v)}
                                                        >
                                                            <SelectTrigger className={`h-8 text-xs flex-1 ${
                                                                isMapped ? 'border-emerald-200 bg-emerald-50/50' : ''
                                                            }`}>
                                                                <SelectValue placeholder="Select column..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__">
                                                                    <span className="text-muted-foreground">— Don&apos;t import —</span>
                                                                </SelectItem>
                                                                {excelHeaders.map((h) => {
                                                                    const isUsed = usedHeaders.has(h) && h !== currentHeader
                                                                    return (
                                                                        <SelectItem key={h} value={h} disabled={isUsed}>
                                                                            <span className={isUsed ? 'text-muted-foreground' : ''}>
                                                                                {h} {isUsed && '(used)'}
                                                                            </span>
                                                                        </SelectItem>
                                                                    )
                                                                })}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP 3: Preview & Validate ═══ */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <StatCard label="Rows" value={parsedData.length} icon={<FileSpreadsheet className="h-3.5 w-3.5" />} color="blue" />
                                <StatCard label="Mapped" value={`${mappedCount}/${SYSTEM_FIELDS.length}`} icon={<CheckCircle2 className="h-3.5 w-3.5" />} color="emerald" />
                                <StatCard label="Errors" value={errorCount} icon={<XCircle className="h-3.5 w-3.5" />} color={errorCount > 0 ? "red" : "emerald"} />
                                <StatCard label="Warnings" value={warningCount} icon={<AlertTriangle className="h-3.5 w-3.5" />} color={warningCount > 0 ? "amber" : "emerald"} />
                            </div>

                            {validations.length > 0 && (
                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                                        Validation Issues ({validations.length})
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                        {validations.slice(0, 50).map((v, i) => (
                                            <div key={i} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                                                {v.level === "error"
                                                    ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                                                    : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                }
                                                <span className="text-muted-foreground">Row {v.row}</span>
                                                <span className="font-medium text-slate-700">{v.field}</span>
                                                <span className="text-muted-foreground">— {v.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                                    Data Preview (first 5 rows)
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-3 py-2 text-left font-medium text-slate-500 border-b">#</th>
                                                {Object.entries(columnMapping).slice(0, 8).map(([fieldKey]) => {
                                                    const field = SYSTEM_FIELDS.find((f) => f.key === fieldKey)
                                                    return (
                                                        <th key={fieldKey} className="px-3 py-2 text-left font-medium text-slate-500 border-b whitespace-nowrap">
                                                            {field?.label || fieldKey}
                                                        </th>
                                                    )
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.slice(0, 5).map((row, idx) => {
                                                const rowErrors = validations.filter((v) => v.row === idx + 1 && v.level === "error")
                                                return (
                                                    <tr key={idx} className={`border-b border-slate-100 ${rowErrors.length > 0 ? 'bg-red-50/30' : ''}`}>
                                                        <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                                        {Object.entries(columnMapping).slice(0, 8).map(([fieldKey, excelHeader]) => {
                                                            const hasError = rowErrors.some((e) => {
                                                                const f = SYSTEM_FIELDS.find((sf) => sf.label === e.field)
                                                                return f?.key === fieldKey
                                                            })
                                                            return (
                                                                <td key={fieldKey} className={`px-3 py-2 max-w-[160px] truncate ${hasError ? 'text-red-600 font-medium' : 'text-slate-700'}`}>
                                                                    {row[excelHeader] || <span className="text-slate-300">—</span>}
                                                                </td>
                                                            )
                                                        })}
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                {parsedData.length > 5 && (
                                    <div className="px-3 py-2 text-[11px] text-muted-foreground bg-slate-50/50 border-t border-slate-100">
                                        ... and {parsedData.length - 5} more row(s)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP 4: Results ═══ */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-4 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                                        <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-emerald-700">{importResult.success}</p>
                                        <p className="text-xs text-emerald-600 font-medium">Successfully Imported</p>
                                    </div>
                                </div>
                                <div className={`flex items-center gap-4 p-5 rounded-xl border ${
                                    importResult.failed > 0
                                        ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50'
                                        : 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200/50'
                                }`}>
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                                        importResult.failed > 0 ? 'bg-red-100' : 'bg-slate-100'
                                    }`}>
                                        <XCircle className={`h-6 w-6 ${importResult.failed > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                                    </div>
                                    <div>
                                        <p className={`text-2xl font-bold ${importResult.failed > 0 ? 'text-red-700' : 'text-slate-400'}`}>{importResult.failed}</p>
                                        <p className={`text-xs font-medium ${importResult.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>Failed</p>
                                    </div>
                                </div>
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="rounded-lg border border-red-200 overflow-hidden">
                                    <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-700">
                                        Error Details
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-red-100">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className="flex items-center gap-2 px-3 py-2 text-xs text-red-700">
                                                <XCircle className="h-3.5 w-3.5 shrink-0" />
                                                {err}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {importResult.success > 0 && importResult.failed === 0 && (
                                <div className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/50">
                                    <Sparkles className="h-5 w-5 text-emerald-500" />
                                    <p className="text-sm text-emerald-700 font-medium">
                                        All leads imported successfully! They&apos;re now available in your pipeline.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═══ FOOTER ═══ */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        {step === 2 && (
                            <Button variant="ghost" size="sm" onClick={() => { setStep(1); setParsedData([]); setFileName(""); setExcelHeaders([]); setColumnMapping({}) }}>
                                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
                            </Button>
                        )}
                        {step === 3 && (
                            <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Edit Mapping
                            </Button>
                        )}
                        {step === 4 && (
                            <Button variant="ghost" size="sm" onClick={resetState}>
                                <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Import More
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleClose}>
                            {step === 4 ? "Close" : "Cancel"}
                        </Button>
                        {step === 2 && (
                            <Button
                                size="sm"
                                disabled={unmappedRequired.length > 0}
                                onClick={proceedToPreview}
                                className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                                <ArrowRight className="h-3.5 w-3.5" /> Preview Data
                            </Button>
                        )}
                        {step === 3 && (
                            <Button
                                size="sm"
                                disabled={!canImport || isPending}
                                onClick={handleImport}
                                className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                            >
                                {isPending ? (
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing...</>
                                ) : (
                                    <><ArrowRight className="h-3.5 w-3.5" /> Import {parsedData.length} Lead{parsedData.length > 1 ? 's' : ''}</>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
    const colors: Record<string, string> = {
        blue: "bg-blue-50 text-blue-600 border-blue-200/50",
        emerald: "bg-emerald-50 text-emerald-600 border-emerald-200/50",
        red: "bg-red-50 text-red-600 border-red-200/50",
        amber: "bg-amber-50 text-amber-600 border-amber-200/50",
    }
    return (
        <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${colors[color]}`}>
            {icon}
            <span className="text-lg font-bold">{value}</span>
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70">{label}</span>
        </div>
    )
}
