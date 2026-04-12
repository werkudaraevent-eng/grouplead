import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { LeadDetailPage } from "@/features/leads/components/lead-detail-page"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function LeadPage({ params }: { params: Promise<{ leadId: string }> }) {
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

    // ─── Adjacent Lead Navigation (Parallel Fetching) ───
    let prevLeadId: number | null = null
    let nextLeadId: number | null = null

    const adjacentQueries: Promise<any>[] = []

    if (lead.pipeline_id) {
        adjacentQueries.push(
            supabase
                .from('leads')
                .select('id')
                .eq('pipeline_id', lead.pipeline_id)
                .or(`created_at.lt.${lead.created_at},and(created_at.eq.${lead.created_at},id.lt.${lead.id})`)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .limit(1)
                .maybeSingle() as unknown as Promise<any>
        )
        
        adjacentQueries.push(
            supabase
                .from('leads')
                .select('id')
                .eq('pipeline_id', lead.pipeline_id)
                .or(`created_at.gt.${lead.created_at},and(created_at.eq.${lead.created_at},id.gt.${lead.id})`)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true })
                .limit(1)
                .maybeSingle() as unknown as Promise<any>
        )
    }

    // Get the latest stage updater
    const latestStageQuery = supabase
        .from('lead_stage_history')
        .select('user_name, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    // Get the latest timeline activity
    const latestActivityQuery = supabase
        .from('lead_activities')
        .select('created_at, profile:profiles!lead_activities_profile_id_fkey(full_name)')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    const results = await Promise.all([...adjacentQueries, latestStageQuery, latestActivityQuery])
    
    // Parse results based on whether pipeline adjacent queries ran
    let latestStageRes;
    let latestActivityRes;
    if (lead.pipeline_id) {
        if (results[0].data) prevLeadId = results[0].data.id
        if (results[1].data) nextLeadId = results[1].data.id
        latestStageRes = results[2]
        latestActivityRes = results[3]
    } else {
        latestStageRes = results[0]
        latestActivityRes = results[1]
    }

    // Determine the most recent modification point
    const stageDate = latestStageRes?.data?.created_at ? new Date(latestStageRes.data.created_at).getTime() : 0
    const activityDate = latestActivityRes?.data?.created_at ? new Date(latestActivityRes.data.created_at).getTime() : 0
    const updatedDate = lead.updated_at ? new Date(lead.updated_at).getTime() : 0

    let lastModifiedBy = "System"
    let lastModified = lead.updated_at || lead.created_at

    if (activityDate > stageDate && activityDate > updatedDate) {
        lastModified = latestActivityRes.data?.created_at
        lastModifiedBy = latestActivityRes.data?.profile?.full_name || "System"
    } else if (stageDate > activityDate && stageDate > updatedDate) {
        lastModified = latestStageRes.data?.created_at
        lastModifiedBy = latestStageRes.data?.user_name || "System"
    } else {
        // Fallback to PIC if inline edit was most recent
        if (lead.pic_sales_profile?.full_name) {
            lastModifiedBy = lead.pic_sales_profile.full_name
        } else if (lead.account_manager_profile?.full_name) {
            lastModifiedBy = lead.account_manager_profile.full_name
        }
    }

    return (
        <LeadDetailPage
            lead={lead}
            prevLeadId={prevLeadId}
            nextLeadId={nextLeadId}
            lastModifiedBy={lastModifiedBy}
            lastModified={lastModified}
        />
    )
}
