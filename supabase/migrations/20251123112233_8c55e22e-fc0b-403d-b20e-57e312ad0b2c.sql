-- Add borrowed_at timestamp to books table to track when a book was borrowed
ALTER TABLE public.books
ADD COLUMN borrowed_at TIMESTAMP WITH TIME ZONE;