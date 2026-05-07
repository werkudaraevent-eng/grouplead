-- Add bio field to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- ══════════════════════════════════════════════════════════════════════════════
-- AUDIT LOGS — tracks all user actions across the system
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT, -- denormalized for fast display
    action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'stage_change', 'import', 'export'
    resource_type TEXT NOT NULL, -- 'lead', 'contact', 'company', 'goal', 'pipeline', 'user', 'settings'
    resource_id TEXT, -- ID of the affected resource (nullable for bulk actions)
    resource_name TEXT, -- human-readable name (e.g. project name, company name)
    description TEXT NOT NULL, -- human-readable summary
    metadata JSONB DEFAULT '{}', -- additional context (old_value, new_value, etc.)
    ip_address TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);

-- RLS: all authenticated users can read (visibility controlled by app-level toggle)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view audit logs"
    ON audit_logs FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Service role can insert audit logs"
    ON audit_logs FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ══════════════════════════════════════════════════════════════════════════════
-- SYSTEM SETTINGS — app-wide toggles (audit visibility, etc.)
-- ══════════════════════════════════════════════════════════════════════════════
-- Using existing master_options table for this:
-- INSERT a default setting for audit visibility
INSERT INTO master_options (option_type, value, label, is_active, sort_order)
VALUES ('system_settings', 'all_users', 'audit_log_visibility', true, 1)
ON CONFLICT DO NOTHING;
