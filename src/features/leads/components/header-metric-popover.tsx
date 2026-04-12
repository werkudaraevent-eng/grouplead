"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createClient } from "@/utils/supabase/client"
import { toast } from "sonner"
import { Pencil, Loader2, Check, X } from "lucide-react"

interface HeaderMetricPopoverProps {
    leadId: number
    fieldPath: string
    label: string
    displayValue: string
    inputType?: "text" | "number" | "date"
    rawValue: string | number | null | undefined
    triggerClassName?: string
}

export function HeaderMetricPopover({
    leadId,
    fieldPath,
    label,
    displayValue,
    inputType = "text",
    rawValue,
    triggerClassName,
}: HeaderMetricPopoverProps) {
    const supabase = createClient()
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const [value, setValue] = useState(rawValue?.toString() ?? "")
    const [saving, setSaving] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (open) {
            setValue(rawValue?.toString() ?? "")
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus()
                    inputRef.current.select()
                }
            }, 50)
        }
    }, [open, rawValue])

    const handleSave = async () => {
        setSaving(true)

        let payload: Record<string, unknown> = {}
        if (inputType === "number") {
            payload[fieldPath] = value ? Number(value) : null
        } else if (inputType === "date") {
            payload[fieldPath] = value || null
        } else {
            payload[fieldPath] = value || null
        }

        const { error } = await supabase
            .from("leads")
            .update(payload)
            .eq("id", leadId)

        if (error) {
            toast.error(`Update failed: ${error.message}`)
        } else {
            toast.success(`${label} updated`)
            router.refresh()
        }
        setSaving(false)
        setOpen(false)
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault()
            handleSave()
        }
        if (e.key === "Escape") {
            setOpen(false)
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button suppressHydrationWarning className={`group flex items-center gap-1.5 transition-colors rounded px-1.5 py-0.5 -mx-1.5 hover:bg-blue-50 ${triggerClassName || "text-[13px] font-semibold text-slate-800 hover:text-blue-600"}`}>
                    <span suppressHydrationWarning className="truncate">{displayValue}</span>
                    <Pencil className="h-3 w-3 text-transparent group-hover:text-blue-500 shrink-0 transition-colors" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                className="w-64 p-3"
                align="start"
                sideOffset={8}
            >
                <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        {label}
                    </label>
                    <Input
                        ref={inputRef}
                        type={inputType}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-8 text-sm"
                        placeholder={`Enter ${label.toLowerCase()}`}
                    />
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setOpen(false)}
                            disabled={saving}
                        >
                            <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Check className="h-3 w-3 mr-1" />
                            )}
                            Save
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
