DROP POLICY IF EXISTS "Allow authenticated read access on profiles" ON public.profiles;

CREATE POLICY "Allow authenticated read access on profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);;
