-- Add role_id FK to profiles for dynamic role assignment
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE SET NULL;

-- Backfill role_id from existing profiles.role text values
UPDATE profiles p
SET role_id = r.id
FROM roles r
WHERE p.role_id IS NULL
  AND (
    (p.role = 'super_admin' AND r.name = 'Super Admin') OR
    (p.role = 'admin'       AND r.name = 'Admin')       OR
    (p.role = 'executive'   AND r.name = 'Executive')   OR
    (p.role = 'leader'      AND r.name = 'Leader')      OR
    (p.role = 'staff'       AND r.name = 'Staff')
  );;
