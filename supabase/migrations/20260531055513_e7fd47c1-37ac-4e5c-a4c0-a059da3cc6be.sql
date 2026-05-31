
DROP POLICY IF EXISTS "gp update own" ON public.guest_passes;
CREATE POLICY "gp update own" ON public.guest_passes FOR UPDATE TO authenticated
  USING (house_id = public.current_house_id() OR public.has_role(auth.uid(),'guard') OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (true);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_house_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_house_id() TO authenticated, service_role;
