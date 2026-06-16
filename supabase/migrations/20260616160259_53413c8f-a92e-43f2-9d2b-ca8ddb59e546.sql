ALTER TABLE public.books 
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS back_cover_image_url text;