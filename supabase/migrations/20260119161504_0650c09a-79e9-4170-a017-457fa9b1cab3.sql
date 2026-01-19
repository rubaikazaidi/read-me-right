-- Drop the restrictive policy that requires authentication
DROP POLICY IF EXISTS "Authenticated users can view organizations" ON public.organizations;

-- Create a new permissive policy that allows anyone to view organizations
-- This is needed for the signup flow where users must select an organization before authenticating
CREATE POLICY "Anyone can view organizations"
ON public.organizations
FOR SELECT
USING (true);