import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { CompanyDetailPage } from "@/features/companies/components/company-detail-page"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function CompanyPage({ params }: { params: Promise<{ companyId: string }> }) {
    const { companyId } = await params
    const supabase = await createClient()

    const { data: company, error } = await supabase
        .from('client_companies')
        .select(`
            *,
            parent:client_companies!parent_id(id, name),
            owner:profiles!client_companies_owner_id_fkey(id, full_name, email)
        `)
        .eq('id', companyId)
        .single()

    if (error || !company) return notFound()

    // Fetch lead stats in parallel
    const [leadsRes, contactCountRes, latestActivityRes, nextRes, prevRes] = await Promise.all([
        supabase
            .from('leads')
            .select('id, project_name, estimated_value, status, pipeline_stage:pipeline_stages!pipeline_stage_id(name, color), pic_sales_profile:profiles!pic_sales_id(full_name), target_close_date')
            .eq('client_company_id', companyId)
            .order('created_at', { ascending: false }),
        supabase
            .from('contacts')
            .select('id', { count: 'exact', head: true })
            .eq('client_company_id', companyId),
        supabase
            .from('company_activities')
            .select('created_at, profile:profiles!company_activities_user_id_fkey(full_name)')
            .eq('client_company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase.from('client_companies').select('id').gt('name', company.name).order('name', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('client_companies').select('id').lt('name', company.name).order('name', { ascending: false }).limit(1).maybeSingle()
    ])

    const lastModified = latestActivityRes.data?.created_at || company.updated_at || company.created_at
    
    let lastModifiedBy = "System"
    if ((latestActivityRes.data as any)?.profile?.full_name) {
        lastModifiedBy = (latestActivityRes.data as any).profile.full_name
    } else if (company.owner?.full_name) {
        lastModifiedBy = company.owner.full_name
    }

    return (
        <CompanyDetailPage
            company={company}
            leads={(leadsRes.data as any) ?? []}
            contactCount={contactCountRes.count ?? 0}
            lastModified={lastModified}
            lastModifiedBy={lastModifiedBy}
            nextCompanyId={nextRes.data?.id}
            prevCompanyId={prevRes.data?.id}
        />
    )
}

