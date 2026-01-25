-- Add copy_number column to books table to track multiple copies of the same ISBN
ALTER TABLE public.books ADD COLUMN copy_number integer NOT NULL DEFAULT 1;

-- Add an index for faster ISBN lookups within an organization
CREATE INDEX idx_books_isbn_org ON public.books (isbn, organization_id);