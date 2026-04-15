
-- Allow super_admin and admin users to read ALL company_members rows
-- This is required for the User Management page to display company data for all users
CREATE POLICY "Admins can view all memberships" ON company_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Also allow admin INSERT on company_members (for assigning users to companies)
CREATE POLICY "Admins can insert memberships" ON company_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow admin UPDATE on company_members
CREATE POLICY "Admins can update memberships" ON company_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );

-- Allow admin DELETE on company_members  
CREATE POLICY "Admins can delete memberships" ON company_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin')
    )
  );
;
