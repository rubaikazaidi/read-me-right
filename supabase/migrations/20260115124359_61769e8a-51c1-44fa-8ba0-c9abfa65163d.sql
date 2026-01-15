
-- Create a security definer function to get user's organization_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- Drop and recreate policies that cause recursion on profiles table
DROP POLICY IF EXISTS "Librarians can view profiles in their org" ON public.profiles;
DROP POLICY IF EXISTS "Librarians can update profiles in their org" ON public.profiles;

CREATE POLICY "Librarians can view profiles in their org" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can update profiles in their org" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Fix books table policies
DROP POLICY IF EXISTS "Users can view books in their organization" ON public.books;
DROP POLICY IF EXISTS "Librarians can insert books in their organization" ON public.books;
DROP POLICY IF EXISTS "Librarians can update books in their organization" ON public.books;
DROP POLICY IF EXISTS "Librarians can delete books in their organization" ON public.books;

CREATE POLICY "Users can view books in their organization" 
ON public.books 
FOR SELECT 
TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Librarians can insert books in their organization" 
ON public.books 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can update books in their organization" 
ON public.books 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can delete books in their organization" 
ON public.books 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Fix borrowing_history table policies
DROP POLICY IF EXISTS "Users can view own borrowing history in their org" ON public.borrowing_history;
DROP POLICY IF EXISTS "Librarians can view all borrowing history in their org" ON public.borrowing_history;
DROP POLICY IF EXISTS "Librarians can insert borrowing history in their org" ON public.borrowing_history;

CREATE POLICY "Users can view own borrowing history in their org" 
ON public.borrowing_history 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can view all borrowing history in their org" 
ON public.borrowing_history 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can insert borrowing history in their org" 
ON public.borrowing_history 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

-- Fix book_requests table policies
DROP POLICY IF EXISTS "Users can view own requests in their org" ON public.book_requests;
DROP POLICY IF EXISTS "Librarians can view all requests in their org" ON public.book_requests;
DROP POLICY IF EXISTS "Students can create requests in their org" ON public.book_requests;
DROP POLICY IF EXISTS "Librarians can update requests in their org" ON public.book_requests;
DROP POLICY IF EXISTS "Librarians can delete requests in their org" ON public.book_requests;

CREATE POLICY "Users can view own requests in their org" 
ON public.book_requests 
FOR SELECT 
TO authenticated
USING (
  auth.uid() = user_id 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can view all requests in their org" 
ON public.book_requests 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Students can create requests in their org" 
ON public.book_requests 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = user_id 
  AND has_role(auth.uid(), 'student'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can update requests in their org" 
ON public.book_requests 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);

CREATE POLICY "Librarians can delete requests in their org" 
ON public.book_requests 
FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) 
  AND organization_id = get_user_organization_id(auth.uid())
);
