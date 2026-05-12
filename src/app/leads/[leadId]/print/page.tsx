import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { LeadPrintView } from "@/features/leads/components/lead-print-view"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function LeadPrintPage({ params }: { params: Promise<{ leadId: string }> }) {
    const { leadId } = await params
    const supabase = await createClient()

    const { data: lead, error } = await supabase
        .from('leads')
        .select(`
            *,
            company:companies!company_id(name),
            client_company:client_companies!client_company_id(id, name),
            contact:contacts!contact_id(id, salutation, full_name, email, phone),
            pipeline_stage:pipeline_stages!pipeline_stage_id(name, color),
            pic_sales_profile:profiles!pic_sales_id(full_name),
            account_manager_profile:profiles!account_manager_id(full_name),
            pipeline:pipelines!pipeline_id(name)
        `)
        .eq('id', leadId)
        .single()

    if (error || !lead) return notFound()

    // Load notes + activities in parallel for the printable view
    const [notesRes, activitiesRes, settingsRes] = await Promise.all([
        supabase
            .from('lead_notes')
            .select('id, content, author_name, created_at')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(30),
        supabase
            .from('lead_activities')
            .select('id, action_type, description, field_name, old_value, new_value, created_at, profile:profiles(full_name)')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: false })
            .limit(30),
        // Currency settings for formatting (scope it to the lead's company)
        lead.company_id
            ? supabase
                .from('company_settings')
                .select('currency_format, currency_prefix')
                .eq('company_id', lead.company_id)
                .maybeSingle()
            : Promise.resolve({ data: null }),
    ])

    type ActivityRow = {
        id: string
        action_type: string
        description: string | null
        field_name: string | null
        old_value: string | null
        new_value: string | null
        created_at: string
        profile?: { full_name: string | null } | null
    }

    const activities = ((activitiesRes.data ?? []) as unknown as ActivityRow[]).map(a => ({
        ...a,
        user_name: a.profile?.full_name ?? null,
    }))

    const currencySettings = settingsRes.data
        ? {
            currency_format: (settingsRes.data as { currency_format?: string }).currency_format ?? 'compact',
            currency_prefix: (settingsRes.data as { currency_prefix?: string }).currency_prefix ?? 'IDR',
          }
        : { currency_format: 'compact', currency_prefix: 'IDR' }

    return (
        <LeadPrintView
            lead={lead}
            notes={notesRes.data ?? []}
            activities={activities}
            currencySettings={currencySettings}
        />
    )
}
