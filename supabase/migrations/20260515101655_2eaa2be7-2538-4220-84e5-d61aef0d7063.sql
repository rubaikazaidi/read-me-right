ALTER TABLE public.books ADD COLUMN IF NOT EXISTS dewey_decimal text;

UPDATE public.books SET dewey_decimal = CASE
  WHEN category = 'Fiction' THEN '813'
  WHEN category = 'Non-Fiction' THEN '081'
  WHEN category = 'Science' THEN '500'
  WHEN category = 'History' THEN '900'
  WHEN category = 'Biography' THEN '920'
  WHEN category = 'Technology' THEN '600'
  WHEN category = 'Textbooks' THEN '370'
  ELSE '000'
END
WHERE dewey_decimal IS NULL;