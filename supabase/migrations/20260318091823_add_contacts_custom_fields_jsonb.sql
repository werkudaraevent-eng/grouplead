ALTER TABLE public.contacts
  ADD COLUMN custom_fields jsonb DEFAULT '{}'::jsonb;;
