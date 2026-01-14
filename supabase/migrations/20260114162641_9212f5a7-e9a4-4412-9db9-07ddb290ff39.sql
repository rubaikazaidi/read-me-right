
-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view organizations (for dropdown)
CREATE POLICY "Authenticated users can view organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (true);

-- Only librarians can create organizations
CREATE POLICY "Librarians can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'librarian'::app_role));

-- Add organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to books
ALTER TABLE public.books ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to borrowing_history
ALTER TABLE public.borrowing_history ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Add organization_id to book_requests
ALTER TABLE public.book_requests ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Drop existing RLS policies on books and recreate with organization filter
DROP POLICY IF EXISTS "Anyone can view books" ON public.books;
DROP POLICY IF EXISTS "Librarians can insert books" ON public.books;
DROP POLICY IF EXISTS "Librarians can update books" ON public.books;
DROP POLICY IF EXISTS "Librarians can delete books" ON public.books;

-- Books: users can only see books from their organization
CREATE POLICY "Users can view books in their organization"
ON public.books FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Librarians can insert books in their organization
CREATE POLICY "Librarians can insert books in their organization"
ON public.books FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Librarians can update books in their organization
CREATE POLICY "Librarians can update books in their organization"
ON public.books FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Librarians can delete books in their organization
CREATE POLICY "Librarians can delete books in their organization"
ON public.books FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Update borrowing_history policies for organization isolation
DROP POLICY IF EXISTS "Users can view own borrowing history" ON public.borrowing_history;
DROP POLICY IF EXISTS "Librarians can view all borrowing history" ON public.borrowing_history;
DROP POLICY IF EXISTS "Librarians can insert borrowing history" ON public.borrowing_history;

CREATE POLICY "Users can view own borrowing history in their org"
ON public.borrowing_history FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Librarians can view all borrowing history in their org"
ON public.borrowing_history FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Librarians can insert borrowing history in their org"
ON public.borrowing_history FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Update book_requests policies for organization isolation
DROP POLICY IF EXISTS "Users can view own requests" ON public.book_requests;
DROP POLICY IF EXISTS "Librarians can view all requests" ON public.book_requests;
DROP POLICY IF EXISTS "Students can create requests" ON public.book_requests;
DROP POLICY IF EXISTS "Librarians can update requests" ON public.book_requests;
DROP POLICY IF EXISTS "Librarians can delete requests" ON public.book_requests;

CREATE POLICY "Users can view own requests in their org"
ON public.book_requests FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Librarians can view all requests in their org"
ON public.book_requests FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Students can create requests in their org"
ON public.book_requests FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  has_role(auth.uid(), 'student'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Librarians can update requests in their org"
ON public.book_requests FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Librarians can delete requests in their org"
ON public.book_requests FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Update profiles policies to include organization context
DROP POLICY IF EXISTS "Only librarians can view profiles" ON public.profiles;

CREATE POLICY "Librarians can view profiles in their org"
ON public.profiles FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Allow profile inserts with organization_id
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Librarians can update any profile" ON public.profiles;

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Librarians can update profiles in their org"
ON public.profiles FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'librarian'::app_role) AND
  organization_id IN (
    SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Update handle_new_user function to NOT auto-insert profile (we'll do it after org selection)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only assign the role, profile will be created separately after org selection
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student'));
  
  RETURN NEW;
END;
$function$;
