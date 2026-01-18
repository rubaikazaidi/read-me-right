-- Fix: User Role Information Exposed to All Authenticated Users
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view roles" ON public.user_roles;

-- Users can only view their own role
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Librarians can view roles for users in their organization
CREATE POLICY "Librarians can view roles in their org"
ON public.user_roles
FOR SELECT
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  user_id IN (
    SELECT id FROM public.profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
);