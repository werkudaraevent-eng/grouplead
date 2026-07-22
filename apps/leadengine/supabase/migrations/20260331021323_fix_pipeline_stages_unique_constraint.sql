
-- Drop the global name uniqueness (stages should be unique per pipeline, not globally)
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_name_key;

-- Add composite unique: name must be unique within a pipeline
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stages_name_pipeline_key UNIQUE (name, pipeline_id);
;
