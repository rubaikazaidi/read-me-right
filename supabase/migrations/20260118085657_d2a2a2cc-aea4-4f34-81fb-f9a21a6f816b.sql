-- Drop existing policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Librarians can view profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Librarians can update profiles in their org" ON public.profiles;

-- Recreate policies with stricter controls:

-- 1. Users can only view their own profile (no cross-org access possible since they can only see their own row)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- 2. Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 3. Users can update their own profile BUT cannot change organization_id
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id 
  AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 4. Librarians can view profiles ONLY in their organization
CREATE POLICY "Librarians can view profiles in their org"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- 5. Librarians can update profiles in their org BUT cannot change organization_id to move users out
CREATE POLICY "Librarians can update profiles in their org"
ON public.profiles
FOR UPDATE
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);