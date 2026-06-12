"use client"

import { useCallback, useEffect, useMemo, useState, useRef, useTransition } from "react"
import { useCompany } from "@/contexts/company-context"
import { importLeadsAction, importHistoricalLeadsAction } from "@/app/actions/lead-actions"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { parseSmartEventDates } from "@/utils/smart-date-parser"
import { excelSerialToISO } from "@/utils/excel-date"
import { detectHeaderRow, buildHeaderAndRows } from "@/features/leads/lib/detect-header-row"
import { resolveFieldByAlias, fuzzyMatchFieldKey } from "@/features/leads/lib/import-aliases"
import { suggestStageMappings, type StageInfo } from "@/features/leads/lib/suggest-stage-mapping"
import { coerceNumber } from "@/features/leads/lib/import-normalize"
import {
    getStageMappings,
    saveStageMappings,
    listImportProfiles,
    saveImportProfile,
    type ImportProfileRow,
} from "@/app/actions/import-profile-actions"

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
    Sparkles, RotateCcw, Save, Workflow, Plus, Trash2,
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
    { key: "closed_won_date", label: "Closed Won Date", required: false, group: "Pipeline & Status", example: "2026-04-20" },
    { key: "closed_lost_date", label: "Closed Lost Date", required: false, group: "Pipeline & Status", example: "2026-05-10" },
    { key: "lost_reason", label: "Lost Reason", required: false, group: "Pipeline & Status", example: "Budget" },
    { key: "lost_reason_details", label: "Lost Reason Details", required: false, group: "Pipeline & Status", example: "Client postponed event due to internal restructuring" },

    // Notes
    { key: "general_brief", label: "General Brief", required: false, group: "Notes", example: "Client needs full-service event management" },
    { key: "production_sow", label: "Production SOW", required: false, group: "Notes", example: "Stage setup, sound system, lighting" },
    { key: "special_remarks", label: "Special Remarks", required: false, group: "Notes", example: "VIP guest protocol required" },
    { key: "description", label: "Description", required: false, group: "Notes", example: "Initial inquiry about event" },
    { key: "remark", label: "Remark", required: false, group: "Notes", example: "" },
]

