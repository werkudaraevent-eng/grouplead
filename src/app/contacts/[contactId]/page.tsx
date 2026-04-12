import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ContactDetailPage } from "@/features/contacts/components/contact-detail-page"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function ContactPage({ params }: { params: Promise<{ contactId: string }> }) {
    const { contactId } = await params
    const supabase = await createClient()

    const { data: contact, error } = await supabase
        .from('contacts')
        .select(`
            *,
            client_company:client_company_id(id, name),
            owner:profiles!contacts_owner_id_fkey(id, full_name, email)
        `)
        .eq('id', contactId)
        .single()

    if (error || !contact) return notFound()

    // Fetch lead stats in parallel (leads where this contact's company is involved... wait, no, leads explicitly linked to this contact?)
    // Our DB schema: contacts don't directly own leads. Leads belong to client_company.
    // If the contact has a company, we show leads for that company.
    const [leadsRes, latestActivityRes, nextRes, prevRes] = await Promise.all([
        supabase
            .from('leads')
            .select('id, project_name, estimated_value, status, pipeline_stage:pipeline_stages!pipeline_stage_id(name, color), pic_sales_profile:profiles!pic_sales_id(full_name), target_close_date')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false }),
        supabase
            .from('contact_activities')
            .select('created_at, profile:profiles!contact_activities_user_id_fkey(full_name)')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase.from('contacts').select('id').gt('full_name', contact.full_name).order('full_name', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('contacts').select('id').lt('full_name', contact.full_name).order('full_name', { ascending: false }).limit(1).maybeSingle()
    ])

    const lastModified = latestActivityRes.data?.created_at || contact.updated_at || contact.created_at
    
    let lastModifiedBy = "System"
    if ((latestActivityRes.data as any)?.profile?.full_name) {
        lastModifiedBy = (latestActivityRes.data as any).profile.full_name
    } else if (contact.owner?.full_name) {
        lastModifiedBy = contact.owner.full_name
    }

    return (
        <ContactDetailPage
            contact={contact}
            leads={(leadsRes.data as any) ?? []}
            lastModified={lastModified}
            lastModifiedBy={lastModifiedBy}
            nextContactId={nextRes.data?.id}
            prevContactId={prevRes.data?.id}
        />
    )
}
