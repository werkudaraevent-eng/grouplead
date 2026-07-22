-- The active auth trigger explicitly hardcoded role = 'sales', so changing the
-- column default alone did not affect Microsoft/SSO-created profiles.
-- New identities are Staff until an administrator provisions another role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_role_id uuid;
BEGIN
  SELECT id INTO staff_role_id
  FROM public.roles
  WHERE name = 'Staff'
  LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, role, role_id, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
    'staff',
    staff_role_id,
    'General'
  );

  RETURN NEW;
END;
$$;

-- Correct currently unprovisioned profiles created by the old trigger.
UPDATE public.profiles AS p
SET role = 'staff',
    role_id = staff.id
FROM public.roles AS staff
WHERE staff.name = 'Staff'
  AND p.role = 'sales'
  AND p.role_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_members AS cm
    WHERE cm.user_id = p.id
  );
