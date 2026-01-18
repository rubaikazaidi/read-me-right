-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Librarians can view profile pictures" ON storage.objects;

-- Create new policy that restricts librarians to their organization's profile pictures
CREATE POLICY "Librarians can view profile pictures in their org"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-pictures' AND
  has_role(auth.uid(), 'librarian'::app_role) AND
  -- Extract user_id from folder path and verify same org
  (storage.foldername(name))[1]::uuid IN (
    SELECT id FROM public.profiles 
    WHERE organization_id = get_user_organization_id(auth.uid())
  )
);