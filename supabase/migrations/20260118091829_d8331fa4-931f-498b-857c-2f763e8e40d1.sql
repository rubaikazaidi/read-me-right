-- Create a private storage bucket for profile pictures
-- This separates user photos from public book covers for privacy

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for profile-pictures bucket

-- Users can upload their own profile pictures
CREATE POLICY "Users can upload own profile picture"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own profile pictures
CREATE POLICY "Users can update own profile picture"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own profile pictures
CREATE POLICY "Users can delete own profile picture"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can view their own profile pictures
CREATE POLICY "Users can view own profile picture"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Librarians can view all profile pictures in their organization
CREATE POLICY "Librarians can view profile pictures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-pictures' AND
  has_role(auth.uid(), 'librarian'::app_role)
);