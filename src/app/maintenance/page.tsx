import { createClient } from "@/utils/supabase/server"
import { Wrench } from "lucide-react"

export const dynamic = "force-dynamic"

const DEFAULT_MESSAGE =
    "LeadEngine is undergoing maintenance. We'll be back shortly. Thank you for your patience."

export default async function MaintenancePage() {
    let message = DEFAULT_MESSAGE
    try {
        const supabase = await createClient()
        const { data } = await supabase
            .from("app_settings")
            .select("maintenance_message")
            .eq("id", 1)
            .maybeSingle()
        if (data?.maintenance_message && data.maintenance_message.trim()) {
            message = data.maintenance_message.trim()
        }
    } catch {
        // Fall back to the default copy.
    }

    return (
        <main className="min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] px-6">
            <div className="w-full max-w-md rounded-2xl bg-white/95 backdrop-blur p-8 text-center shadow-xl">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50">
                    <Wrench className="h-7 w-7 text-blue-700" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900">
                    Under maintenance
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 whitespace-pre-line">
                    {message}
                </p>
                <p className="mt-6 text-xs text-slate-400">
                    Werkudara Group · LeadEngine
                </p>
            </div>
        </main>
    )
}
