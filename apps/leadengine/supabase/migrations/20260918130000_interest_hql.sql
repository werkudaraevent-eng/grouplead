-- ============================================================
-- HQL as a level of interest.
--
-- LeadEngine classifies leads as HQL, Hot, Warm or Cold, and an
-- evaluation meeting reports that breakdown. Sales Activity's report
-- had three interest kinds plus "none"; a rep who judged a visit HQL
-- had no way to say so until the hand-off. This adds the kind and seeds
-- the choice for every tenant that already has interest choices (the
-- app only seeds a field that is wholly missing). The code and label
-- stay editable by the admin, as every choice is.
-- ============================================================

BEGIN;

ALTER TABLE sales_mission.report_choices DROP CONSTRAINT IF EXISTS report_choices_kind_check;
ALTER TABLE sales_mission.report_choices ADD CONSTRAINT report_choices_kind_check CHECK (
  (field_key = 'visit_outcome' AND kind IN ('met_decision_maker', 'met_staff', 'rescheduled', 'absent', 'cancelled')) OR
  (field_key = 'interest_level' AND kind IN ('hql', 'hot', 'warm', 'cold', 'none')) OR
  (field_key = 'next_action_type' AND kind IN ('action', 'none'))
);

INSERT INTO sales_mission.report_choices (company_id, field_key, code, label, kind, display_order)
SELECT DISTINCT company_id, 'interest_level', 'HQL', 'HQL', 'hql', 5
FROM sales_mission.report_choices
WHERE field_key = 'interest_level'
ON CONFLICT (company_id, field_key, code) DO NOTHING;

COMMIT;
