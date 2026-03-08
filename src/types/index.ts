export * from './company'

export interface ClientCompany {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    created_at: string;
}

export interface Contact {
    id: string;
    client_company_id: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    job_title: string | null;
    created_at: string;
}

export interface PipelineStage {
    id: string;
    name: string;
    color: string;
    sort_order: number;
    is_default: boolean;
    created_at: string;
}

export interface MasterOption {
    id: number;
    created_at: string;
    option_type: 'category' | 'bu_revenue' | 'status' | string;
    label: string;
    value: string;
    is_active: boolean;
    company_id: string | null;
}

export interface Lead {
    // Group 1: Core Identity
    id: number;
    created_at: string;
    updated_at: string;
    company_id: string;
    client_company_id: string | null;
    contact_id: string | null;

    manual_id: number | null;
    category: string | null;
    bu_revenue: string | null;
    company_name: string | null;
    main_company: string | null;
    month_event: string | null;
    year_lead_receive: number | null;

    // Group 2: Event Specifics
    start_date: string | null; // ISO Date string
    date_of_event: string | null;
    project_name: string | null;
    grade_lead: string | null;
    main_stream: string | null;
    tipe_stream: string | null;
    business_purpose: string | null;
    tipe: string | null;
    number_of_pax: number | null;
    is_onsite: boolean | null;
    is_online: boolean | null;
    nationality: string | null;
    venue_hotel: string | null;
    location_city: string | null;

    // Group 3: Status & Operations
    status: string | null;
    cancel_lost_reason: string | null;
    date_cancel_lost: string | null;
    month_cancel_lost: string | null;
    account_manager: string | null;
    sector: string | null;
    line_industry: string | null;
    area: string | null;
    pic_sales: string | null;
    pic_so: string | null;
    is_qualified: boolean | null;
    source_lead: string | null;
    referral_source: string | null;

    // Group 4: Financials
    estimated_revenue: number | null;
    nominal_konfirmasi: number | null;
    materialized_amount: number | null;
    difference_amount: number | null;
    percentage_deal: number | null;

    // Group 5: SLA & Time Tracking
    month_receive_lead: string | null;
    date_lead_received: string | null;
    sla_tep_to_pd: string | null;
    sla_pd_to_so: string | null;
    sla_pd_to_acs: string | null;
    sla_so_to_pd: string | null;
    sla_pd_to_tep: string | null;
    sla_acs_to_pd: string | null;
    sla_quo_to_tep: string | null;
    sla_pro_to_tep: string | null;
    sla_quo_send_client: string | null;
    sla_pro_send_client: string | null;
    duration_inq_to_pd: string | null;
    duration_inq_to_client: string | null;

    // Group 6: Contact Person
    salutation: string | null;
    contact_full_name: string | null;
    contact_email: string | null;
    contact_mobile: string | null;
    job_title: string | null;
    date_of_birth: string | null;
    address: string | null;
    office_phone: string | null;
    destination: string | null;
    client_province_country: string | null;
    client_company_country: string | null;

    // Group 7: Historical & Logs
    remark: string | null;
    follow_up_1: string | null;
    follow_up_2: string | null;
    follow_up_3: string | null;
    follow_up_4: string | null;
    follow_up_5: string | null;
    sign_doc_type: string | null;
    date_send_doc: string | null;
    time_log: string | null;
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;
export type LeadUpdate = Partial<LeadInsert>;
