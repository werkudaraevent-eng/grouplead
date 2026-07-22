"use client"

import { useState } from "react"
import { ChevronRight, Loader2, Check, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { useCompany } from "@/contexts/company-context"
import { useCurrency } from "@/contexts/currency-context"
import { updateCurrencySettingsAction } from "@/app/actions/settings-actions"
import type { CurrencyFormat, CurrencyPrefix } from "@/types/currency"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FORMAT_OPTIONS: { value: CurrencyFormat; label: string; example: string }[] = [
    { value: "compact", label: "Compact", example: "19.5B / 130M" },
    { value: "full", label: "Full digits", example: "19.500.000.000" },
]

const PREFIX_OPTIONS: { value: CurrencyPrefix; label: string }[] = [
    { value: "Rp", label: "Rp" },
    { value: "IDR", label: "IDR" },
    { value: "", label: "None" },
]

type IconType = typeof DollarSign

interface CurrencySettingsRowProps {
    /** Optional icon override; defaults to DollarSign. Note: when used from a Server Component, omit this prop — icon components cannot be serialized across the boundary. */
    icon?: IconType
}

/**
 * Inline-expandable settings row for currency display preferences.
 * Matches the row pattern used by other items in `/settings`.
 */
export function CurrencySettingsRow({ icon: Icon = DollarSign }: CurrencySettingsRowProps = {}) {
    const { activeCompany } = useCompany()
    const { settings } = useCurrency()
    const [open, setOpen] = useState(false)
    const [format, setFormat] = useState<CurrencyFormat>(settings.currency_format)
    const [prefix, setPrefix] = useState<CurrencyPrefix>(settings.currency_prefix)
    const [saving, setSaving] = useState(false)

    const hasChanges = format !== settings.currency_format || prefix !== settings.currency_prefix
    const previewPrefix = prefix ? `${prefix} ` : ""
    const previewValue =
        format === "compact" ? `${previewPrefix}19.5B` : `${previewPrefix}19.500.000.000`

    const summary = `${prefix || "no prefix"} · ${format === "compact" ? "Compact" : "Full digits"}`

    const handleSave = async () => {
        if (!activeCompany?.id) return
        setSaving(true)
        const result = await updateCurrencySettingsAction(activeCompany.id, {
            currency_format: format,
            currency_prefix: prefix,
        })
        setSaving(false)
        if (result.success) {
            toast.success("Currency format updated. Refresh to apply across the system.")
        } else {
            toast.error(result.error || "Failed to save")
        }
    }

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="group flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:outline-none"
            >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tight text-foreground">
                        Currency display
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        How monetary values appear across the system · {summary}
                    </p>
                </div>
                <ChevronRight
                    className={cn(
                        "h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform duration-150",
                        open ? "rotate-90 text-foreground" : "group-hover:translate-x-0.5 group-hover:text-foreground",
                    )}
                    aria-hidden="true"
                />
            </button>

            {open && (
                <div className="border-t border-border bg-muted/20 px-4 py-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        {/* Format */}
                        <div>
                            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                                Format
                            </label>
                            <div className="mt-2 flex gap-2">
                                {FORMAT_OPTIONS.map((opt) => {
                                    const active = format === opt.value
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setFormat(opt.value)}
                                            className={cn(
                                                "flex-1 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                                                active
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-border bg-card text-foreground hover:border-foreground/30",
                                            )}
                                            aria-pressed={active}
                                        >
                                            <div className="font-semibold">{opt.label}</div>
                                            <div className="mt-0.5 text-[10px] tabular-nums opacity-70">
                                                {opt.example}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Prefix */}
                        <div>
                            <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                                Prefix
                            </label>
                            <div className="mt-2 flex gap-2">
                                {PREFIX_OPTIONS.map((opt) => {
                                    const active = prefix === opt.value
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setPrefix(opt.value)}
                                            className={cn(
                                                "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                                                active
                                                    ? "border-primary bg-primary/10 text-primary"
                                                    : "border-border bg-card text-foreground hover:border-foreground/30",
                                            )}
                                            aria-pressed={active}
                                        >
                                            {opt.label || "(None)"}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Preview + actions */}
                    <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="rounded-md border border-border bg-card px-3 py-2">
                            <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                                Preview
                            </div>
                            <div className="text-base font-bold tabular-nums tracking-tight text-foreground">
                                {previewValue}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 sm:justify-end">
                            {hasChanges && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                        setFormat(settings.currency_format)
                                        setPrefix(settings.currency_prefix)
                                    }}
                                    disabled={saving}
                                >
                                    Reset
                                </Button>
                            )}
                            <Button
                                size="sm"
                                type="button"
                                onClick={handleSave}
                                disabled={!hasChanges || saving}
                            >
                                {saving ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                    <Check className="h-3.5 w-3.5" />
                                )}
                                {saving ? "Saving…" : "Save changes"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
