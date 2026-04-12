"use client"

import { useEffect, useState, useCallback, useMemo, Suspense } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { flushSync } from "react-dom"
import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { createClient } from "@/utils/supabase/client"
import { useCompany } from "@/contexts/company-context"
import { PermissionGate } from "@/features/users/components/permission-gate"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2, Loader2, ListChecks, FolderPlus, Tag, Link2, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, RotateCcw, GripVertical, Archive } from "lucide-react"
import { toast } from "sonner"
import type { MasterOption, FormSchema } from "@/types"
import { cn } from "@/lib/utils"
import {
    DndContext, closestCenter, PointerSensor, useSensor, useSensors,
    type DragEndEvent,
} from "@dnd-kit/core"
import {
    SortableContext, verticalListSortingStrategy, useSortable,
    arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { FormLayoutBuilder } from "@/features/settings/components/form-layout-builder"

const SYSTEM_MANAGED_CATEGORIES = ["status", "bu_revenue"]

const CATEGORY_GROUPS: Record<string, string[]> = {
    "Leads": [
        "category", "lead_source", "grade_lead",
        "event_city", "event_format",
        "tentative_month", "tentative_year",
        "main_stream", "stream_type", "business_purpose", "tipe", "lost_reason"
    ],
    "Companies": ["sector", "area", "line_industry"],
    "Contacts": ["nationality"],
}

const CATEGORY_RELATIONS: Record<string, string> = {
    stream_type: "main_stream",
    business_purpose: "stream_type",
}
const MODULE_OPTIONS = [
    { value: "leads", label: "Leads" },
    { value: "contacts", label: "Contacts" },
    { value: "companies", label: "Companies" },
    { value: "tasks", label: "Tasks" },
]
const FIELD_TYPE_OPTIONS = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "dropdown", label: "Dropdown" },
]

