"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { Lead, TransitionRule } from "@/types"
import { FIELD_LABELS } from "@/features/settings/components/form-layout-builder"
import { CurrencyInput } from "@/components/shared/currency-input"
import { MultiDatePicker } from "@/components/shared/multi-date-picker"
import { DatePickerField } from "@/components/shared/date-picker-field"
import { MultiFileUploader, type UploadedAttachment } from "@/components/shared/multi-file-uploader"
import { updatePipelineStageAction } from "@/app/actions/lead-actions"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"

interface TransitionPromptModalProps {
    prompt: {
        lead: Lead;
        oldStageId: string;
        newStageId: string;
        rule: TransitionRule;
        newSortOrder?: number;
    } | null;
    onClose: () => void;
    onSuccess: (leadId: number, newStageId: string, leadUpdates: any) => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10)

export function TransitionPromptModal({ prompt, onClose, onSuccess }: TransitionPromptModalProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [note, setNote] = useState("")
    const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
    const [uploading, setUploading] = useState(false)
    const [closeDate, setCloseDate] = useState<string>("")
    const [masterOptions, setMasterOptions] = useState<Record<string, string[]>>({})

    const supabase = createClient()

    // Detect destination stage state so we can ask the user for the
    // matching closing date. Resolve via stages list so we can read the
    // canonical closed_status (won/lost) regardless of stage name casing.
    const [destinationMeta, setDestinationMeta] = useState<
        | { closedStatus: "won" | "lost" | null; stageType: "open" | "closed" | null; stageName: string }
        | null
    >(null)

    // Fields that should render as dropdown (from master_options)
    const DROPDOWN_FIELDS: Record<string, string> = {
        lost_reason: "lost_reason",
        category: "category",
        grade_lead: "grade_lead",
        lead_source: "lead_source",
        main_stream: "main_stream",
        stream_type: "stream_type",
        business_purpose: "business_purpose",
        event_format: "event_format",
        area: "area",
    }
    // Fields that should render as long text (textarea)
    const TEXTAREA_FIELDS = new Set(["lost_reason_details", "remark", "description", "general_brief", "production_sow", "special_remarks"])

    useEffect(() => {
        if (prompt?.lead) {
            const initial: Record<string, any> = {}
            for (const field of prompt.rule.required_fields || []) {
                if (field === "event_dates") {
                    initial[field] = (prompt.lead as any)[field] || []
                } else {
                    initial[field] = (prompt.lead as any)[field] || ""
                }
            }
            setFormData(initial)
            setNote("")
            setAttachments([])
            setCloseDate(todayIso())

            // Fetch destination stage to know if we need a close date input.
            supabase
                .from("pipeline_stages")
                .select("name, closed_status, stage_type")
                .eq("id", prompt.newStageId)
                .single()
                .then(({ data }) => {
                    if (!data) {
                        setDestinationMeta(null)
                        return
                    }
                    const meta = {
                        closedStatus: (data.closed_status ?? null) as "won" | "lost" | null,
                        stageType: (data.stage_type ?? null) as "open" | "closed" | null,
                        stageName: data.name as string,
                    }
                    setDestinationMeta(meta)

                    // If transitioning into a known closed state, prefill the
                    // close date with whatever was previously stamped (if any),
                    // falling back to today.
                    if (meta.closedStatus === "won") {
                        const existing = (prompt.lead as any).closed_won_date as string | null
                        setCloseDate(existing ? existing.slice(0, 10) : todayIso())
                    } else if (meta.closedStatus === "lost" || meta.stageType === "closed") {
                        const existing = (prompt.lead as any).closed_lost_date as string | null
                        setCloseDate(existing ? existing.slice(0, 10) : todayIso())
                    }
                })

            // Fetch master options for any dropdown fields in required_fields
            const dropdownKeys = (prompt.rule.required_fields || []).filter(f => f in DROPDOWN_FIELDS)
            if (dropdownKeys.length > 0) {
                const optionTypes = dropdownKeys.map(f => DROPDOWN_FIELDS[f])
                supabase.from('master_options').select('option_type, value')
                    .in('option_type', optionTypes)
                    .eq('is_active', true)
                    .order('sort_order')
                    .then(({ data }) => {
                        const map: Record<string, string[]> = {}
                        for (const opt of data ?? []) {
                            if (!map[opt.option_type]) map[opt.option_type] = []
                            map[opt.option_type].push(opt.value)
                        }
                        setMasterOptions(map)
                    })
            }
        }
    }, [prompt])

    if (!prompt) return null

    const showCloseDatePicker = !!destinationMeta && (
        destinationMeta.closedStatus === "won" ||
        destinationMeta.closedStatus === "lost" ||
        destinationMeta.stageType === "closed"
    )

    const closeDateLabel = destinationMeta?.closedStatus === "won"
        ? "Won Date"
        : destinationMeta?.closedStatus === "lost"
            ? "Lost Date"
            : "Closed Date"

    const handleSave = async () => {
        // Validation
        for (const field of prompt.rule.required_fields || []) {
            if (!formData[field]) {
                toast.error(`Please fill in ${FIELD_LABELS[`native:${field}`] || field}`)
                return
            }
        }
        if (prompt.rule.note_required && !note.trim()) {
            toast.error("A note is required for this transition")
            return
        }
        if (prompt.rule.attachment_required && attachments.length === 0) {
            toast.error("At least one attachment is required for this transition")
            return
        }
        if (showCloseDatePicker && !closeDate) {
            toast.error(`Please pick the ${closeDateLabel.toLowerCase()}`)
            return
        }

        setLoading(true)
        
        try {
            // 1. Prepare payload with special logic for event_dates
            const payload: Record<string, any> = { ...formData }
            
            // Smart sync of start/end dates for table filtering if event_dates exists in payload
            if (payload.event_dates !== undefined) {
                if (payload.event_dates && payload.event_dates.length > 0) {
                    const sorted = [...payload.event_dates].sort()
                    payload.event_date_start = sorted[0]
                    payload.event_date_end = sorted[sorted.length - 1]
                } else {
                    payload.event_date_start = null
                    payload.event_date_end = null
                }
            }

            // When closing a deal as WON, the amount entered is the confirmed
            // (actual) value — mirror it into actual_value so won-revenue and
            // goal attainment (which read actual_value only) count it.
            if (destinationMeta?.closedStatus === "won" && payload.estimated_value !== undefined && payload.estimated_value !== "") {
                payload.actual_value = payload.estimated_value
            }

            // 2. Update the lead with the new form data
            if (Object.keys(payload).length > 0) {
                const { error: updateErr } = await supabase
                    .from('leads')
                    .update(payload)
                    .eq('id', prompt.lead.id)
                if (updateErr) throw updateErr
            }

            // 3. Perform the stage transition (this will also write to transition history via trigger/RPC)
            const result = await updatePipelineStageAction(
                prompt.lead.id,
                prompt.newStageId,
                prompt.newSortOrder,
                showCloseDatePicker && closeDate ? { closedDate: closeDate } : undefined,
            )
            if (!result.success) throw new Error(result.error)

            // 4. Persist a note if the user supplied one. Attachments are
            // already saved through MultiFileUploader (lead_attachments).
            if (note.trim()) {
                await supabase.from('lead_notes').insert({
                    lead_id: prompt.lead.id,
                    content: note.trim(),
                })
            }

            // Bubble close date back to the parent so card UI updates without
            // a refetch. The server already persisted the value.
            const surfaceUpdates = { ...payload }
            if (showCloseDatePicker && closeDate) {
                if (destinationMeta?.closedStatus === "won") {
                    surfaceUpdates.closed_won_date = closeDate
                    surfaceUpdates.closed_lost_date = null
                } else if (
                    destinationMeta?.closedStatus === "lost" ||
                    destinationMeta?.stageType === "closed"
                ) {
                    surfaceUpdates.closed_lost_date = closeDate
                    surfaceUpdates.closed_won_date = null
                }
            }

            toast.success("Stage updated successfully")
            onSuccess(prompt.lead.id, prompt.newStageId, surfaceUpdates)
        } catch (err: any) {
            toast.error(`Update failed: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[480px] max-h-[90vh] p-0 gap-0 flex flex-col">
                <DialogHeader className="px-6 pt-6 pb-3 border-b border-slate-100 shrink-0">
                    <DialogTitle>Update Fields</DialogTitle>
                    <DialogDescription>
                        It is mandatory to fill these information while moving this pipeline lead.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
                    {showCloseDatePicker && (
                        <div className="space-y-1.5">
                            <Label className="text-slate-600">{closeDateLabel} <span className="text-red-500">*</span></Label>
                            <DatePickerField
                                value={closeDate}
                                onChange={setCloseDate}
                                placeholder="Pick a date"
                                clearable={false}
                                className="bg-white"
                            />
                        </div>
                    )}

                    {prompt.rule.required_fields?.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium border-b pb-1 text-slate-700">Required Information</h4>
                            {prompt.rule.required_fields.map((field) => {
                                const label = field === "estimated_value" && destinationMeta?.stageType === "closed"
                                    ? "Confirmed Value"
                                    : FIELD_LABELS[`native:${field}`] || field.replace(/_/g, " ")
                                const optionType = DROPDOWN_FIELDS[field]
                                const options = optionType ? masterOptions[optionType] || [] : []
                                const isDropdown = !!optionType && options.length > 0
                                const isTextarea = TEXTAREA_FIELDS.has(field)
                                return (
                                    <div key={field} className="space-y-1.5">
                                        <Label className="capitalize text-slate-600">{label}</Label>
                                        {field === "estimated_value" ? (
                                            <CurrencyInput
                                                name="estimated_value"
                                                value={formData[field]}
                                                onChange={(val) => setFormData({ ...formData, [field]: val })}
                                                prefix="Rp"
                                                className="bg-white"
                                            />
                                        ) : field === "event_dates" ? (
                                            <MultiDatePicker
                                                value={formData[field] || []}
                                                onChange={(val) => setFormData({ ...formData, [field]: val })}
                                                className="bg-white"
                                            />
                                        ) : isDropdown ? (
                                            <Select value={formData[field] || ""} onValueChange={(val) => setFormData({ ...formData, [field]: val })}>
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder={`Select ${label.toLowerCase()}...`} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {options.map((opt) => (
                                                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        ) : isTextarea ? (
                                            <Textarea
                                                value={formData[field] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                                placeholder={`Enter ${label.toLowerCase()}...`}
                                                rows={3}
                                                className="bg-white"
                                            />
                                        ) : (
                                            <Input
                                                value={formData[field] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                                placeholder={`Enter ${label.toLowerCase()}`}
                                                className="bg-white"
                                            />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {prompt.rule.note_required && (
                        <div className="space-y-1.5">
                            <Label className="text-slate-600">Additional Note <span className="text-red-500">*</span></Label>
                            <Textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="Add a note about this transition..."
                            />
                        </div>
                    )}

                    {prompt.rule.attachment_required && (
                        <div className="space-y-1.5">
                            <Label className="text-slate-600">Attachments <span className="text-red-500">*</span></Label>
                            <MultiFileUploader
                                leadId={prompt.lead.id}
                                onChange={setAttachments}
                                onUploadingChange={setUploading}
                                disabled={loading}
                            />
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || uploading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save & Move
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
