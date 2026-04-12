export * from './company'

export interface ClientCompany {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    phone: string | null;
    address: string | null;
    /** Structured address fields */
    area: string | null;
    street_address: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    parent_id: string | null;
    line_industry: string | null;
    owner_id: string | null;
    created_at: string;
    custom_data?: any;
    parent?: { id: string; name: string } | null;
}

export interface Contact {
    id: string;
    client_company_id: string | null;
    salutation: string | null;
    full_name: string;
    email: string | null;
    phone: string | null;
    job_title: string | null;
    created_at: string;
    secondary_email: string | null;
    secondary_phone: string | null;
    secondary_emails: string[] | null;
    secondary_phones: string[] | null;
    linkedin_url: string | null;
    notes: string | null;
    owner_id: string | null;
    date_of_birth: string | null;
    address: string | null;
    social_urls: { platform: string; url: string }[] | null;
}

export interface Pipeline {
    id: string;
    name: string;
    company_id: string;
    created_at: string;
    is_active: boolean;
    visibility: 'owner_only' | 'all_subs' | 'selected';
    icon: string;
    is_default?: boolean;
    company?: { name: string; is_holding?: boolean } | null;
}

export interface PipelineStage {
    id: string;
    name: string;
    color: string;
    sort_order: number;
    is_default: boolean;
    stage_type: 'open' | 'closed';
    closed_status?: 'won' | 'lost' | null;
    pipeline_id?: string;
    created_at: string;
}

export interface TransitionRule {
    id: string;
    pipeline_id: string;
    from_stage_id: string | null;
    to_stage_id: string;
    required_fields: string[];
    note_required: boolean;
    attachment_required: boolean;
    checklist: string[];
    created_at: string;
}

export interface ClosureRestriction {
    id: string;
    pipeline_id: string;
    closed_stage_id: string;
    allowed_from_stage_ids: string[];
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
    parent_value: string | null;
    metadata: Record<string, unknown> | null;
    sort_order: number;
}

export interface Lead {
    // Core Identity
    id: number;
    created_at: string;
    updated_at: string;
    company_id: string;
    client_company_id: string | null;
    contact_id: string | null;
    pipeline_stage_id: string | null;
    pipeline_id: string | null;
    pic_sales_id: string | null;
    account_manager_id: string | null;
    manual_id: number | null;

    // Joined relations
    company?: { id?: string; name: string } | null;
    client_company?: { id?: string; name: string } | null;
    contact?: { id?: string; salutation: string | null; full_name: string; email: string | null; phone: string | null } | null;
    pipeline_stage?: { id?: string; name: string; color: string } | null;
    pic_sales_profile?: { id?: string; full_name: string } | null;
    account_manager_profile?: { id?: string; full_name: string } | null;

    // Project & Classification
    category: string | null;
    project_name: string | null;
    main_stream: string | null;
    grade_lead: string | null;
    stream_type: string | null;
    business_purpose: string | null;
    tipe: string | null;
    nationality: string | null;
    sector: string | null;
    line_industry: string | null;
    area: string | null;
    lead_source: string | null;
    referral_source: string | null;

    // Event Details
    destinations: Array<{ city: string; venue?: string }> | null;
    pax_count: number | null;
    event_date_start: string | null;
    event_date_end: string | null;
    event_dates: string[] | null;
    event_format: string | null;
    virtual_platform: string | null;

    // Financials
    estimated_value: number | null;
    actual_value: number | null;
    kanban_sort_order?: number;
    target_close_date: string | null;

    // Description / Initial Inquiry
    description: string | null;

    // Status
    status: string | null;
    cancel_lost_reason: string | null;
    lost_reason: string | null;
    lost_reason_details: string | null;
    date_cancel_lost: string | null;
    month_cancel_lost: string | null;
    is_qualified: boolean | null;
    month_event: string | null;

    // Dynamic / Custom
    custom_data: Record<string, unknown> | null;

    // Notes / Text
    remark: string | null;
    general_brief: string | null;
    production_sow: string | null;
    special_remarks: string | null;
}

export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at'>;
export type LeadUpdate = Partial<LeadInsert>;

export interface Profile {
    id: string;
    email: string | null;
    full_name: string | null;
    role: string;
    role_id: string | null;
    department: string | null;
    phone: string | null;
    job_title: string | null;
    avatar_url: string | null;
    is_active: boolean;
    created_at: string;
    role_tier: number | null;
    reports_to: string | null;
    business_unit: string | null;
    manager?: { full_name: string } | null;
    company_memberships?: { company_id: string; user_type: string; company: { id: string; name: string } }[];
}

export interface SalesTarget {
    id: string;
    created_at: string;
    updated_at: string;
    profile_id: string;
    target_amount: number;
    period_start: string;
    period_end: string;
    period_type: 'monthly' | 'quarterly' | 'yearly';
}

export interface FormSchema {
    id: string
    created_at: string
    updated_at: string
    company_id: string | null
    module_name: string
    field_name: string
    field_key: string
    field_type: 'text' | 'number' | 'date' | 'dropdown'
    is_required: boolean
    options_category: string | null
    is_active: boolean
    sort_order: number
    parent_dependency: string | null
    tab_placement?: string | null
}
