import React, { useState, useEffect } from "react"
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
    DragOverlay, defaultDropAnimationSideEffects,
} from "@dnd-kit/core"
import {
    SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, EyeOff, LayoutTemplate, Loader2, Save, X, Pencil, Asterisk, Zap, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import type { FormSchema } from "@/types"
import { cn } from "@/lib/utils"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export type VisibilityCondition = {
    dependsOn: string
    operator: "equals" | "not_equals" | "contains" | "starts_with" | "in" | "not_empty"
    value: string | string[]
}
export type VisibilityRule = {
    logic: "and" | "or"
    conditions: VisibilityCondition[]
}
export type VisibilityRules = Record<string, VisibilityRule>

const VISIBILITY_OPERATORS = [
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts with" },
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not equals" },
    { value: "in", label: "Is one of (comma-separated)" },
    { value: "not_empty", label: "Is not empty" },
]

export type LayoutItemsMap = Record<string, string[]>

export const DEFAULT_LAYOUTS: Record<string, LayoutItemsMap> = {
    leads: {
        project: ["native:project_name", "native:pipeline_stage_id", "native:category", "native:grade_lead", "native:client_company_id", "native:contact_id", "native:pic_sales_id", "native:lead_source", "native:referral_source", "native:target_close_date"],
        event: ["native:event_dates", "native:month_event", "native:pax_count", "native:event_format", "native:destinations", "native:virtual_platform"],
        classification: ["native:main_stream", "native:stream_type", "native:business_purpose", "native:area"],
        financial: ["native:estimated_value"],
        hidden: ["native:lost_reason", "native:lost_reason_details"]
    },
    companies: {
        identity: ["native:name", "native:parent_id", "native:sector", "native:line_industry", "native:owner_id"],
        contact: ["native:street_address", "native:city", "native:postal_code", "native:country", "native:phone", "native:website"],
        hidden: []
    },
    contacts: {
        identity: ["native:salutation", "native:full_name", "native:client_company_id", "native:job_title"],
        contact_methods: ["native:email", "native:phone", "native:secondary_emails", "native:secondary_phones"],
        social: ["native:linkedin_url", "native:social_urls"],
        enrichment: ["native:date_of_birth", "native:address", "native:notes", "native:owner_id"],
        hidden: []
    }
}

export const FIELD_LABELS: Record<string, string> = {
    "native:project_name": "Project Name",
    "native:category": "Category",
    "native:grade_lead": "Grade Lead",
    "native:client_company_id": "Client Company",
    "native:contact_id": "Contact Person",
    "native:pic_sales_id": "PIC Sales",
    "native:lead_source": "Lead Source",
    "native:referral_source": "Referral Source",
    "native:target_close_date": "Target Close Date",
    "native:pipeline_stage_id": "Pipeline Stage",
    "native:event_dates": "Event Dates",
    "native:month_event": "Revenue Recognition (Month & Year)",
    "native:pax_count": "Pax Count",
    "native:event_format": "Event Format",
    "native:destinations": "Destinations (City/Venue)",
    "native:virtual_platform": "Virtual Platform",
    "native:main_stream": "Main Stream",
    "native:stream_type": "Stream Type",
    "native:business_purpose": "Business Purpose",
    "native:area": "Client Source Area",
    "native:estimated_value": "Estimated Value",
    "native:lost_reason": "Lost Reason",
    "native:lost_reason_details": "Lost Reason Details",
    // Companies
    "native:name": "Company Name",
    "native:parent_id": "Parent Company",
    "native:sector": "Sector",
    "native:line_industry": "Line of Industry",
    "native:street_address": "Street Address",
    "native:city": "City",
    "native:postal_code": "Postal Code",
    "native:country": "Country",
    "native:phone": "Phone",
    "native:website": "Website",
    // Contacts
    "native:salutation": "Salutation",
    "native:full_name": "Full Name",
    "native:job_title": "Job Title",
    "native:email": "Primary Email",
    "native:secondary_emails": "Secondary Emails",
    "native:secondary_phones": "Secondary Phones",
    "native:linkedin_url": "LinkedIn URL",
    "native:social_urls": "Other Social Links",
    "native:date_of_birth": "Date of Birth",
    "native:address": "Address",
    "native:notes": "Notes",
    "native:owner_id": "Owner",
}

interface FormLayoutBuilderProps {
    companyId: string | null;
    customSchemas: FormSchema[];
    onEditCustomField?: (schema: FormSchema) => void;
}

export function FormLayoutBuilder({ companyId, customSchemas, onEditCustomField }: FormLayoutBuilderProps) {
    const supabase = createClient()
    const [activeModule, setActiveModule] = useState<"leads" | "companies" | "contacts">("leads")
    const [layoutConfigId, setLayoutConfigId] = useState<string | null>(null)
    const [items, setItems] = useState<LayoutItemsMap>({})
    const [requiredOverrides, setRequiredOverrides] = useState<string[]>([])
    const [visibilityRules, setVisibilityRules] = useState<VisibilityRules>({})
    const [activeId, setActiveId] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [initialStateStr, setInitialStateStr] = useState<string>("")
    const [pendingModuleMap, setPendingModuleMap] = useState<"leads" | "companies" | "contacts" | null>(null)

    const isDirty = initialStateStr !== "" && initialStateStr !== JSON.stringify({ tabs: items, req: requiredOverrides, vis: visibilityRules })

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault()
                e.returnValue = ''
            }
        }
        window.addEventListener('beforeunload', handleBeforeUnload)
        return () => window.removeEventListener('beforeunload', handleBeforeUnload)
    }, [isDirty])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    )

    useEffect(() => {
        const fetchLayout = async () => {
            setIsLoading(true)
            const configKey = activeModule === "leads" ? "form_layout_config" : `form_layout_config_${activeModule}`
            const query = supabase.from("master_options").select("*").eq("option_type", "system_setting").eq("label", configKey)
            const { data } = await query
            
            // Try to find exact match for company, or fall back to global
            const configOption = data?.find(o => o.company_id === companyId) || data?.find(o => o.company_id === null)
            
            let loadedLayout = { ...DEFAULT_LAYOUTS[activeModule] }
            let loadedReqOverrides = activeModule === "leads" ? ["native:project_name"] : (activeModule === "companies" ? ["native:name"] : ["native:full_name"])
            let loadedVisRules: VisibilityRules = {}
            
            if (configOption) {
                setLayoutConfigId(configOption.id)
                try {
                    const parsed = JSON.parse(configOption.value)
                    if (parsed.tabs && parsed.requiredOverrides) {
                        loadedLayout = { ...DEFAULT_LAYOUTS[activeModule], ...parsed.tabs }
                        loadedReqOverrides = parsed.requiredOverrides
                        if (parsed.visibilityRules) loadedVisRules = parsed.visibilityRules
                    } else { // old format fallback
                        loadedLayout = { ...DEFAULT_LAYOUTS[activeModule], ...parsed }
                    }
                } catch(e) {}
            } else {
                setLayoutConfigId(null)
            }

            // Self-heal: Inject any newly-added native fields from DEFAULT_LAYOUTS that are missing from saved config
            const allPresent = new Set(Object.values(loadedLayout).flat())
            const defaultLayout = DEFAULT_LAYOUTS[activeModule]
            if (defaultLayout) {
                for (const [tabKey, defaultFields] of Object.entries(defaultLayout)) {
                    for (const fieldId of defaultFields) {
                        if (fieldId.startsWith("native:") && !allPresent.has(fieldId)) {
                            if (!loadedLayout[tabKey]) loadedLayout[tabKey] = []
                            loadedLayout[tabKey].push(fieldId)
                            allPresent.add(fieldId)
                        }
                    }
                }
            }

            // Sync Custom Fields for this specific module
            const moduleCustomSchemas = customSchemas.filter(s => s.module_name === activeModule)
            const allLayoutItems = Object.values(loadedLayout).flat()
            const missingCustom = moduleCustomSchemas.filter(s => !allLayoutItems.includes(`custom:${s.field_key}`))
            
            if (missingCustom.length > 0) {
                const firstTabKey = Object.keys(loadedLayout)[0]
                if (firstTabKey) {
                    loadedLayout[firstTabKey] = [...loadedLayout[firstTabKey], ...missingCustom.map(s => `custom:${s.field_key}`)]
                }
            }

            setItems(loadedLayout)
            setRequiredOverrides(loadedReqOverrides)
            setVisibilityRules(loadedVisRules)
            setInitialStateStr(JSON.stringify({ tabs: loadedLayout, req: loadedReqOverrides, vis: loadedVisRules }))
            setIsLoading(false)
        }
        fetchLayout()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId, customSchemas, activeModule])

    const saveLayout = async () => {
        setIsSaving(true)
        const payload = JSON.stringify({ tabs: items, requiredOverrides, visibilityRules })
        if (layoutConfigId) {
            await supabase.from("master_options").update({ value: payload }).eq("id", layoutConfigId)
        } else {
            const configKey = activeModule === "leads" ? "form_layout_config" : `form_layout_config_${activeModule}`
            const res = await supabase.from("master_options").insert({
                option_type: "system_setting",
                label: configKey,
                value: payload,
                company_id: companyId,
                is_active: true
            }).select()
            if (res.data?.[0]) {
                setLayoutConfigId(res.data[0].id)
            }
        }
        toast.success("Form Layout Map saved successfully!")
        setInitialStateStr(JSON.stringify({ tabs: items, req: requiredOverrides, vis: visibilityRules }))
        setIsSaving(false)
    }

    const handleModuleSwitch = (mod: "leads" | "companies" | "contacts") => {
        if (activeModule === mod) return
        if (isDirty) {
            setPendingModuleMap(mod)
        } else {
            setActiveModule(mod)
        }
    }

    const getFieldLabel = (id: string) => {
        if (id.startsWith("native:")) return FIELD_LABELS[id] || id
        if (id.startsWith("custom:")) {
            const schema = customSchemas.find(s => s.field_key === id.replace("custom:", ""))
            return schema ? `${schema.field_name} (Custom)` : id
        }
        return id
    }

    // --- DND Handlers ---
    const findContainer = (id: string) => {
        if (id in items) return id
        return Object.keys(items).find((key) => items[key].includes(id))
    }

    const handleDragStart = (event: any) => {
        const { active } = event
        setActiveId(active.id)
    }

    const handleDragOver = (event: any) => {
        const { active, over } = event
        const overId = over?.id

        if (!overId || active.id === overId) return

        const activeContainer = findContainer(active.id)
        const overContainer = findContainer(overId)

        if (!activeContainer || !overContainer) return

        if (activeContainer !== overContainer) {
            setItems((prev) => {
                const activeItems = prev[activeContainer]
                const overItems = prev[overContainer]
                const activeIndex = activeItems.indexOf(active.id)
                const overIndex = overItems.indexOf(overId)

                let newIndex
                if (overId in prev) {
                    newIndex = overItems.length + 1
                } else {
                    const isBelowOverItem =
                        over &&
                        active.rect.current.translated &&
                        active.rect.current.translated.top > over.rect.top + over.rect.height
                    const modifier = isBelowOverItem ? 1 : 0
                    newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1
                }

                return {
                    ...prev,
                    [activeContainer]: prev[activeContainer].filter((item) => item !== active.id),
                    [overContainer]: [
                        ...prev[overContainer].slice(0, newIndex),
                        activeItems[activeIndex],
                        ...prev[overContainer].slice(newIndex, prev[overContainer].length),
                    ],
                }
            })
        }
    }

    const handleDragEnd = (event: any) => {
        const { active, over } = event
        const activeContainer = findContainer(active.id)
        const overContainer = over?.id ? findContainer(over.id) : null

        if (!activeContainer || !overContainer || activeContainer !== overContainer) {
            setActiveId(null)
            return
        }

        const activeIndex = items[activeContainer].indexOf(active.id)
        const overIndex = items[overContainer].indexOf(over.id)

        if (activeIndex !== overIndex) {
            setItems((items) => ({
                ...items,
                [overContainer]: arrayMove(items[overContainer], activeIndex, overIndex),
            }))
        }

        setActiveId(null)
    }

    if (isLoading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
    }

    const handleHideField = (id: string) => {
        setItems(prev => {
            const newItems = { ...prev }
            for (const key of Object.keys(newItems)) {
                newItems[key] = newItems[key].filter(itemId => itemId !== id)
            }
            newItems.hidden = [id, ...newItems.hidden]
            return newItems
        })
    }

    const handleToggleRequired = (id: string) => {
        if (activeModule === "leads" && id === "native:project_name") return;
        if (activeModule === "companies" && id === "native:name") return;
        if (activeModule === "contacts" && id === "native:full_name") return;

        setRequiredOverrides(prev => {
            if (prev.includes(id)) return prev.filter(x => x !== id)
            return [...prev, id]
        })
    }

    const getGroupName = (key: string) => {
        if (key === "hidden") return "Unused Fields"
        return key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + " Section"
    }

    const handleSetVisibilityRule = (fieldId: string, rule: VisibilityRule) => {
        setVisibilityRules(prev => ({ ...prev, [fieldId]: rule }))
    }
    const handleClearVisibilityRule = (fieldId: string) => {
        setVisibilityRules(prev => {
            const next = { ...prev }
            delete next[fieldId]
            return next
        })
    }
    const allFields = Object.entries(items)
        .filter(([key]) => key !== "hidden")
        .flatMap(([, fieldIds]) => fieldIds.map(id => ({ id, label: getFieldLabel(id) })))

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
                <Button 
                    variant={activeModule === "leads" ? "default" : "outline"} 
                    className="h-8 rounded-full" 
                    onClick={() => handleModuleSwitch("leads")}
                >
                    Leads Form
                </Button>
                <Button 
                    variant={activeModule === "companies" ? "default" : "outline"} 
                    className="h-8 rounded-full" 
                    onClick={() => handleModuleSwitch("companies")}
                >
                    Companies Form
                </Button>
                <Button 
                    variant={activeModule === "contacts" ? "default" : "outline"} 
                    className="h-8 rounded-full" 
                    onClick={() => handleModuleSwitch("contacts")}
                >
                    Contacts Form
                </Button>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <LayoutTemplate className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-[13px] text-blue-800 leading-relaxed">
                    Drag and Drop fields across different sections to rebuild your <strong>{activeModule.charAt(0).toUpperCase() + activeModule.slice(1)} Entry form</strong>. 
                    Move fields into &quot;Unused Fields&quot; container to hide them. Toggle &quot;REQ&quot; to make them mandatory. Click <strong>⚡</strong> to set conditional visibility rules.
                </p>
            </div>

            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
            >
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                    <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        {Object.keys(items).filter(k => k !== "hidden").map((containerId) => (
                            <SortableContainer
                                key={containerId}
                                id={containerId}
                                items={items[containerId] || []}
                                label={getFieldLabel}
                                title={`${containerId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')} Tab`}
                                isHiddenBox={false}
                                heightClass="h-[380px]"
                                onHideField={handleHideField}
                                onEditCustomField={onEditCustomField}
                                customSchemas={customSchemas}
                                requiredFields={requiredOverrides}
                                onToggleRequired={handleToggleRequired}
                                visibilityRules={visibilityRules}
                                onSetVisibilityRule={handleSetVisibilityRule}
                                onClearVisibilityRule={handleClearVisibilityRule}
                                allFields={allFields}
                            />
                        ))}
                    </div>
                    
                    <div className="lg:col-span-1">
                        <SortableContainer
                            id="hidden"
                            items={items["hidden"] || []}
                            label={getFieldLabel}
                            title="Unused Fields"
                            isHiddenBox={true}
                            heightClass="h-[380px] lg:h-[784px]"
                            onHideField={handleHideField}
                            onEditCustomField={onEditCustomField}
                            customSchemas={customSchemas}
                            requiredFields={requiredOverrides}
                            onToggleRequired={handleToggleRequired}
                            visibilityRules={visibilityRules}
                            onSetVisibilityRule={handleSetVisibilityRule}
                            onClearVisibilityRule={handleClearVisibilityRule}
                            allFields={allFields}
                        />
                    </div>
                </div>
                
                <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.5" } } }) }}>
                    {activeId ? <DraggableFieldItem id={activeId} label={getFieldLabel(activeId)} isHidden={findContainer(activeId) === "hidden"} isOverlay requiredFields={requiredOverrides} /> : null}
                </DragOverlay>
            </DndContext>

            <div className="pt-4 border-t flex justify-end">
                <Button onClick={saveLayout} disabled={isSaving || !isDirty}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Full Layout
                </Button>
            </div>

            <AlertDialog open={!!pendingModuleMap} onOpenChange={(open) => !open && setPendingModuleMap(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Unsaved Layout Changes</AlertDialogTitle>
                        <AlertDialogDescription>
                            You have made changes to the layout. If you switch to another module now, your changes will be lost. Do you want to discard them?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Continue Editing</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => {
                                if (pendingModuleMap) setActiveModule(pendingModuleMap)
                                setPendingModuleMap(null)
                            }}
                        >
                            Discard Changes
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function SortableContainer({ id, items, label, title, isHiddenBox, heightClass = "h-[400px]", onHideField, onEditCustomField, customSchemas, requiredFields, onToggleRequired, visibilityRules, onSetVisibilityRule, onClearVisibilityRule, allFields }: { id: string, items: string[], label: (id: string) => string, title: string, isHiddenBox: boolean, heightClass?: string, onHideField?: (id: string) => void, onEditCustomField?: (schema: FormSchema) => void, customSchemas?: FormSchema[], requiredFields?: string[], onToggleRequired?: (id: string) => void, visibilityRules?: VisibilityRules, onSetVisibilityRule?: (fieldId: string, rule: VisibilityRule) => void, onClearVisibilityRule?: (fieldId: string) => void, allFields?: Array<{id: string, label: string}> }) {
    const { setNodeRef } = useSortable({
        id,
        data: { type: "container", children: items },
    })

    return (
        <Card className={`${isHiddenBox ? "border-dashed border-2 bg-muted/40 text-muted-foreground shadow-inner" : "bg-white shadow-sm border-slate-200"} flex flex-col ${heightClass}`}>
            <CardHeader className="py-3 px-4 border-b bg-muted/20 flex-none shrink-0">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center font-semibold">
                        {isHiddenBox && <EyeOff className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />}
                        {title}
                        <span className="ml-2 text-xs text-muted-foreground font-normal bg-muted px-1.5 py-0.5 rounded-full">{items.length}</span>
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-2 flex-1 overflow-y-auto">
                <SortableContext id={id} items={items} strategy={verticalListSortingStrategy}>
                    <div ref={setNodeRef} className="space-y-2 min-h-[100px] h-full flex-col flex w-full">
                        {items.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs p-4 text-center">
                                Drop fields here
                            </div>
                        ) : (
                            items.map((itemId) => (
                                <SortableFieldItem key={itemId} id={itemId} label={label(itemId)} isHidden={isHiddenBox} 
                                    onHideField={onHideField} 
                                    onEditCustomField={onEditCustomField} 
                                    customSchemas={customSchemas} 
                                    requiredFields={requiredFields}
                                    onToggleRequired={onToggleRequired}
                                    visibilityRules={visibilityRules}
                                    onSetVisibilityRule={onSetVisibilityRule}
                                    onClearVisibilityRule={onClearVisibilityRule}
                                    allFields={allFields}
                                />
                            ))
                        )}
                    </div>
                </SortableContext>
            </CardContent>
        </Card>
    )
}

