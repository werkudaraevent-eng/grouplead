-- Backfill role_id for users with profiles.role = 'sales'
-- Sales users map to the 'Leader' role (create + read-company + update on leads)
UPDATE profiles
SET role_id = (SELECT id FROM roles WHERE name = 'Leader' LIMIT 1)
WHERE role = 'sales' AND role_id IS NULL;

-- Also ensure company_members entries for sales users have user_type = 'leader'
-- so the fallback permission lookup works correctly
UPDATE company_members cm
SET user_type = 'leader'
FROM profiles p
WHERE cm.user_id = p.id
  AND p.role = 'sales'
  AND cm.user_type = 'staff';
