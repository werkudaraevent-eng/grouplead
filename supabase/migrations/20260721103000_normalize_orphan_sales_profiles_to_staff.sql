-- Microsoft/SSO-created profiles must not default to Sales when they have
-- not been provisioned into any tenant. Existing Sales users with an active
-- company membership remain unchanged.

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