function SortableFieldItem({ id, label, isHidden, onHideField, onEditCustomField, customSchemas, requiredFields, onToggleRequired, visibilityRules, onSetVisibilityRule, onClearVisibilityRule, allFields }: { id: string, label: string, isHidden: boolean, onHideField?: (id: string) => void, onEditCustomField?: (schema: FormSchema) => void, customSchemas?: FormSchema[], requiredFields?: string[], onToggleRequired?: (id: string) => void, visibilityRules?: VisibilityRules, onSetVisibilityRule?: (fieldId: string, rule: VisibilityRule) => void, onClearVisibilityRule?: (fieldId: string) => void, allFields?: Array<{id: string, label: string}> }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    }

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
            <DraggableFieldItem id={id} label={label} isHidden={isHidden} onHideField={onHideField} onEditCustomField={onEditCustomField} customSchemas={customSchemas} requiredFields={requiredFields} onToggleRequired={onToggleRequired} visibilityRules={visibilityRules} onSetVisibilityRule={onSetVisibilityRule} onClearVisibilityRule={onClearVisibilityRule} allFields={allFields} />
        </div>
    )
}

function DraggableFieldItem({ id, label, isHidden, isOverlay, onHideField, onEditCustomField, customSchemas, requiredFields = [], onToggleRequired, visibilityRules, onSetVisibilityRule, onClearVisibilityRule, allFields }: { id: string, label: string, isHidden: boolean, isOverlay?: boolean, onHideField?: (id: string) => void, onEditCustomField?: (schema: FormSchema) => void, customSchemas?: FormSchema[], requiredFields?: string[], onToggleRequired?: (id: string) => void, visibilityRules?: VisibilityRules, onSetVisibilityRule?: (fieldId: string, rule: VisibilityRule) => void, onClearVisibilityRule?: (fieldId: string) => void, allFields?: Array<{id: string, label: string}> }) {
    const isCustom = id.startsWith("custom:")
    const isCoreLocked = id === "native:project_name" || id === "native:name" || id === "native:full_name"
    const isRequired = requiredFields.includes(id) || isCoreLocked
    const hasCondition = !!(visibilityRules && visibilityRules[id] && (visibilityRules[id].conditions?.length || (visibilityRules[id] as unknown as Record<string, unknown>).dependsOn))
    const conditionCount = visibilityRules?.[id]?.conditions?.length || (hasCondition ? 1 : 0)
    
    return (
        <div className={cn(
            "flex items-center justify-between p-2.5 rounded-md border text-sm font-medium cursor-grab active:cursor-grabbing group transition-colors",
            isHidden ? "bg-muted/50 border-dashed text-muted-foreground" : "bg-white border-slate-200 shadow-sm text-slate-800 hover:border-slate-300",
            isOverlay ? "shadow-lg bg-white ring-2 ring-primary ring-opacity-50" : "",
            hasCondition && !isHidden ? "border-l-2 border-l-amber-400" : ""
        )}>
            <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{label}</span>
                {isCustom && (
                    <span className="shrink-0 text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Custom</span>
                )}
                {isRequired && (
                    <span className="text-red-500 font-bold ml-1 text-xs" title="Mandatory field">*</span>
                )}
                {hasCondition && (
                    <span className="shrink-0 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded" title="Has visibility condition">
                        ⚡{conditionCount > 1 ? ` ×${conditionCount}` : ""}
                    </span>
                )}
            </div>

            {!isHidden && !isOverlay && (
                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1.5 ml-1 pt-0.5" onClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}>
                        <span className={`text-[9px] font-bold ${isRequired ? "text-slate-400" : "text-slate-300"}`}>REQ</span>
                        <Switch 
                            checked={isRequired} 
                            disabled={isCoreLocked}
                            onCheckedChange={() => onToggleRequired?.(id)}
                            className="scale-75"
                        />
                    </div>

                    {onSetVisibilityRule && onClearVisibilityRule && allFields && (
                        <ConditionPopover
                            fieldId={id}
                            currentRule={visibilityRules?.[id]}
                            allFields={allFields}
                            onSet={onSetVisibilityRule}
                            onClear={onClearVisibilityRule}
                        />
                    )}

                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0 bg-white/80">
                        {isCustom && onEditCustomField && (
                            <Button 
                                variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-slate-100 hover:text-primary"
                                onPointerDown={(e) => e.stopPropagation()} 
                                onClick={() => {
                                    const schema = customSchemas?.find(s => s.field_key === id.replace("custom:", ""));
                                    if (schema) onEditCustomField(schema);
                                }}
                            >
                                <Pencil className="h-3 w-3" />
                            </Button>
                        )}
                        <Button 
                            variant="ghost" size="icon" className="h-6 w-6 rounded hover:bg-slate-200 text-muted-foreground"
                            onPointerDown={(e) => e.stopPropagation()} 
                            onClick={() => onHideField?.(id)}
                            title="Remove from layout"
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function ConditionPopover({ fieldId, currentRule, allFields, onSet, onClear }: {
    fieldId: string
    currentRule?: VisibilityRule
    allFields: Array<{id: string, label: string}>
    onSet: (fieldId: string, rule: VisibilityRule) => void
    onClear: (fieldId: string) => void
}) {
    const emptyCondition = (): VisibilityCondition => ({ dependsOn: "", operator: "contains", value: "" })

    // Normalize old single-condition format to new multi-condition format
    const initConditions = (): VisibilityCondition[] => {
        if (!currentRule) return [emptyCondition()]
        if (currentRule.conditions?.length) return currentRule.conditions.map(c => ({ ...c }))
        // Backward compat: old format had dependsOn/operator/value at root
        const legacy = currentRule as unknown as Record<string, unknown>
        if (legacy.dependsOn) return [{ dependsOn: String(legacy.dependsOn), operator: (legacy.operator as VisibilityCondition["operator"]) || "contains", value: (legacy.value as string | string[]) || "" }]
        return [emptyCondition()]
    }

    const [open, setOpen] = useState(false)
    const [logic, setLogic] = useState<"and" | "or">(currentRule?.logic || "and")
    const [conditions, setConditions] = useState<VisibilityCondition[]>(initConditions)

    useEffect(() => {
        if (open) {
            setLogic(currentRule?.logic || "and")
            setConditions(initConditions())
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const availableFields = allFields.filter(f => f.id !== fieldId)
    const hasCondition = !!(currentRule?.conditions?.length || (currentRule as unknown as Record<string, unknown>)?.dependsOn)

    const updateCondition = (idx: number, patch: Partial<VisibilityCondition>) => {
        setConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c))
    }
    const removeCondition = (idx: number) => {
        setConditions(prev => prev.filter((_, i) => i !== idx))
    }
    const addCondition = () => {
        setConditions(prev => [...prev, emptyCondition()])
    }

    const handleSave = () => {
        const valid = conditions.filter(c => c.dependsOn && (c.operator === "not_empty" || (typeof c.value === "string" ? c.value.trim() : (c.value as string[])?.length)))
        if (valid.length === 0) return
        // Normalize "in" operator values
        const normalized = valid.map(c => {
            if (c.operator === "in" && typeof c.value === "string") {
                return { ...c, value: c.value.split(",").map((v: string) => v.trim()).filter(Boolean) }
            }
            return c
        })
        onSet(fieldId, { logic, conditions: normalized })
        setOpen(false)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost" size="icon"
                    className={cn("h-6 w-6 rounded", hasCondition ? "text-amber-600 hover:bg-amber-50" : "text-slate-300 hover:text-slate-500 hover:bg-slate-100")}
                    onPointerDown={(e) => e.stopPropagation()}
                    title={hasCondition ? "Edit visibility condition" : "Add visibility condition"}
                >
                    <Zap className="h-3 w-3" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-4 space-y-3" align="end" side="left" onPointerDown={(e) => e.stopPropagation()}>
                <div className="space-y-1">
                    <h4 className="font-semibold text-sm flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        Visibility Conditions
                    </h4>
                    <p className="text-xs text-muted-foreground">Show this field only when conditions are met.</p>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                    {conditions.map((cond, idx) => (
                        <div key={idx}>
                            {idx > 0 && (
                                <div className="flex items-center justify-center gap-2 py-1">
                                    <div className="h-px flex-1 bg-slate-200" />
                                    <button
                                        type="button"
                                        onClick={() => setLogic(logic === "and" ? "or" : "and")}
                                        className={cn(
                                            "text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border cursor-pointer transition-colors",
                                            logic === "and" ? "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                        )}
                                    >
                                        {logic}
                                    </button>
                                    <div className="h-px flex-1 bg-slate-200" />
                                </div>
                            )}
                            <div className="rounded-lg border bg-slate-50/50 p-2.5 space-y-2 relative">
                                {conditions.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => removeCondition(idx)}
                                        className="absolute top-1.5 right-1.5 h-5 w-5 flex items-center justify-center rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                )}
                                <Select value={cond.dependsOn} onValueChange={(v) => updateCondition(idx, { dependsOn: v })}>
                                    <SelectTrigger className="h-7 text-xs bg-white">
                                        <SelectValue placeholder="Select field..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableFields.map(f => (
                                            <SelectItem key={f.id} value={f.id} className="text-xs">{f.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, { operator: v as VisibilityCondition["operator"] })}>
                                    <SelectTrigger className="h-7 text-xs bg-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {VISIBILITY_OPERATORS.map(op => (
                                            <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {cond.operator !== "not_empty" && (
                                    <Input 
                                        value={Array.isArray(cond.value) ? cond.value.join(", ") : (cond.value || "")}
                                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                        placeholder={cond.operator === "in" ? "Value1, Value2" : "Enter value..."}
                                        className="h-7 text-xs bg-white"
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1 border-dashed" onClick={addCondition}>
                    <Plus className="h-3 w-3" /> Add Condition
                </Button>

                <div className="flex justify-between pt-1 border-t">
                    {hasCondition ? (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => { onClear(fieldId); setOpen(false) }}>
                            Clear All
                        </Button>
                    ) : <div />}
                    <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
                        Apply
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    )
}

