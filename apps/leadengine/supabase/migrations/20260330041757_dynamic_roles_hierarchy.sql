-- 1. Create the roles table with self-referential hierarchy
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  parent_id   UUID REFERENCES roles(id) ON DELETE SET NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_system   BOOLEAN NOT NULL DEFAULT false
);

-- 2. Seed the five canonical system roles
INSERT INTO roles (name, description, sort_order, is_system) VALUES
  ('Super Admin', 'Full system access — immutable permissions',        1, true),
  ('Admin',       'Company-level administration',                      2, true),
  ('Executive',   'Strategic oversight and reporting',                 3, true),
  ('Leader',      'Team and department management',                    4, true),
  ('Staff',       'Standard operational access',                       5, true)
ON CONFLICT (name) DO NOTHING;

-- 3. Wire up the default hierarchy chain
UPDATE roles SET parent_id = (SELECT id FROM roles WHERE name = 'Super Admin') WHERE name = 'Admin';
UPDATE roles SET parent_id = (SELECT id FROM roles WHERE name = 'Admin')       WHERE name = 'Executive';
UPDATE roles SET parent_id = (SELECT id FROM roles WHERE name = 'Executive')   WHERE name = 'Leader';
UPDATE roles SET parent_id = (SELECT id FROM roles WHERE name = 'Leader')      WHERE name = 'Staff';

-- 4. Add role_id FK to role_permissions (backward-compatible)
ALTER TABLE role_permissions
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE CASCADE;

-- 5. Make user_type nullable so custom roles can be inserted without it
ALTER TABLE role_permissions ALTER COLUMN user_type DROP NOT NULL;

-- 6. Backfill role_id on existing rows from their user_type values
UPDATE role_permissions rp
SET role_id = r.id
FROM roles r
WHERE rp.role_id IS NULL
  AND (
    (rp.user_type = 'super_admin' AND r.name = 'Super Admin') OR
    (rp.user_type = 'admin'       AND r.name = 'Admin')       OR
    (rp.user_type = 'executive'   AND r.name = 'Executive')   OR
    (rp.user_type = 'leader'      AND r.name = 'Leader')      OR
    (rp.user_type = 'staff'       AND r.name = 'Staff')
  );

-- 7. RLS policies for the roles table
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_authenticated"
  ON roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "roles_insert_super_admin"
  ON roles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "roles_update_super_admin"
  ON roles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "roles_delete_super_admin"
  ON roles FOR DELETE
  TO authenticated
  USING (
    NOT is_system
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin')
  );;
