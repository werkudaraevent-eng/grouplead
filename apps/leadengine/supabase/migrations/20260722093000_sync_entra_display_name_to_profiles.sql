-- Keep provider display name separate from email. New auth profiles use the
-- standard OIDC name claims when available and never use email as full_name.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  staff_role_id uuid;
  provider_display_name text;
BEGIN
  SELECT id INTO staff_role_id
  FROM public.roles
  WHERE name = 'Staff'
  LIMIT 1;

  provider_display_name := NULLIF(trim(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    concat_ws(' ',
      NULLIF(trim(NEW.raw_user_meta_data->>'given_name'), ''),
      NULLIF(trim(NEW.raw_user_meta_data->>'family_name'), '')
    )
  )), '');

  INSERT INTO public.profiles (id, email, full_name, role, role_id, department)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(provider_display_name, 'New User'),
    'staff',
    staff_role_id,
    'General'
  );

  RETURN NEW;
END;
$$;
