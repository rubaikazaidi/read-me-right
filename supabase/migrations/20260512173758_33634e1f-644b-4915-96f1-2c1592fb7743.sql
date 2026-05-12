
DROP VIEW IF EXISTS public.organizations_public;

CREATE OR REPLACE FUNCTION public.list_public_organizations()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT id, name FROM public.organizations ORDER BY name;
$$;

-- Allow anonymous (signup) and authenticated users to read org names
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;

CREATE POLICY "Anyone can view organization names"
ON public.organizations
FOR SELECT
TO anon, authenticated
USING (true);

-- Recreate the public view with security_invoker so RLS applies normally
CREATE VIEW public.organizations_public
WITH (security_invoker = on) AS
SELECT id, name FROM public.organizations;

GRANT SELECT ON public.organizations_public TO anon, authenticated;