// ── Additional fields for historical import ──
// `received_date` is REQUIRED — it sets the lead's "Received Month" used in
// the pipeline filter. For backfilled rows it MUST reflect the date the
// lead was originally received, not the day the row is being imported.
const HISTORICAL_FIELDS = [
    { key: "received_date", label: "Received Date", required: true, group: "Historical", example: "2024-03-15" },
    { key: "actual_value", label: "Confirmed Value (Revenue)", required: false, group: "Historical", example: "175000000" },
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

    // Determinate progress while importing — driven by client-side batching
    // so the user sees real row counts instead of an indefinite spinner.
    const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null)

    // Wizard state — 4 steps
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
    const [fileName, setFileName] = useState("")
    const [parsedData, setParsedData] = useState<ParsedRow[]>([])
    const [excelHeaders, setExcelHeaders] = useState<string[]>([])
    const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
    const [validations, setValidations] = useState<RowValidation[]>([])
    const [importResult, setImportResult] = useState<{ success: number; failed: number; errors: string[]; warnings: string[] }>({ success: 0, failed: 0, errors: [], warnings: [] })
    const [isHistorical, setIsHistorical] = useState(false)
    const [historicalPipelineId, setHistoricalPipelineId] = useState<string>("")
    const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([])

    // Stage-mapping state. `stageMapping` translates spreadsheet STATUS-like
    // values into actual pipeline_stages.id; `statusSourceField` records
    // which Excel column we're reading those values from.
    const [pipelineStages, setPipelineStages] = useState<StageInfo[]>([])
    const [stageMapping, setStageMapping] = useState<Record<string, string>>({})
    const [statusSourceField, setStatusSourceField] = useState<string | null>(null)
    const [savedStageMappings, setSavedStageMappings] = useState<Record<string, string>>({})

    // Import-profile state
    const [importProfiles, setImportProfiles] = useState<ImportProfileRow[]>([])
    const [profileName, setProfileName] = useState("")
    const [savingProfile, setSavingProfile] = useState(false)

    // Fetch pipelines for historical mode selector
    useEffect(() => {
        if (!isHistorical) return
        const supabase = createClient()
        supabase.from("pipelines").select("id, name").order("created_at", { ascending: true })
            .then(({ data }) => { if (data) setPipelines(data) })
    }, [isHistorical])

    // Determine which pipeline the import is targeting (changes between
    // standard and historical mode). Used to fetch stages + saved mappings.
    const targetPipelineId = isHistorical ? historicalPipelineId : pipelineId

    // Load pipeline stages + saved stage mappings whenever the target
    // pipeline changes. Stages drive the dropdown choices; saved mappings
    // pre-fill the per-source-value selections.
    useEffect(() => {
        if (!open || !targetPipelineId) {
            setPipelineStages([])
            setSavedStageMappings({})
            return
        }
        const supabase = createClient()
        let cancelled = false
        ;(async () => {
            const [{ data: stagesData }, savedRes] = await Promise.all([
                supabase
                    .from("pipeline_stages")
                    .select("id, name, sort_order, closed_status")
                    .eq("pipeline_id", targetPipelineId)
                    .order("sort_order", { ascending: true }),
                getStageMappings(targetPipelineId),
            ])
            if (cancelled) return
            setPipelineStages((stagesData ?? []) as StageInfo[])
            if (savedRes.success && savedRes.data) {
                const map: Record<string, string> = {}
                for (const r of savedRes.data) {
                    map[r.source_value] = r.target_stage_id
                }
                setSavedStageMappings(map)
            }
        })()
        return () => { cancelled = true }
    }, [open, targetPipelineId])

    // Load saved import profiles when the modal opens.
    useEffect(() => {
        if (!open) return
        let cancelled = false
        ;(async () => {
            const res = await listImportProfiles(targetPipelineId)
            if (cancelled) return
            if (res.success && res.data) setImportProfiles(res.data)
        })()
        return () => { cancelled = true }
    }, [open, targetPipelineId])

    // Active fields depend on mode — memoized to prevent re-render cascades
    const COMBINED_FIELDS = useMemo(() => [...SYSTEM_FIELDS, ...HISTORICAL_FIELDS], [])
    const activeFields = isHistorical ? COMBINED_FIELDS : SYSTEM_FIELDS

    const resetState = useCallback(() => {
        setStep(1)
        setFileName("")
        setParsedData([])
        setExcelHeaders([])
        setColumnMapping({})
        setValidations([])
        setImportResult({ success: 0, failed: 0, errors: [], warnings: [] })
        setImportProgress(null)
        setIsHistorical(false)
        setHistoricalPipelineId("")
        setStageMapping({})
        setStatusSourceField(null)
        setProfileName("")
    }, [])

    const handleClose = useCallback(() => {
        // Modern platform UX: never let an in-flight import be lost to a
        // stray outside click or Escape press. Inform the user, keep the
        // modal open, finish the request.
        if (isPending) {
            toast.info("Import in progress — please wait until it finishes.")
            return
        }
        resetState()
        onOpenChange(false)
    }, [resetState, onOpenChange, isPending])

    // Only the result panel (Step 4) is safe to dismiss with an outside
    // click — by then the import is already complete. Everywhere else the
    // user has unsaved wizard state (uploaded file, custom mapping, stage
    // mapping, profile name in flight) and accidental dismissal would be
    // costly. Match the HubSpot / Linear / Stripe wizard pattern: require
    // an explicit Cancel / X click to leave.
    const blockOutsideDismiss = isPending || step < 4

    // ── Download XLSX Template ──
    const downloadTemplate = useCallback(() => {
        const headers = activeFields.map((c) => c.label)
        const exampleRow = activeFields.map((c) => c.example)
        const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow])
        ws["!cols"] = activeFields.map((c) => ({
            wch: Math.max(c.label.length, c.example.length, 18)
        }))
        const wb = XLSX.utils.book_new()
        const sheetName = isHistorical ? "Historical Import Template" : "Lead Import Template"
        XLSX.utils.book_append_sheet(wb, ws, sheetName)

        // For historical imports, add an Instructions sheet so users know
        // exactly how to populate the Received Date column. Without this,
        // users frequently leave it blank or fill it with today's date,
        // which breaks the Received Month filter.
        if (isHistorical) {
            const instructions = [
                ["Historical Lead Import \u2014 Instructions"],
                [""],
                ["This template is for backfilling leads that were received in"],
                ["PREVIOUS months. The Received Date column drives the"],
                ["\"Received Month\" filter on the pipeline."],
                [""],
                ["Required:"],
                ["  \u2022 Received Date (YYYY-MM-DD) \u2014 the date the lead was"],
                ["    originally received, NOT today's date."],
                ["  \u2022 Project Name"],
                ["  \u2022 Subsidiary / Business Unit"],
                [""],
                ["Tips:"],
                ["  \u2022 Use ISO format YYYY-MM-DD (e.g. 2024-03-15) for safety,"],
                ["    or any date Excel recognises."],
                ["  \u2022 Leave Confirmed Value blank for leads that didn't close Won."],
                ["  \u2022 If a lead is already in the system from a regular import,"],
                ["    delete it first \u2014 re-importing as historical does NOT"],
                ["    update existing rows."],
                [""],
                ["Acceptable header aliases for Received Date:"],
                ["  Received Date | Created Date | Inquiry Date |"],
                ["  Month Received Lead | Lead Received | Tanggal Buat"],
            ]
            const wsInfo = XLSX.utils.aoa_to_sheet(instructions)
            wsInfo["!cols"] = [{ wch: 70 }]
            XLSX.utils.book_append_sheet(wb, wsInfo, "Instructions")
        }

        XLSX.writeFile(wb, isHistorical ? "historical_lead_import_template.xlsx" : "lead_import_template.xlsx")
        toast.success("Template downloaded!")
    }, [activeFields, isHistorical])

    // ── Auto-map headers to system fields ──
    // 3-tier strategy:
    //   1. Exact match against canonical alias dictionary (covers ~all
    //      real-world header variants we've seen).
    //   2. Direct comparison against system field label/key as a fallback.
    //   3. Bigram-Dice fuzzy matching for typos / abbreviations.
    const autoMapHeaders = useCallback((rawHeaders: string[]): ColumnMapping => {
        const mapping: ColumnMapping = {}
        const usedHeadersLocal = new Set<string>()

        // Index field keys for membership check; we only auto-map headers to
        // fields that exist in the active set (standard vs historical).
        const activeFieldKeys = new Set(activeFields.map((f) => f.key))

        // ── Pass 1: Alias-dictionary exact match ──
        for (const header of rawHeaders) {
            const fieldKey = resolveFieldByAlias(header)
            if (fieldKey && activeFieldKeys.has(fieldKey) && !mapping[fieldKey]) {
                mapping[fieldKey] = header
                usedHeadersLocal.add(header)
            }
        }

        // ── Pass 2: Direct label/key match for fields still unmapped ──
        for (const field of activeFields) {
            if (mapping[field.key]) continue
            const found =
                rawHeaders.find((h) => h === field.label) ||
                rawHeaders.find((h) => h.toLowerCase() === field.label.toLowerCase()) ||
                rawHeaders.find((h) => h.toLowerCase() === field.key.toLowerCase()) ||
                rawHeaders.find((h) =>
                    h.toLowerCase().replace(/[_ ]/g, "") ===
                    field.key.toLowerCase().replace(/_/g, ""),
                )
            if (found && !usedHeadersLocal.has(found)) {
                mapping[field.key] = found
                usedHeadersLocal.add(found)
            }
        }

        // ── Pass 3: Fuzzy match (bigram-Dice) for remaining headers ──
        // Only suggest if confidence is high — avoid spurious mappings.
        for (const header of rawHeaders) {
            if (usedHeadersLocal.has(header)) continue
            const guess = fuzzyMatchFieldKey(header, 0.7)
            if (
                guess &&
                activeFieldKeys.has(guess.fieldKey) &&
                !mapping[guess.fieldKey]
            ) {
                mapping[guess.fieldKey] = header
                usedHeadersLocal.add(header)
            }
        }

        return mapping
    }, [activeFields])

    // ── Validate parsed data based on mapping ──
    const validateData = useCallback((rows: ParsedRow[], mapping: ColumnMapping): RowValidation[] => {
        const errors: RowValidation[] = []
        rows.forEach((row, idx) => {
            for (const field of activeFields.filter((f) => f.required)) {
                const header = mapping[field.key]
                const value = header ? row[header] : ""
                if (!value || !String(value).trim()) {
                    errors.push({ row: idx + 1, field: field.label, message: `${field.label} is required`, level: "error" })
                }
            }
            // Validate date formats for both standard and historical modes.
            // Closed dates can appear in either context — historical adds
            // received_date on top.
            const dateFieldsForMode = isHistorical
                ? ["target_close_date", "received_date", "closed_won_date", "closed_lost_date"]
                : ["target_close_date", "closed_won_date", "closed_lost_date"]
            for (const df of dateFieldsForMode) {
                const header = mapping[df]
                const value = header ? row[header] : ""
                if (value && String(value).trim()) {
                    const trimmed = String(value).trim()
                    // Skip cells that are clearly not dates (mostly letters,
                    // e.g. a signatory name accidentally mapped to a date
                    // field). Surface as a warning so the user can fix the
                    // mapping instead of treating the entire row as broken.
                    const letterCount = (trimmed.match(/[A-Za-z]/g) ?? []).length
                    const digitCount = (trimmed.match(/\d/g) ?? []).length
                    if (letterCount > 4 && digitCount === 0) {
                        const field = activeFields.find((f) => f.key === df)
                        errors.push({ row: idx + 1, field: field?.label || df, message: `"${trimmed.slice(0, 40)}" doesn't look like a date — unmap this column if you meant something else`, level: "warning" })
                        continue
                    }
                    const looksLikeSerial = excelSerialToISO(trimmed) !== null
                    const d = new Date(trimmed)
                    if (!looksLikeSerial && isNaN(d.getTime())) {
                        const field = activeFields.find((f) => f.key === df)
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
            for (const nf of ["estimated_value", "actual_value", "pax_count"]) {
                const header = mapping[nf]
                const val = header ? row[header] : ""
                if (val && String(val).trim() && coerceNumber(val) === null) {
                    const field = activeFields.find((f) => f.key === nf)
                    errors.push({ row: idx + 1, field: field?.label || nf, message: "Must be a number", level: "error" })
                }
            }
            // Historical-only date field validation (Created Date is already
            // covered, plus closed dates were promoted to standard above).
            // Kept as a no-op block for now to make the historical branch
            // explicit; future historical-only date fields go here.

        })
        return errors
    }, [activeFields, isHistorical])

    // ── Parse XLSX file ──
    // Reads the first sheet, auto-detects which row contains headers (real-
    // world sheets often have a banner row + a merged group row before the
    // actual headers), and converts every cell to a string. Excel serial
    // dates are kept as their numeric string form here — downstream parsers
    // (`parseSmartEventDates`, `excelSerialToISO`) handle the conversion.
    const parseXLSX = useCallback((buffer: ArrayBuffer): {
        headers: string[];
        rows: ParsedRow[];
        headerRowIndex: number;
    } => {
        const workbook = XLSX.read(buffer, { type: "array", cellDates: false })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        // Use the raw 2D array form so we can choose the header row ourselves.
        const raw = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            defval: "",
            raw: true,
            blankrows: false,
        })
        if (raw.length === 0) {
            return { headers: [], rows: [], headerRowIndex: 0 }
        }
        const detection = detectHeaderRow(raw)
        const { headers, rows } = buildHeaderAndRows(raw, detection)
        return { headers, rows, headerRowIndex: detection.headerRowIndex }
    }, [])

    // ── Handle File ──
    const processFile = useCallback((file: File) => {
        // Block upload if historical mode but no pipeline selected
        if (isHistorical && !historicalPipelineId) {
            toast.error("Please select a target pipeline first")
            return
        }
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
            const { headers, rows, headerRowIndex } = parseXLSX(buffer)
            if (rows.length === 0) {
                toast.error("No data rows found in the file")
                return
            }
            setExcelHeaders(headers)
            setParsedData(rows)
            const autoMap = autoMapHeaders(headers)
            setColumnMapping(autoMap)
            if (headerRowIndex > 0) {
                toast.success(
                    `Detected headers on row ${headerRowIndex + 1}, skipped ${headerRowIndex} banner row(s).`,
                )
            }
            setStep(2)
        }
        reader.readAsArrayBuffer(file)
    }, [parseXLSX, autoMapHeaders, isHistorical, historicalPipelineId])

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
    const unmappedRequired = activeFields.filter((f) => f.required && !columnMapping[f.key])

    // ── Auto-detect the status source field + distinct values ──
    // Whichever Excel column is mapped to `status` or `pipeline_stage_name`
    // is treated as the source of stage values. We collect distinct,
    // non-empty values from that column so we can show one row per value
    // in the stage-mapping table.
    const statusFieldHeader = useMemo(() => {
        return columnMapping.status || columnMapping.pipeline_stage_name || null
    }, [columnMapping])

    const distinctStatusValues = useMemo(() => {
        if (!statusFieldHeader) return []
        const set = new Set<string>()
        for (const row of parsedData) {
            const v = row[statusFieldHeader]?.trim()
            if (v) set.add(v)
        }
        return [...set].sort((a, b) => a.localeCompare(b))
    }, [statusFieldHeader, parsedData])

    // Pre-populate stage mapping when distinct values change. Priority:
    //   1. Saved per-pipeline mappings (from import_stage_mappings DB).
    //   2. Heuristic suggestions (suggestStageMappings).
    // Anything the user manually changed is preserved.
    useEffect(() => {
        if (distinctStatusValues.length === 0) {
            setStageMapping({})
            setStatusSourceField(null)
            return
        }
        setStatusSourceField(statusFieldHeader)
        setStageMapping((prev) => {
            const next: Record<string, string> = { ...prev }
            const suggestions = suggestStageMappings(distinctStatusValues, pipelineStages)
            for (const v of distinctStatusValues) {
                if (next[v]) continue // user already chose
                // Saved mapping takes precedence; lookup is case-sensitive against
                // what's stored. Try the original casing then upper/lower variants.
                const saved =
                    savedStageMappings[v] ||
                    savedStageMappings[v.toUpperCase()] ||
                    savedStageMappings[v.toLowerCase()]
                if (saved && pipelineStages.some((s) => s.id === saved)) {
                    next[v] = saved
                    continue
                }
                if (suggestions[v]) next[v] = suggestions[v]
            }
            return next
        })
    }, [distinctStatusValues, statusFieldHeader, pipelineStages, savedStageMappings])

    // Apply a saved import profile: replaces column mapping (and stage mapping
    // if the profile carries one) with the saved configuration.
    const applyProfile = useCallback((profile: ImportProfileRow) => {
        // Only keep mappings whose Excel header is actually present in the
        // current file — otherwise the user sees orphaned dropdowns.
        const cleanColMap: ColumnMapping = {}
        for (const [fieldKey, header] of Object.entries(profile.column_mapping)) {
            if (excelHeaders.includes(header)) cleanColMap[fieldKey] = header
        }
        setColumnMapping(cleanColMap)
        if (profile.stage_mapping && Object.keys(profile.stage_mapping).length > 0) {
            setStageMapping(profile.stage_mapping)
        }
        toast.success(`Applied profile "${profile.name}"`)
    }, [excelHeaders])

    // Save current configuration as a reusable profile.
    const handleSaveProfile = useCallback(async () => {
        if (!profileName.trim()) {
            toast.error("Please give the profile a name first")
            return
        }
        setSavingProfile(true)
        try {
            const res = await saveImportProfile({
                name: profileName.trim(),
                pipeline_id: targetPipelineId ?? null,
                is_historical: isHistorical,
                column_mapping: columnMapping,
                stage_mapping: stageMapping,
                status_source_field: statusSourceField,
            })
            if (res.success) {
                toast.success(`Profile "${profileName}" saved — reuse it on future imports.`)
                const list = await listImportProfiles(targetPipelineId)
                if (list.success && list.data) setImportProfiles(list.data)
                setProfileName("")
            } else {
                toast.error(res.error || "Failed to save profile")
            }
        } finally {
            setSavingProfile(false)
        }
    }, [profileName, columnMapping, stageMapping, statusSourceField, isHistorical, targetPipelineId])

    const updateStageMapping = useCallback((sourceValue: string, stageId: string) => {
        setStageMapping((prev) => {
            const next = { ...prev }
            if (!stageId || stageId === "__none__") delete next[sourceValue]
            else next[sourceValue] = stageId
            return next
        })
    }, [])

    // Inline cell edit: update a single cell in `parsedData` and re-run
    // validation so the issue tab counts stay accurate.
    const editCell = useCallback((rowIdx: number, header: string, value: string) => {
        setParsedData((prev) => {
            const next = prev.map((r, i) => i === rowIdx ? { ...r, [header]: value } : r)
            // Re-validate using the next snapshot
            setValidations(validateData(next, columnMapping))
            return next
        })
    }, [validateData, columnMapping])

    // Filter mode for validation issues + preview rows.
    const [issueFilter, setIssueFilter] = useState<"all" | "errors" | "warnings">("all")

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
                    if ((fieldKey === "estimated_value" || fieldKey === "actual_value") && val) {
                        val = coerceNumber(val)
                    }
                    if (fieldKey === "pax_count" && val) {
                        val = coerceNumber(val)
                    }

                    mapped[fieldKey] = val
                }

                // ── Translate source status → pipeline_stage_id ──
                // If the user mapped a STATUS-like column AND configured a
                // stage mapping for that source value, write the stage_id
                // directly so the server action skips name lookup.
                if (statusSourceField) {
                    const srcVal = row[statusSourceField]?.trim()
                    if (srcVal && stageMapping[srcVal]) {
                        mapped.pipeline_stage_id = stageMapping[srcVal]
                        // Drop the legacy name-based field so the server
                        // doesn't double-resolve and overwrite our stage_id.
                        delete mapped.pipeline_stage_name
                        delete mapped.status
                    }
                }

                // Standard import: use current pipeline. Historical: use user-selected pipeline
                if (isHistorical) {
                    mapped.pipeline_id = historicalPipelineId || null
                } else {
                    mapped.pipeline_id = pipelineId || null
                }
                return mapped
            })

            // Persist the user's stage mapping so the next import for this
            // pipeline auto-applies it. Best-effort — we don't fail the
            // import if this save fails.
            if (targetPipelineId && Object.keys(stageMapping).length > 0) {
                const entries = Object.entries(stageMapping).map(([sv, sid]) => ({
                    source_value: sv,
                    target_stage_id: sid,
                }))
                void saveStageMappings(targetPipelineId, entries)
            }

            // ── Batched import for real progress feedback ──
            // The server actions process whatever rows they're given and return
            // once. Sending the rows in chunks lets us advance a determinate
            // progress bar between calls. Sequential (not parallel) on purpose:
            // each call re-fetches lookup tables, so a client company / contact
            // auto-created in an earlier chunk is visible to later chunks and
            // we avoid duplicate inserts.
            const BATCH_SIZE = 50
            const aggregate: typeof importResult = { success: 0, failed: 0, errors: [], warnings: [] }

            // Server labels rows "Row N" within its own slice; shift by the
            // batch offset so error/warning row numbers stay file-global.
            const reindex = (msgs: string[], offset: number) =>
                offset === 0
                    ? msgs
                    : msgs.map((m) =>
                          m.replace(/^Row (\d+)/, (_, n) => `Row ${Number(n) + offset}`),
                      )

            setImportProgress({ done: 0, total: rows.length })

            for (let start = 0; start < rows.length; start += BATCH_SIZE) {
                const chunk = rows.slice(start, start + BATCH_SIZE)
                const result = isHistorical
                    ? await importHistoricalLeadsAction(chunk)
                    : await importLeadsAction(chunk)

                aggregate.success += result.success
                aggregate.failed += result.failed
                aggregate.errors.push(...reindex(result.errors, start))
                aggregate.warnings.push(...reindex(result.warnings, start))

                setImportProgress({ done: Math.min(start + chunk.length, rows.length), total: rows.length })
            }

            setImportResult(aggregate)
            setImportProgress(null)
            setStep(4)

            if (aggregate.success > 0) {
                toast.success(`${aggregate.success} lead(s) imported successfully!`)
                onSuccess?.()
                router.refresh()
            }
            if (aggregate.failed > 0) {
                toast.error(`${aggregate.failed} lead(s) failed to import`)
            }
        })
    }, [columnMapping, parsedData, pipelineId, historicalPipelineId, startTransition, onSuccess, router, isHistorical, stageMapping, statusSourceField, targetPipelineId, importResult])

    // Headers already used in mapping
    const usedHeaders = useMemo(() => new Set(Object.values(columnMapping)), [columnMapping])

    // Group system fields by category
    const fieldGroups = useMemo(() => {
        const groups: Record<string, typeof SYSTEM_FIELDS> = {}
        for (const f of activeFields) {
            if (!groups[f.group]) groups[f.group] = []
            groups[f.group].push(f)
        }
        return groups
    }, [activeFields])

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(v) }}>
            <DialogContent
                className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden"
                // While an import is running we suppress all dismissal
                // affordances so the result panel is guaranteed to render.
                showCloseButton={!isPending}
                onInteractOutside={(e) => { if (blockOutsideDismiss) e.preventDefault() }}
                onEscapeKeyDown={(e) => { if (blockOutsideDismiss) e.preventDefault() }}
            >
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
                            {/* Import Mode Toggle */}
                            <div className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                                <button
                                    type="button"
                                    onClick={() => setIsHistorical(false)}
                                    className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${!isHistorical ? 'bg-white shadow-sm text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Standard Import
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsHistorical(true)}
                                    className={`flex-1 px-3 py-2 rounded-md text-xs font-semibold transition-all ${isHistorical ? 'bg-white shadow-sm text-amber-800 border border-amber-200' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    📅 Historical Data
                                </button>
                            </div>

                            {isHistorical && (
                                <div className="space-y-3">
                                    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50/70 border border-amber-200/50 text-xs text-amber-800">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold">Historical Import Mode</p>
                                            <p className="mt-0.5 text-amber-700">
                                                Import leads from previous years with custom dates. The <strong>Created Date</strong> column is required.
                                                Select the target pipeline where historical data should be stored (e.g. &quot;Pipeline 2025&quot;).
                                            </p>
                                        </div>
                                    </div>

                                    {/* Pipeline selector for historical data */}
                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-200/50 bg-white">
                                        <div className="text-xs font-semibold text-slate-700 shrink-0">Target Pipeline:</div>
                                        <Select value={historicalPipelineId} onValueChange={setHistoricalPipelineId}>
                                            <SelectTrigger className="h-8 text-xs flex-1">
                                                <SelectValue placeholder="Select pipeline for historical data..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {pipelines.map((p) => (
                                                    <SelectItem key={p.id} value={p.id}>
                                                        {p.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {/* Saved Import Profiles */}
                            {/*
                              Lists profiles previously saved by the user.
                              Picking one pre-fills column + stage mapping so
                              they can skip Step 2 entirely on recurring files.
                            */}
                            {importProfiles.length > 0 && (
                                <div className="rounded-lg border border-purple-200/50 bg-purple-50/30 overflow-hidden">
                                    <div className="px-3 py-2 bg-purple-50 border-b border-purple-200/50 flex items-center gap-2">
                                        <Workflow className="h-3.5 w-3.5 text-purple-500" />
                                        <span className="text-xs font-semibold text-purple-900">Saved Profiles</span>
                                        <span className="text-[11px] text-purple-700">
                                            — pick one to skip column mapping
                                        </span>
                                    </div>
                                    <div className="max-h-32 overflow-y-auto divide-y divide-purple-100/70">
                                        {importProfiles.map((p) => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => applyProfile(p)}
                                                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-purple-50 transition-colors text-left"
                                            >
                                                <span className="font-semibold text-slate-700 truncate">{p.name}</span>
                                                {p.is_historical && (
                                                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
                                                        Historical
                                                    </span>
                                                )}
                                                <span className="text-muted-foreground ml-auto">
                                                    {Object.keys(p.column_mapping).length} fields,
                                                    {" "}{Object.keys(p.stage_mapping ?? {}).length} stages
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

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
                                    <span className="font-semibold text-blue-800">{mappedCount} of {activeFields.length}</span>
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

                            {/* ── Stage Mapping Panel ── */}
                            {/*
                              Activates when the file has a STATUS-like column
                              and we know which pipeline stages to choose from.
                              The mapping is auto-suggested but fully editable.
                            */}
                            {distinctStatusValues.length > 0 && pipelineStages.length > 0 && (
                                <div className="rounded-lg border border-blue-200/70 bg-blue-50/30 overflow-hidden">
                                    <div className="px-3 py-2.5 bg-blue-50 border-b border-blue-200/70 flex items-center gap-2">
                                        <Workflow className="h-3.5 w-3.5 text-blue-500" />
                                        <span className="text-xs font-semibold text-blue-900">
                                            Stage Mapping
                                        </span>
                                        <span className="text-[11px] text-blue-700">
                                            — translate "{statusSourceField}" values into pipeline stages
                                        </span>
                                    </div>
                                    <div className="divide-y divide-blue-100/70">
                                        {distinctStatusValues.map((value) => {
                                            const currentStageId = stageMapping[value] || ""
                                            const isSaved = !!savedStageMappings[value]
                                            return (
                                                <div key={value} className="flex items-center gap-3 px-3 py-2">
                                                    <div className="flex items-center gap-2 w-[200px] shrink-0">
                                                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                                                            currentStageId ? "bg-blue-500" : "bg-slate-300"
                                                        }`} />
                                                        <span className="text-xs font-medium text-slate-700 truncate" title={value}>
                                                            {value}
                                                        </span>
                                                        {isSaved && (
                                                            <span
                                                                title="Saved from previous import"
                                                                className="text-[9px] text-blue-500 font-bold"
                                                            >
                                                                ★
                                                            </span>
                                                        )}
                                                    </div>
                                                    <ArrowRight className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                                                    <Select
                                                        value={currentStageId || "__none__"}
                                                        onValueChange={(v) => updateStageMapping(value, v)}
                                                    >
                                                        <SelectTrigger className={`h-8 text-xs flex-1 ${
                                                            currentStageId ? "border-blue-200 bg-white" : ""
                                                        }`}>
                                                            <SelectValue placeholder="Select pipeline stage..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="__none__">
                                                                <span className="text-muted-foreground">— Use default —</span>
                                                            </SelectItem>
                                                            {pipelineStages.map((s) => (
                                                                <SelectItem key={s.id} value={s.id}>
                                                                    <span className="flex items-center gap-1.5">
                                                                        {s.closed_status === "won" && (
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                        )}
                                                                        {s.closed_status === "lost" && (
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                                                        )}
                                                                        {!s.closed_status && (
                                                                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                                                        )}
                                                                        {s.name}
                                                                    </span>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )
                                        })}
                                    </div>
                                    <div className="px-3 py-2 bg-blue-50/50 border-t border-blue-100/70 text-[11px] text-blue-700">
                                        Mappings save automatically on import — next time these values are translated for you.
                                    </div>
                                </div>
                            )}

                            {/* ── Save as Profile ── */}
                            {/*
                              After mapping, user can name the configuration to
                              reuse on future imports. Profile-aware files (e.g.
                              "Werkudara Recap 2026") become 1-click imports.
                            */}
                            <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-center gap-2">
                                <Save className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Save this mapping as a profile (optional)..."
                                    value={profileName}
                                    onChange={(e) => setProfileName(e.target.value)}
                                    className="text-xs flex-1 bg-transparent border-0 outline-none placeholder:text-slate-400"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile || !profileName.trim()}
                                    className="gap-1 h-7 text-[11px]"
                                >
                                    {savingProfile ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                        <Plus className="h-3 w-3" />
                                    )}
                                    Save profile
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ═══ STEP 3: Preview & Validate ═══ */}
                    {step === 3 && (
                        <div className="space-y-4">
                            {/* Determinate import progress — real row counts, not a spinner */}
                            {importProgress && (
                                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-2">
                                    <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
                                        <span className="flex items-center gap-1.5">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing leads…
                                        </span>
                                        <span>
                                            {importProgress.done} / {importProgress.total}
                                            {" "}
                                            ({Math.round((importProgress.done / Math.max(importProgress.total, 1)) * 100)}%)
                                        </span>
                                    </div>
                                    <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-300 ease-out"
                                            style={{ width: `${(importProgress.done / Math.max(importProgress.total, 1)) * 100}%` }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-blue-600/80">
                                        Please keep this window open until the import finishes.
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-4 gap-3">
                                <StatCard label="Rows" value={parsedData.length} icon={<FileSpreadsheet className="h-3.5 w-3.5" />} color="blue" />
                                <StatCard label="Mapped" value={`${mappedCount}/${activeFields.length}`} icon={<CheckCircle2 className="h-3.5 w-3.5" />} color="emerald" />
                                <StatCard label="Errors" value={errorCount} icon={<XCircle className="h-3.5 w-3.5" />} color={errorCount > 0 ? "red" : "emerald"} />
                                <StatCard label="Warnings" value={warningCount} icon={<AlertTriangle className="h-3.5 w-3.5" />} color={warningCount > 0 ? "amber" : "emerald"} />
                            </div>

                            {validations.length > 0 && (
                                <div className="rounded-lg border border-slate-200 overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
                                        <span className="text-xs font-semibold text-slate-600">
                                            Validation Issues ({validations.length})
                                        </span>
                                        <div className="flex items-center gap-1">
                                            {(["all", "errors", "warnings"] as const).map((f) => (
                                                <button
                                                    key={f}
                                                    type="button"
                                                    onClick={() => setIssueFilter(f)}
                                                    className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${
                                                        issueFilter === f
                                                            ? "bg-slate-700 text-white"
                                                            : "bg-white text-slate-500 hover:bg-slate-100"
                                                    }`}
                                                >
                                                    {f === "all" ? "All" : f === "errors" ? `Errors (${errorCount})` : `Warnings (${warningCount})`}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                        {validations
                                            .filter((v) =>
                                                issueFilter === "all" ||
                                                (issueFilter === "errors" && v.level === "error") ||
                                                (issueFilter === "warnings" && v.level === "warning"),
                                            )
                                            .slice(0, 50)
                                            .map((v, i) => (
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
                                <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-2">
                                    <span>Data Preview (first 5 rows)</span>
                                    <span className="text-[10px] text-muted-foreground font-normal">— click any cell to edit</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50/50">
                                                <th className="px-3 py-2 text-left font-medium text-slate-500 border-b">#</th>
                                                {Object.entries(columnMapping).slice(0, 8).map(([fieldKey]) => {
                                                    const field = activeFields.find((f) => f.key === fieldKey)
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
                                                                const f = activeFields.find((sf) => sf.label === e.field)
                                                                return f?.key === fieldKey
                                                            })
                                                            return (
                                                                <td key={fieldKey} className={`max-w-[160px] ${hasError ? 'bg-red-50' : ''}`}>
                                                                    <PreviewEditableCell
                                                                        value={row[excelHeader] ?? ""}
                                                                        onCommit={(v) => editCell(idx, excelHeader, v)}
                                                                        hasError={hasError}
                                                                    />
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
                                    <div className="px-3 py-2 bg-red-50 border-b border-red-200 text-xs font-semibold text-red-700 flex items-center gap-1.5">
                                        <XCircle className="h-3.5 w-3.5" />
                                        Failed Imports ({importResult.errors.length})
                                        <span className="ml-auto text-[10px] font-normal text-red-600/80">these rows were NOT imported</span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-red-100">
                                        {importResult.errors.map((err, i) => (
                                            <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs text-red-700">
                                                <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                <span>{err}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {importResult.warnings.length > 0 && (
                                <div className="rounded-lg border border-amber-200 overflow-hidden">
                                    <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                                        <AlertTriangle className="h-3.5 w-3.5" />
                                        Auto-corrections ({importResult.warnings.length})
                                        <span className="ml-auto text-[10px] font-normal text-amber-700/80">leads imported, please verify</span>
                                    </div>
                                    <div className="max-h-40 overflow-y-auto divide-y divide-amber-100">
                                        {importResult.warnings.map((w, i) => (
                                            <div key={i} className="flex items-start gap-2 px-3 py-2 text-xs text-amber-800">
                                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                                <span>{w}</span>
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
                        <Button variant="outline" size="sm" onClick={handleClose} disabled={isPending}>
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
                                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {importProgress ? `Importing ${importProgress.done}/${importProgress.total}…` : "Importing…"}</>
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

/**
 * Inline editable cell for the Step 3 preview. Click to edit, Enter or
 * blur to commit, Escape to cancel. Surfaces errors via red text.
 */
function PreviewEditableCell({
    value,
    onCommit,
    hasError,
}: {
    value: string
    onCommit: (next: string) => void
    hasError: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [draft, setDraft] = useState(value)

    // Sync draft if external value changes (e.g., re-validate after another edit).
    useEffect(() => { setDraft(value) }, [value])

    if (editing) {
        return (
            <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => {
                    if (draft !== value) onCommit(draft)
                    setEditing(false)
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        if (draft !== value) onCommit(draft)
                        setEditing(false)
                    } else if (e.key === "Escape") {
                        setDraft(value)
                        setEditing(false)
                    }
                }}
                className={`w-full px-3 py-2 text-xs bg-white border ${
                    hasError ? "border-red-300" : "border-blue-300"
                } outline-none rounded-sm`}
            />
        )
    }

    return (
        <button
            type="button"
            onClick={() => setEditing(true)}
            className={`w-full text-left px-3 py-2 truncate hover:bg-blue-50/50 transition-colors ${
                hasError ? "text-red-600 font-medium" : "text-slate-700"
            }`}
            title="Click to edit"
        >
            {value || <span className="text-slate-300">—</span>}
        </button>
    )
}
