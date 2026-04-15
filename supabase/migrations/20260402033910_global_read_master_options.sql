
-- master_options is REFERENCE data (categories, lead sources, etc.)
-- It must be globally readable by all authenticated users regardless of company membership.
-- Write/update operations remain scoped by company ownership.

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "master_options_select_policy" ON master_options;

-- Create a global read policy for all authenticated users
CREATE POLICY "master_options_select_global" 
ON master_options FOR SELECT 
TO authenticated 
USING (true);

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
;
