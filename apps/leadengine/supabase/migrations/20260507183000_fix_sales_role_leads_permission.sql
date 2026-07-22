-- Fix: Sales role should be able to create and update leads
-- Sales users need create + update + read(company) on leads module
UPDATE role_permissions
SET can_create = true,
    can_update = true,
    can_read = 'company'
WHERE role_id = 'c4f03475-62ed-4b25-87b9-2f7e9a46c518'
  AND module_id = 'leads';
