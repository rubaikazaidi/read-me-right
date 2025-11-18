-- Add cover_image_url column to books table
ALTER TABLE public.books ADD COLUMN cover_image_url text;

-- Create storage bucket for book covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('book-covers', 'book-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for book covers
CREATE POLICY "Book covers are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'book-covers');

CREATE POLICY "Librarians can upload book covers"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'book-covers' AND has_role(auth.uid(), 'librarian'));

CREATE POLICY "Librarians can update book covers"
ON storage.objects FOR UPDATE
USING (bucket_id = 'book-covers' AND has_role(auth.uid(), 'librarian'));

CREATE POLICY "Librarians can delete book covers"
ON storage.objects FOR DELETE
USING (bucket_id = 'book-covers' AND has_role(auth.uid(), 'librarian'));