-- ============================================================
-- MIGRATION: Multi-Company Support
-- Transforms LeadEngine from single-tenant to multi-tenant
-- ============================================================

-- Use a DO block to store the default company UUID for backfilling
DO $$
DECLARE
  default_company_id uuid;
BEGIN

  -- ========================================================
  -- STEP 1: Create companies table
  -- ========================================================
  CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    is_holding boolean DEFAULT false NOT NULL,
    logo_url text
  );

  -- Insert default Werkudara Group holding company
  INSERT INTO public.companies (name, slug, is_holding)
  VALUES ('Werkudara Group', 'werkudara-group', true)
  RETURNING id INTO default_company_id;

  -- ========================================================
  -- STEP 2: Create company_members table
  -- ========================================================
  CREATE TABLE public.company_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_type text NOT NULL DEFAULT 'staff'
      CHECK (user_type IN ('staff', 'leader', 'executive', 'admin', 'super_admin')),
    UNIQUE (company_id, user_id)
  );

  -- ========================================================
  -- STEP 3: Create role_permissions table
  -- ========================================================
  CREATE TABLE public.role_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_type text NOT NULL
      CHECK (user_type IN ('staff', 'leader', 'executive', 'admin', 'super_admin')),
    resource text NOT NULL,
    action text NOT NULL,
    is_allowed boolean DEFAULT false NOT NULL,
    UNIQUE (company_id, user_type, resource, action)
  );


  -- ========================================================
  -- STEP 4: Add company_id to leads (nullable first)
  -- ========================================================
  ALTER TABLE public.leads
    ADD COLUMN company_id uuid REFERENCES public.companies(id);

  -- Backfill all existing leads with the default company
  UPDATE public.leads SET company_id = default_company_id;

  -- Enforce NOT NULL after backfill
  ALTER TABLE public.leads ALTER COLUMN company_id SET NOT NULL;

  -- ========================================================
  -- STEP 5: Add company_id to lead_tasks (nullable first)
  -- ========================================================
  ALTER TABLE public.lead_tasks
    ADD COLUMN company_id uuid REFERENCES public.companies(id);

  -- Backfill all existing lead_tasks with the default company
  UPDATE public.lead_tasks SET company_id = default_company_id;

  -- Enforce NOT NULL after backfill
  ALTER TABLE public.lead_tasks ALTER COLUMN company_id SET NOT NULL;

  -- ========================================================
  -- STEP 6: Add company_id to master_options (nullable for global options)
  -- ========================================================
  ALTER TABLE public.master_options
    ADD COLUMN company_id uuid REFERENCES public.companies(id);

  -- Backfill existing master_options with the default company
  UPDATE public.master_options SET company_id = default_company_id;

  -- NOTE: company_id stays nullable on master_options — NULL means global option

  -- ========================================================
  -- STEP 7: Create indexes
  -- ========================================================
  CREATE INDEX idx_companies_slug ON public.companies(slug);
  CREATE INDEX idx_company_members_user ON public.company_members(user_id);
  CREATE INDEX idx_company_members_company ON public.company_members(company_id);
  CREATE INDEX idx_role_permissions_lookup ON public.role_permissions(company_id, user_type);
  CREATE INDEX idx_leads_company ON public.leads(company_id);
  CREATE INDEX idx_lead_tasks_company ON public.lead_tasks(company_id);
  CREATE INDEX idx_master_options_company ON public.master_options(company_id);

END $$;

-- ============================================================
-- STEP 8: Migrate existing profiles to company_members
-- ============================================================
DO $$
DECLARE
  default_company_id uuid;
