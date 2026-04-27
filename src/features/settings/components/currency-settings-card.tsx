"use client"

import { useState } from "react"
import { useCompany } from "@/contexts/company-context"
import { useCurrency } from "@/contexts/currency-context"
import { updateCurrencySettingsAction } from "@/app/actions/settings-actions"
import type { CurrencyFormat, CurrencyPrefix } from "@/types/currency"
import { toast } from "sonner"
import { Loader2, Check, DollarSign } from "lucide-react"

const FORMAT_OPTIONS: { value: CurrencyFormat; label: string; example: string }[] = [
    { value: "compact", label: "Compact", example: "19.5B / 130M" },
    { value: "full", label: "Full Digits", example: "19.500.000.000" },
]

const PREFIX_OPTIONS: { value: CurrencyPrefix; label: string }[] = [
    { value: "Rp", label: "Rp" },
    { value: "IDR", label: "IDR" },
    { value: "", label: "None" },
]

export function CurrencySettingsCard() {
    const { activeCompany } = useCompany()
    const { settings } = useCurrency()
    const [format, setFormat] = useState<CurrencyFormat>(settings.currency_format)
    const [prefix, setPrefix] = useState<CurrencyPrefix>(settings.currency_prefix)
    const [saving, setSaving] = useState(false)

    const hasChanges = format !== settings.currency_format || prefix !== settings.currency_prefix
    const previewPrefix = prefix ? `${prefix} ` : ""
    const previewValue = format === "compact" ? `${previewPrefix}19.5B` : `${previewPrefix}19.500.000.000`

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
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow h-full">
            <div>
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit">
                    <DollarSign className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mt-4">Currency Display</h3>
                <p className="text-sm text-slate-600 mt-1">
                    Configure how monetary values appear across the entire system.
                </p>

                {/* Number Format */}
                <div className="mt-4">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Format</label>
                    <div className="flex gap-2 mt-1.5">
                        {FORMAT_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setFormat(opt.value)}
                                className={`flex-1 px-3 py-2 rounded-lg border text-left transition-all text-xs ${
                                    format === opt.value
                                        ? "border-blue-500 bg-blue-50 text-blue-700"
                                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                            >
                                <div className="font-semibold">{opt.label}</div>
                                <div className="text-[10px] opacity-70 mt-0.5">{opt.example}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Currency Prefix */}
                <div className="mt-3">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prefix</label>
                    <div className="flex gap-2 mt-1.5">
                        {PREFIX_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setPrefix(opt.value)}
                                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                    prefix === opt.value
                                        ? "border-blue-500 bg-blue-50 text-blue-700"
                                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                                }`}
                            >
                                {opt.label || "(None)"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Preview */}
                <div className="bg-slate-50 rounded-lg px-3 py-2 mt-3 border border-slate-100">
                    <div className="text-[10px] font-medium text-slate-400">Preview</div>
                    <div className="text-base font-bold text-slate-900 tracking-tight">{previewValue}</div>
                </div>
            </div>

            {/* Save button — matches the module card button style */}
            {hasChanges ? (
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-white bg-blue-600 hover:bg-blue-700 text-sm font-medium mt-6 flex items-center w-full justify-center gap-2 border border-blue-600 rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {saving ? "Saving..." : "Save Changes"}
                </button>
            ) : (
                <div className="text-slate-400 text-sm font-medium mt-6 flex items-center w-full justify-center border border-slate-200 rounded-lg px-4 py-2">
                    Current: {previewPrefix}{format === "compact" ? "Compact" : "Full"}
                </div>
            )}
        </div>
    )
}
