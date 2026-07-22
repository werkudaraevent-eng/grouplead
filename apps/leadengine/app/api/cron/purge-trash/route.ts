import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/utils/supabase/service"

export const dynamic = "force-dynamic"

/**
 * Scheduled purge of Recycle Bin items past the retention window.
 *
 * Triggered by Vercel Cron (see vercel.json). Runs fully server-side with the
 * service client — no admin needs to open the Recycle Bin for cleanup to
 * happen. Protected by CRON_SECRET: Vercel Cron sends
 * `Authorization: Bearer <CRON_SECRET>`. Requests without it are rejected.
 *
 * `app_settings.trash_retention_days = 0` means keep forever (no purge).
 */
const TABLES = ["leads", "client_companies", "contacts"] as const

export async function GET(request: NextRequest) {
    // Auth: allow only Vercel Cron (Bearer CRON_SECRET). If CRON_SECRET is
    // unset we refuse rather than run unauthenticated.
    const secret = process.env.CRON_SECRET
    const auth = request.headers.get("authorization")
    if (!secret || auth !== `Bearer ${secret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const supabase = createServiceClient()

        const { data: settings } = await supabase
            .from("app_settings")
            .select("trash_retention_days")
            .eq("id", 1)
            .maybeSingle()
        const days = settings?.trash_retention_days ?? 0
        if (!days || days <= 0) {
            return NextResponse.json({ ok: true, purged: 0, reason: "retention disabled" })
        }

        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
        let purged = 0
        const perTable: Record<string, number> = {}
        for (const table of TABLES) {
            const { data, error } = await supabase
                .from(table)
                .delete()
                .not("deleted_at", "is", null)
                .lt("deleted_at", cutoff)
                .select("id")
            if (error) {
                return NextResponse.json({ error: error.message, table }, { status: 500 })
            }
            const n = data?.length ?? 0
            perTable[table] = n
            purged += n
        }

        return NextResponse.json({ ok: true, purged, perTable, cutoff, days })
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Unknown error" },
            { status: 500 },
        )
    }
}