BEGIN
  -- Get the default company ID
  SELECT id INTO default_company_id FROM public.companies WHERE slug = 'werkudara-group';

  -- Insert company_members for all existing profiles with role mapping
  INSERT INTO public.company_members (company_id, user_id, user_type)
  SELECT
    default_company_id,
    p.id,
    CASE p.role
      WHEN 'super_admin' THEN 'super_admin'
      WHEN 'director'    THEN 'executive'
      WHEN 'bu_manager'  THEN 'leader'
      WHEN 'sales'       THEN 'staff'
      WHEN 'finance'     THEN 'staff'
      ELSE 'staff'
    END
  FROM public.profiles p
  ON CONFLICT (company_id, user_id) DO NOTHING;

  -- ============================================================
  -- STEP 9: Seed default role_permissions for Werkudara Group
  -- ============================================================
  INSERT INTO public.role_permissions (company_id, user_type, resource, action, is_allowed)
  VALUES
    -- staff: read only on leads, lead_tasks, master_options
    (default_company_id, 'staff', 'leads',          'read',   true),
    (default_company_id, 'staff', 'leads',          'create', false),
    (default_company_id, 'staff', 'leads',          'update', false),
    (default_company_id, 'staff', 'leads',          'delete', false),
    (default_company_id, 'staff', 'lead_tasks',     'read',   true),
    (default_company_id, 'staff', 'lead_tasks',     'create', false),
    (default_company_id, 'staff', 'lead_tasks',     'update', false),
    (default_company_id, 'staff', 'lead_tasks',     'delete', false),
    (default_company_id, 'staff', 'master_options', 'read',   true),
    (default_company_id, 'staff', 'master_options', 'create', false),
    (default_company_id, 'staff', 'master_options', 'update', false),
    (default_company_id, 'staff', 'master_options', 'delete', false),
    (default_company_id, 'staff', 'companies',      'read',   false),
    (default_company_id, 'staff', 'companies',      'create', false),
    (default_company_id, 'staff', 'companies',      'update', false),
    (default_company_id, 'staff', 'companies',      'delete', false),
    (default_company_id, 'staff', 'members',        'read',   false),
    (default_company_id, 'staff', 'members',        'create', false),
    (default_company_id, 'staff', 'members',        'update', false),
    (default_company_id, 'staff', 'members',        'delete', false),

    -- leader: read/create/update leads and tasks
    (default_company_id, 'leader', 'leads',          'read',   true),
    (default_company_id, 'leader', 'leads',          'create', true),
    (default_company_id, 'leader', 'leads',          'update', true),
    (default_company_id, 'leader', 'leads',          'delete', false),
    (default_company_id, 'leader', 'lead_tasks',     'read',   true),
    (default_company_id, 'leader', 'lead_tasks',     'create', true),
    (default_company_id, 'leader', 'lead_tasks',     'update', true),
    (default_company_id, 'leader', 'lead_tasks',     'delete', false),
    (default_company_id, 'leader', 'master_options', 'read',   true),
    (default_company_id, 'leader', 'master_options', 'create', false),
    (default_company_id, 'leader', 'master_options', 'update', false),
    (default_company_id, 'leader', 'master_options', 'delete', false),
    (default_company_id, 'leader', 'companies',      'read',   false),
    (default_company_id, 'leader', 'companies',      'create', false),
    (default_company_id, 'leader', 'companies',      'update', false),
    (default_company_id, 'leader', 'companies',      'delete', false),
    (default_company_id, 'leader', 'members',        'read',   false),
    (default_company_id, 'leader', 'members',        'create', false),
    (default_company_id, 'leader', 'members',        'update', false),
    (default_company_id, 'leader', 'members',        'delete', false),

    -- executive: full CRUD on leads and tasks
    (default_company_id, 'executive', 'leads',          'read',   true),
    (default_company_id, 'executive', 'leads',          'create', true),
    (default_company_id, 'executive', 'leads',          'update', true),
    (default_company_id, 'executive', 'leads',          'delete', true),
    (default_company_id, 'executive', 'lead_tasks',     'read',   true),
    (default_company_id, 'executive', 'lead_tasks',     'create', true),
    (default_company_id, 'executive', 'lead_tasks',     'update', true),
    (default_company_id, 'executive', 'lead_tasks',     'delete', true),
    (default_company_id, 'executive', 'master_options', 'read',   true),
    (default_company_id, 'executive', 'master_options', 'create', false),
    (default_company_id, 'executive', 'master_options', 'update', false),
    (default_company_id, 'executive', 'master_options', 'delete', false),
    (default_company_id, 'executive', 'companies',      'read',   true),
    (default_company_id, 'executive', 'companies',      'create', false),
    (default_company_id, 'executive', 'companies',      'update', false),
    (default_company_id, 'executive', 'companies',      'delete', false),
    (default_company_id, 'executive', 'members',        'read',   true),
    (default_company_id, 'executive', 'members',        'create', false),
    (default_company_id, 'executive', 'members',        'update', false),
    (default_company_id, 'executive', 'members',        'delete', false),

    -- admin: full CRUD on everything except company create/delete
    (default_company_id, 'admin', 'leads',          'read',   true),
    (default_company_id, 'admin', 'leads',          'create', true),
    (default_company_id, 'admin', 'leads',          'update', true),
    (default_company_id, 'admin', 'leads',          'delete', true),
    (default_company_id, 'admin', 'lead_tasks',     'read',   true),
    (default_company_id, 'admin', 'lead_tasks',     'create', true),
    (default_company_id, 'admin', 'lead_tasks',     'update', true),
    (default_company_id, 'admin', 'lead_tasks',     'delete', true),
    (default_company_id, 'admin', 'master_options', 'read',   true),
    (default_company_id, 'admin', 'master_options', 'create', true),
    (default_company_id, 'admin', 'master_options', 'update', true),
    (default_company_id, 'admin', 'master_options', 'delete', true),
    (default_company_id, 'admin', 'companies',      'read',   true),
    (default_company_id, 'admin', 'companies',      'create', false),
    (default_company_id, 'admin', 'companies',      'update', true),
    (default_company_id, 'admin', 'companies',      'delete', false),
    (default_company_id, 'admin', 'members',        'read',   true),
    (default_company_id, 'admin', 'members',        'create', true),
    (default_company_id, 'admin', 'members',        'update', true),
    (default_company_id, 'admin', 'members',        'delete', true),

    -- super_admin: full CRUD on everything
    (default_company_id, 'super_admin', 'leads',          'read',   true),
    (default_company_id, 'super_admin', 'leads',          'create', true),
    (default_company_id, 'super_admin', 'leads',          'update', true),
    (default_company_id, 'super_admin', 'leads',          'delete', true),
    (default_company_id, 'super_admin', 'lead_tasks',     'read',   true),
    (default_company_id, 'super_admin', 'lead_tasks',     'create', true),
    (default_company_id, 'super_admin', 'lead_tasks',     'update', true),
    (default_company_id, 'super_admin', 'lead_tasks',     'delete', true),
    (default_company_id, 'super_admin', 'master_options', 'read',   true),
    (default_company_id, 'super_admin', 'master_options', 'create', true),
    (default_company_id, 'super_admin', 'master_options', 'update', true),
    (default_company_id, 'super_admin', 'master_options', 'delete', true),
    (default_company_id, 'super_admin', 'companies',      'read',   true),
    (default_company_id, 'super_admin', 'companies',      'create', true),
    (default_company_id, 'super_admin', 'companies',      'update', true),
    (default_company_id, 'super_admin', 'companies',      'delete', true),
    (default_company_id, 'super_admin', 'members',        'read',   true),
    (default_company_id, 'super_admin', 'members',        'create', true),
    (default_company_id, 'super_admin', 'members',        'update', true),
    (default_company_id, 'super_admin', 'members',        'delete', true)
  ON CONFLICT (company_id, user_type, resource, action) DO NOTHING;

END $$;
