-- Drop the old constraint that references auth.users
ALTER TABLE public.book_requests
DROP CONSTRAINT book_requests_user_id_fkey;

-- Add new constraint that references public.profiles
ALTER TABLE public.book_requests
ADD CONSTRAINT book_requests_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;