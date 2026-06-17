ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS classification_number text,
  ADD COLUMN IF NOT EXISTS vendor_bill text,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS page_count integer,
  ADD COLUMN IF NOT EXISTS publisher text;