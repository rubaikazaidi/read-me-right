ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS is_damaged boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS damage_notes text;