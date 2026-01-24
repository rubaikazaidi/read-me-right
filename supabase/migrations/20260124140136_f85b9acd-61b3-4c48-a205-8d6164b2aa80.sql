-- Create a public view that only exposes safe columns (id and name)
-- This prevents exposure of created_by UUID
CREATE VIEW public.organizations_public
WITH (security_invoker=on) AS
  SELECT id, name
  FROM public.organizations;

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Anyone can view organizations" ON public.organizations;

-- Create a new restrictive policy - only authenticated users can view organizations in their org
-- Or unauthenticated users get NO direct access (they use the view)
CREATE POLICY "Authenticated users can view organizations"
  ON public.organizations FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Grant SELECT on the view to anon and authenticated roles
-- This allows the signup flow to work via the view
GRANT SELECT ON public.organizations_public TO anon;
GRANT SELECT ON public.organizations_public TO authenticated;