"use client"

import { useCallback, useMemo, useState, useRef, useTransition } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import * as XLSX from "xlsx"

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

// ── Helper formatters ──
const PRESERVE_UPPERCASE = ["IT", "HR", "MICE", "PR", "B2B", "B2C", "PT", "CV", "TBK", "LLC", "INC", "LTD", "IGO", "NGO", "MLM", "BUMN", "BUMD", "FMCG"]

function toProperCase(str: string) {
    if (!str) return str
    return str
        .toLowerCase()
        .split(/[ /_|-]/) // split by space, slash, underscore, pipe, hyphen
        .map((word, idx, arr) => {
            if (!word) return ""
            const upperWord = word.toUpperCase()
            if (PRESERVE_UPPERCASE.includes(upperWord)) return upperWord
            // Small words like "dan", "and", "of", "in" shouldn't be capitalized unless it's the first word
            if (idx > 0 && /^(and|of|in|the|dan|di|ke|dari)$/i.test(word)) {
                return word.toLowerCase()
            }
            return word.charAt(0).toUpperCase() + word.slice(1)
        })
        .join(" ") // Note: This simplistically joins by space, destroying original delimiters like / or -, but it's usually fine for industry names
}

function formatValue(key: string, val: string) {
    if (!val) return val
    if (key === "industry" || key === "line_industry") {
        // e.g. "BANKING" -> "Banking", "TOUR OPERATOR/ TR..." -> "Tour Operator/ Tr..."
        // A safer generic title casing that preserves non-word characters:
        let cased = val.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
        PRESERVE_UPPERCASE.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, "ig")
            cased = cased.replace(regex, word)
        })
        return cased
    }
    return val
}

import { parseAddress } from "@/lib/address-parser"

// ── System fields for Companies ──
const SYSTEM_FIELDS = [
    { key: "name", label: "Company Name", required: true, group: "Core Details", example: "PT Contoh Sukses" },
    { key: "industry", label: "Sector (Industry)", required: false, group: "Core Details", example: "Technology" },
    { key: "line_industry", label: "Line Industry", required: false, group: "Core Details", example: "Software Development" },
    { key: "phone", label: "Phone", required: false, group: "Contact", example: "+62811223344" },
    { key: "website", label: "Website", required: false, group: "Contact", example: "www.contoh.com" },
    { key: "street_address", label: "Street Address", required: false, group: "Location", example: "Jl. Sudirman No 1" },
    { key: "city", label: "City", required: false, group: "Location", example: "Jakarta" },
    { key: "postal_code", label: "Postal Code", required: false, group: "Location", example: "10220" },
    { key: "country", label: "Country", required: false, group: "Location", example: "Indonesia" },
    { key: "notes", label: "Notes", required: false, group: "Other", example: "Key client in APAC" },
]

type ParsedRow = Record<string, string>
type ColumnMapping = Record<string, string>
type RowValidation = { row: number; field: string; message: string; level: "error" | "warning" }

interface ImportCompaniesModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function ImportCompaniesModal({ open, onOpenChange, onSuccess }: ImportCompaniesModalProps) {
    const router = useRouter()
    const supabase = createClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [isPending, startTransition] = useTransition()

    // Wizard state
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

