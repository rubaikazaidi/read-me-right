-- Drop existing restrictive SELECT policies on borrowing_history
DROP POLICY IF EXISTS "Users can view own borrowing history" ON public.borrowing_history;
DROP POLICY IF EXISTS "Librarians can view all borrowing history" ON public.borrowing_history;

-- Create PERMISSIVE policies so either condition allows access (OR logic)
-- Students can view their own borrowing history
CREATE POLICY "Users can view own borrowing history"
ON public.borrowing_history
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Librarians can view all borrowing history
CREATE POLICY "Librarians can view all borrowing history"
ON public.borrowing_history
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'librarian'::app_role));