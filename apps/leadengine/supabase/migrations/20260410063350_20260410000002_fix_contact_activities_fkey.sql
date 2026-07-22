ALTER TABLE public.contact_activities DROP CONSTRAINT contact_activities_user_id_fkey;
ALTER TABLE public.contact_activities ADD CONSTRAINT contact_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';;