function formatCategoryLabel(key: string) {
    if (key === "tentative_month") return "Month"
    if (key === "tentative_year") return "Year"
    const labelKey = key.replace(/^custom_[a-z]+__/, "")
    return labelKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function toFieldKey(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
}

export default function MasterOptionsPage() {
    return (
        <Suspense fallback={<div className="flex h-[calc(100vh-2rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <MasterOptionsContent />
        </Suspense>
    )
}

function MasterOptionsContent() {
    const { activeCompany, companies } = useCompany()
    const supabase = createClient()
    const companyId = activeCompany?.id ?? null
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // ── Master Options state ──
    const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "options")
    
    // Sync URL when tab changes
    const handleTabChange = (val: string) => {
        setActiveTab(val)
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", val)
        window.history.replaceState(null, '', `${pathname}?${params.toString()}`)
    }

    const [options, setOptions] = useState<MasterOption[]>([])
    const [optLoading, setOptLoading] = useState(true)
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
    const [optDialogOpen, setOptDialogOpen] = useState(false)
    const [editingOpt, setEditingOpt] = useState<MasterOption | null>(null)
    const [optForm, setOptForm] = useState({ label: "", value: "" })
    const [countryValue, setCountryValue] = useState("")
    const [parentValue, setParentValue] = useState("")
    const [optSaving, setOptSaving] = useState(false)
    const [deleteOptOpen, setDeleteOptOpen] = useState(false)
    const [deletingOpt, setDeletingOpt] = useState<MasterOption | null>(null)
    const [newCatOpen, setNewCatOpen] = useState(false)
    const [newCatName, setNewCatName] = useState("")
    const [newCatModule, setNewCatModule] = useState("leads")
    const [editCatOpen, setEditCatOpen] = useState(false)
    const [editCatName, setEditCatName] = useState("")
    const [editCatModule, setEditCatModule] = useState("leads")
    const [editCatLoading, setEditCatLoading] = useState(false)
    const [deleteCatConfirmOpen, setDeleteCatConfirmOpen] = useState(false)
    const [bulkOpen, setBulkOpen] = useState(false)
    const [bulkText, setBulkText] = useState("")
    const [bulkSaving, setBulkSaving] = useState(false)
    const [bulkParentValue, setBulkParentValue] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [showInactive, setShowInactive] = useState(false)
    const [sortConfig, setSortConfig] = useState<{ key: "label" | "parent"; direction: "asc" | "desc" } | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)

    // ── System Settings state ──
    const [cutoffDate, setCutoffDate] = useState<string>("31")
    const [settingsSaving, setSettingsSaving] = useState(false)

    // ── Form Schemas state ──
    const [schemas, setSchemas] = useState<FormSchema[]>([])
    const [schemaLoading, setSchemaLoading] = useState(true)
    const [schemaDialogOpen, setSchemaDialogOpen] = useState(false)
    const [editingSchema, setEditingSchema] = useState<FormSchema | null>(null)
    const [schemaForm, setSchemaForm] = useState({
        module_name: "leads",
        field_name: "",
        field_key: "",
        field_type: "text" as string,
        is_required: false,
        options_category: "",
        sort_order: 0,
        parent_dependency: "",
        tab_placement: "custom",
    })
    const [schemaSaving, setSchemaSaving] = useState(false)
    const [deleteSchemaOpen, setDeleteSchemaOpen] = useState(false)
    const [deletingSchema, setDeletingSchema] = useState<FormSchema | null>(null)
    const [autoKey, setAutoKey] = useState(true)

    // ── Fetch ──
    const fetchOptions = useCallback(async () => {
        setOptLoading(true)
        let query = supabase.from("master_options").select("*").order("sort_order", { ascending: true }).order("option_type").order("label")
        // Include options from all accessible companies + global (null company_id)
        const companyIds = companies.map((c) => c.id)
        if (companyIds.length > 0) {
            const orClauses = companyIds.map((id) => `company_id.eq.${id}`).join(",")
            query = query.or(`${orClauses},company_id.is.null`)
        }
        const { data, error } = await query
        if (error) toast.error(error.message)
        else {
            setOptions((data as MasterOption[]) ?? [])
            const cutoffOption = data?.find(o => o.option_type === "system_setting" && o.label === "event_cutoff_date")
            if (cutoffOption) {
                setCutoffDate(cutoffOption.value)
            }
        }
        setOptLoading(false)
    }, [companies])

    const fetchSchemas = useCallback(async () => {
        setSchemaLoading(true)
        let query = supabase.from("form_schemas").select("*").order("module_name").order("sort_order")
        const companyIds = companies.map((c) => c.id)
        if (companyIds.length > 0) {
            const orClauses = companyIds.map((id) => `company_id.eq.${id}`).join(",")
            query = query.or(`${orClauses},company_id.is.null`)
        }
        const { data, error } = await query
        if (error) toast.error(error.message)
        else setSchemas((data as FormSchema[]) ?? [])
        setSchemaLoading(false)
    }, [companies])

    useEffect(() => { fetchOptions(); fetchSchemas() }, [fetchOptions, fetchSchemas])

    // ── Derived ──
    const filtered = options.filter((o) => !SYSTEM_MANAGED_CATEGORIES.includes(o.option_type))
    // Apply active/inactive filter
    const visibleOptions = showInactive ? filtered : filtered.filter((o) => o.is_active)
    const grouped = visibleOptions.reduce<Record<string, MasterOption[]>>((acc, o) => {
        (acc[o.option_type] ??= []).push(o); return acc
    }, {})
    // For sidebar counts, always count from full (unfiltered) set
    const allGrouped = filtered.reduce<Record<string, MasterOption[]>>((acc, o) => {
        (acc[o.option_type] ??= []).push(o); return acc
    }, {})
    const coreCategories = Object.values(CATEGORY_GROUPS).flat()
    const activeGroupKeys = showInactive ? Object.keys(allGrouped) : Object.keys(grouped)
    const categories = [...new Set([...coreCategories, ...activeGroupKeys])].sort()

    useEffect(() => {
        if (!selectedCategory && categories.length > 0) setSelectedCategory(categories[0])
    }, [categories.length])

    useEffect(() => { setSearchQuery(""); setSortConfig(null); setCurrentPage(1) }, [selectedCategory, showInactive])

    const activeItems = useMemo(() => {
        const items = selectedCategory ? (grouped[selectedCategory] ?? []) : []
        return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    }, [selectedCategory, grouped])

    const processedItems = useMemo(() => {
        let result = activeItems
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter((o) => o.label.toLowerCase().includes(q) || (o.parent_value ?? "").toLowerCase().includes(q))
        }
        if (sortConfig) {
            result = [...result].sort((a, b) => {
                const aVal = sortConfig.key === "label" ? a.label : (a.parent_value ?? "")
                const bVal = sortConfig.key === "label" ? b.label : (b.parent_value ?? "")
                const cmp = aVal.localeCompare(bVal)
                return sortConfig.direction === "asc" ? cmp : -cmp
            })
        }
        return result
    }, [activeItems, searchQuery, sortConfig])

    const totalPages = Math.max(1, Math.ceil(processedItems.length / pageSize))
    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * pageSize
        return processedItems.slice(start, start + pageSize)
    }, [processedItems, currentPage, pageSize])

    useEffect(() => { setCurrentPage(1) }, [searchQuery, sortConfig, pageSize])

    const toggleSort = (key: "label" | "parent") => {
        setSortConfig((prev) =>
            prev?.key === key
                ? prev.direction === "asc" ? { key, direction: "desc" } : null
                : { key, direction: "asc" }
        )
    }

    // ── Drag-and-drop reorder ──
    const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return

        const oldIndex = paginatedItems.findIndex(o => o.id === active.id)
        const newIndex = paginatedItems.findIndex(o => o.id === over.id)
        if (oldIndex === -1 || newIndex === -1) return

        const reordered = arrayMove(paginatedItems, oldIndex, newIndex)

        // Build a map of id -> new sort_order
        const newOrderMap = new Map<number, number>()
        reordered.forEach((item, idx) => newOrderMap.set(item.id, idx))

        // flushSync forces React to render synchronously BEFORE dnd-kit removes
        // the CSS transforms — preventing the visual "snap back" in React 18
        flushSync(() => {
            setOptions(prev =>
                prev.map(o => {
                    const newOrder = newOrderMap.get(o.id)
                    return newOrder !== undefined ? { ...o, sort_order: newOrder } : o
                })
            )
        })

        // Persist to database (async, after DOM is already updated)
        const updates = reordered.map((item, idx) =>
            supabase.from("master_options").update({ sort_order: idx }).eq("id", item.id)
        )
        const results = await Promise.all(updates)
        const hasError = results.some(r => r.error)
        if (hasError) {
            toast.error("Failed to save order")
            fetchOptions()
        }
    }, [paginatedItems, supabase, fetchOptions])

    const allOptionTypes = [...new Set([...categories, ...options.map((o) => o.option_type)])]
        .filter((t) => !SYSTEM_MANAGED_CATEGORIES.includes(t))
        .sort()

    // ── Master Options CRUD ──
    const openAddOpt = () => {
        setEditingOpt(null)
        setOptForm({ label: "", value: "" })
        setCountryValue("")
        setParentValue("")
        setOptDialogOpen(true)
    }
    const openEditOpt = (o: MasterOption) => {
        setEditingOpt(o)
        setOptForm({ label: o.label, value: o.value })
        setCountryValue((o.metadata as Record<string, string> | null)?.country ?? "")
        setParentValue(o.parent_value ?? "")
        setOptDialogOpen(true)
    }

    const saveOpt = async () => {
        if (!optForm.label.trim() || !optForm.value.trim()) { toast.error("Label and value are required"); return }
        if (!selectedCategory) { toast.error("No category selected"); return }
        const activeCat = editingOpt?.option_type ?? selectedCategory
        const parentCat = CATEGORY_RELATIONS[activeCat]
        if (parentCat && !parentValue) { toast.error(`Please select a parent ${formatCategoryLabel(parentCat)}`); return }
        setOptSaving(true)
        const isCity = activeCat === "event_city"
        const metadataPayload = isCity && countryValue.trim() ? { country: countryValue.trim() } : undefined
        if (editingOpt) {
            const updatePayload: Record<string, unknown> = {
                label: optForm.label.trim(), value: optForm.value.trim(),
            }
            if (isCity) updatePayload.metadata = metadataPayload ?? {}
            if (parentCat) updatePayload.parent_value = parentValue || null
            const { error } = await supabase.from("master_options").update(updatePayload).eq("id", editingOpt.id)
            if (error) toast.error(error.message)
            else toast.success("Option updated")
        } else {
            const insertPayload: Record<string, unknown> = {
                option_type: selectedCategory, label: optForm.label.trim(), value: optForm.value.trim(),
                is_active: true, company_id: companyId,
            }
            if (isCity) insertPayload.metadata = metadataPayload ?? {}
            if (parentCat) insertPayload.parent_value = parentValue || null
            const { error } = await supabase.from("master_options").insert(insertPayload)
            if (error) toast.error(error.message)
            else toast.success("Option added")
        }
        setOptSaving(false); setOptDialogOpen(false); fetchOptions()
    }

    const deleteOpt = async () => {
        if (!deletingOpt) return
        setOptSaving(true)
        const { error } = await supabase.from("master_options").update({ is_active: false }).eq("id", deletingOpt.id)
        if (error) toast.error(error.message)
        else toast.success("Option deactivated")
        setOptSaving(false); setDeleteOptOpen(false); fetchOptions()
    }

    const reactivateOpt = async (opt: MasterOption) => {
        const { error } = await supabase.from("master_options").update({ is_active: true }).eq("id", opt.id)
        if (error) toast.error(error.message)
        else toast.success(`"${opt.label}" reactivated`)
        fetchOptions()
    }

    const addNewCategory = () => {
        const baseKey = newCatName.trim().toLowerCase().replace(/\s+/g, "_")
        if (!baseKey) { toast.error("Category name is required"); return }
        const key = newCatModule ? `custom_${newCatModule}__${baseKey}` : baseKey
        if (SYSTEM_MANAGED_CATEGORIES.includes(key)) { toast.error("This category is managed by the system"); return }
        if (categories.includes(key)) { toast.error("Category already exists"); return }
        setNewCatOpen(false)
        setNewCatName("")
        setSelectedCategory(key)
        setEditingOpt(null)
        setOptForm({ label: "", value: "" })
        setOptDialogOpen(true)
    }

    const openEditCategory = () => {
        if (!selectedCategory) return
        const m = selectedCategory.match(/^custom_(leads|companies|contacts)__(.*)$/)
        if (m) {
            setEditCatModule(m[1])
            setEditCatName(m[2].replace(/_/g, " "))
        } else {
            setEditCatName(selectedCategory.replace(/_/g, " "))
        }
        setEditCatOpen(true)
    }

    const saveEditCategory = async () => {
        if (!selectedCategory) return
        const baseKey = editCatName.trim().toLowerCase().replace(/\s+/g, "_")
        if (!baseKey) { toast.error("Category name is required"); return }
        const newKey = `custom_${editCatModule}__${baseKey}`
        if (newKey === selectedCategory) { setEditCatOpen(false); return }
        if (categories.includes(newKey)) { toast.error("A category with this name already exists"); return }
        
        setEditCatLoading(true)
        const { error: err1 } = await supabase.from("master_options").update({ option_type: newKey }).eq("option_type", selectedCategory)
        const { error: err2 } = await supabase.from("form_schemas").update({ options_category: newKey }).eq("options_category", selectedCategory)
        setEditCatLoading(false)
        
        if (err1) { toast.error(err1.message); return }
        if (err2) { toast.error(err2.message); return }
        
        toast.success("Category updated successfully")
        setEditCatOpen(false)
        setSelectedCategory(newKey)
        fetchOptions()
        fetchSchemas()
    }

    const deleteCategory = async () => {
        if (!selectedCategory) return
        setEditCatLoading(true)
        // Soft delete all options to comply with RLS
        const { error: err1 } = await supabase.from("master_options").update({ is_active: false }).eq("option_type", selectedCategory)
        setEditCatLoading(false)
        
        if (err1) { toast.error(err1.message); return }
        
        toast.success("Category deleted")
        setEditCatOpen(false)
        setDeleteCatConfirmOpen(false)
        setSelectedCategory(null)
        fetchOptions()
    }

    // ── Bulk Add ──
    const saveBulk = async () => {
        if (!selectedCategory) { toast.error("No category selected"); return }
        const parentCat = CATEGORY_RELATIONS[selectedCategory]
        if (parentCat && !bulkParentValue) { toast.error(`Please select a parent ${formatCategoryLabel(parentCat)}`); return }
        const lines = bulkText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0)
        if (lines.length === 0) { toast.error("No options to import"); return }
        setBulkSaving(true)
        const rows = lines.map((line) => ({
            option_type: selectedCategory,
            label: line,
            value: line,
            is_active: true,
            company_id: companyId,
            ...(parentCat ? { parent_value: bulkParentValue } : {}),
        }))
        const { error } = await supabase.from("master_options").insert(rows)
        if (error) toast.error(error.message)
        else toast.success(`${lines.length} option${lines.length !== 1 ? "s" : ""} imported`)
        setBulkSaving(false); setBulkOpen(false); setBulkText(""); setBulkParentValue(""); fetchOptions()
    }

    // ── System Settings ──
    const saveSettings = async () => {
        setSettingsSaving(true)
        const num = parseInt(cutoffDate)
        if (isNaN(num) || num < 1 || num > 31) {
            toast.error("Cut-off date must be between 1 and 31")
            setSettingsSaving(false)
            return
        }

        const existing = options.find(o => o.option_type === "system_setting" && o.label === "event_cutoff_date")
        if (existing) {
            const { error } = await supabase.from("master_options").update({ value: num.toString() }).eq("id", existing.id)
            if (error) toast.error(error.message)
            else toast.success("Settings saved successfully")
        } else {
            const { error } = await supabase.from("master_options").insert({
                option_type: "system_setting",
                label: "event_cutoff_date",
                value: num.toString(),
                company_id: companyId,
                is_active: true
            })
            if (error) toast.error(error.message)
            else toast.success("Settings saved successfully")
        }

        setSettingsSaving(false)
        fetchOptions()
    }

    // ── Form Schemas CRUD ──
    const openAddSchema = () => {
        setEditingSchema(null)
        setAutoKey(true)
        setSchemaForm({
            module_name: "leads", field_name: "", field_key: "", field_type: "text",
            is_required: false, options_category: "", sort_order: schemas.length, parent_dependency: "",
            tab_placement: "custom",
        })
        setSchemaDialogOpen(true)
    }
    const openEditSchema = (s: FormSchema) => {
        setEditingSchema(s)
        setAutoKey(false)
        setSchemaForm({
            module_name: s.module_name, field_name: s.field_name, field_key: s.field_key,
            field_type: s.field_type, is_required: s.is_required,
            options_category: s.options_category ?? "", sort_order: s.sort_order,
            parent_dependency: s.parent_dependency ?? "",
            tab_placement: s.tab_placement ?? "custom",
        })
        setSchemaDialogOpen(true)
    }

    const handleFieldNameChange = (name: string) => {
        setSchemaForm((f) => ({
            ...f,
            field_name: name,
            ...(autoKey ? { field_key: toFieldKey(name) } : {}),
        }))
    }

    const saveSchema = async () => {
        if (!schemaForm.field_name.trim() || !schemaForm.field_key.trim()) {
            toast.error("Field name and key are required"); return
        }
        if (schemaForm.field_type === "dropdown" && !schemaForm.options_category) {
            toast.error("Please select an options category for the dropdown"); return
        }
        setSchemaSaving(true)
        const payload = {
            module_name: schemaForm.module_name,
            field_name: schemaForm.field_name.trim(),
            field_key: toFieldKey(schemaForm.field_key),
            field_type: schemaForm.field_type,
            is_required: schemaForm.is_required,
            options_category: schemaForm.field_type === "dropdown" ? schemaForm.options_category || null : null,
            sort_order: schemaForm.sort_order,
            parent_dependency: schemaForm.parent_dependency || null,
            tab_placement: schemaForm.tab_placement || "custom",
            company_id: companyId,
        }
        if (editingSchema) {
            const { error } = await supabase.from("form_schemas").update(payload).eq("id", editingSchema.id)
            if (error) toast.error(error.message)
            else toast.success("Field updated")
        } else {
            const { error } = await supabase.from("form_schemas").insert({ ...payload, is_active: true })
            if (error) toast.error(error.message)
            else toast.success("Field added")
        }
        setSchemaSaving(false); setSchemaDialogOpen(false); fetchSchemas()
    }

    const toggleSchemaActive = async (s: FormSchema) => {
        const { error } = await supabase.from("form_schemas").update({ is_active: !s.is_active }).eq("id", s.id)
        if (error) toast.error(error.message)
        else fetchSchemas()
    }

    const deleteSchema = async () => {
        if (!deletingSchema) return
        setSchemaSaving(true)
        const { error } = await supabase.from("form_schemas").delete().eq("id", deletingSchema.id)
        if (error) toast.error(error.message)
        else toast.success("Field deleted")
        setSchemaSaving(false); setDeleteSchemaOpen(false); setDeletingSchema(null); fetchSchemas()
    }

    return (
        <PermissionGate resource="master_options" action="update" fallback={
            <div className="p-8 text-center text-muted-foreground">You don&apos;t have permission to manage options.</div>
        }>
            <div className="flex flex-col h-[calc(100vh-2rem)] w-full overflow-hidden p-6 lg:p-8">
                <div className="flex-none pb-4">
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                        <ListChecks className="h-6 w-6 text-primary" /> Master Options &amp; Custom Fields
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage dropdown values and dynamic form fields.</p>
                </div>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0">
                    <TabsList className="w-max flex-none">
                        <TabsTrigger value="options">Dropdown Options</TabsTrigger>
                        <TabsTrigger value="fields">Custom Fields</TabsTrigger>
                        <TabsTrigger value="layout">Form Layout</TabsTrigger>
                        <TabsTrigger value="settings">System Rules</TabsTrigger>
                    </TabsList>

                    {/* ═══════════ TAB 1: DROPDOWN OPTIONS ═══════════ */}
                    <TabsContent value="options" className="flex-1 flex flex-col overflow-hidden mt-6 data-[state=inactive]:hidden min-h-0">
                        {optLoading ? (
                            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : (
                            <div className="grid grid-cols-12 gap-6 h-full flex-1 min-h-0">
                                {/* LEFT: Category Nav */}
                                <div className="col-span-3 flex flex-col h-full border-r pr-4 min-h-0">
                                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex-none">Categories</div>
                                    <nav className="flex-1 overflow-y-auto pr-2 space-y-1 min-h-0">
                                        {(() => {
                                            const assignedCats = new Set(Object.values(CATEGORY_GROUPS).flat())
                                            const allGroupsMerged: Record<string, string[]> = JSON.parse(JSON.stringify(CATEGORY_GROUPS))
                                            const otherCats: string[] = []

                                            for (const cat of categories) {
                                                if (assignedCats.has(cat)) continue
                                                const m = cat.match(/^custom_(leads|companies|contacts)__(.*)$/)
                                                if (m) {
                                                    const moduleName = m[1].charAt(0).toUpperCase() + m[1].slice(1)
                                                    if (!allGroupsMerged[moduleName]) allGroupsMerged[moduleName] = []
                                                    allGroupsMerged[moduleName].push(cat)
                                                } else {
                                                    otherCats.push(cat)
                                                }
                                            }

                                            const groupEntries = Object.entries(allGroupsMerged)
                                            const defaultOpen = groupEntries.map(([g]) => g)

                                            const renderCatButton = (cat: string) => {
                                                const activeCount = allGrouped[cat]?.filter(o => o.is_active).length ?? 0
                                                const inactiveCount = (allGrouped[cat]?.length ?? 0) - activeCount
                                                return (
                                                <button
                                                    key={cat}
                                                    onClick={() => setSelectedCategory(cat)}
                                                    className={cn(
                                                        "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left",
                                                        selectedCategory === cat
                                                            ? "bg-primary text-primary-foreground font-medium"
                                                            : "hover:bg-muted text-foreground"
                                                    )}
                                                >
                                                    <span className="flex items-center gap-2 truncate">
                                                        <Tag className="h-3.5 w-3.5 flex-none" />
                                                        <span className="truncate">{formatCategoryLabel(cat)}</span>
                                                    </span>
                                                    <span className={cn(
                                                        "text-xs tabular-nums flex-none ml-2",
                                                        selectedCategory === cat ? "text-primary-foreground/70" : "text-muted-foreground"
                                                    )}>
                                                        {activeCount}{inactiveCount > 0 && <span className="opacity-50">+{inactiveCount}</span>}
                                                    </span>
                                                </button>
                                                )
                                            }

                                            return (
                                                <>
                                                    <Accordion type="multiple" defaultValue={defaultOpen} className="space-y-0">
                                                        {groupEntries.map(([groupLabel, groupCats]) => {
                                                            const visible = groupCats.filter((c) => categories.includes(c))
                                                            if (visible.length === 0) return null
                                                            return (
                                                                <AccordionItem key={groupLabel} value={groupLabel} className="border-none">
                                                                    <AccordionTrigger className="py-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:no-underline">
                                                                        {groupLabel}
                                                                    </AccordionTrigger>
                                                                    <AccordionContent className="pb-2">
                                                                        <div className="space-y-0.5">
                                                                            {visible.map(renderCatButton)}
                                                                        </div>
                                                                    </AccordionContent>
                                                                </AccordionItem>
                                                            )
                                                        })}
                                                        {otherCats.length > 0 && (
                                                            <AccordionItem value="__other" className="border-none">
                                                                <AccordionTrigger className="py-2 px-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:no-underline">
                                                                    Other
                                                                </AccordionTrigger>
                                                                <AccordionContent className="pb-2">
                                                                    <div className="space-y-0.5">
                                                                        {otherCats.map(renderCatButton)}
                                                                    </div>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        )}
                                                    </Accordion>
                                                </>
                                            )
                                        })()}
                                    </nav>
                                    <div className="flex-none pt-4 border-t mt-2">
                                        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => { setNewCatName(""); setNewCatModule("leads"); setNewCatOpen(true) }}>
                                            <FolderPlus className="h-3.5 w-3.5 mr-2" /> Add New Category
                                        </Button>
                                    </div>
                                </div>

                                {/* RIGHT: Options Detail */}
                                <div className="col-span-9 h-full flex flex-col pl-2 min-h-0">
                                    {selectedCategory ? (
                                        <Card className="flex flex-col max-h-full overflow-hidden min-h-0 border-muted">
                                            <CardHeader className="flex flex-row items-center justify-between pb-3 flex-none border-b bg-muted/10">
                                                <div className="flex items-center gap-2">
                                                    <CardTitle className="text-base">{formatCategoryLabel(selectedCategory)}</CardTitle>
                                                    {selectedCategory.startsWith("custom_") && (
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={openEditCategory}>
                                                            <Pencil className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="relative">
                                                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                        <Input
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            placeholder="Search options..."
                                                            className="h-8 w-48 pl-8 text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 border rounded-md px-2.5 py-1.5 bg-muted/30">
                                                        <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <Label htmlFor="show-inactive" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">Archived</Label>
                                                        <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} className="scale-75" />
                                                    </div>
                                                    <Button size="sm" variant="outline" onClick={() => { setBulkText(""); setBulkParentValue(""); setBulkOpen(true) }}>
                                                        <Upload className="h-3.5 w-3.5 mr-1.5" /> Bulk Add
                                                    </Button>
                                                    <Button size="sm" onClick={openAddOpt}>
                                                        <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Option
                                                    </Button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0 flex flex-col shrink min-h-0">
                                                {processedItems.length === 0 ? (
                                                    <div className="text-center py-12 text-muted-foreground text-sm">
                                                        {searchQuery ? "No options match your search." : "No options in this category yet. Click \"Add Option\" to create one."}
                                                    </div>
                                                ) : (
                                                    <>
                                                    <div className="overflow-y-auto shrink min-h-0 relative">
                                                        <DndContext
                                                            sensors={dndSensors}
                                                            collisionDetection={closestCenter}
                                                            onDragEnd={handleDragEnd}
                                                        >
                                                        <SortableContext items={paginatedItems.map(o => o.id)} strategy={verticalListSortingStrategy}>
                                                        <Table>
                                                            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
                                                                <TableRow className="bg-muted/30 hover:bg-muted/30">
                                                                <TableHead className="h-12 px-4 w-10"><GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" /></TableHead>
                                                                <TableHead className="h-12 px-4">
                                                                    <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("label")}>
                                                                        Label
                                                                        {sortConfig?.key === "label" ? (sortConfig.direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
                                                                    </button>
                                                                </TableHead>
                                                                {CATEGORY_RELATIONS[selectedCategory] && (
                                                                    <TableHead className="h-12 px-4">
                                                                        <button type="button" className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("parent")}>
                                                                            Parent ({formatCategoryLabel(CATEGORY_RELATIONS[selectedCategory])})
                                                                            {sortConfig?.key === "parent" ? (sortConfig.direction === "asc" ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />) : null}
                                                                        </button>
                                                                    </TableHead>
                                                                )}
                                                                {showInactive && <TableHead className="h-12 px-4 text-center w-20">Status</TableHead>}
                                                                <TableHead className="h-12 px-4 text-right w-24">Actions</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {paginatedItems.map((o) => (
                                                                <SortableOptionRow
                                                                    key={o.id}
                                                                    option={o}
                                                                    showParent={!!CATEGORY_RELATIONS[selectedCategory!]}
                                                                    showInactive={showInactive}
                                                                    canDrag={!searchQuery && !sortConfig}
                                                                    onEdit={() => openEditOpt(o)}
                                                                    onDelete={() => { setDeletingOpt(o); setDeleteOptOpen(true) }}
                                                                    onReactivate={() => reactivateOpt(o)}
                                                                />
                                                            ))}
                                                        </TableBody>
                                                        </Table>
                                                        </SortableContext>
                                                        </DndContext>
                                                    </div>
                                                    {/* Pagination Footer */}
                                                    <div className="flex-none flex items-center justify-between border-t px-4 py-3 bg-muted/5">
                                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <span>{processedItems.length} result{processedItems.length !== 1 ? "s" : ""}</span>
                                                            <span className="text-muted-foreground/40">·</span>
                                                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                                                                <SelectTrigger className="h-8 w-[70px] text-xs"><SelectValue /></SelectTrigger>
                                                                <SelectContent>
                                                                    {[10, 20, 50, 100].map((n) => (
                                                                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <span className="text-xs">per page</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-sm text-muted-foreground mr-2">
                                                                Page {currentPage} of {totalPages}
                                                            </span>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage(1)}>
                                                                <ChevronsLeft className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                                                                <ChevronLeft className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                                                                <ChevronRight className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(totalPages)}>
                                                                <ChevronsRight className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    </>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ) : (
                                        <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                                            Select a category from the left or create a new one.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* ═══════════ TAB 2: CUSTOM FIELDS ═══════════ */}
                    <TabsContent value="fields" className="flex flex-col flex-1 overflow-hidden mt-6 data-[state=inactive]:hidden min-h-0">
                        <div className="flex items-center justify-between flex-none mb-4">
                            <p className="text-sm text-muted-foreground">
                                {schemas.length} custom field{schemas.length !== 1 ? "s" : ""} defined
                            </p>
                            <Button size="sm" onClick={openAddSchema}>
                                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Custom Field
                            </Button>
                        </div>
                        {schemaLoading ? (
                            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : schemas.length === 0 ? (
                            <div className="text-center py-16 text-muted-foreground text-sm flex-none">
                                <p className="mb-1">No custom fields defined yet.</p>
                                <p className="text-xs">Click &quot;Add Custom Field&quot; to create dynamic form fields for your modules.</p>
                            </div>
                        ) : (
                            <div className="border rounded-lg overflow-y-auto flex-1 mb-8 shadow-sm">
                                <Table>
                                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                                        <TableRow>
                                            <TableHead>Module</TableHead>
                                            <TableHead>Field Name</TableHead>
                                            <TableHead>Key</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Placement</TableHead>
                                            <TableHead className="text-center">Required</TableHead>
                                            <TableHead className="text-center">Active</TableHead>
                                            <TableHead className="text-right w-24">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {schemas.map((s) => (
                                            <TableRow key={s.id} className={cn("hover:bg-muted/40", !s.is_active && "opacity-50")}>
                                                <TableCell>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 border border-blue-500/20 capitalize">
                                                        {s.module_name}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="font-medium text-sm">{s.field_name}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground font-mono">{s.field_key}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted border capitalize">{s.field_type}</span>
                                                        {s.field_type === "dropdown" && s.options_category && (
                                                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                                                <Link2 className="h-3 w-3" />
                                                                {formatCategoryLabel(s.options_category)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 border text-slate-700 capitalize">
                                                        {s.tab_placement === "custom" ? "Custom Tab" : s.tab_placement}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center text-sm">{s.is_required ? "Yes" : "\u2014"}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center">
                                                        <Switch checked={s.is_active} onCheckedChange={() => toggleSchemaActive(s)} />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSchema(s)}>
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeletingSchema(s); setDeleteSchemaOpen(true) }}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </TabsContent>

                    {/* ═══════════ TAB 3: FORM LAYOUT ═══════════ */}
                    <TabsContent value="layout" className="flex flex-col flex-1 overflow-y-auto mt-6 data-[state=inactive]:hidden">
                        <div className="w-full">
                            <Card className="shadow-sm">
                                <CardHeader className="bg-muted/10 border-b">
                                    <CardTitle>Lead Form Output Layout</CardTitle>
                                    <CardDescription>Drag and drop fields across tabs to rebuild your Lead Entry form.</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <FormLayoutBuilder customSchemas={schemas} companyId={companyId} onEditCustomField={openEditSchema} />
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    {/* ═══════════ TAB 4: SYSTEM SETTINGS ═══════════ */}
                    <TabsContent value="settings" className="flex flex-col flex-1 overflow-y-auto mt-6 data-[state=inactive]:hidden">
                        <div className="max-w-3xl">
                            <Card className="shadow-sm">
                                <CardHeader className="bg-muted/10 border-b">
                                    <CardTitle>Financial & Recognition Rules</CardTitle>
                                </CardHeader>
                                <CardContent className="pt-6">
                                    <div className="space-y-6">
                                        <div className="grid gap-2">
                                            <Label className="font-semibold text-slate-800">Event Cut-Off Date</Label>
                                            <p className="text-sm text-slate-500 mb-2">
                                                Determines which month an event Revenue is recognized in. For instance, if the cut-off date is the 25th, an event starting on the 26th will be recognized in the <strong>following month</strong>.
                                            </p>
                                            <div className="flex items-center gap-3">
                                                <Input 
                                                    type="number" 
                                                    min={1} max={31} 
                                                    value={cutoffDate} 
                                                    onChange={e => setCutoffDate(e.target.value)}
                                                    className="w-24"
                                                />
                                                <span className="text-sm text-muted-foreground font-medium">th of the month</span>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t">
                                            <Button onClick={saveSettings} disabled={settingsSaving}>
                                                {settingsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                                Save Settings
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>
                </Tabs>

                {/* ═══════════ DIALOGS ═══════════ */}

                {/* Add/Edit Option Dialog */}
                <Dialog open={optDialogOpen} onOpenChange={setOptDialogOpen}>
                    <DialogContent className="sm:max-w-[420px]">
                        <DialogHeader>
                            <DialogTitle>{editingOpt ? "Edit Option" : "Add Option"}</DialogTitle>
                            <DialogDescription>
                                {editingOpt
                                    ? `Editing option in "${formatCategoryLabel(editingOpt.option_type)}".`
                                    : `Adding to "${selectedCategory ? formatCategoryLabel(selectedCategory) : ""}".`}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Label</Label>
                                <Input value={optForm.label} onChange={(e) => setOptForm((f) => ({ ...f, label: e.target.value }))} placeholder="Display label" />
                            </div>
                            <div className="space-y-2">
                                <Label>Value</Label>
                                <Input value={optForm.value} onChange={(e) => setOptForm((f) => ({ ...f, value: e.target.value }))} placeholder="Stored value" />
                            </div>
                            {(selectedCategory === "event_city" || editingOpt?.option_type === "event_city") && (
                                <div className="space-y-2">
                                    <Label>Country</Label>
                                    <Input value={countryValue} onChange={(e) => setCountryValue(e.target.value)} placeholder="e.g. Indonesia" />
                                    <p className="text-[11px] text-muted-foreground">Stored as metadata for geographic reporting.</p>
                                </div>
                            )}
                            {(() => {
                                const activeCat = editingOpt?.option_type ?? selectedCategory ?? ""
                                const parentCat = CATEGORY_RELATIONS[activeCat]
                                if (!parentCat) return null
                                const parentOptions = options.filter((o) => o.option_type === parentCat && o.is_active)
                                return (
                                    <div className="space-y-2">
                                        <Label>Parent: {formatCategoryLabel(parentCat)} *</Label>
                                        <Select value={parentValue || undefined} onValueChange={(v) => setParentValue(v)}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={`Select ${formatCategoryLabel(parentCat).toLowerCase()}`} /></SelectTrigger>
                                            <SelectContent>
                                                {parentOptions.length === 0 ? (
                                                    <SelectItem value="__empty" disabled>No {formatCategoryLabel(parentCat)} options found</SelectItem>
                                                ) : (
                                                    parentOptions.map((o) => (<SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground">This option will only appear when the parent value is selected.</p>
                                    </div>
                                )
                            })()}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setOptDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveOpt} disabled={optSaving}>
                                {optSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                {editingOpt ? "Save" : "Add"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Option Dialog */}
                <Dialog open={deleteOptOpen} onOpenChange={setDeleteOptOpen}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>Deactivate Option</DialogTitle>
                            <DialogDescription>
                                Deactivate &quot;{deletingOpt?.label}&quot;? It will no longer appear in dropdowns but existing data is preserved.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteOptOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={deleteOpt} disabled={optSaving}>
                                {optSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                Deactivate
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* New Category Dialog */}
                <Dialog open={newCatOpen} onOpenChange={setNewCatOpen}>
                    <DialogContent className="sm:max-w-[380px]">
                        <DialogHeader>
                            <DialogTitle>New Category</DialogTitle>
                            <DialogDescription>Create a new option category. The key will be auto-formatted (lowercase, underscores).</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Select Module</Label>
                                <Select value={newCatModule} onValueChange={setNewCatModule}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="leads">Leads</SelectItem>
                                        <SelectItem value="contacts">Contacts</SelectItem>
                                        <SelectItem value="companies">Companies</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Category Name</Label>
                                <Input
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                    placeholder="e.g. Lead Source"
                                    onKeyDown={(e) => { if (e.key === "Enter") addNewCategory() }}
                                />
                                {newCatName.trim() && (
                                    <p className="text-xs text-muted-foreground">
                                        Key: <span className="font-mono">custom_{newCatModule}__{newCatName.trim().toLowerCase().replace(/\s+/g, "_")}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setNewCatOpen(false)}>Cancel</Button>
                            <Button onClick={addNewCategory}>Create &amp; Add Options</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Edit Category Dialog */}
                <Dialog open={editCatOpen} onOpenChange={setEditCatOpen}>
                    <DialogContent className="sm:max-w-[380px]">
                        <DialogHeader>
                            <DialogTitle>Edit Category</DialogTitle>
                            <DialogDescription>Modify or reassign module for this custom category.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Assign to Module</Label>
                                <Select value={editCatModule} onValueChange={setEditCatModule}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="leads">Leads</SelectItem>
                                        <SelectItem value="contacts">Contacts</SelectItem>
                                        <SelectItem value="companies">Companies</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Category Name</Label>
                                <Input
                                    value={editCatName}
                                    onChange={(e) => setEditCatName(e.target.value)}
                                    placeholder="e.g. Lead Source"
                                    onKeyDown={(e) => { if (e.key === "Enter") saveEditCategory() }}
                                />
                                {editCatName.trim() && (
                                    <p className="text-xs text-muted-foreground">
                                        New Key: <span className="font-mono">custom_{editCatModule}__{editCatName.trim().toLowerCase().replace(/\s+/g, "_")}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        <DialogFooter className="flex items-center sm:justify-between">
                            <Button type="button" variant="destructive" onClick={() => setDeleteCatConfirmOpen(true)} disabled={editCatLoading} className="mr-auto">Delete</Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setEditCatOpen(false)} disabled={editCatLoading}>Cancel</Button>
                                <Button onClick={saveEditCategory} disabled={editCatLoading}>
                                    {editCatLoading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                    Save
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Category Alert Dialog */}
                <AlertDialog open={deleteCatConfirmOpen} onOpenChange={setDeleteCatConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This will permanently delete the <strong className="text-foreground">{selectedCategory ? formatCategoryLabel(selectedCategory) : ""}</strong> category and remove all options associated with it. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={editCatLoading}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => { e.preventDefault(); deleteCategory(); }} disabled={editCatLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {editCatLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                Delete Category
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Bulk Import Dialog */}
                <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
                    <DialogContent className="sm:max-w-[480px]">
                        <DialogHeader>
                            <DialogTitle>Bulk Add Options</DialogTitle>
                            <DialogDescription>
                                Adding to &quot;{selectedCategory ? formatCategoryLabel(selectedCategory) : ""}&quot;. Each line becomes a new option (label and value will be the same).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2 py-2">
                            {(() => {
                                const parentCat = selectedCategory ? CATEGORY_RELATIONS[selectedCategory] : undefined
                                if (!parentCat) return null
                                const parentOptions = options.filter((o) => o.option_type === parentCat && o.is_active)
                                return (
                                    <div className="space-y-2 mb-3">
                                        <Label>Parent: {formatCategoryLabel(parentCat)} *</Label>
                                        <Select value={bulkParentValue || undefined} onValueChange={(v) => setBulkParentValue(v)}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={`Select ${formatCategoryLabel(parentCat).toLowerCase()}`} /></SelectTrigger>
                                            <SelectContent>
                                                {parentOptions.length === 0 ? (
                                                    <SelectItem value="__empty" disabled>No {formatCategoryLabel(parentCat)} options found</SelectItem>
                                                ) : (
                                                    parentOptions.map((o) => (<SelectItem key={o.id} value={o.value}>{o.label}</SelectItem>))
                                                )}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground">All imported options will be assigned to this parent.</p>
                                    </div>
                                )
                            })()}
                            <Label>Options</Label>
                            <textarea
                                className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                placeholder={"Paste a list of options here.\nEnter one option per line.\n\ne.g.\nJakarta\nBali\nSurabaya"}
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                            />
                            {bulkText.trim() && (
                                <p className="text-xs text-muted-foreground">
                                    {bulkText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0).length} option(s) detected
                                </p>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
                            <Button onClick={saveBulk} disabled={bulkSaving || !bulkText.trim()}>
                                {bulkSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                Import
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Custom Field Builder Modal */}
                <Dialog open={schemaDialogOpen} onOpenChange={setSchemaDialogOpen}>
                    <DialogContent className="sm:max-w-[520px]">
                        <DialogHeader>
                            <DialogTitle>{editingSchema ? "Edit Custom Field" : "Add Custom Field"}</DialogTitle>
                            <DialogDescription>
                                Define a dynamic field for your forms. Dropdown fields can be linked to a Master Options category.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            {/* Module */}
                            <div className="space-y-2">
                                <Label>Module</Label>
                                <Select value={schemaForm.module_name} onValueChange={(v) => setSchemaForm((f) => ({ ...f, module_name: v, options_category: "" }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {MODULE_OPTIONS.map((m) => (
                                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Field Placement (Tab) */}
                            {schemaForm.module_name === "leads" && (
                                <div className="space-y-2">
                                    <Label>Tab Placement</Label>
                                    <Select value={schemaForm.tab_placement} onValueChange={(v) => setSchemaForm((f) => ({ ...f, tab_placement: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="project">Project Tab</SelectItem>
                                            <SelectItem value="event">Event Tab</SelectItem>
                                            <SelectItem value="classification">Classification Tab</SelectItem>
                                            <SelectItem value="financial">Financial Tab</SelectItem>
                                            <SelectItem value="custom">Custom Fields Tab / Native</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-muted-foreground">Choose where this field should visually appear within the Lead Form.</p>
                                </div>
                            )}

                            {/* Field Name + Key */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Field Name</Label>
                                    <Input
                                        value={schemaForm.field_name}
                                        onChange={(e) => handleFieldNameChange(e.target.value)}
                                        placeholder="e.g. Catering Preference"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Field Key</Label>
                                    <Input
                                        value={schemaForm.field_key}
                                        onChange={(e) => { setAutoKey(false); setSchemaForm((f) => ({ ...f, field_key: e.target.value })) }}
                                        placeholder="e.g. catering_preference"
                                        className="font-mono text-sm"
                                    />
                                    {autoKey && schemaForm.field_name && (
                                        <p className="text-[11px] text-muted-foreground">Auto-generated from name</p>
                                    )}
                                </div>
                            </div>

                            {/* Type + Sort Order */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Field Type</Label>
                                    <Select value={schemaForm.field_type} onValueChange={(v) => setSchemaForm((f) => ({ ...f, field_type: v, options_category: "" }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {FIELD_TYPE_OPTIONS.map((t) => (
                                                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Sort Order</Label>
                                    <Input type="number" value={schemaForm.sort_order} onChange={(e) => setSchemaForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} />
                                </div>
                            </div>

                            {/* Conditional: Dropdown → Options Category Linkage */}
                            {schemaForm.field_type === "dropdown" && (
                                <div className="space-y-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-4">
                                    <Label className="flex items-center gap-1.5 text-blue-700">
                                        <Link2 className="h-3.5 w-3.5" />
                                        Options Category (from Master Options)
                                    </Label>
                                    <Select value={schemaForm.options_category} onValueChange={(v) => setSchemaForm((f) => ({ ...f, options_category: v }))}>
                                        <SelectTrigger><SelectValue placeholder="Select a category to populate this dropdown" /></SelectTrigger>
                                        <SelectContent>
                                            {allOptionTypes.filter((t) => {
                                                if (t.startsWith(`custom_${schemaForm.module_name}__`)) return true
                                                const prettyModule = schemaForm.module_name.charAt(0).toUpperCase() + schemaForm.module_name.slice(1)
                                                const hardcodedAssigned = CATEGORY_GROUPS[prettyModule] || []
                                                if (hardcodedAssigned.includes(t)) return true
                                                return false
                                            }).map((t) => (
                                                <SelectItem key={t} value={t} className="capitalize">{formatCategoryLabel(t)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-[11px] text-blue-600/70">
                                        This dropdown will be populated with values from the selected Master Options category.
                                        Manage those values in the &quot;Dropdown Options&quot; tab.
                                    </p>
                                </div>
                            )}

                            {/* Required toggle */}
                            <div className="flex items-center gap-3 pt-1">
                                <Switch checked={schemaForm.is_required} onCheckedChange={(v) => setSchemaForm((f) => ({ ...f, is_required: v }))} />
                                <Label>Required field</Label>
                            </div>

                            {/* Parent Dependency */}
                            {(() => {
                                const siblingFields = schemas.filter(
                                    (s) => s.module_name === schemaForm.module_name && s.field_key !== (editingSchema?.field_key ?? "")
                                )
                                if (siblingFields.length === 0) return null
                                return (
                                    <div className="space-y-2">
                                        <Label>Depends On (Parent Field)</Label>
                                        <Select value={schemaForm.parent_dependency || undefined} onValueChange={(v) => setSchemaForm((f) => ({ ...f, parent_dependency: v === "__none" ? "" : v }))}>
                                            <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="No dependency" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="__none">No dependency</SelectItem>
                                                {siblingFields.map((s) => (
                                                    <SelectItem key={s.id} value={s.field_key}>{s.field_name} ({s.field_key})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[11px] text-muted-foreground">
                                            If set, this field will be disabled until the parent field has a value. Dropdown options will be filtered by parent_value.
                                        </p>
                                    </div>
                                )
                            })()}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setSchemaDialogOpen(false)}>Cancel</Button>
                            <Button onClick={saveSchema} disabled={schemaSaving}>
                                {schemaSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                {editingSchema ? "Save Changes" : "Add Field"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Delete Schema Dialog */}
                <Dialog open={deleteSchemaOpen} onOpenChange={setDeleteSchemaOpen}>
                    <DialogContent className="sm:max-w-[400px]">
                        <DialogHeader>
                            <DialogTitle>Delete Custom Field</DialogTitle>
                            <DialogDescription>
                                Permanently delete &quot;{deletingSchema?.field_name}&quot;? Existing data in custom_data will not be removed, but the field will no longer appear on forms.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteSchemaOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={deleteSchema} disabled={schemaSaving}>
                                {schemaSaving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </PermissionGate>
    )
}

// ── Sortable Option Row ──────────────────────────────────────
function SortableOptionRow({
    option: o,
    showParent,
    showInactive,
    canDrag,
    onEdit,
    onDelete,
    onReactivate,
}: {
    option: MasterOption
    showParent: boolean
    showInactive: boolean
    canDrag: boolean
    onEdit: () => void
    onDelete: () => void
    onReactivate: () => void
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: o.id, disabled: !canDrag })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 50 : undefined,
        position: isDragging ? "relative" as const : undefined,
    }

    return (
        <TableRow
            ref={setNodeRef}
            style={style}
            className={cn(
                "hover:bg-muted/40",
                !o.is_active && "opacity-50 bg-muted/20",
                isDragging && "bg-white shadow-lg border border-blue-200 rounded-lg"
            )}
        >
            <TableCell className="p-4 w-10">
                <GripVertical
                    className={cn(
                        "h-3.5 w-3.5 transition-colors",
                        canDrag
                            ? "text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                            : "text-muted-foreground/15 cursor-default"
                    )}
                    {...(canDrag ? { ...attributes, ...listeners } : {})}
                />
            </TableCell>
            <TableCell className="p-4 font-medium text-sm">{o.label}</TableCell>
            {showParent && (
                <TableCell className="p-4 text-sm text-muted-foreground">{o.parent_value ?? "—"}</TableCell>
            )}
            {showInactive && (
                <TableCell className="p-4 text-center">
                    <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium",
                        o.is_active ? "bg-green-100 text-green-700 border border-green-200" : "bg-orange-100 text-orange-700 border border-orange-200"
                    )}>
                        {o.is_active ? "Active" : "Archived"}
                    </span>
                </TableCell>
            )}
            <TableCell className="p-4 text-right">
                <div className="flex justify-end gap-1">
                    {o.is_active ? (
                        <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </>
                    ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-green-700 hover:text-green-800" onClick={onReactivate}>
                            <RotateCcw className="h-3 w-3" /> Reactivate
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    )
}
