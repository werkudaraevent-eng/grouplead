"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { Loader2, User } from "lucide-react"

interface StageHistoryEntry {
    id: string
    lead_id: number
    stage_id: string | null
    stage_name: string | null
    user_id: string | null
    user_name: string | null
    amount: number | null
    duration_days: number
    created_at: string
}

interface StageHistoryTabProps {
    leadId: number | string
}

export function StageHistoryTab({ leadId }: StageHistoryTabProps) {
    const supabase = createClient()
    const [history, setHistory] = useState<StageHistoryEntry[]>([])
    const [loading, setLoading] = useState(true)

    const fetchHistory = useCallback(async () => {
        const { data, error } = await supabase
            .from("lead_stage_history")
            .select("*")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: false })

        if (error) {
            console.error("[StageHistoryTab] Fetch error:", error.message)
        } else {
            setHistory(data ?? [])
        }
        setLoading(false)
    }, [leadId])

    useEffect(() => {
        fetchHistory()
    }, [fetchHistory])

    const getInitials = (name: string | null) => {
        if (!name) return "?"
        return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }

    const formatCurrency = (amount: number | null) => {
        if (!amount) return "—"
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(amount)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading stage history...
            </div>
        )
    }

    if (history.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-sm text-muted-foreground">No stage transitions recorded yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Stage changes will be logged here automatically.</p>
            </div>
        )
    }

    return (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                    <tr>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide">Stage</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide">Amount</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide">Duration</th>
                        <th className="px-4 py-3 text-xs uppercase tracking-wide">Modified By</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {history.map((row) => (
                        <tr key={row.id} className="bg-white hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-900">
                                {row.stage_name || "Unknown Stage"}
                            </td>
                            <td className="px-4 py-3 text-slate-600 tabular-nums">
                                {formatCurrency(row.amount)}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                                {row.duration_days > 0 ? `${row.duration_days} Day${row.duration_days !== 1 ? 's' : ''}` : "—"}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-2 text-slate-500">
                                    <div className="h-5 w-5 rounded-full bg-slate-200 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {row.user_name ? getInitials(row.user_name) : <User className="h-3 w-3 text-slate-400" />}
                                    </div>
                                    <span className="text-xs">
                                        {new Date(row.created_at).toLocaleString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
