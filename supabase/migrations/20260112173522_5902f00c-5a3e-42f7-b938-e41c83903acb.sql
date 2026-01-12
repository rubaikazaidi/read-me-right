-- Drop existing SELECT policies on profiles table
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Librarians can view all profiles" ON public.profiles;

-- Create a single policy: Only librarians can view profiles
CREATE POLICY "Only librarians can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'librarian'::app_role));