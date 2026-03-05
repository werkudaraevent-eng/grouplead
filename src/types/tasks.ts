export interface LeadTask {
    id: string
    created_at: string
    updated_at: string
    company_id: string

    lead_id: number
    department: string
    assigned_to: string | null

    task_type: string
    task_title: string
    task_description: string | null
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
    completed_at: string | null
    completed_by: string | null

    evidence_file_url: string | null
    notes: string | null

    // Joined from leads table (when using select with join)
    leads?: {
        company_name: string | null
        project_name: string | null
        manual_id: number | null
        status: string | null
        estimated_revenue: number | null
        pic_sales: string | null
    }
}

export const DEPARTMENTS = ['TEP', 'CREATIVE', 'FINANCE', 'LEGAL', 'PD', 'SO', 'ACS'] as const
export type Department = typeof DEPARTMENTS[number]

export const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    'PENDING': { label: 'Pending', color: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
    'IN_PROGRESS': { label: 'In Progress', color: 'bg-blue-500/15 text-blue-700 border-blue-500/30' },
    'COMPLETED': { label: 'Completed', color: 'bg-green-500/15 text-green-700 border-green-500/30' },
    'CANCELLED': { label: 'Cancelled', color: 'bg-neutral-500/15 text-neutral-500 border-neutral-500/30' },
}

export const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
    'LOW': { label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-300' },
    'MEDIUM': { label: 'Medium', color: 'bg-sky-100 text-sky-700 border-sky-300' },
    'HIGH': { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
    'URGENT': { label: 'Urgent', color: 'bg-red-100 text-red-700 border-red-300' },
}

export const DEPARTMENT_CONFIG: Record<string, { label: string; color: string }> = {
    'TEP': { label: 'TEP', color: 'bg-violet-100 text-violet-700' },
    'CREATIVE': { label: 'Creative', color: 'bg-pink-100 text-pink-700' },
    'FINANCE': { label: 'Finance', color: 'bg-emerald-100 text-emerald-700' },
    'LEGAL': { label: 'Legal', color: 'bg-amber-100 text-amber-700' },
    'PD': { label: 'PD', color: 'bg-cyan-100 text-cyan-700' },
    'SO': { label: 'SO', color: 'bg-indigo-100 text-indigo-700' },
    'ACS': { label: 'ACS', color: 'bg-teal-100 text-teal-700' },
}