    const downloadTemplate = useCallback(() => {
        const headers = SYSTEM_FIELDS.map((c) => c.label)
        const exampleRow = SYSTEM_FIELDS.map((c) => c.example)
        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
        ws["!cols"] = SYSTEM_FIELDS.map((c) => ({
            wch: Math.max(c.label.length, c.example.length, 18)
        }))
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, "Companies Import Template")
        XLSX.writeFile(wb, "companies_import_template.xlsx")
        toast.success("Template downloaded!")
    }, [])

    const autoMapHeaders = useCallback((rawHeaders: string[]): ColumnMapping => {
        const mapping: ColumnMapping = {}
        for (const field of SYSTEM_FIELDS) {
            let found = rawHeaders.find((h) => h === field.label)
            if (!found) found = rawHeaders.find((h) => h.toLowerCase() === field.label.toLowerCase())
            if (!found) found = rawHeaders.find((h) => h.toLowerCase() === field.key.toLowerCase())
            if (!found && field.key === "name") found = rawHeaders.find((h) => /company|organization|name/i.test(h))
            if (!found && field.key === "street_address") found = rawHeaders.find((h) => /address|alamat|street/i.test(h))
            if (!found && field.key === "industry") found = rawHeaders.find((h) => /industry|sector|sektor/i.test(h))
            if (found) mapping[field.key] = found
        }
        return mapping
    }, [])

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
        })
        return errors
    }, [])

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

    const updateMapping = useCallback((systemFieldKey: string, excelHeader: string) => {
        setColumnMapping((prev) => {
            const next = { ...prev }
            if (excelHeader === "__none__") delete next[systemFieldKey]
            else next[systemFieldKey] = excelHeader
            return next
        })
    }, [])

    const mappedCount = Object.keys(columnMapping).length
    const unmappedRequired = SYSTEM_FIELDS.filter((f) => f.required && !columnMapping[f.key])

    const proceedToPreview = useCallback(() => {
        const errors = validateData(parsedData, columnMapping)
        setValidations(errors)
        setStep(3)
    }, [validateData, parsedData, columnMapping])

    const errorCount = validations.filter((v) => v.level === "error").length
    const warningCount = validations.filter((v) => v.level === "warning").length
    const canImport = parsedData.length > 0 && errorCount === 0

    const handleImport = useCallback(() => {
        startTransition(async () => {
            const { data: userData } = await supabase.auth.getUser()
            const userId = userData.user?.id

            let successCount = 0
            let failedCount = 0
            const errs: string[] = []

            for (let i = 0; i < parsedData.length; i++) {
                const row = parsedData[i]
                const payload: any = {}
                for (const [fieldKey, excelHeader] of Object.entries(columnMapping)) {
                    let val = row[excelHeader]?.trim()
                    if (val) {
                        val = formatValue(fieldKey, val)
                        payload[fieldKey] = val
                    }
                }

                if (userId) payload.owner_id = userId

                // Smartly parse the street_address into city and postal_code if they are missing
                if (payload.street_address) {
                    const parsed = parseAddress(payload.street_address, payload.city, payload.postal_code)
                    payload.street_address = parsed.street || payload.street_address
                    if (!payload.city && parsed.city) payload.city = parsed.city
                    if (!payload.postal_code && parsed.postal) payload.postal_code = parsed.postal
                }

                if (payload.street_address || payload.city || payload.country || payload.postal_code) {
                    payload.address = [payload.street_address, payload.city, payload.postal_code, payload.country].filter(Boolean).join(", ")
                }

                const { error } = await supabase.from("client_companies").insert(payload)
                if (error) {
                    failedCount++
                    errs.push(`Row ${i + 1}: ${error.message}`)
                } else {
                    successCount++
                }
            }

            setImportResult({ success: successCount, failed: failedCount, errors: errs })
            setStep(4)

            if (successCount > 0) {
                toast.success(`${successCount} companies imported successfully!`)
                onSuccess?.()
                router.refresh()
            }
            if (failedCount > 0) {
                toast.error(`${failedCount} rows failed to import`)
            }
        })
    }, [columnMapping, parsedData, supabase, onSuccess, router])

    const usedHeaders = useMemo(() => new Set(Object.values(columnMapping)), [columnMapping])

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
                            <DialogTitle className="text-lg font-semibold">Import Companies</DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                                {step === 1 && "Upload an Excel file to bulk import companies."}
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
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5">
                    {/* STEP 1: Upload */}
                    {step === 1 && (
                        <div className="space-y-5">
                            <div
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className="group relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer border-slate-300 bg-slate-50/50 hover:border-blue-400 hover:bg-blue-50/30"
                            >
                                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileInput} />
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                                        <FileSpreadsheet className="h-7 w-7 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">Drop your Excel file here, or <span className="text-blue-600">browse</span></p>
                                        <p className="text-xs text-muted-foreground mt-1">Supports .xlsx and .xls files</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-gradient-to-r from-emerald-50/50 to-teal-50/30">
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-700">Download Template</p>
                                        <p className="text-xs text-muted-foreground">Excel template with all supported columns</p>
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                                    <Download className="h-3.5 w-3.5" /> Download
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Map Data */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/70 border border-blue-200/50">
                                <Link2 className="h-4 w-4 text-blue-500 shrink-0" />
                                <div className="text-xs">
                                    <span className="font-semibold text-blue-800">{mappedCount} of {SYSTEM_FIELDS.length}</span>
                                    <span className="text-blue-600"> fields mapped from </span>
                                    <span className="font-semibold text-blue-800">{excelHeaders.length} columns</span>
                                </div>
                            </div>
                            {unmappedRequired.length > 0 && (
                                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200/50 text-xs">
                                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold text-red-800">Required fields not mapped</p>
                                        <p className="text-red-700 mt-0.5">{unmappedRequired.map((f) => f.label).join(", ")}</p>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3">
                                {Object.entries(fieldGroups).map(([groupName, fields]) => (
                                    <div key={groupName} className="rounded-lg border border-slate-200 overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">{groupName}</div>
                                        <div className="divide-y divide-slate-100">
                                            {fields.map((field) => {
                                                const currentHeader = columnMapping[field.key]
                                                const isMapped = !!currentHeader
                                                return (
                                                    <div key={field.key} className="flex items-center gap-3 px-3 py-2.5">
                                                        <div className="flex items-center gap-2 w-[200px] shrink-0">
                                                            <div className={`h-2 w-2 rounded-full shrink-0 ${isMapped ? 'bg-emerald-400' : field.required ? 'bg-red-400' : 'bg-slate-300'}`} />
                                                            <span className="text-xs font-medium text-slate-700 truncate">{field.label}</span>
                                                            {field.required && <span className="text-[9px] text-red-400 font-bold shrink-0">*</span>}
                                                        </div>
                                                        <div className="shrink-0">{isMapped ? <Link2 className="h-3.5 w-3.5 text-emerald-500" /> : <Link2Off className="h-3.5 w-3.5 text-slate-300" />}</div>
                                                        <Select value={currentHeader || "__none__"} onValueChange={(v) => updateMapping(field.key, v)}>
                                                            <SelectTrigger className={`h-8 text-xs flex-1 ${isMapped ? 'border-emerald-200 bg-emerald-50/50' : ''}`}>
                                                                <SelectValue placeholder="Select column..." />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="__none__"><span className="text-muted-foreground">— Don't import —</span></SelectItem>
                                                                {excelHeaders.map((h) => {
                                                                    const isUsed = usedHeaders.has(h) && h !== currentHeader
                                                                    return <SelectItem key={h} value={h} disabled={isUsed}><span className={isUsed ? 'text-muted-foreground' : ''}>{h} {isUsed && '(used)'}</span></SelectItem>
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

                    {/* STEP 3: Preview */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <div className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-blue-50 text-blue-600 border-blue-200/50">
                                    <FileSpreadsheet className="h-3.5 w-3.5" />
                                    <span className="text-lg font-bold">{parsedData.length}</span>
                                    <span className="text-[10px] uppercase tracking-wider opacity-70">Rows</span>
                                </div>
                                <div className="flex flex-col items-center gap-1 p-3 rounded-lg border bg-emerald-50 text-emerald-600 border-emerald-200/50">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span className="text-lg font-bold">{mappedCount}/{SYSTEM_FIELDS.length}</span>
                                    <span className="text-[10px] uppercase tracking-wider opacity-70">Mapped</span>
                                </div>
                                <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${errorCount > 0 ? "bg-red-50 text-red-600 border-red-200/50" : "bg-emerald-50 text-emerald-600 border-emerald-200/50"}`}>
                                    <XCircle className="h-3.5 w-3.5" />
                                    <span className="text-lg font-bold">{errorCount}</span>
                                    <span className="text-[10px] uppercase tracking-wider opacity-70">Errors</span>
                                </div>
                                <div className={`flex flex-col items-center gap-1 p-3 rounded-lg border ${warningCount > 0 ? "bg-amber-50 text-amber-600 border-amber-200/50" : "bg-emerald-50 text-emerald-600 border-emerald-200/50"}`}>
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    <span className="text-lg font-bold">{warningCount}</span>
                                    <span className="text-[10px] uppercase tracking-wider opacity-70">Warnings</span>
                                </div>
                            </div>
                            {validations.length > 0 && (
                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">Validation Issues</div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                        {validations.slice(0, 50).map((v, i) => (
                                            <div key={i} className="flex items-center gap-2.5 px-3 py-2 text-xs">
                                                {v.level === "error" ? <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                                                <span className="text-muted-foreground">Row {v.row}</span>
                                                <span className="font-medium text-slate-700">{v.field}</span>
                                                <span className="text-muted-foreground">— {v.message}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="rounded-lg border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">Data Preview (first 5 rows)</div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs hover:bg-slate-50/50 transition-colors">
                                        <thead>
                                            <tr className="bg-slate-50/50 text-slate-500 border-b border-slate-200">
                                                <th className="px-3 py-2 text-left font-medium">#</th>
                                                {Object.entries(columnMapping).slice(0, 8).map(([key]) => (
                                                    <th key={key} className="px-3 py-2 text-left font-medium">{SYSTEM_FIELDS.find(f => f.key === key)?.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {parsedData.slice(0, 5).map((row, idx) => (
                                                <tr key={idx} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                                                    <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                                    {Object.entries(columnMapping).slice(0, 8).map(([key, header]) => (
                                                        <td key={key} className="px-3 py-2 max-w-[160px] truncate">{row[header] || <span className="text-slate-300">—</span>}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Results */}
                    {step === 4 && (
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center gap-4 p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 border border-emerald-200/50">
                                    <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
                                    <div><p className="text-2xl font-bold text-emerald-700">{importResult.success}</p><p className="text-xs text-emerald-600 font-medium">Imported</p></div>
                                </div>
                                <div className={`flex items-center gap-4 p-5 rounded-xl border ${importResult.failed > 0 ? 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200/50' : 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-200/50'}`}>
                                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${importResult.failed > 0 ? 'bg-red-100' : 'bg-slate-100'}`}><XCircle className={`h-6 w-6 ${importResult.failed > 0 ? 'text-red-600' : 'text-slate-400'}`} /></div>
                                    <div><p className={`text-2xl font-bold ${importResult.failed > 0 ? 'text-red-700' : 'text-slate-400'}`}>{importResult.failed}</p><p className={`text-xs font-medium ${importResult.failed > 0 ? 'text-red-600' : 'text-slate-400'}`}>Failed</p></div>
                                </div>
                            </div>
                            {importResult.errors.length > 0 && (
                                <div className="rounded-lg border border-red-200 overflow-hidden"><div className="px-3 py-2 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-700">Errors</div><div className="max-h-40 overflow-y-auto divide-y divide-red-100">{importResult.errors.map((err, i) => <div key={i} className="px-3 py-2 text-xs text-red-700">{err}</div>)}</div></div>
                            )}
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    <div>
                        {step === 2 && <Button variant="ghost" size="sm" onClick={() => { setStep(1); setParsedData([]); setFileName(""); setExcelHeaders([]); setColumnMapping({}) }}><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back</Button>}
                        {step === 3 && <Button variant="ghost" size="sm" onClick={() => setStep(2)}><ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Edit Mapping</Button>}
                        {step === 4 && <Button variant="ghost" size="sm" onClick={resetState}><RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Import More</Button>}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleClose}>{step === 4 ? "Close" : "Cancel"}</Button>
                        {step === 2 && <Button size="sm" disabled={unmappedRequired.length > 0} onClick={proceedToPreview} className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white"><ArrowRight className="h-3.5 w-3.5" /> Preview Data</Button>}
                        {step === 3 && <Button size="sm" disabled={!canImport || isPending} onClick={handleImport} className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white">{isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing...</> : <><ArrowRight className="h-3.5 w-3.5" /> Import {parsedData.length}</>}</Button>}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
