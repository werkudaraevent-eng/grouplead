"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, UploadCloud } from "lucide-react"
import { Lead, TransitionRule } from "@/types"
import { FIELD_LABELS } from "@/features/settings/components/form-layout-builder"
import { CurrencyInput } from "@/components/shared/currency-input"
import { MultiDatePicker } from "@/components/shared/multi-date-picker"
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

export function TransitionPromptModal({ prompt, onClose, onSuccess }: TransitionPromptModalProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [note, setNote] = useState("")
    const [fileUrl, setFileUrl] = useState("")
    const [uploading, setUploading] = useState(false)
    const [masterOptions, setMasterOptions] = useState<Record<string, string[]>>({})
    
    const supabase = createClient()

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
            setFileUrl("")

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
        if (prompt.rule.attachment_required && !fileUrl) {
            toast.error("An attachment is required for this transition")
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

            // 2. Update the lead with the new form data
            if (Object.keys(payload).length > 0) {
                const { error: updateErr } = await supabase
                    .from('leads')
                    .update(payload)
                    .eq('id', prompt.lead.id)
                if (updateErr) throw updateErr
            }
            
            // 3. Perform the stage transition (this will also write to transition history via trigger/RPC)
            const result = await updatePipelineStageAction(prompt.lead.id, prompt.newStageId, prompt.newSortOrder)
            if (!result.success) throw new Error(result.error)
            
            // 3. If note or attachment, perhaps we should save it to notes?
            if (note || fileUrl) {
                await supabase.from('lead_notes').insert({
                    lead_id: prompt.lead.id,
                    content: note || "Stage transition attachment",
                    attachment_url: fileUrl || null
                })
            }
            
            toast.success("Stage updated successfully")
            onSuccess(prompt.lead.id, prompt.newStageId, payload)
        } catch (err: any) {
            toast.error(`Update failed: ${err.message}`)
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const ext = file.name.split('.').pop()
            const fileName = `${Math.random()}.${ext}`
            const filePath = `transitions/${prompt.lead.id}/${fileName}`
            const { error: uploadError } = await supabase.storage.from('lead_attachments').upload(filePath, file)
            if (uploadError) throw uploadError
            const { data } = supabase.storage.from('lead_attachments').getPublicUrl(filePath)
            setFileUrl(data.publicUrl)
            toast.success("File uploaded")
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <Dialog open={!!prompt} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Update Fields</DialogTitle>
                    <DialogDescription>
                        It is mandatory to fill these information while moving this pipeline lead.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {prompt.rule.required_fields?.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="text-sm font-medium border-b pb-1 text-slate-700">Required Information</h4>
                            {prompt.rule.required_fields.map((field) => {
                                const label = FIELD_LABELS[`native:${field}`] || field.replace(/_/g, " ")
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
                                            />
                                        ) : field === "event_dates" ? (
                                            <MultiDatePicker
                                                value={formData[field] || []}
                                                onChange={(val) => setFormData({ ...formData, [field]: val })}
                                            />
                                        ) : isDropdown ? (
                                            <Select value={formData[field] || ""} onValueChange={(val) => setFormData({ ...formData, [field]: val })}>
                                                <SelectTrigger>
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
                                            />
                                        ) : (
                                            <Input
                                                value={formData[field] || ""}
                                                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                                                placeholder={`Enter ${label.toLowerCase()}`}
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
                        <div className="space-y-1.5 border border-dashed border-slate-300 rounded-lg p-6 bg-slate-50 relative flex flex-col items-center justify-center text-center">
                            <Input
                                type="file"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileUpload}
                                disabled={uploading}
                            />
                            {uploading ? (
                                <div className="flex flex-col items-center text-slate-500">
                                    <Loader2 className="h-6 w-6 animate-spin mb-2" />
                                    <span className="text-xs font-medium">Uploading...</span>
                                </div>
                            ) : fileUrl ? (
                                <div className="flex flex-col items-center text-emerald-600">
                                    <span className="text-xs font-medium">File uploaded successfully</span>
                                    <span className="text-[10px] text-slate-400 mt-1">Click to replace</span>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center text-slate-500">
                                    <UploadCloud className="h-6 w-6 mb-2 text-slate-400" />
                                    <span className="text-xs font-medium text-blue-600">Click to browse</span>
                                    <span className="text-[10px] text-slate-400 mt-0.5">Required document</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
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
