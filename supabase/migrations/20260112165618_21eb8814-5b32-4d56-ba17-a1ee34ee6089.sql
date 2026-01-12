-- Allow librarians to update any profile (for editing student details)
CREATE POLICY "Librarians can update any profile"
ON public.profiles
FOR UPDATE
USING (has_role(auth.uid(), 'librarian'::app_role))
WITH CHECK (has_role(auth.uid(), 'librarian'::app_role));