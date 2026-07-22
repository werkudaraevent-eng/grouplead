-- ============================================================
-- TABLE: lead_tasks
-- Department Workflow Engine - Trello-style task tracking
-- ============================================================

-- 1. Create the lead_tasks table
CREATE TABLE public.lead_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  -- Link to parent lead
  lead_id bigint NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- Department & Assignment
  department text NOT NULL,           -- 'TEP', 'CREATIVE', 'FINANCE', 'LEGAL', 'PD', 'SO', 'ACS'
  assigned_to text,                   -- Name or user ID
  
  -- Task Details
  task_type text NOT NULL,            -- 'DRAFT_PROPOSAL', 'REVIEW_BUDGET', 'DESIGN_CONCEPT', 'ISSUE_INVOICE', etc.
  task_title text NOT NULL,           -- Human-readable title
  task_description text,              -- Optional details/instructions
  priority text DEFAULT 'MEDIUM',     -- 'LOW', 'MEDIUM', 'HIGH', 'URGENT'
  
  -- Status & Completion
  status text DEFAULT 'PENDING' NOT NULL, -- 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  completed_at timestamptz,           -- When the task was marked complete
  completed_by text,                  -- Who completed it
  
  -- Evidence
  evidence_file_url text,             -- Link to uploaded file/proof
  notes text                          -- Completion notes
);

-- 2. Enable RLS
ALTER TABLE public.lead_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public access to lead_tasks"
  ON public.lead_tasks FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3. Create index for fast lookups
CREATE INDEX idx_lead_tasks_lead_id ON public.lead_tasks(lead_id);
CREATE INDEX idx_lead_tasks_department ON public.lead_tasks(department);
CREATE INDEX idx_lead_tasks_status ON public.lead_tasks(status);

-- ============================================================
-- TRIGGER: Auto-sync SLA timestamps to parent leads table
-- When a task is completed, update the corresponding SLA column
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_sync_task_to_lead_sla()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes to 'COMPLETED'
  IF NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    -- Set completed_at if not manually set
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;

    -- Map task_type to the correct SLA column on the leads table
    CASE NEW.task_type
      WHEN 'ACKNOWLEDGE_LEAD' THEN
        UPDATE public.leads SET date_lead_received = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'TEP_TO_PD' THEN
        UPDATE public.leads SET sla_tep_to_pd = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'PD_TO_SO' THEN
        UPDATE public.leads SET sla_pd_to_so = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'SO_TO_PD' THEN
        UPDATE public.leads SET sla_so_to_pd = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'PD_TO_TEP' THEN
        UPDATE public.leads SET sla_pd_to_tep = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'PD_TO_ACS' THEN
        UPDATE public.leads SET sla_pd_to_acs = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'ACS_TO_PD' THEN
        UPDATE public.leads SET sla_acs_to_pd = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'DRAFT_QUOTATION' THEN
        UPDATE public.leads SET sla_quo_to_tep = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'DRAFT_PROPOSAL' THEN
        UPDATE public.leads SET sla_pro_to_tep = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'SEND_QUOTATION_CLIENT' THEN
        UPDATE public.leads SET sla_quo_send_client = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'SEND_PROPOSAL_CLIENT' THEN
        UPDATE public.leads SET sla_pro_send_client = NEW.completed_at, updated_at = NOW() WHERE id = NEW.lead_id;
      
      WHEN 'SEND_DOCUMENT' THEN
        UPDATE public.leads SET date_send_doc = NEW.completed_at::date, updated_at = NOW() WHERE id = NEW.lead_id;
      
      ELSE
        -- Unknown task_type: just update the lead's updated_at
        UPDATE public.leads SET updated_at = NOW() WHERE id = NEW.lead_id;
    END CASE;
  END IF;

  -- Always update the task's updated_at
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger
CREATE TRIGGER trg_sync_task_sla
  BEFORE UPDATE ON public.lead_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_sync_task_to_lead_sla();

-- Also fire on INSERT if task is created as already COMPLETED
CREATE TRIGGER trg_sync_task_sla_insert
  BEFORE INSERT ON public.lead_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'COMPLETED')
  EXECUTE FUNCTION public.fn_sync_task_to_lead_sla();


-- ============================================================
-- SEED: 5 Dummy Tasks linked to existing leads (IDs 1-10)
-- ============================================================

INSERT INTO public.lead_tasks (lead_id, department, assigned_to, task_type, task_title, task_description, priority, status) VALUES
-- Lead 1 (Pertamina - Lead Masuk): TEP needs to draft proposal
(1, 'TEP', 'Ahmad Fauzi', 'DRAFT_PROPOSAL', 
 'Draft Proposal: Pertamina Annual Safety Gathering', 
 'Create initial proposal deck for 350 pax event in Bali. Include venue options at Westin Nusa Dua.', 
 'HIGH', 'PENDING'),

-- Lead 3 (Telkomsel - Lead Masuk): Creative needs concept
(3, 'CREATIVE', 'Dian Prasetyo', 'DESIGN_CONCEPT', 
 'Creative Concept: Telkomsel Digital Innovation Summit', 
 'Hybrid format, 500 pax at ICE BSD. Client wants futuristic theme with digital art installations.', 
 'URGENT', 'IN_PROGRESS'),

-- Lead 4 (Unilever - Estimasi): Finance to review budget  
(4, 'FINANCE', 'Ratna Dewi', 'REVIEW_BUDGET', 
 'Budget Review: Unilever Skincare Launch', 
 'Validate cost breakdown for Rp1.2B event at Raffles Jakarta. Check vendor quotes.', 
 'HIGH', 'PENDING'),

-- Lead 5 (Gojek - Estimasi): PD needs to send to SO
(5, 'PD', 'Hendra Wijaya', 'PD_TO_SO', 
 'Handover to Sales Ops: Gojek Driver Day', 
 'Project Design complete. Forward specs and budget to SO for final validation.', 
 'MEDIUM', 'IN_PROGRESS'),

-- Lead 7 (BCA - Closed Won): Legal needs to send contract
(7, 'LEGAL', 'Sari Indah', 'SEND_DOCUMENT', 
 'Send SPK: BCA Prioritas Gala Dinner', 
 'Contract has been signed. Send final SPK document to client for records. Deposit already received.', 
 'LOW', 'PENDING');
