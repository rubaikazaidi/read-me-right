-- Ensure borrowing_history is only accessible to authenticated users
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Librarians can insert borrowing history" ON public.borrowing_history;
DROP POLICY IF EXISTS "Librarians can view all borrowing history" ON public.borrowing_history;
DROP POLICY IF EXISTS "Users can view own borrowing history" ON public.borrowing_history;

-- Recreate with explicit TO authenticated clause
CREATE POLICY "Librarians can insert borrowing history"
ON public.borrowing_history
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Librarians can view all borrowing history"
ON public.borrowing_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'librarian'::app_role));

CREATE POLICY "Users can view own borrowing history"
ON public.borrowing_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);