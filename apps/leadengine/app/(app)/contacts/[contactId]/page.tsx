import { createClient } from "@/utils/supabase/server"
import { notFound } from "next/navigation"
import { ContactDetailPage, type ContactCustomField } from "@/features/contacts/components/contact-detail-page"
import type { ContactLead } from "@/features/contacts/components/contact-leads-section"
import { readContactTab } from "@/features/contacts/lib/contact-record"

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export default async function ContactPage({
    params,
    searchParams,
}: {
    params: Promise<{ contactId: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const [{ contactId }, query] = await Promise.all([params, searchParams])
    const supabase = await createClient()

    // `owner` is the person who owns the contact (profiles, through
    // owner_id). The business unit is a different thing, `company_id` on
    // the tenant's own `companies`, read below; the client company is
    // `client_company_id` on `client_companies`.
    const { data: contact, error } = await supabase
        .from('contacts')
        .select(`
            *,
            client_company:client_company_id(id, name),
            owner:profiles!contacts_owner_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq('id', contactId)
        .single()

    if (error || !contact) return notFound()

    // Leads name a contact directly (leads.contact_id).
    const [leadsRes, latestActivityRes, nextRes, prevRes, unitRes, schemasRes] = await Promise.all([
        supabase
            .from('leads')
            .select('id, project_name, estimated_value, status, pipeline_stage:pipeline_stages!pipeline_stage_id(name, color, stage_type, closed_status), pic_sales_profile:profiles!pic_sales_id(full_name), target_close_date')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false }),
        supabase
            .from('contact_activities')
            .select('created_at, profile:profiles!contact_activities_user_id_fkey(full_name)')
            .eq('contact_id', contactId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        supabase.from('contacts').select('id').gt('full_name', contact.full_name).is('deleted_at', null).order('full_name', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('contacts').select('id').lt('full_name', contact.full_name).is('deleted_at', null).order('full_name', { ascending: false }).limit(1).maybeSingle(),
        // Its own read rather than an embed: a missing relation must never
        // take the page down with it.
        contact.company_id
            ? supabase.from('companies').select('id, name').eq('id', contact.company_id).maybeSingle()
            : Promise.resolve({ data: null }),
        // The fields an admin added to the contact form (Settings → Layout),
        // named at render time from their schema, never from the stored key.
        supabase
            .from('form_schemas')
            .select('field_key, field_name, field_type, sort_order')
            .eq('module_name', 'contacts')
            .eq('is_active', true)
            .order('sort_order'),
    ])

    const latest = latestActivityRes.data as { created_at: string; profile: { full_name: string | null } | null } | null
    const lastModified = latest?.created_at || contact.updated_at || contact.created_at
    const lastModifiedBy = latest?.profile?.full_name || contact.owner?.full_name || "System"

    return (
        <ContactDetailPage
            contact={contact}
            leads={(leadsRes.data as unknown as ContactLead[] | null) ?? []}
            lastModified={lastModified}
            lastModifiedBy={lastModifiedBy}
            nextContactId={nextRes.data?.id}
            prevContactId={prevRes.data?.id}
            businessUnit={(unitRes.data as { id: string; name: string } | null) ?? null}
            customFields={(schemasRes.data as ContactCustomField[] | null) ?? []}
            initialTab={readContactTab(query.tab)}
        />
    )
}
