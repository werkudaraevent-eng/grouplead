import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { CompanyDetailPage, type CompanyContact } from "@/features/companies/components/company-detail-page"
import type { RecordLead } from "@/components/shared/record-page"
import type { ActivityRow, NoteRow } from "@/lib/record-page"
import { readCompanyTab } from "@/features/companies/lib/company-record"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function CompanyPage({
    params,
    searchParams,
}: {
    params: Promise<{ companyId: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const [{ companyId }, query] = await Promise.all([params, searchParams])
    const supabase = await createClient()

    // `client_companies` is the CRM's customer organisation; `owner` is the
    // person who owns it (profiles, through owner_id), never the tenant's
    // business unit (`companies`, through company_id).
    const { data: company, error } = await supabase
        .from('client_companies')
        .select(`
            *,
            parent:parent_id(id, name, industry, line_industry, city, area),
            owner:profiles!client_companies_owner_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq('id', companyId)
        .single()

    if (error || !company) return notFound()

    // What sits in the Recycle Bin is not the company's any more, even to an
    // admin who can read it.
    const [leadsRes, contactsRes, activitiesRes, notesRes, filesRes, nextRes, prevRes, childrenRes] = await Promise.all([
        supabase
            .from('leads')
            .select('id, project_name, estimated_value, status, pipeline_stage:pipeline_stages!pipeline_stage_id(name, color, stage_type, closed_status), pic_sales_profile:profiles!pic_sales_id(full_name), target_close_date')
            .eq('client_company_id', companyId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false }),
        supabase
            .from('contacts')
            .select('id, salutation, full_name, job_title, email, phone')
            .eq('client_company_id', companyId)
            .is('deleted_at', null)
            .order('full_name'),
        // The timeline and the notes, read here so the Overview's facts,
        // Recent activity and the Activity tab draw from one feed on first
        // paint; every write refreshes the page.
        supabase
            .from('company_activities')
            .select('*, profile:profiles!company_activities_user_id_fkey(full_name, avatar_url)')
            .eq('client_company_id', companyId)
            .order('created_at', { ascending: false }),
        supabase
            .from('company_notes')
            .select('id, content, author_name, user_id, created_at')
            .eq('client_company_id', companyId)
            .order('created_at', { ascending: false }),
        supabase
            .from('company_attachments')
            .select('id', { count: 'exact', head: true })
            .eq('client_company_id', companyId),
        supabase.from('client_companies').select('id').gt('name', company.name).is('deleted_at', null).order('name', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('client_companies').select('id').lt('name', company.name).is('deleted_at', null).order('name', { ascending: false }).limit(1).maybeSingle(),
        // Subsidiaries: companies whose parent_id points at this company.
        supabase
            .from('client_companies')
            .select('id, name, industry, line_industry, city, area')
            .eq('parent_id', companyId)
            .is('deleted_at', null)
            .order('name', { ascending: true }),
    ])

    const activities = (activitiesRes.data as unknown as ActivityRow[] | null) ?? []
    const latest = activities[0] ?? null
    const lastModified = latest?.created_at || company.updated_at || company.created_at
    const lastModifiedBy = latest?.profile?.full_name || company.owner?.full_name || "System"

    return (
        <CompanyDetailPage
            company={company}
            leads={(leadsRes.data as unknown as RecordLead[] | null) ?? []}
            contacts={(contactsRes.data as CompanyContact[] | null) ?? []}
            activities={activities}
            notes={(notesRes.data as NoteRow[] | null) ?? []}
            fileCount={filesRes.count ?? null}
            subsidiaries={(childrenRes.data as { id: string; name: string }[] | null) ?? []}
            lastModified={lastModified}
            lastModifiedBy={lastModifiedBy}
            nextCompanyId={nextRes.data?.id}
            prevCompanyId={prevRes.data?.id}
            initialTab={readCompanyTab(query.tab)}
        />
    )
}
