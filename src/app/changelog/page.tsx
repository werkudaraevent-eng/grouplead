"use client"

import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { usePermissions } from "@/contexts/permissions-context"
import { CHANGELOG, CHANGE_TYPE_META } from "@/features/changelog/changelog-data"
import { Sparkles, ShieldAlert, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

function formatDate(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

export default function ChangelogPage() {
    const router = useRouter()
    const { can, loading } = usePermissions()

    // Admin-gated: only users who can read Settings (admins) see the changelog.
    const allowed = can("settings", "read")

    const entries = useMemo(() => CHANGELOG, [])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[60vh] text-slate-400 text-sm">
                Loading…
            </div>
        )
    }

    if (!allowed) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
                    <ShieldAlert className="w-6 h-6 text-red-500" />
                </div>
                <h2 className="text-[15px] font-semibold text-slate-800">Access restricted</h2>
                <p className="text-[13px] text-slate-500 mt-1 max-w-sm">
                    The changelog is available to administrators only.
                </p>
                <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={() => router.push("/")}>
                    <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
                </Button>
            </div>
        )
    }

    return (
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
            {/* Header */}
            <div className="flex items-start gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                    <h1 className="text-[22px] font-bold text-slate-900 tracking-tight leading-tight">
                        Apa yang baru
                    </h1>
                    <p className="text-[13px] text-slate-500 mt-0.5">
                        Daftar pembaruan dan perbaikan terbaru pada aplikasi.
                    </p>
                </div>
            </div>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />

                <div className="space-y-10">
                    {entries.map((entry) => (
                        <section key={entry.date} className="relative pl-8">
                            {/* Timeline dot */}
                            <span
                                className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full border-2 border-white bg-blue-500 shadow-sm ring-1 ring-blue-100"
                                aria-hidden
                            />

                            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mb-3">
                                <h2 className="text-[15px] font-semibold text-slate-900">{entry.title}</h2>
                                <time className="text-[12px] font-medium text-slate-400" dateTime={entry.date}>
                                    {formatDate(entry.date)}
                                </time>
                            </div>

                            <ul className="space-y-2.5">
                                {entry.items.map((item, idx) => {
                                    const meta = CHANGE_TYPE_META[item.type]
                                    return (
                                        <li
                                            key={idx}
                                            className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                                        >
                                            <span
                                                className={`mt-0.5 shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className}`}
                                            >
                                                <span aria-hidden>{meta.emoji}</span>
                                                {meta.label}
                                            </span>
                                            <p className="text-[13px] text-slate-700 leading-relaxed min-w-0">
                                                {item.text}
                                            </p>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <p className="mt-10 pt-5 border-t border-slate-100 text-[11px] text-slate-400 text-center">
                Pembaruan dicatat sejak {formatDate(entries[entries.length - 1]?.date ?? "")}.
            </p>
        </div>
    )
}
